"use client";
import { useState, useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useWalletStore } from "@/store/walletStore";
import { BadgeCheck, Loader2, CheckCircle, XCircle, ExternalLink, ChevronDown, Search, Plus, Trash2 } from "lucide-react";
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

const LICENSES = [
  "No License (None)", "The Unlicense (Unlicense)", "MIT License (MIT)",
  "GNU General Public License v2.0 (GNU GPLv2)", "GNU General Public License v3.0 (GNU GPLv3)",
  "GNU Lesser General Public License v2.1 (GNU LGPLv2.1)", "GNU Lesser General Public License v3.0 (GNU LGPLv3.0)",
  "BSD 2-clause \"Simplified\" license (BSD-2-Clause)", "BSD 3-clause \"New\" Or \"Revised\" license (BSD-3-Clause)",
];
const LICENSE_SPDX: Record<string,string> = {
  "No License (None)": "UNLICENSED", "The Unlicense (Unlicense)": "Unlicense", "MIT License (MIT)": "MIT",
  "GNU General Public License v2.0 (GNU GPLv2)": "GPL-2.0", "GNU General Public License v3.0 (GNU GPLv3)": "GPL-3.0",
  "GNU Lesser General Public License v2.1 (GNU LGPLv2.1)": "LGPL-2.1", "GNU Lesser General Public License v3.0 (GNU LGPLv3.0)": "LGPL-3.0",
  "BSD 2-clause \"Simplified\" license (BSD-2-Clause)": "BSD-2-Clause", "BSD 3-clause \"New\" Or \"Revised\" license (BSD-3-Clause)": "BSD-3-Clause",
};

const VERIFICATION_METHODS = [
  "Solidity (Single file)", "Solidity (Standard JSON input)", "Sourcify (Solidity or Vyper)",
  "Solidity (Multi-part files)", "Solidity (Hardhat)", "Solidity (Foundry)",
  "Vyper (Contract)", "Vyper (Multi-part files)", "Vyper (Standard JSON input)",
];

const EVM_VERSIONS = ["default", "istanbul", "berlin", "london", "paris", "shanghai", "cancun", "prague", "osaka"];

const COMPILER_VERSIONS = [
  "0.8.36+commit.8a079791", "0.8.35+commit.47b9dedd", "0.8.35-pre.1+commit.a99b6d8c",
  "0.8.34+commit.80d5c536", "0.8.33+commit.64118f21", "0.8.32+commit.ebbd65e5",
  "0.8.31+commit.fd3a2265", "0.8.30+commit.73712a01", "0.8.29+commit.ab55807c",
  "0.8.28+commit.7893614a", "0.8.27+commit.40a35a09", "0.8.26+commit.8a97fa7a",
  "0.8.25+commit.b61c2a91", "0.8.24+commit.e11b9ed9", "0.8.23+commit.f704f362",
  "0.8.22+commit.4fc1097e", "0.8.21+commit.d9974bed", "0.8.20+commit.a1b79de6",
  "0.8.19+commit.7dd6d404", "0.8.18+commit.87f61d96", "0.8.17+commit.8df45f5f",
];

