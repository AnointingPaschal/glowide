"use client";
import { useState, useEffect, useCallback } from "react";
import { useWalletStore } from "@/store/walletStore";
import { useEditorStore } from "@/store/editorStore";
import type { CompileOutput } from "@/lib/compiler";
import {
  Rocket, CheckCircle, XCircle, AlertTriangle, Info,
  ExternalLink, Copy, Loader2, Zap, Play, ChevronDown,
  Shield, Code2, ArrowRight,
} from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface EthProvider { request:(a:{method:string;params?:unknown[]})=>Promise<unknown>; }
interface AbiInput    { name:string; type:string; internalType?:string; }
interface AbiItem     { type:string; inputs?:AbiInput[]; stateMutability?:string; name?:string; }

const ARC_RPC      = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5042002;

// ── RPC helpers ───────────────────────────────────────────────────────────────
async function rpc(method: string, params: unknown[]) {
  const r = await fetch(ARC_RPC, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({jsonrpc:"2.0",id:Date.now(),method,params}),
    cache:"no-store",
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message ?? JSON.stringify(d.error));
  return d.result;
}

async function waitTx(hash: string) {
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const receipt = await rpc("eth_getTransactionReceipt", [hash]) as {
      contractAddress?:string; blockNumber?:string; gasUsed?:string; status?:string;
    } | null;
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("Transaction reverted — check constructor args and USDC balance");
      return {
        contractAddress: receipt.contractAddress ?? "",
        blockNumber: receipt.blockNumber ? parseInt(receipt.blockNumber,16).toString() : "0",
        gasUsed: receipt.gasUsed ? parseInt(receipt.gasUsed,16).toString() : "0",
      };
    }
  }
  throw new Error("Not confirmed after 100s — check ArcScan");
}

// ── ABI encoder ───────────────────────────────────────────────────────────────
function encodeArgs(types: string[], values: string[]): string {
  if (!types.length) return "";
  const heads: string[] = [];
  const tails: string[] = [];
  let dynOffset = types.length * 32;

  for (let i = 0; i < types.length; i++) {
    const t = types[i].trim();
    const v = (values[i] ?? "").trim();
    if (t === "string" || t === "bytes" || t.endsWith("[]")) {
      heads.push(dynOffset.toString(16).padStart(64,"0"));
      const enc = encDyn(t, v);
      tails.push(enc);
      dynOffset += enc.length / 2;
    } else {
      heads.push(encStatic(t, v));
    }
  }
  return heads.join("") + tails.join("");
}

function encStatic(type: string, val: string): string {
  if (type === "address") {
    const clean = val.replace(/^0x/i,"").toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(clean)) throw new Error(`Invalid address: "${val}"`);
    return clean.padStart(64,"0");
  }
  if (type === "bool") return (val==="true"||val==="1"?"1":"0").padStart(64,"0");
  if (type.startsWith("uint")||type.startsWith("int")) {
    try {
      const n = BigInt(val||"0");
      return (n<0n ? (BigInt("0x"+"f".repeat(64))+n+1n).toString(16).padStart(64,"0") : n.toString(16).padStart(64,"0")).slice(-64);
    } catch { throw new Error(`Invalid number "${val}" for ${type}`); }
  }
  if (type.startsWith("bytes")&&type!=="bytes") {
    const s = parseInt(type.slice(5));
    return val.replace(/^0x/i,"").padEnd(s*2,"0").slice(0,s*2).padEnd(64,"0");
  }
  throw new Error(`Unsupported type: ${type}`);
}

function encDyn(type: string, val: string): string {
  if (type==="string"||type==="bytes") {
    const hex = type==="string"
      ? Array.from(new TextEncoder().encode(val)).map(b=>b.toString(16).padStart(2,"0")).join("")
      : val.replace(/^0x/i,"");
    const len = hex.length/2;
    return len.toString(16).padStart(64,"0") + hex.padEnd(Math.ceil(hex.length/64)*64,"0");
  }
  return "0".padStart(64,"0");
}

// ── Placeholder hints ─────────────────────────────────────────────────────────
function hint(inp: AbiInput, addr?: string|null): string {
  const n = inp.name.toLowerCase();
  const t = inp.type;
  if (t==="address") {
    if (n.includes("owner")||n.includes("admin")||n.includes("initial")) return addr??"0x…";
    if (n.includes("treasury")||n.includes("recipient")) return addr??"0x…";
    return "0x…";
  }
  if (t==="string") {
    if (n==="name") return "My Token";
    if (n==="symbol") return "MTK";
    if (n.includes("uri")) return "https://…/metadata.json";
    return "text value";
  }
  if (t.startsWith("uint")) {
    if (n.includes("supply")) return "1000000000000000000 (1e18)";
    if (n.includes("price")) return "1000000 (1 USDC)";
    if (n.includes("bps")||n.includes("percent")) return "500 (5%)";
    if (n.includes("days")) return "30";
    return "0";
  }
  if (t==="bool") return "false";
  return t;
}

