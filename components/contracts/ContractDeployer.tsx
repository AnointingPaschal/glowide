"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useWalletStore } from "@/store/walletStore";
import { useEditorStore } from "@/store/editorStore";
import type { CompileOutput } from "@/lib/compiler";
import { Rocket, CheckCircle, XCircle, AlertTriangle, ExternalLink, Copy, Loader2, DollarSign } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import toast from "react-hot-toast";

interface EthProvider {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface DeployStep { id: string; label: string; status: "pending"|"running"|"done"|"error"; detail?: string; }

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(ARC_RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "RPC error");
  return data.result;
}

async function waitForReceipt(txHash: string, maxAttempts = 40): Promise<{ contractAddress: string; blockNumber: string; gasUsed: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]) as {
      contractAddress?: string; blockNumber?: string; gasUsed?: string; status?: string;
    } | null;
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("Transaction reverted on-chain");
      return {
        contractAddress: receipt.contractAddress ?? "",
        blockNumber: receipt.blockNumber ? parseInt(receipt.blockNumber, 16).toString() : "0",
        gasUsed: receipt.gasUsed ? parseInt(receipt.gasUsed, 16).toString() : "0",
      };
    }
  }
  throw new Error("Transaction not confirmed after 80s. Check ArcScan for status.");
}

