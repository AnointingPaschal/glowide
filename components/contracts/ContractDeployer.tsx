"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useWalletStore } from "@/store/walletStore";
import { useEditorStore } from "@/store/editorStore";
import type { CompileOutput } from "@/lib/compiler";
import {
  Rocket, CheckCircle, XCircle, AlertTriangle,
  ExternalLink, Copy, Loader2, DollarSign, Info,
} from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import toast from "react-hot-toast";

// ── EIP-1193 provider type ─────────────────────────────────────────────────
interface EthProvider {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
}

// ── Deploy step ────────────────────────────────────────────────────────────
interface DeployStep {
  id: string; label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

// ── ABI types ──────────────────────────────────────────────────────────────
interface AbiInput { name: string; type: string; internalType?: string; }
interface AbiItem  { type: string; inputs?: AbiInput[]; stateMutability?: string; }

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message ?? JSON.stringify(d.error));
  return d.result;
}

async function waitForReceipt(txHash: string, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]) as {
      contractAddress?: string; blockNumber?: string;
      gasUsed?: string; status?: string;
    } | null;
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("Transaction reverted on-chain. Check constructor args.");
      return {
        contractAddress: receipt.contractAddress ?? "",
        blockNumber: receipt.blockNumber ? parseInt(receipt.blockNumber, 16).toString() : "0",
        gasUsed: receipt.gasUsed ? parseInt(receipt.gasUsed, 16).toString() : "0",
      };
    }
  }
  throw new Error("Not confirmed after 100s — check ArcScan");
}

// ── ABI encoder (pure JS, no viem) ─────────────────────────────────────────
function encodeAbiParams(types: string[], values: string[]): string {
  if (types.length === 0) return "";

  const heads: string[] = [];
  const tails: string[] = [];
  let dynamicOffset = types.length * 32; // head section length

  for (let i = 0; i < types.length; i++) {
    const type = types[i].trim();
    const val  = (values[i] ?? "").trim();

    if (isDynamic(type)) {
      // Head = pointer to dynamic data
      heads.push(dynamicOffset.toString(16).padStart(64, "0"));
      const encoded = encodeDynamic(type, val);
      tails.push(encoded);
      dynamicOffset += encoded.length / 2;
    } else {
      heads.push(encodeStatic(type, val));
    }
  }

  return heads.join("") + tails.join("");
}

function isDynamic(type: string): boolean {
  return type === "string" || type === "bytes" || type.endsWith("[]");
}

function encodeStatic(type: string, val: string): string {
  if (type === "address") {
    const clean = val.replace(/^0x/i, "").toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(clean)) throw new Error(`Invalid address: "${val}"`);
    return clean.padStart(64, "0");
  }
  if (type === "bool") {
    const b = val === "true" || val === "1";
    return (b ? "1" : "0").padStart(64, "0");
  }
  if (type.startsWith("uint") || type.startsWith("int")) {
    try {
      const n = BigInt(val || "0");
      const hex = n < 0n
        ? (BigInt("0x" + "f".repeat(64)) + n + 1n).toString(16).padStart(64, "0")
        : n.toString(16).padStart(64, "0");
      return hex.slice(-64); // keep last 32 bytes
    } catch { throw new Error(`Invalid number "${val}" for type ${type}`); }
  }
  if (type.startsWith("bytes") && type !== "bytes") {
    // bytes1…bytes32
    const size = parseInt(type.slice(5));
    const hex = val.replace(/^0x/i, "").padEnd(size * 2, "0").slice(0, size * 2);
    return hex.padEnd(64, "0");
  }
  throw new Error(`Unsupported static type: ${type}`);
}

function encodeDynamic(type: string, val: string): string {
  if (type === "string" || type === "bytes") {
    const hex = type === "string"
      ? Array.from(new TextEncoder().encode(val)).map(b => b.toString(16).padStart(2, "0")).join("")
      : val.replace(/^0x/i, "");
    const len = hex.length / 2;
    const lenHex = len.toString(16).padStart(64, "0");
    const dataHex = hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
    return lenHex + dataHex;
  }
  // arrays: not fully supported yet
  return "0".padStart(64, "0");
}

