"use client";
import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useWalletStore } from "@/store/walletStore";
import { BadgeCheck, Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAINS: Record<number,{name:string;explorer:string}> = {
  1:       { name:"Ethereum",    explorer:"https://etherscan.io"          },
  137:     { name:"Polygon",     explorer:"https://polygonscan.com"       },
  42161:   { name:"Arbitrum",   explorer:"https://arbiscan.io"           },
  10:      { name:"Optimism",   explorer:"https://optimistic.etherscan.io"},
  8453:    { name:"Base",        explorer:"https://basescan.org"          },
  56:      { name:"BSC",         explorer:"https://bscscan.com"           },
  5042002: { name:"Arc Testnet", explorer:"https://testnet.arcscan.app"   },
};

export function VerifyPanel({ compiled }: { compiled: { contractName?:string; bytecode?:string; abi?:unknown[]; metadata?:{compiler?:{version?:string};selectedVersion?:string} } | null }) {
  const { tabs, activeTabId } = useEditorStore();
  const { chainId } = useWalletStore();

  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{service:string;success:boolean;error?:string}>|null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const chain     = chainId ? CHAINS[chainId] : null;
  const solcVer   = compiled?.metadata?.selectedVersion ?? compiled?.metadata?.compiler?.version ?? "0.8.20";

  const verify = async () => {
    if (!address || !compiled?.contractName || !activeTab?.content || !chainId) return;
    setLoading(true); setResults(null);
    try {
      const res  = await fetch("/api/contracts/verify", {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          address,
          sourceCode:      activeTab.content,
          contractName:    compiled.contractName ?? "Contract",
          compilerVersion: solcVer,
          chainId,
        }),
      });
      const data = await res.json() as { results: Array<{service:string;success:boolean;error?:string}> };
      setResults(data.results ?? []);
    } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-glow-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <BadgeCheck className="w-4 h-4 text-glow-accent"/>
          <span className="text-sm font-semibold text-glow-text">Contract Verification</span>
        </div>
        <p className="text-[10px] text-glow-muted/60 mb-3 leading-relaxed">
          Verify source on Sourcify (all chains), Etherscan, Basescan, Arbiscan, Blockscout, and ArcScan automatically.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Network badge */}
        {chain && (
          <div className="flex items-center gap-2 p-2.5 bg-glow-surface border border-glow-border/40 rounded-xl">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
            <span className="text-xs text-glow-text font-medium">{chain.name}</span>
            <span className="text-[10px] text-glow-muted/50 ml-auto">Chain {chainId}</span>
          </div>
        )}

        {/* Contract info */}
        {compiled && (
          <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-xs space-y-1">
            <div className="flex justify-between"><span className="text-glow-muted/60">Contract</span><span className="text-emerald-400 font-semibold">{compiled.contractName}</span></div>
            <div className="flex justify-between"><span className="text-glow-muted/60">Compiler</span><span className="text-glow-muted font-mono">v{solcVer}</span></div>
          </div>
        )}

        {/* Address input */}
        <div>
          <label className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-wider block mb-1.5">Deployed Address</label>
          <input value={address} onChange={e => setAddress(e.target.value)}
            placeholder="0x…"
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2.5 text-xs font-mono text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
        </div>

        <button onClick={verify} disabled={loading || !address || !compiled || !chainId}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-glow-gradient text-white text-xs font-semibold rounded-xl disabled:opacity-50">
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Verifying…</> : <><BadgeCheck className="w-3.5 h-3.5"/>Verify Contract</>}
        </button>

        {!compiled  && <p className="text-[10px] text-amber-400 text-center">Compile your contract first</p>}
        {!chainId   && <p className="text-[10px] text-amber-400 text-center">Connect wallet to detect network</p>}

        {/* Results */}
        {results && (
          <div className="space-y-2 pt-2">
            {results.map((r, i) => (
              <div key={i} className={cn("flex items-start gap-2.5 p-3 rounded-xl border text-xs",
                r.success ? "bg-emerald-500/8 border-emerald-500/20" : "bg-glow-surface border-glow-border/40")}>
                {r.success
                  ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5"/>
                  : <XCircle    className="w-4 h-4 text-glow-muted/40 flex-shrink-0 mt-0.5"/>}
                <div className="flex-1 min-w-0">
                  <p className={cn("font-semibold", r.success ? "text-emerald-400" : "text-glow-muted/60")}>{r.service}</p>
                  {r.success
                    ? <p className="text-glow-muted/60 mt-0.5">Verified ✓</p>
                    : <p className="text-glow-muted/40 mt-0.5 text-[10px] break-words">{r.error ?? "Not verified"}</p>}
                </div>
                {r.success && chain && (
                  <a href={`${chain.explorer}/address/${address}#code`} target="_blank" rel="noopener noreferrer"
                    className="text-glow-muted/50 hover:text-glow-cyan">
                    <ExternalLink className="w-3.5 h-3.5"/>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