export function ContractDeployer({ compiled }: { compiled: CompileOutput | null }) {
  const { address, isConnected, chainId } = useWalletStore();
  const { tabs, activeTabId } = useEditorStore();
  const [steps, setSteps] = useState<DeployStep[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [constructorArgs, setConstructorArgs] = useState("");
  const [deploymentFee, setDeploymentFee] = useState<string>("0");
  const [feeRecipient, setFeeRecipient] = useState<string>("");
  const [copiedAddr, setCopiedAddr] = useState(false);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Fetch deployment fee from admin settings
  useEffect(() => {
    fetch("/api/admin/public-settings")
      .then(r => r.json())
      .then(d => {
        if (d.deployment_fee) setDeploymentFee(d.deployment_fee);
        if (d.fee_recipient)  setFeeRecipient(d.fee_recipient);
      })
      .catch(() => {});
  }, []);

  const updateStep = (id: string, update: Partial<DeployStep>) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));

  const deploy = async () => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (!compiled?.abi || !compiled?.bytecode) { toast.error("Compile the contract first"); return; }

    const provider = (window as Window & { ethereum?: EthProvider }).ethereum;
    if (!provider) { toast.error("No wallet provider found"); return; }

    if (chainId !== 5042002) { toast.error("Switch to Arc Testnet first"); return; }

    setIsDeploying(true);
    setDeployedAddress(null);
    setTxHash(null);

    const initSteps: DeployStep[] = [
      { id: "fee",     label: "Processing deployment fee", status: parseFloat(deploymentFee) > 0 ? "pending" : "done", detail: parseFloat(deploymentFee) > 0 ? undefined : "No fee required" },
      { id: "prepare", label: "Preparing transaction",     status: "pending" },
      { id: "sign",    label: "Awaiting wallet signature", status: "pending" },
      { id: "confirm", label: "Confirming on Arc Testnet", status: "pending" },
      { id: "save",    label: "Saving to dashboard",       status: "pending" },
    ];
    setSteps(initSteps);

    try {
      // Step 1: Pay deployment fee if configured
      if (parseFloat(deploymentFee) > 0 && feeRecipient) {
        updateStep("fee", { status: "running", detail: `Sending ${deploymentFee} USDC fee…` });
        const feeWei = (parseFloat(deploymentFee) * 1e6).toString(16);
        const feeTx = await provider.request({
          method: "eth_sendTransaction",
          params: [{ from: address, to: feeRecipient, value: `0x${feeWei}` }],
        }) as string;
        await waitForReceipt(feeTx);
        updateStep("fee", { status: "done", detail: `Paid ${deploymentFee} USDC` });
      } else {
        updateStep("fee", { status: "done", detail: "Free deployment" });
      }

      // Step 2: Prepare calldata
      updateStep("prepare", { status: "running" });
      let deployData = compiled.bytecode!;
      if (constructorArgs.trim()) {
        try {
          const args = JSON.parse(constructorArgs);
          if (!Array.isArray(args)) throw new Error("Must be a JSON array");
          // Args are appended as raw hex if provided (simple types)
          // For production: use a full ABI encoder
          deployData = deployData + args.map((a: unknown) => {
            if (typeof a === "string" && a.startsWith("0x")) return a.slice(2).padStart(64, "0");
            if (typeof a === "number" || typeof a === "bigint") return BigInt(a).toString(16).padStart(64, "0");
            return String(a);
          }).join("");
        } catch (e) {
          throw new Error(`Constructor args invalid JSON array: ${(e as Error).message}`);
        }
      }

      // Estimate gas
      const gasEstimate = await rpc("eth_estimateGas", [{
        from: address, data: deployData,
      }]) as string;
      const gasLimit = `0x${Math.ceil(parseInt(gasEstimate, 16) * 1.2).toString(16)}`;
      updateStep("prepare", { status: "done", detail: `Gas: ${parseInt(gasEstimate, 16).toLocaleString()} (+ 20% buffer)` });

      // Step 3: Sign & send
      updateStep("sign", { status: "running" });
      const txHashResult = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, data: deployData, gas: gasLimit }],
      }) as string;
      setTxHash(txHashResult);
      updateStep("sign", { status: "done", detail: truncateAddress(txHashResult, 8) });

      // Step 4: Wait for receipt
      updateStep("confirm", { status: "running" });
      const receipt = await waitForReceipt(txHashResult);
      if (!receipt.contractAddress) throw new Error("No contract address in receipt");
      setDeployedAddress(receipt.contractAddress);
      updateStep("confirm", { status: "done", detail: `Block #${receipt.blockNumber} · Gas: ${parseInt(receipt.gasUsed).toLocaleString()}` });

      // Step 5: Save to Supabase
      updateStep("save", { status: "running" });
      await fetch("/api/contracts/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: receipt.contractAddress,
          txHash: txHashResult,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          abi: compiled.abi,
          bytecode: compiled.bytecode,
          sourceCode: activeTab?.content ?? "",
          contractName: compiled.contractName ?? activeTab?.name?.replace(".sol", "") ?? "Contract",
          deployer: address,
        }),
      });
      updateStep("save", { status: "done" });

      toast.success("Contract deployed successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSteps(prev => {
        const running = prev.find(s => s.status === "running");
        if (!running) return prev;
        return prev.map(s => s.id === running.id ? { ...s, status: "error", detail: msg.slice(0, 100) } : s);
      });
      toast.error(msg.slice(0, 80));
    } finally {
      setIsDeploying(false);
    }
  };

  const hasFee = parseFloat(deploymentFee) > 0;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <Rocket className="w-4 h-4 text-glow-accent" />
        <h3 className="text-sm font-semibold text-glow-text">Deploy Contract</h3>
        <Badge variant={isConnected ? "success" : "warning"} className="ml-auto text-xs">
          {isConnected ? truncateAddress(address!) : "Not connected"}
        </Badge>
      </div>

      {/* Network info */}
      <div className="p-3 bg-glow-surface border border-glow-border rounded-lg text-xs space-y-1.5">
        <div className="flex justify-between"><span className="text-glow-muted">Network</span><span className="text-glow-text font-medium">Arc Testnet</span></div>
        <div className="flex justify-between"><span className="text-glow-muted">Chain ID</span><span className="text-glow-text font-mono">5042002</span></div>
        <div className="flex justify-between"><span className="text-glow-muted">Gas Token</span><span className="text-glow-cyan font-medium">USDC</span></div>
        {hasFee && (
          <div className="flex justify-between border-t border-glow-border pt-1.5">
            <span className="text-glow-muted flex items-center gap-1"><DollarSign className="w-3 h-3" />Deploy Fee</span>
            <span className="text-amber-400 font-medium">{deploymentFee} USDC</span>
          </div>
        )}
      </div>

      {/* Constructor args */}
      {compiled?.abi?.some((i: { type: string }) => i.type === "constructor") && (
        <div>
          <label className="text-xs text-glow-muted mb-1.5 block">Constructor Arguments <span className="text-gray-600">(JSON array)</span></label>
          <textarea
            value={constructorArgs}
            onChange={e => setConstructorArgs(e.target.value)}
            placeholder={'["arg1", 100, "0x..."]'}
            className="w-full bg-glow-surface border border-glow-border rounded-lg p-2 text-xs text-glow-text font-mono focus:outline-none focus:border-glow-accent/50 resize-none"
            rows={3}
          />
        </div>
      )}

      {/* Deploy steps */}
      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map(step => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                {step.status === "running" && <Loader2 className="w-4 h-4 text-glow-accent animate-spin" />}
                {step.status === "done"    && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {step.status === "error"   && <XCircle className="w-4 h-4 text-red-400" />}
                {step.status === "pending" && <div className="w-4 h-4 rounded-full border border-glow-border mt-0.5" />}
              </div>
              <div className="flex-1">
                <p className="text-xs text-glow-text">{step.label}</p>
                {step.detail && <p className="text-xs text-glow-muted mt-0.5">{step.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Success */}
      {deployedAddress && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">Deployed Successfully!</span>
          </div>
          <div className="text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-glow-muted">Address:</span>
              <span className="text-glow-cyan font-mono">{truncateAddress(deployedAddress, 8)}</span>
              <button onClick={() => { navigator.clipboard.writeText(deployedAddress); setCopiedAddr(true); setTimeout(()=>setCopiedAddr(false),2000); }}>
                {copiedAddr ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-glow-muted hover:text-glow-text" />}
              </button>
              <a href={`https://testnet.arcscan.app/address/${deployedAddress}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 text-glow-muted hover:text-glow-cyan" />
              </a>
            </div>
            <div className="flex gap-2 mt-2">
              <a href={`/deployments/${deployedAddress}/interact`} className="text-xs px-3 py-1.5 bg-glow-accent/20 border border-glow-accent/30 text-glow-accent-light rounded-lg hover:bg-glow-accent/30 transition-colors">
                Interact →
              </a>
              <a href="/deployments" className="text-xs px-3 py-1.5 bg-glow-surface border border-glow-border text-glow-muted rounded-lg hover:text-glow-text transition-colors">
                View All
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {!compiled && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-400">Compile the contract first</span>
        </div>
      )}
      {chainId && chainId !== 5042002 && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">Wrong network — switch to Arc Testnet (5042002)</span>
        </div>
      )}

      <Button
        onClick={deploy}
        isLoading={isDeploying}
        disabled={!compiled || !isConnected || isDeploying}
        className="w-full"
        variant="gradient"
      >
        <Rocket className="w-4 h-4" />
        {hasFee ? `Deploy · ${deploymentFee} USDC Fee` : "Deploy to Arc Testnet"}
      </Button>
    </div>
  );
}