// ── Input label helper ─────────────────────────────────────────────────────
function getPlaceholder(input: AbiInput, walletAddress?: string | null): string {
  const { type, name } = input;
  const n = name?.toLowerCase() ?? "";
  if (type === "address") {
    if (n.includes("admin") || n.includes("owner") || n.includes("default")) return walletAddress ?? "0x…";
    if (n.includes("recipient") || n.includes("treasury")) return walletAddress ?? "0x…";
    return "0x…";
  }
  if (type === "string") {
    if (n === "name") return "My Token";
    if (n === "symbol") return "MTK";
    if (n === "uri") return "https://…/metadata/{id}.json";
    return "text";
  }
  if (type.startsWith("uint")) {
    if (n.includes("supply") || n.includes("amount")) return "1000000000000000000 (1 × 10¹⁸)";
    if (n.includes("price")) return "1000000 (1 USDC)";
    if (n.includes("percent") || n.includes("bps")) return "500 (5%)";
    return "0";
  }
  if (type === "bool") return "false";
  return type;
}

// ══════════════════════════════════════════════════════════════════════════════
export function ContractDeployer({ compiled }: { compiled: CompileOutput | null }) {
  const { address, isConnected, chainId } = useWalletStore();
  const { tabs, activeTabId } = useEditorStore();
  const [steps, setSteps] = useState<DeployStep[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [constructorValues, setConstructorValues] = useState<Record<string, string>>({});
  const [deploymentFee, setDeploymentFee] = useState("0");
  const [feeRecipient, setFeeRecipient] = useState("");
  const [feesEnabled, setFeesEnabled] = useState(false);
  const [feeLoaded, setFeeLoaded] = useState(false);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // ── Parse constructor from ABI ─────────────────────────────────────────
  const constructorItem = (compiled?.abi as AbiItem[] | undefined)?.find(i => i.type === "constructor");
  const constructorInputs: AbiInput[] = constructorItem?.inputs ?? [];

  // ── Auto-fill address fields with connected wallet ─────────────────────
  useEffect(() => {
    if (!address || !constructorInputs.length) return;
    setConstructorValues(prev => {
      const next = { ...prev };
      for (const inp of constructorInputs) {
        if (!next[inp.name] && inp.type === "address") {
          next[inp.name] = address;
        }
      }
      return next;
    });
  }, [address, compiled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch admin fees ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/public-settings")
      .then(r => r.json())
      .then(d => {
        const fee  = d.deployment_fee   ?? "0";
        const recip = d.fee_recipient   ?? "";
        const enabled = d.fees_enabled  === "true";
        setDeploymentFee(fee);
        setFeeRecipient(recip);
        setFeesEnabled(enabled);
        setFeeLoaded(true);
      })
      .catch(() => setFeeLoaded(true));
  }, []);

  const updateStep = (id: string, update: Partial<DeployStep>) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));

  // ── Validate constructor inputs before deploy ──────────────────────────
  const validateInputs = (): string | null => {
    for (const inp of constructorInputs) {
      const val = (constructorValues[inp.name] ?? "").trim();
      if (!val && inp.type !== "bool") {
        return `Missing value for constructor argument "${inp.name}" (${inp.type})`;
      }
      if (inp.type === "address" && !/^0x[0-9a-fA-F]{40}$/.test(val)) {
        return `"${inp.name}" must be a valid Ethereum address (0x + 40 hex chars)`;
      }
    }
    return null;
  };

  // ── Deploy ─────────────────────────────────────────────────────────────
  const deploy = async () => {
    if (!isConnected)      { toast.error("Connect your wallet first");   return; }
    if (!compiled?.bytecode) { toast.error("Compile the contract first"); return; }
    if (chainId !== 5042002) { toast.error("Switch to Arc Testnet (5042002)"); return; }

    const provider = (window as Window & { ethereum?: EthProvider }).ethereum;
    if (!provider) { toast.error("No wallet provider found"); return; }

    // Validate constructor args
    const validationError = validateInputs();
    if (validationError) { toast.error(validationError); return; }

    setIsDeploying(true);
    setDeployedAddress(null);
    setTxHash(null);

    const actualFee   = feesEnabled && parseFloat(deploymentFee) > 0 && feeRecipient;
    const feeLabel    = actualFee ? `Pay ${deploymentFee} USDC deployment fee` : "Deployment fee";
    const feeDetail   = actualFee ? undefined : "Free deployment";

    setSteps([
      { id:"fee",     label: feeLabel,                      status: actualFee ? "pending" : "done", detail: feeDetail },
      { id:"encode",  label: "Encoding constructor args",   status: "pending" },
      { id:"prepare", label: "Estimating gas",              status: "pending" },
      { id:"sign",    label: "Awaiting wallet signature",   status: "pending" },
      { id:"confirm", label: "Confirming on Arc Testnet",   status: "pending" },
      { id:"save",    label: "Saving to dashboard",         status: "pending" },
    ]);

    try {
      // ── Step 1: Fee ──────────────────────────────────────────────────
      if (actualFee) {
        updateStep("fee", { status:"running" });
        const feeAmount = BigInt(Math.round(parseFloat(deploymentFee) * 1e6));
        const feeTx = await provider.request({
          method: "eth_sendTransaction",
          params: [{ from: address, to: feeRecipient, value: `0x${feeAmount.toString(16)}` }],
        }) as string;
        await waitForReceipt(feeTx);
        updateStep("fee", { status:"done", detail: `Paid ${deploymentFee} USDC → ${truncateAddress(feeRecipient)}` });
      }

      // ── Step 2: Encode constructor args ──────────────────────────────
      updateStep("encode", { status:"running" });
      let constructorHex = "";
      if (constructorInputs.length > 0) {
        const types  = constructorInputs.map(i => i.type);
        const values = constructorInputs.map(i => (constructorValues[i.name] ?? "").trim());
        constructorHex = encodeAbiParams(types, values);
        const summary = constructorInputs.map((i, idx) => `${i.name}=${values[idx].slice(0,20)}`).join(", ");
        updateStep("encode", { status:"done", detail: summary });
      } else {
        updateStep("encode", { status:"done", detail: "No constructor args" });
      }

      // ── Step 3: Build deploy data & estimate gas ──────────────────────
      updateStep("prepare", { status:"running" });
      const bytecode = compiled.bytecode!;
      const deployData = bytecode.startsWith("0x")
        ? bytecode + constructorHex
        : "0x" + bytecode + constructorHex;

      let gasLimit: string;
      try {
        const gasEst = await rpcCall("eth_estimateGas", [{ from: address, data: deployData }]) as string;
        const gasNum = parseInt(gasEst, 16);
        gasLimit = `0x${Math.ceil(gasNum * 1.3).toString(16)}`;
        updateStep("prepare", { status:"done", detail: `Gas: ~${gasNum.toLocaleString()} (×1.3 buffer)` });
      } catch (gasErr: unknown) {
        const msg = (gasErr as Error).message ?? String(gasErr);
        throw new Error(
          `Gas estimation failed: ${msg}\n\nThis usually means:\n` +
          `• Constructor args are wrong (check types and values)\n` +
          `• Contract requires specific initialization (e.g. valid address)\n` +
          `• Contract reverts on invalid state`
        );
      }

      // ── Step 4: Sign & broadcast ──────────────────────────────────────
      updateStep("sign", { status:"running" });
      const txResult = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, data: deployData, gas: gasLimit }],
      }) as string;
      setTxHash(txResult);
      updateStep("sign", { status:"done", detail: truncateAddress(txResult, 10) });

      // ── Step 5: Wait for confirmation ─────────────────────────────────
      updateStep("confirm", { status:"running" });
      const receipt = await waitForReceipt(txResult);
      if (!receipt.contractAddress) throw new Error("No contract address in receipt");
      setDeployedAddress(receipt.contractAddress);
      updateStep("confirm", { status:"done", detail: `Block #${receipt.blockNumber} · Gas used: ${parseInt(receipt.gasUsed).toLocaleString()}` });

      // ── Step 6: Save ──────────────────────────────────────────────────
      updateStep("save", { status:"running" });
      await fetch("/api/contracts/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: receipt.contractAddress,
          txHash: txResult,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          abi:         compiled.abi,
          bytecode:    compiled.bytecode,
          sourceCode:  activeTab?.content ?? "",
          contractName: compiled.contractName ?? activeTab?.name?.replace(".sol","") ?? "Contract",
          deployer:    address,
        }),
      });
      updateStep("save", { status:"done", detail: "Saved to deployments" });
      toast.success("Contract deployed!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSteps(prev => {
        const running = prev.find(s => s.status === "running");
        if (!running) return prev;
        return prev.map(s => s.id === running.id ? { ...s, status:"error", detail: msg.slice(0, 150) } : s);
      });
      toast.error(msg.split("\n")[0].slice(0, 80));
    } finally {
      setIsDeploying(false);
    }
  };

  // ── Not compiled yet ───────────────────────────────────────────────────
  if (!compiled) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-glow-accent/10 flex items-center justify-center">
          <Rocket className="w-6 h-6 text-glow-accent/50"/>
        </div>
        <p className="text-sm text-glow-muted">Compile a Solidity contract to enable deployment</p>
      </div>
    );
  }

  const hasFee       = feeLoaded && feesEnabled && parseFloat(deploymentFee) > 0 && !!feeRecipient;
  const isWrongChain = isConnected && chainId !== 5042002;
  const canDeploy    = isConnected && !isWrongChain && !isDeploying;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Contract info */}
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-glow-accent"/>
          <h3 className="text-sm font-semibold text-glow-text">Deploy Contract</h3>
          <Badge variant={isConnected ? "success" : "warning"} className="ml-auto text-xs">
            {isConnected ? truncateAddress(address!) : "Not connected"}
          </Badge>
        </div>

        {compiled.contractName && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0"/>
            <span className="text-xs text-emerald-300 font-medium">Compiled: {compiled.contractName}</span>
            {compiled.allContracts && compiled.allContracts.length > 1 && (
              <span className="text-xs text-glow-muted ml-1">({compiled.allContracts.length} contracts found)</span>
            )}
          </div>
        )}

        {/* Network + fee */}
        <div className="p-3 bg-glow-surface border border-glow-border rounded-lg text-xs space-y-1.5">
          <div className="flex justify-between"><span className="text-glow-muted">Network</span><span className="text-glow-text">Arc Testnet</span></div>
          <div className="flex justify-between"><span className="text-glow-muted">Chain ID</span><span className="text-glow-text font-mono">5042002</span></div>
          <div className="flex justify-between"><span className="text-glow-muted">Gas Token</span><span className="text-glow-cyan">USDC (6 decimals)</span></div>
          {feeLoaded && (
            <div className="flex justify-between border-t border-glow-border pt-1.5">
              <span className="text-glow-muted flex items-center gap-1">
                <DollarSign className="w-3 h-3"/>Deploy Fee
              </span>
              <span className={hasFee ? "text-amber-400 font-medium" : "text-emerald-400"}>
                {hasFee ? `${deploymentFee} USDC` : "Free"}
              </span>
            </div>
          )}
        </div>

        {/* Constructor arguments */}
        {constructorInputs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-glow-text uppercase tracking-wider">Constructor Arguments</span>
              <div className="group relative">
                <Info className="w-3.5 h-3.5 text-glow-muted cursor-help"/>
                <div className="absolute left-0 bottom-5 w-52 bg-glow-card border border-glow-border rounded-lg p-2 text-xs text-glow-muted hidden group-hover:block z-10 shadow-card-shadow">
                  Fill in all required constructor parameters. Address fields are pre-filled with your connected wallet.
                </div>
              </div>
            </div>

            {constructorInputs.map(inp => (
              <div key={inp.name} className="space-y-1">
                <label className="flex items-center gap-1.5 text-xs text-glow-muted">
                  <span className="font-medium text-glow-text">{inp.name}</span>
                  <span className="text-glow-muted/60 font-mono">{inp.type}</span>
                </label>
                <input
                  value={constructorValues[inp.name] ?? ""}
                  onChange={e => setConstructorValues(p => ({ ...p, [inp.name]: e.target.value }))}
                  placeholder={getPlaceholder(inp, address)}
                  className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2 text-xs text-glow-text font-mono placeholder-glow-muted/40 focus:outline-none focus:border-glow-accent/50 transition-colors"
                />
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {!isConnected && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0"/>
            <span className="text-xs text-amber-400">Connect your wallet to deploy</span>
          </div>
        )}
        {isWrongChain && (
          <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0"/>
            <span className="text-xs text-red-400">Switch to Arc Testnet (5042002)</span>
          </div>
        )}

        {/* Deploy button */}
        <Button
          onClick={deploy}
          isLoading={isDeploying}
          disabled={!canDeploy}
          className="w-full"
          variant="gradient"
        >
          <Rocket className="w-4 h-4"/>
          {hasFee ? `Deploy · ${deploymentFee} USDC` : "Deploy to Arc Testnet"}
        </Button>

        {/* Steps */}
        {steps.length > 0 && (
          <div className="space-y-2 pt-1">
            {steps.map(step => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                  {step.status === "running"  && <Loader2 className="w-4 h-4 text-glow-accent animate-spin"/>}
                  {step.status === "done"     && <CheckCircle className="w-4 h-4 text-emerald-400"/>}
                  {step.status === "error"    && <XCircle className="w-4 h-4 text-red-400"/>}
                  {step.status === "pending"  && <div className="w-4 h-4 rounded-full border border-glow-border mt-0.5"/>}
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${step.status === "running" ? "text-glow-text" : step.status === "error" ? "text-red-400" : "text-glow-muted"}`}>
                    {step.label}
                  </p>
                  {step.detail && (
                    <p className="text-xs text-glow-muted mt-0.5 break-words whitespace-pre-wrap">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Success */}
        {deployedAddress && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400"/>
              <span className="text-sm font-semibold text-emerald-400">Deployed!</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-glow-cyan font-mono">{truncateAddress(deployedAddress, 10)}</span>
              <button onClick={() => { navigator.clipboard.writeText(deployedAddress); setCopiedAddr(true); setTimeout(()=>setCopiedAddr(false),2000); }}>
                {copiedAddr ? <CheckCircle className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3 text-glow-muted hover:text-glow-text"/>}
              </button>
              <a href={`https://testnet.arcscan.app/address/${deployedAddress}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 text-glow-muted hover:text-glow-cyan"/>
              </a>
            </div>
            {txHash && (
              <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-glow-muted hover:text-glow-cyan transition-colors block">
                View TX on ArcScan →
              </a>
            )}
            <div className="flex gap-2 pt-1">
              <a href={`/deployments/${deployedAddress}/interact`}
                className="text-xs px-3 py-1.5 bg-glow-accent/20 border border-glow-accent/30 text-glow-accent-light rounded-lg hover:bg-glow-accent/30 transition-colors">
                Interact →
              </a>
              <a href="/deployments"
                className="text-xs px-3 py-1.5 bg-glow-surface border border-glow-border text-glow-muted rounded-lg hover:text-glow-text transition-colors">
                View All
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