// ── Generic dark-themed dropdown (searchable optional) ────────────────────────
function FieldDropdown({ label, value, options, onChange, searchable, checkmark }:
  { label:string; value:string; options:string[]; onChange:(v:string)=>void; searchable?:boolean; checkmark?:boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = searchable && search.trim()
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="relative">
      <label className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-wider block mb-1.5">{label}</label>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 bg-glow-bg border border-glow-border rounded-xl px-3 py-2.5 text-left hover:border-glow-accent/40 transition-colors">
        <span className="text-xs text-glow-accent-light font-medium truncate">{value}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-glow-muted flex-shrink-0 transition-transform", open && "rotate-180")}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute left-0 right-0 top-full mt-1 bg-glow-card border border-glow-border rounded-xl shadow-2xl z-50 overflow-hidden">
            {searchable && (
              <div className="p-2 border-b border-glow-border">
                <div className="flex items-center gap-1.5 bg-glow-bg border border-glow-border rounded-lg px-2 py-1.5">
                  <Search className="w-3 h-3 text-glow-muted/50 flex-shrink-0"/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search"
                    className="flex-1 min-w-0 bg-transparent text-xs text-glow-text focus:outline-none"/>
                </div>
              </div>
            )}
            <div className="max-h-56 overflow-y-auto">
              {filtered.map(opt => (
                <button key={opt} onClick={() => { onChange(opt); setOpen(false); setSearch(""); }}
                  className={cn("w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors",
                    value === opt ? "text-glow-accent-light bg-glow-accent/10" : "text-glow-text hover:bg-glow-surface")}>
                  <span className="truncate">{opt}</span>
                  {checkmark && value === opt && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0"/>}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-3 text-[11px] text-glow-muted/50 text-center">No matches</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function VerifyPanel({ compiled }: { compiled: { contractName?:string; bytecode?:string; abi?:unknown[]; metadata?:{compiler?:{version?:string};selectedVersion?:string} } | null }) {
  const { tabs, activeTabId } = useEditorStore();
  const { chainId } = useWalletStore();

  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{service:string;success:boolean;error?:string}>|null>(null);

  // Blockscout-style verification fields
  const [license, setLicense] = useState("GNU General Public License v2.0 (GNU GPLv2)");
  const [method, setMethod] = useState("Solidity (Single file)");
  const [isYul, setIsYul] = useState(false);
  const [compiler, setCompiler] = useState(COMPILER_VERSIONS[17]); // default to 0.8.20
  const [evmVersion, setEvmVersion] = useState("default");
  const [optimizationEnabled, setOptimizationEnabled] = useState(true);
  const [optimizationRuns, setOptimizationRuns] = useState("200");
  const [showLibraries, setShowLibraries] = useState(false);
  const [libraries, setLibraries] = useState<Array<{name:string;address:string}>>([{name:"",address:""}]);
  const [sourceOverride, setSourceOverride] = useState<string|null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const chain     = chainId ? CHAINS[chainId] : null;
  const effectiveSource = sourceOverride ?? activeTab?.content ?? "";
  const compilerVer = useMemo(() => compiled?.metadata?.selectedVersion ?? compiled?.metadata?.compiler?.version ?? compiler.split("+")[0], [compiled, compiler]);
  const isSupportedMethod = method === "Solidity (Single file)";

  const verify = async () => {
    if (!address || !compiled?.contractName || !effectiveSource || !chainId) return;
    setLoading(true); setResults(null);
    try {
      const res  = await fetch("/api/contracts/verify", {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          address,
          sourceCode:      effectiveSource,
          contractName:    compiled.contractName ?? "Contract",
          compilerVersion: compilerVer,
          chainId,
          evmVersion,
          optimizationEnabled,
          optimizationRuns: parseInt(optimizationRuns) || 200,
          libraries: libraries.filter(l => l.name && l.address),
          licenseIdentifier: LICENSE_SPDX[license] ?? "UNLICENSED",
        }),
      });
      const data = await res.json() as { results: Array<{service:string;success:boolean;error?:string}> };
      setResults(data.results ?? []);
    } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-glow-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <BadgeCheck className="w-4 h-4 text-glow-accent"/>
          <span className="text-sm font-semibold text-glow-text">New Smart Contract Verification</span>
        </div>
        <p className="text-[10px] text-glow-muted/60 leading-relaxed">
          Submits to Sourcify, ArcScan/Blockscout, and Etherscan-family explorers in parallel.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Network + contract info */}
        {chain && (
          <div className="flex items-center gap-2 p-2.5 bg-glow-surface border border-glow-border/40 rounded-xl">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
            <span className="text-xs text-glow-text font-medium">{chain.name}</span>
            <span className="text-[10px] text-glow-muted/50 ml-auto">Chain {chainId}</span>
          </div>
        )}
        {compiled && (
          <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-xs space-y-1">
            <div className="flex justify-between"><span className="text-glow-muted/60">Contract</span><span className="text-emerald-400 font-semibold">{compiled.contractName}</span></div>
          </div>
        )}

        {/* Address */}
        <div>
          <label className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-wider block mb-1.5">Deployed Address</label>
          <input value={address} onChange={e => setAddress(e.target.value)}
            placeholder="0x…"
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2.5 text-xs font-mono text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
        </div>

        {/* Contract license */}
        <FieldDropdown label="Contract License" value={license} options={LICENSES} onChange={setLicense} checkmark/>

        {/* Verification method */}
        <div>
          <p className="text-xs text-glow-muted mb-2">Currently, GlowIDE supports {VERIFICATION_METHODS.length} contract verification methods</p>
          <FieldDropdown label="Verification method (compiler type)*" value={method} options={VERIFICATION_METHODS} onChange={setMethod} checkmark/>
        </div>

        {!isSupportedMethod && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[11px] text-amber-300/90">
            Only "Solidity (Single file)" is wired up to submit in GlowIDE right now — the others are shown for parity with Blockscout but aren't yet implemented here.
          </div>
        )}

        {isSupportedMethod && (
          <>
            <h3 className="text-sm font-semibold text-glow-text">Contract verification via Solidity (flattened source code)</h3>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isYul} onChange={e=>setIsYul(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-glow-accent"/>
              <span className="text-xs text-glow-text">Is Yul contract</span>
            </label>

            <FieldDropdown label="Compiler*" value={compiler} options={COMPILER_VERSIONS} onChange={setCompiler} searchable/>

            <FieldDropdown label="EVM Version*" value={evmVersion} options={EVM_VERSIONS} onChange={setEvmVersion} checkmark/>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input type="checkbox" checked={optimizationEnabled} onChange={e=>setOptimizationEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-glow-accent"/>
                <span className="text-xs text-glow-text">Optimization enabled</span>
              </label>
              {optimizationEnabled && (
                <input value={optimizationRuns} onChange={e=>setOptimizationRuns(e.target.value.replace(/\D/g,""))}
                  className="w-20 bg-glow-bg border border-glow-border rounded-lg px-2 py-1.5 text-xs text-glow-text text-center focus:outline-none focus:border-glow-accent/50"/>
              )}
            </div>

            <div>
              <label className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-wider block mb-1.5">Contract Code*</label>
              <textarea value={effectiveSource} onChange={e=>setSourceOverride(e.target.value)}
                placeholder={activeTab ? undefined : "Open a .sol file in the editor, or paste flattened source here"}
                rows={8}
                className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2.5 text-[11px] font-mono text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50 resize-y"/>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showLibraries} onChange={e=>setShowLibraries(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-glow-accent"/>
              <span className="text-xs text-glow-text">Add contract libraries</span>
            </label>

            {showLibraries && (
              <div className="space-y-2 pl-1">
                {libraries.map((lib, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={lib.name} onChange={e=>{ const l=[...libraries]; l[i]={...l[i],name:e.target.value}; setLibraries(l); }}
                      placeholder="Library name" className="flex-1 min-w-0 bg-glow-bg border border-glow-border rounded-lg px-2.5 py-2 text-xs text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
                    <input value={lib.address} onChange={e=>{ const l=[...libraries]; l[i]={...l[i],address:e.target.value}; setLibraries(l); }}
                      placeholder="0x…" className="flex-1 min-w-0 bg-glow-bg border border-glow-border rounded-lg px-2.5 py-2 text-xs font-mono text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
                    <button onClick={()=>setLibraries(libraries.filter((_,idx)=>idx!==i))} className="p-2 text-glow-muted hover:text-red-400 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                ))}
                <button onClick={()=>setLibraries([...libraries,{name:"",address:""}])}
                  className="flex items-center gap-1.5 text-xs text-glow-accent hover:text-glow-accent-light">
                  <Plus className="w-3.5 h-3.5"/>Add another library
                </button>
              </div>
            )}
          </>
        )}

        <button onClick={verify} disabled={loading || !address || !compiled || !chainId || !isSupportedMethod}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-glow-gradient text-white text-xs font-semibold rounded-xl disabled:opacity-50">
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Verifying…</> : <><BadgeCheck className="w-3.5 h-3.5"/>Verify &amp; Publish</>}
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
