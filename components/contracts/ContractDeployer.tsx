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

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data.result;
}

async function waitForReceipt(txHash: string, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]) as {
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
  throw new Error("Transaction not confirmed after 100s — check ArcScan");
}

export function ContractDeployer({ compiled }: { compiled: CompileOutput | null }) {
  const { address, isConnected, chainId } = useWalletStore();
  const { tabs, activeTabId } = useEditorStore();
  const [steps, setSteps] = useState<DeployStep[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [constructorArgs, setConstructorArgs] = useState("");
  const [deploymentFee, setDeploymentFee] = useState("0");
  const [feeRecipient, setFeeRecipient] = useState("");
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [feesEnabled, setFeesEnabled] = useState(false);

  const activeTab = tabs.find(t => t.id === activeTabId);

  useEffect(() => {
    fetch("/api/admin/public-settings")
      .then(r => r.json())
      .then(d => {
        if (d.deployment_fee) setDeploymentFee(d.deployment_fee);
        if (d.fee_recipient)  setFeeRecipient(d.fee_recipient);
        if (d.fees_enabled)   setFeesEnabled(d.fees_enabled === "true");
      })
      .catch(() => {});
  }, []);

  const updateStep = (id: string, update: Partial<DeployStep>) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));

  const deploy = async () => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (!compiled?.bytecode) { toast.error("Compile the contract first"); return; }

    const provider = (window as Window & { ethereum?: EthProvider }).ethereum;
    if (!provider) { toast.error("No wallet provider found"); return; }
    if (chainId !== 5042002) { toast.error("Switch to Arc Testnet (5042002) first"); return; }

    setIsDeploying(true);
    setDeployedAddress(null);
    setTxHash(null);

    const hasFee = feesEnabled && parseFloat(deploymentFee) > 0 && feeRecipient;

    setSteps([
      { id: "fee",     label: hasFee ? `Pay ${deploymentFee} USDC deployment fee` : "Deployment fee",  status: hasFee ? "pending" : "done", detail: hasFee ? undefined : "Free deployment" },
      { id: "prepare", label: "Preparing & estimating gas",     status: "pending" },
      { id: "sign",    label: "Awaiting wallet signature",       status: "pending" },
      { id: "confirm", label: "Confirming on Arc Testnet",       status: "pending" },
      { id: "save",    label: "Saving to dashboard",             status: "pending" },
    ]);

    try {
      // ── Step 1: Pay fee ─────────────────────────────────────────
      if (hasFee) {
        updateStep("fee", { status: "running" });
        const feeAmount = BigInt(Math.round(parseFloat(deploymentFee) * 1e6));
        const feeTx = await provider.request({
          method: "eth_sendTransaction",
          params: [{ from: address, to: feeRecipient, value: `0x${feeAmount.toString(16)}` }],
        }) as string;
        await waitForReceipt(feeTx);
        updateStep("fee", { status: "done", detail: `Paid ${deploymentFee} USDC` });
      }

      // ── Step 2: Prepare bytecode (NO manual ABI encoding) ──────
      updateStep("prepare", { status: "running" });

      // Use the bytecode exactly as output by the compiler
      // Constructor args encoding is handled by the compiler itself when building bytecode
      // If user provides additional args, they must be ABI-encoded hex
      let deployData = compiled.bytecode!;
      if (!deployData.startsWith("0x")) deployData = "0x" + deployData;

      if (constructorArgs.trim()) {
        // Accept raw hex-encoded constructor args (advanced use)
        const cleanArgs = constructorArgs.trim().replace(/^0x/i, "");
        if (!/^[0-9a-fA-F]*$/.test(cleanArgs)) {
          throw new Error("Constructor args must be hex-encoded (without 0x prefix). Use a tool like ethers.js AbiCoder to encode them.");
        }
        deployData = deployData + cleanArgs;
      }

      // Estimate gas
      let gasLimit: string;
      try {
        const gasEst = await rpcCall("eth_estimateGas", [{ from: address, data: deployData }]) as string;
        const gasNum = parseInt(gasEst, 16);
        gasLimit = `0x${Math.ceil(gasNum * 1.3).toString(16)}`;
        updateStep("prepare", { status: "done", detail: `Gas: ~${gasNum.toLocaleString()} (×1.3 buffer)` });
      } catch (gasErr: unknown) {
        throw new Error(`Gas estimation failed: ${(gasErr as Error).message}. Ensure contract is compiled for the correct EVM version.`);
      }

      // ── Step 3: Sign & send ─────────────────────────────────────
      updateStep("sign", { status: "running" });
      const txResult = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, data: deployData, gas: gasLimit }],
      }) as string;
      setTxHash(txResult);
      updateStep("sign", { status: "done", detail: truncateAddress(txResult, 10) });

      // ── Step 4: Wait for confirmation ───────────────────────────
      updateStep("confirm", { status: "running" });
      const receipt = await waitForReceipt(txResult);
      if (!receipt.contractAddress) throw new Error("No contract address in receipt");
      setDeployedAddress(receipt.contractAddress);
      updateStep("confirm", { status: "done", detail: `Block #${receipt.blockNumber} · Gas: ${parseInt(receipt.gasUsed).toLocaleString()}` });

      // ── Step 5: Save ────────────────────────────────────────────
      updateStep("save", { status: "running" });
      await fetch("/api/contracts/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: receipt.contractAddress,
          txHash: txResult,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          abi: compiled.abi ?? [],
          bytecode: compiled.bytecode,
          sourceCode: activeTab?.content ?? "",
          contractName: compiled.contractName ?? activeTab?.name?.replace(".sol","") ?? "Contract",
          deployer: address,
        }),
      });
      updateStep("save", { status: "done", detail: "Saved to deployments" });
      toast.success("Contract deployed successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSteps(prev => {
        const running = prev.find(s => s.status === "running");
        if (!running) return prev;
        return prev.map(s => s.id === running.id ? { ...s, status: "error", detail: msg.slice(0, 120) } : s);
      });
      toast.error(msg.slice(0, 80));
    } finally {
      setIsDeploying(false);
    }
  };

  // Only show if compiled
  if (!compiled) return (
    <div className="p-4 flex flex-col items-center justify-center h-full gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-glow-accent/10 flex items-center justify-center">
        <Rocket className="w-6 h-6 text-glow-accent/50" />
      </div>
      <p className="text-sm text-glow-muted">Compile a Solidity contract to enable deployment</p>
    </div>
  );

  const hasFee = feesEnabled && parseFloat(deploymentFee) > 0;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <Rocket className="w-4 h-4 text-glow-accent" />
        <h3 className="text-sm font-semibold text-glow-text">Deploy Contract</h3>
        {isConnected && <Badge variant="success" className="ml-auto text-xs">{truncateAddress(address!)}</Badge>}
        {!isConnected && <Badge variant="warning" className="ml-auto text-xs">Not connected</Badge>}
      </div>

      {compiled?.contractName && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs text-emerald-300 font-medium">Compiled: {compiled.contractName}</span>
        </div>
      )}

      <div className="p-3 bg-glow-surface border border-glow-border rounded-lg text-xs space-y-1.5">
        <div className="flex justify-between"><span className="text-glow-muted">Network</span><span className="text-glow-text">Arc Testnet</span></div>
        <div className="flex justify-between"><span className="text-glow-muted">Chain ID</span><span className="text-glow-text font-mono">5042002</span></div>
        <div className="flex justify-between"><span className="text-glow-muted">Gas Token</span><span className="text-glow-cyan">USDC</span></div>
        {hasFee && (
          <div className="flex justify-between border-t border-glow-border pt-1.5">
            <span className="text-glow-muted flex items-center gap-1"><DollarSign className="w-3 h-3" />Deploy Fee</span>
            <span className="text-amber-400 font-medium">{deploymentFee} USDC</span>
          </div>
        )}
      </div>

      {/* Constructor args — only show if ABI has constructor */}
      {compiled?.abi?.some((i: { type: string }) => i.type === "constructor") && (
        <div>
          <label className="text-xs text-glow-muted mb-1.5 block font-medium">
            Constructor Arguments <span className="text-gray-500">(hex-encoded, without 0x)</span>
          </label>
          <textarea value={constructorArgs} onChange={e => setConstructorArgs(e.target.value)}
            placeholder="ABI-encoded hex string..."
            className="w-full bg-glow-surface border border-glow-border rounded-lg p-2 text-xs text-glow-text font-mono focus:outline-none focus:border-glow-accent/50 resize-none"
            rows={2} />
        </div>
      )}

      {/* Network warning */}
      {isConnected && chainId && chainId !== 5042002 && (
        <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">Wrong network — switch to Arc Testnet (5042002)</span>
        </div>
      )}

      {/* Deploy button */}
      <Button onClick={deploy} isLoading={isDeploying}
        disabled={!isConnected || isDeploying || (!!chainId && chainId !== 5042002)}
        className="w-full" variant="gradient">
        <Rocket className="w-4 h-4" />
        {hasFee ? `Deploy · ${deploymentFee} USDC` : "Deploy to Arc Testnet"}
      </Button>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="space-y-2 pt-1">
          {steps.map(step => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                {step.status === "running" && <Loader2 className="w-4 h-4 text-glow-accent animate-spin" />}
                {step.status === "done"    && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {step.status === "error"   && <XCircle className="w-4 h-4 text-red-400" />}
                {step.status === "pending" && <div className="w-4 h-4 rounded-full border border-glow-border mt-0.5" />}
              </div>
              <div className="flex-1">
                <p className={`text-xs ${step.status === "running" ? "text-glow-text" : step.status === "error" ? "text-red-400" : "text-glow-muted"}`}>{step.label}</p>
                {step.detail && <p className="text-xs text-glow-muted mt-0.5 break-all">{step.detail}</p>}
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
            <span className="text-sm font-medium text-emerald-400">Deployed!</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-glow-cyan font-mono">{truncateAddress(deployedAddress, 10)}</span>
            <button onClick={() => { navigator.clipboard.writeText(deployedAddress); setCopiedAddr(true); setTimeout(()=>setCopiedAddr(false),2000); }}>
              {copiedAddr ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-glow-muted" />}
            </button>
            <a href={`https://testnet.arcscan.app/address/${deployedAddress}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 text-glow-muted hover:text-glow-cyan" />
            </a>
          </div>
          <div className="flex gap-2">
            <a href={`/deployments/${deployedAddress}/interact`} className="text-xs px-3 py-1.5 bg-glow-accent/20 border border-glow-accent/30 text-glow-accent-light rounded-lg">Interact →</a>
            <a href="/deployments" className="text-xs px-3 py-1.5 bg-glow-surface border border-glow-border text-glow-muted rounded-lg hover:text-glow-text">View All</a>
          </div>
        </div>
      )}
    </div>
  );
}
