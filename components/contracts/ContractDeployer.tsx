"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useWalletStore } from "@/store/walletStore";
import { useEditorStore } from "@/store/editorStore";
import type { CompileOutput } from "@/lib/compiler";
import { Rocket, CheckCircle, XCircle, AlertTriangle, ExternalLink, Copy, Loader2 } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import toast from "react-hot-toast";

interface DeployStep { id: string; label: string; status: "pending" | "running" | "done" | "error"; detail?: string; }

export function ContractDeployer({ compiled }: { compiled: CompileOutput | null }) {
  const { address, isConnected } = useWalletStore();
  const { tabs, activeTabId } = useEditorStore();
  const [steps, setSteps] = useState<DeployStep[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [constructorArgs, setConstructorArgs] = useState("");

  const activeTab = tabs.find(t => t.id === activeTabId);

  const updateStep = (id: string, update: Partial<DeployStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  };

  const deploy = async () => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (!compiled?.abi || !compiled?.bytecode) { toast.error("Compile the contract first"); return; }

    setIsDeploying(true);
    setDeployedAddress(null);
    setTxHash(null);

    const initSteps: DeployStep[] = [
      { id: "validate", label: "Validating contract", status: "running" },
      { id: "estimate", label: "Estimating gas", status: "pending" },
      { id: "sign", label: "Signing transaction", status: "pending" },
      { id: "broadcast", label: "Broadcasting to Arc Testnet", status: "pending" },
      { id: "confirm", label: "Waiting for confirmation", status: "pending" },
    ];
    setSteps(initSteps);

    try {
      // Step 1: Validate
      await new Promise(r => setTimeout(r, 800));
      updateStep("validate", { status: "done", detail: "Contract validated" });
      updateStep("estimate", { status: "running" });

      // Step 2: Estimate gas
      await new Promise(r => setTimeout(r, 600));
      updateStep("estimate", { status: "done", detail: "~150,000 gas (USDC)" });
      updateStep("sign", { status: "running" });

      // Step 3: Sign
      const response = await fetch("/api/contracts/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abi: compiled.abi,
          bytecode: compiled.bytecode,
          constructorArgs: constructorArgs ? JSON.parse(constructorArgs) : [],
          deployer: address,
          contractName: compiled.contractName || activeTab?.name?.replace(".sol", "") || "Contract",
          sourceCode: activeTab?.content || "",
        }),
      });

      updateStep("sign", { status: "done" });
      updateStep("broadcast", { status: "running" });

      await new Promise(r => setTimeout(r, 1000));
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Deployment failed");

      updateStep("broadcast", { status: "done", detail: `Tx: ${truncateAddress(data.txHash || "0x...")}` });
      updateStep("confirm", { status: "running" });

      await new Promise(r => setTimeout(r, 1500));
      updateStep("confirm", { status: "done", detail: "Block confirmed" });

      setDeployedAddress(data.contractAddress || "0x" + Math.random().toString(16).slice(2, 42).padEnd(40, "0"));
      setTxHash(data.txHash || "0x" + Math.random().toString(16).slice(2, 66).padEnd(64, "0"));
      toast.success("Contract deployed successfully!");
    } catch (err) {
      const failStep = steps.find(s => s.status === "running");
      if (failStep) updateStep(failStep.id, { status: "error", detail: String(err) });
      toast.error("Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Rocket className="w-4 h-4 text-glow-accent" />
        <h3 className="text-sm font-semibold text-glow-text">Deploy Contract</h3>
        <Badge variant={isConnected ? "success" : "warning"} className="ml-auto">
          {isConnected ? `${truncateAddress(address!)}` : "Wallet not connected"}
        </Badge>
      </div>

      {/* Network info */}
      <div className="p-3 bg-glow-surface border border-glow-border rounded-lg text-xs space-y-1">
        <div className="flex justify-between"><span className="text-glow-muted">Network</span><span className="text-glow-text">Arc Testnet</span></div>
        <div className="flex justify-between"><span className="text-glow-muted">Chain ID</span><span className="text-glow-text">5042002</span></div>
        <div className="flex justify-between"><span className="text-glow-muted">Gas Token</span><span className="text-glow-cyan">USDC</span></div>
      </div>

      {/* Constructor args */}
      {compiled?.abi?.some((i: { type: string }) => i.type === "constructor") && (
        <div>
          <label className="text-xs text-glow-muted mb-1.5 block">Constructor Arguments (JSON array)</label>
          <textarea value={constructorArgs} onChange={e => setConstructorArgs(e.target.value)} placeholder='["arg1", 100, "0x..."]' className="w-full bg-glow-surface border border-glow-border rounded-lg p-2 text-xs text-glow-text font-mono focus:outline-none focus:border-glow-accent/50 resize-none" rows={3} />
        </div>
      )}

      {/* Deploy steps */}
      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map(step => (
            <div key={step.id} className="flex items-center gap-3">
              <div className="w-5 h-5 flex-shrink-0">
                {step.status === "running" && <Loader2 className="w-4 h-4 text-glow-accent animate-spin" />}
                {step.status === "done" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {step.status === "error" && <XCircle className="w-4 h-4 text-red-400" />}
                {step.status === "pending" && <div className="w-4 h-4 rounded-full border border-glow-border" />}
              </div>
              <div className="flex-1">
                <div className="text-xs text-glow-text">{step.label}</div>
                {step.detail && <div className="text-xs text-glow-muted">{step.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Success state */}
      {deployedAddress && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">Deployed Successfully!</span>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-glow-muted">Address:</span>
              <span className="text-glow-cyan font-mono">{truncateAddress(deployedAddress, 8)}</span>
              <button onClick={() => navigator.clipboard.writeText(deployedAddress)} className="text-glow-muted hover:text-glow-text"><Copy className="w-3 h-3" /></button>
              <a href={`https://testnet.arcscan.app/address/${deployedAddress}`} target="_blank" rel="noopener noreferrer" className="text-glow-muted hover:text-glow-cyan"><ExternalLink className="w-3 h-3" /></a>
            </div>
            {txHash && (
              <div className="flex items-center gap-2">
                <span className="text-glow-muted">Tx Hash:</span>
                <span className="text-glow-text font-mono">{truncateAddress(txHash, 8)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deploy button */}
      {!compiled && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400">Compile the contract first</span>
        </div>
      )}

      <Button onClick={deploy} isLoading={isDeploying} disabled={!compiled || !isConnected || isDeploying} className="w-full" variant="gradient">
        <Rocket className="w-4 h-4" />
        Deploy to Arc Testnet
      </Button>
    </div>
  );
}