// ── Step indicator ────────────────────────────────────────────────────────────
type StepStatus = "idle"|"running"|"done"|"error";
interface Step { id:string; label:string; status:StepStatus; detail?:string; }

function StepRow({ step }: { step:Step }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="w-4 h-4 flex-shrink-0 mt-0.5">
        {step.status==="running" && <Loader2 className="w-4 h-4 text-glow-accent animate-spin"/>}
        {step.status==="done"    && <CheckCircle className="w-4 h-4 text-emerald-400"/>}
        {step.status==="error"   && <XCircle className="w-4 h-4 text-red-400"/>}
        {step.status==="idle"    && <div className="w-3.5 h-3.5 rounded-full border border-glow-border/60 mt-0.5"/>}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs", step.status==="running"?"text-glow-text font-medium":step.status==="error"?"text-red-400":step.status==="done"?"text-glow-muted":"text-glow-muted/50")}>
          {step.label}
        </p>
        {step.detail && (
          <p className="text-[10px] text-glow-muted/60 mt-0.5 break-words leading-relaxed">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export function ContractDeployer({ compiled }: { compiled: CompileOutput|null }) {
  const { address, isConnected, chainId } = useWalletStore();
  const { tabs, activeTabId, lastCompileResult } = useEditorStore();

  // Use passed compiled OR fall back to store's last compile result
  const result = compiled ?? lastCompileResult;

  const [steps,          setSteps]          = useState<Step[]>([]);
  const [deploying,      setDeploying]      = useState(false);
  const [deployedAddr,   setDeployedAddr]   = useState<string|null>(null);
  const [txHash,         setTxHash]         = useState<string|null>(null);
  const [copied,         setCopied]         = useState(false);
  const [args,           setArgs]           = useState<Record<string,string>>({});
  const [fee,            setFee]            = useState("0");
  const [feeRecip,       setFeeRecip]       = useState("");
  const [feeEnabled,     setFeeEnabled]     = useState(false);
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [compilingInline, setCompilingInline] = useState(false);
  const [inlineCompile,  setInlineCompile]  = useState<CompileOutput|null>(null);

  const activeResult = inlineCompile ?? result;
  const activeTab = tabs.find(t => t.id === activeTabId);
  const isSolFile = activeTab?.name?.endsWith(".sol");

  const constructor = (activeResult?.abi as AbiItem[]|undefined)?.find(i=>i.type==="constructor");
  const ctorInputs: AbiInput[] = constructor?.inputs ?? [];
  const isArcChain = chainId === ARC_CHAIN_ID;
  const wrongChain = isConnected && !isArcChain;

  // Auto-fill address fields
  useEffect(() => {
    if (!address || !ctorInputs.length) return;
    setArgs(prev => {
      const next = {...prev};
      for (const inp of ctorInputs) {
        if (!next[inp.name] && inp.type==="address") next[inp.name] = address;
      }
      return next;
    });
  }, [address, activeResult]); // eslint-disable-line

  // Fetch fee settings
  useEffect(() => {
    fetch("/api/admin/public-settings").then(r=>r.json()).then(d=>{
      setFee(d.deployment_fee??"0");
      setFeeRecip(d.fee_recipient??"");
      setFeeEnabled(d.fees_enabled==="true");
    }).catch(()=>{});
  }, []);

  const upd = useCallback((id:string, u:Partial<Step>) =>
    setSteps(p => p.map(s=>s.id===id?{...s,...u}:s)), []);

  // Compile the active file inline (from deploy panel)
  const compileInline = async () => {
    if (!activeTab?.content) { toast.error("No active .sol file"); return; }
    setCompilingInline(true);
    setInlineCompile(null);
    try {
      const res = await fetch("/api/contracts/compile", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ sourceCode: activeTab.content, contractName: activeTab.name.replace(".sol","") }),
      });
      const data: CompileOutput = await res.json();
      setInlineCompile(data);
      if (data.success) toast.success(`Compiled: ${data.contractName}`);
      else { data.errors?.forEach(e => toast.error(e.message.slice(0,80))); }
    } finally { setCompilingInline(false); }
  };

  // Switch to Arc Testnet
  const switchChain = async () => {
    const provider = (window as Window&{ethereum?:EthProvider}).ethereum;
    if (!provider) return;
    const hexId = "0x" + ARC_CHAIN_ID.toString(16);
    try {
      await provider.request({ method:"wallet_switchEthereumChain", params:[{chainId:hexId}] });
    } catch {
      await provider.request({ method:"wallet_addEthereumChain", params:[{
        chainId: hexId, chainName:"Arc Testnet",
        rpcUrls:["https://rpc.testnet.arc.network"],
        nativeCurrency:{name:"USDC",symbol:"USDC",decimals:18},
        blockExplorerUrls:["https://testnet.arcscan.app"],
      }]}).catch(()=>{});
    }
  };

  // Deploy
  const deploy = async () => {
    if (!isConnected)           { toast.error("Connect your wallet first"); return; }
    if (!activeResult?.bytecode){ toast.error("No compiled contract"); return; }
    if (wrongChain)             { await switchChain(); return; }

    const provider = (window as Window&{ethereum?:EthProvider}).ethereum;
    if (!provider) { toast.error("No wallet provider"); return; }

    // Validate args
    for (const inp of ctorInputs) {
      const v = (args[inp.name]??"").trim();
      if (!v && inp.type!=="bool") { toast.error(`Missing: ${inp.name} (${inp.type})`); return; }
      if (inp.type==="address" && !/^0x[0-9a-fA-F]{40}$/.test(v)) { toast.error(`Invalid address: ${inp.name}`); return; }
    }

    setDeploying(true); setDeployedAddr(null); setTxHash(null);
    const hasFee = feeEnabled && parseFloat(fee)>0 && !!feeRecip;

    setSteps([
      { id:"fee",     label: hasFee?`Pay ${fee} USDC fee`:"Deployment fee",         status: hasFee?"idle":"done", detail: hasFee?undefined:"Free" },
      { id:"encode",  label: "Encoding constructor args",   status:"idle" },
      { id:"gas",     label: "Estimating gas",              status:"idle" },
      { id:"sign",    label: "Sign & broadcast",            status:"idle" },
      { id:"confirm", label: "Confirming on Arc Testnet",   status:"idle" },
      { id:"save",    label: "Saving deployment",           status:"idle" },
    ]);

    try {
      // Fee
      if (hasFee) {
        upd("fee",{status:"running"});
        const feeWei = BigInt(Math.round(parseFloat(fee)*1e6));
        const feeTx = await provider.request({method:"eth_sendTransaction",params:[{from:address,to:feeRecip,value:"0x"+feeWei.toString(16)}]}) as string;
        await waitTx(feeTx);
        upd("fee",{status:"done",detail:`${fee} USDC paid`});
      }

      // Encode
      upd("encode",{status:"running"});
      let ctorHex = "";
      if (ctorInputs.length) {
        const types  = ctorInputs.map(i=>i.type);
        const values = ctorInputs.map(i=>(args[i.name]??"").trim());
        ctorHex = encodeArgs(types, values);
        upd("encode",{status:"done",detail:`${ctorInputs.length} arg(s) encoded`});
      } else {
        upd("encode",{status:"done",detail:"No constructor args"});
      }

      // Gas estimate
      upd("gas",{status:"running"});
      const bytecode = activeResult.bytecode!;
      const deployData = (bytecode.startsWith("0x")?bytecode:"0x"+bytecode) + ctorHex;
      let gasLimit: string;
      try {
        const est = await rpc("eth_estimateGas",[{from:address,data:deployData}]) as string;
        const gasNum = parseInt(est,16);
        gasLimit = "0x"+Math.ceil(gasNum*1.3).toString(16);
        upd("gas",{status:"done",detail:`~${gasNum.toLocaleString()} gas (×1.3 buffer)`});
      } catch(e:unknown) {
        throw new Error(`Gas estimate failed: ${(e as Error).message}\n\nCheck: correct constructor args, valid addresses, non-zero amounts`);
      }

      // Sign
      upd("sign",{status:"running"});
      const txResult = await provider.request({method:"eth_sendTransaction",params:[{from:address,data:deployData,gas:gasLimit}]}) as string;
      setTxHash(txResult);
      upd("sign",{status:"done",detail:`TX: ${txResult.slice(0,14)}…`});

      // Confirm
      upd("confirm",{status:"running"});
      const receipt = await waitTx(txResult);
      if (!receipt.contractAddress) throw new Error("No contract address in receipt");
      setDeployedAddr(receipt.contractAddress);
      upd("confirm",{status:"done",detail:`Block #${receipt.blockNumber} · ${parseInt(receipt.gasUsed).toLocaleString()} gas used`});

      // Save
      upd("save",{status:"running"});
      const saveRes = await fetch("/api/contracts/deploy", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          contractAddress: receipt.contractAddress,
          txHash: txResult,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          abi: activeResult.abi,
          bytecode: activeResult.bytecode,
          sourceCode: activeTab?.content ?? "",
          contractName: activeResult.contractName ?? "Contract",
          deployer: address,
        }),
      });
      const saveData = await saveRes.json().catch(()=>({}));
      upd("save",{status:"done",detail: saveData.success?"Saved to deployments":"Saved (DB optional)"});

      toast.success(`✓ ${activeResult.contractName} deployed!`);
    } catch(err:unknown) {
      const msg = (err instanceof Error?err.message:String(err));
      setSteps(prev => {
        const running = prev.find(s=>s.status==="running");
        return running ? prev.map(s=>s.id===running.id?{...s,status:"error",detail:msg.slice(0,180)}:s) : prev;
      });
      toast.error(msg.split("\n")[0].slice(0,80));
    } finally { setDeploying(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#080812]">
      <div className="p-4 space-y-3.5">

        {/* Header */}
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-glow-accent"/>
          <h3 className="text-sm font-semibold text-glow-text">Deploy to Arc Testnet</h3>
        </div>

        {/* Wallet + chain status */}
        <div className="grid grid-cols-2 gap-2">
          <div className={cn("p-2.5 rounded-xl border text-xs", isConnected?"border-emerald-500/20 bg-emerald-500/5":"border-amber-500/20 bg-amber-500/5")}>
            <p className="text-glow-muted/60 mb-0.5">Wallet</p>
            <p className={isConnected?"text-emerald-400 font-mono":"text-amber-400"}>
              {isConnected ? truncateAddress(address!,6) : "Not connected"}
            </p>
          </div>
          <div className={cn("p-2.5 rounded-xl border text-xs", isArcChain?"border-emerald-500/20 bg-emerald-500/5":wrongChain?"border-red-500/20 bg-red-500/5":"border-glow-border/40 bg-glow-surface/30")}>
            <p className="text-glow-muted/60 mb-0.5">Network</p>
            <p className={isArcChain?"text-emerald-400":wrongChain?"text-red-400":"text-glow-muted/50"}>
              {isArcChain ? "Arc Testnet ✓" : wrongChain ? `Chain ${chainId}` : "—"}
            </p>
          </div>
        </div>

        {/* Wrong chain */}
        {wrongChain && (
          <button onClick={switchChain}
            className="w-full flex items-center justify-center gap-2 py-2 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light text-xs font-medium rounded-xl hover:bg-glow-accent/25 transition-colors">
            <Zap className="w-3.5 h-3.5"/>Switch to Arc Testnet
          </button>
        )}

        {/* Compile panel */}
        {!activeResult ? (
          <div className="space-y-3">
            <div className="p-3 bg-glow-surface border border-glow-border/40 rounded-xl text-xs text-center space-y-2">
              <Code2 className="w-7 h-7 text-glow-muted/30 mx-auto"/>
              <p className="text-glow-muted/60">No compiled contract</p>
              {isSolFile && <p className="text-glow-muted/40">Open file: {activeTab?.name}</p>}
            </div>
            {isSolFile && (
              <button onClick={compileInline} disabled={compilingInline}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-glow-gradient text-white text-xs font-semibold rounded-xl disabled:opacity-60">
                {compilingInline?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Play className="w-3.5 h-3.5"/>}
                {compilingInline?"Compiling…":"Compile & Continue"}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Compiled contract info */}
            <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400"/>
                  <span className="text-xs font-semibold text-emerald-400">{activeResult.contractName}</span>
                </div>
                {isSolFile && (
                  <button onClick={compileInline} disabled={compilingInline}
                    className="flex items-center gap-1 text-[10px] text-glow-muted/60 hover:text-glow-text px-2 py-0.5 bg-glow-surface rounded border border-glow-border/30">
                    {compilingInline?<Loader2 className="w-2.5 h-2.5 animate-spin"/>:<Play className="w-2.5 h-2.5"/>}Re-compile
                  </button>
                )}
              </div>
              <div className="flex gap-3 text-[10px] text-glow-muted/60">
                <span>{(activeResult.bytecode?.length??0)/2} bytes</span>
                <span>{(activeResult.abi as AbiItem[])?.filter(i=>i.type==="function").length??0} functions</span>
                {(activeResult.abi as AbiItem[])?.filter(i=>i.type==="event").length > 0 && (
                  <span>{(activeResult.abi as AbiItem[]).filter(i=>i.type==="event").length} events</span>
                )}
              </div>
            </div>

            {/* Fee */}
            {feeEnabled && parseFloat(fee) > 0 && (
              <div className="flex items-center justify-between p-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl text-xs">
                <span className="text-amber-400 font-medium">Deployment Fee</span>
                <span className="text-amber-300 font-semibold">{fee} USDC</span>
              </div>
            )}

            {/* Constructor args */}
            {ctorInputs.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[10px] text-glow-muted/60 uppercase tracking-widest font-semibold">Constructor Arguments</p>
                {ctorInputs.map(inp => (
                  <div key={inp.name}>
                    <label className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-medium text-glow-text">{inp.name}</span>
                      <span className="text-[10px] text-glow-muted/50 font-mono bg-glow-surface px-1 rounded">{inp.type}</span>
                    </label>
                    <input
                      value={args[inp.name]??""}
                      onChange={e=>setArgs(p=>({...p,[inp.name]:e.target.value}))}
                      placeholder={hint(inp, address)}
                      className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2 text-xs text-glow-text font-mono placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50 transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Advanced: ABI preview */}
            <div>
              <button onClick={()=>setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-[10px] text-glow-muted/50 hover:text-glow-muted transition-colors">
                <ChevronDown className={cn("w-3 h-3 transition-transform",showAdvanced&&"rotate-180")}/>
                ABI & Contract Details
              </button>
              {showAdvanced && (
                <div className="mt-2 p-2.5 bg-glow-bg border border-glow-border/40 rounded-lg max-h-32 overflow-y-auto">
                  <div className="space-y-1">
                    {(activeResult.abi as AbiItem[])?.filter(i=>i.type==="function").map((fn,i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className="text-glow-accent/70 font-mono">{fn.name}</span>
                        <span className="text-glow-muted/40">{fn.stateMutability}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Deploy button */}
            <button onClick={deploy} disabled={deploying || !isConnected}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
                deploying||!isConnected ? "bg-glow-border/50 text-glow-muted/40 cursor-not-allowed" :
                wrongChain ? "bg-amber-500/20 border border-amber-500/30 text-amber-400" :
                "bg-glow-gradient text-white hover:opacity-90 shadow-glow-sm"
              )}>
              {deploying ? (
                <><Loader2 className="w-4 h-4 animate-spin"/>Deploying…</>
              ) : wrongChain ? (
                <><Zap className="w-4 h-4"/>Switch to Arc Testnet</>
              ) : (
                <><Rocket className="w-4 h-4"/>
                  {feeEnabled && parseFloat(fee) > 0 ? `Deploy · ${fee} USDC` : "Deploy to Arc Testnet"}
                </>
              )}
            </button>
          </>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <div className="border border-glow-border/30 rounded-xl p-3 space-y-0.5">
            <p className="text-[10px] text-glow-muted/40 uppercase tracking-widest mb-2">Progress</p>
            {steps.map(s => <StepRow key={s.id} step={s}/>)}
          </div>
        )}

        {/* Success */}
        {deployedAddr && (
          <div className="p-3.5 bg-emerald-500/8 border border-emerald-500/25 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400"/>
              <span className="text-sm font-bold text-emerald-400">Deployed Successfully!</span>
            </div>
            <div className="bg-glow-bg border border-glow-border rounded-lg p-2.5 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-glow-accent flex-shrink-0"/>
              <code className="text-xs font-mono text-glow-cyan flex-1 truncate">{deployedAddr}</code>
              <button onClick={()=>{ navigator.clipboard.writeText(deployedAddr); setCopied(true); setTimeout(()=>setCopied(false),2000); }}>
                {copied?<CheckCircle className="w-3.5 h-3.5 text-emerald-400"/>:<Copy className="w-3.5 h-3.5 text-glow-muted hover:text-glow-text"/>}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href={`https://testnet.arcscan.app/address/${deployedAddr}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 bg-glow-card border border-glow-border rounded-lg text-xs text-glow-muted hover:text-glow-text transition-colors">
                <ExternalLink className="w-3 h-3"/>ArcScan
              </a>
              {txHash && (
                <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 bg-glow-card border border-glow-border rounded-lg text-xs text-glow-muted hover:text-glow-text transition-colors">
                  <ArrowRight className="w-3 h-3"/>TX Hash
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
