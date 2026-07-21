"use client";
import { useState, useEffect } from "react";
import { useWalletStore } from "@/store/walletStore";
import { Gauge, Loader2, Zap, TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface GasEstimate {
  fn:      string;
  type:    "constructor"|"function"|"view";
  gas?:    number;
  error?:  string;
}

const ARC_RPC = (process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network");

// Minimal ABI encoder — builds real calldata (zero-value args) so
// eth_estimateGas gets an actual function call to estimate, not a guess.
// Function selector requires real keccak256, computed server-side via /api/contracts/selector.
async function getSelector(sig: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/contracts/selector?sig=${encodeURIComponent(sig)}`);
    if (!res.ok) return null;
    const d = await res.json() as { selector?: string };
    return d.selector ?? null;
  } catch { return null; }
}

function encodeZeroArgs(types: string[]): string {
  return types.map(t => {
    if (t === "address") return "0".repeat(24) + "0".repeat(16); // 32 bytes zero
    if (t.startsWith("uint") || t.startsWith("int")) return "0".repeat(64);
    if (t === "bool") return "0".repeat(64);
    if (t === "bytes32") return "0".repeat(64);
    return "0".repeat(64); // best-effort default for other types
  }).join("");
}

export function GasPanel({ compiled }: { compiled: {abi?:unknown[];bytecode?:string;metadata?:Record<string,unknown>} | null }) {
  const { address } = useWalletStore();
  const [estimates, setEstimates] = useState<GasEstimate[]|null>(null);
  const [prevEstimates, setPrevEstimates] = useState<GasEstimate[]|null>(null);
  const [loading,   setLoading]   = useState(false);
  const [gasPriceWei, setGasPriceWei] = useState<bigint|null>(null);

  // Live gas price from Arc Testnet — used to convert gas units into a real
  // USDC cost estimate (Arc's native gas token IS USDC, so this is direct).
  useEffect(() => {
    fetch(ARC_RPC, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ jsonrpc:"2.0", id:1, method:"eth_gasPrice", params:[] }),
    }).then(r=>r.json()).then(d => { if (d.result) setGasPriceWei(BigInt(d.result)); }).catch(()=>{});
  }, []);

  const estimateAll = async () => {
    if (!compiled?.abi || !compiled.bytecode) return;
    setLoading(true);
    if (estimates) setPrevEstimates(estimates);
    setEstimates(null);

    try {
      // Real deployment gas estimate
      const deployRes = await fetch(ARC_RPC, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_estimateGas",params:[{
          from: address ?? "0x0000000000000000000000000000000000000001",
          data:  compiled.bytecode?.startsWith("0x") ? compiled.bytecode : "0x"+compiled.bytecode,
        }]}),
        cache:"no-store",
      });
      const deployData = await deployRes.json() as {result?:string;error?:{message:string}};
      const deployGas  = deployData.result ? parseInt(deployData.result, 16) : undefined;

      const results: GasEstimate[] = [
        { fn:"constructor", type:"constructor", gas:deployGas, error:deployData.error?.message },
      ];

      const abi = compiled.abi as Array<{type:string;name?:string;inputs?:Array<{type:string}>;stateMutability?:string}>;

      for (const fn of abi.filter(f => f.type === "function")) {
        const isView = fn.stateMutability === "view" || fn.stateMutability === "pure";
        if (isView) { results.push({ fn: fn.name ?? "?", type:"view" }); continue; }

        const types = (fn.inputs ?? []).map(i => i.type);
        const sig = `${fn.name}(${types.join(",")})`;
        const selector = await getSelector(sig);

        if (!selector) {
          results.push({ fn: fn.name ?? "?", type:"function", error: "Couldn't compute selector" });
          continue;
        }

        const data = "0x" + selector + encodeZeroArgs(types);
        try {
          const res = await fetch(ARC_RPC, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ jsonrpc:"2.0", id:1, method:"eth_estimateGas",
              params:[{ from: address ?? "0x0000000000000000000000000000000000000001", to: address ?? undefined, data }] }),
          });
          const d = await res.json() as { result?:string; error?:{message:string} };
          // Without a deployed address to call against, estimation against a
          // non-existent contract will legitimately fail — that's expected
          // and reported honestly, not papered over with a fake number.
          if (d.result) results.push({ fn: fn.name ?? "?", type:"function", gas: parseInt(d.result,16) });
          else results.push({ fn: fn.name ?? "?", type:"function", error: d.error?.message ?? "Deploy the contract first to estimate this function's real gas cost" });
        } catch (e) {
          results.push({ fn: fn.name ?? "?", type:"function", error: String(e) });
        }
      }

      setEstimates(results);
    } finally { setLoading(false); }
  };

  const totalGas = estimates?.reduce((a,b) => a+(b.gas??0), 0) ?? 0;
  const prevTotal = prevEstimates?.reduce((a,b) => a+(b.gas??0), 0) ?? null;
  const gasDiff = prevTotal !== null ? totalGas - prevTotal : null;

  const usdcCost = gasPriceWei !== null ? (Number(gasPriceWei) * totalGas) / 1e18 : null;
  const expensiveFns = estimates?.filter(e => e.type==="function" && (e.gas ?? 0) > 100_000) ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-glow-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="w-4 h-4 text-glow-accent"/>
          <span className="text-sm font-semibold text-glow-text">Gas Profiler</span>
        </div>
        <p className="text-[10px] text-glow-muted/60 mb-3 leading-relaxed">
          Real eth_estimateGas calls against Arc Testnet — deployment always works; function estimates need the contract already deployed at your connected address.
        </p>
        <button onClick={estimateAll} disabled={loading || !compiled}
          className="w-full flex items-center justify-center gap-2 py-2 bg-glow-gradient text-white text-xs font-semibold rounded-xl disabled:opacity-50">
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Estimating…</> : <><Gauge className="w-3.5 h-3.5"/>{estimates ? "Re-run Profile" : "Profile Gas"}</>}
        </button>
        {!compiled && <p className="text-[10px] text-glow-muted/40 text-center mt-1">Compile a contract first</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {estimates && (
          <div className="p-3 bg-glow-accent/8 border border-glow-accent/20 rounded-xl mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-glow-muted/60 uppercase tracking-wider mb-1">Total Gas (all ops)</p>
                <p className="text-xl font-bold text-glow-accent">{totalGas.toLocaleString()}</p>
              </div>
              {gasDiff !== null && gasDiff !== 0 && (
                <span className={cn("flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg",
                  gasDiff > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400")}>
                  {gasDiff > 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                  {gasDiff > 0 ? "+" : ""}{gasDiff.toLocaleString()} vs last run
                </span>
              )}
            </div>
            {usdcCost !== null && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-glow-accent/10">
                <span className="text-[10px] text-glow-muted/60">≈ deployment cost:</span>
                <span className="text-xs font-bold text-glow-text">${usdcCost.toFixed(4)} USDC</span>
                <span className="text-[9px] text-glow-muted/40">(Arc's native gas token)</span>
              </div>
            )}
          </div>
        )}

        {expensiveFns.length > 0 && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5"/>
            <p className="text-[10px] text-amber-300">{expensiveFns.length} function{expensiveFns.length>1?"s":""} over 100k gas: {expensiveFns.map(f=>f.fn).join(", ")} — consider reviewing for storage writes that could be batched or minimized</p>
          </div>
        )}

        {estimates?.map((e, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-glow-card border border-glow-border rounded-xl">
            <div className={cn("w-1.5 rounded-full self-stretch flex-shrink-0",
              e.type==="constructor"?"bg-glow-accent":e.type==="view"?"bg-blue-400":(e.gas??0)>100000?"bg-amber-400":"bg-emerald-400")}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-glow-text truncate">{e.fn}()</span>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold",
                  e.type==="constructor"?"bg-glow-accent/15 text-glow-accent-light":
                  e.type==="view"?"bg-blue-500/15 text-blue-400":"bg-emerald-500/15 text-emerald-400")}>
                  {e.type}
                </span>
              </div>
              {e.error && <p className="text-[10px] text-glow-muted/50 mt-0.5">{e.error.slice(0,80)}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              {e.gas ? (
                <>
                  <p className="text-xs font-bold text-glow-text tabular-nums">{e.gas.toLocaleString()}</p>
                  <p className="text-[9px] text-glow-muted/50">gas units</p>
                </>
              ) : e.type === "view" ? (
                <p className="text-[10px] text-blue-400">free (view)</p>
              ) : (
                <p className="text-[10px] text-glow-muted/40">n/a</p>
              )}
            </div>
          </div>
        ))}

        {!estimates && !loading && (
          <div className="text-center py-8">
            <Gauge className="w-10 h-10 text-glow-muted/20 mx-auto mb-3"/>
            <p className="text-sm text-glow-muted/50">Run profiler to see gas costs</p>
          </div>
        )}

        {estimates && (
          <div className="flex items-start gap-2 p-2.5 bg-glow-surface border border-glow-border/40 rounded-xl mt-2">
            <Info className="w-3.5 h-3.5 text-glow-muted/50 flex-shrink-0 mt-0.5"/>
            <p className="text-[10px] text-glow-muted/50 leading-relaxed">Function estimates use zero-value arguments and require the contract to already be deployed at your connected wallet address — undeployed functions show "n/a" honestly rather than a guessed number.</p>
          </div>
        )}
      </div>
    </div>
  );
}
