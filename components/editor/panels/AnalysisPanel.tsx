"use client";
import { useState, useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { Shield, AlertTriangle, Info, CheckCircle, Loader2, ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Finding {
  id: string; severity: "high"|"medium"|"low"|"info";
  title: string; message: string; line?: number; docs?: string;
}
interface Summary { high:number; medium:number; low:number; info:number; }

const SEV_CONFIG = {
  high:   { color:"text-red-400",    bg:"bg-red-500/10 border-red-500/20",    icon:"🔴", label:"High"   },
  medium: { color:"text-amber-400",  bg:"bg-amber-500/10 border-amber-500/20",icon:"🟡", label:"Medium" },
  low:    { color:"text-blue-400",   bg:"bg-blue-500/10 border-blue-500/20",  icon:"🔵", label:"Low"    },
  info:   { color:"text-glow-muted", bg:"bg-glow-surface border-glow-border/40",icon:"⚪", label:"Info"  },
};

function FindingCard({ f, onJumpTo }: { f: Finding; onJumpTo?: (line:number)=>void }) {
  const [open, setOpen] = useState(false);
  const cfg = SEV_CONFIG[f.severity];
  return (
    <div className={cn("rounded-xl border mb-2 overflow-hidden", cfg.bg)}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
        <span className="text-sm flex-shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-bold", cfg.color)}>{f.title}</span>
            <span className="text-[9px] text-glow-muted/50 font-mono bg-glow-surface px-1.5 py-0.5 rounded">{f.id}</span>
            {f.line && <span className="text-[9px] text-glow-muted/50">line {f.line}</span>}
          </div>
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-glow-muted/40 flex-shrink-0 transition-transform", open&&"rotate-180")}/>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
          <p className="text-xs text-glow-muted/80 leading-relaxed">{f.message}</p>
          <div className="flex items-center gap-2">
            {f.line && onJumpTo && (
              <button onClick={() => onJumpTo(f.line!)}
                className="text-[10px] text-glow-accent hover:underline">Jump to line {f.line}</button>
            )}
            {f.docs && (
              <a href={f.docs} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-glow-muted/50 hover:text-glow-cyan flex items-center gap-1">
                <ExternalLink className="w-3 h-3"/>Docs
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalysisPanel() {
  const { tabs, activeTabId } = useEditorStore();
  const [findings, setFindings] = useState<Finding[]|null>(null);
  const [summary,  setSummary]  = useState<Summary|null>(null);
  const [loading,  setLoading]  = useState(false);
  const [filter,   setFilter]   = useState<string>("all");

  const activeTab = tabs.find(t => t.id === activeTabId);
  const isSol     = activeTab?.name?.endsWith(".sol");

  const runAnalysis = useCallback(async () => {
    if (!activeTab?.content) return;
    setLoading(true); setFindings(null); setSummary(null);
    try {
      const res  = await fetch("/api/contracts/analyze", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ sourceCode: activeTab.content }),
      });
      const data = await res.json() as { findings:Finding[]; summary:Summary };
      setFindings(data.findings); setSummary(data.summary);
    } finally { setLoading(false); }
  }, [activeTab]);

  const visible = findings?.filter(f => filter === "all" || f.severity === filter) ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-glow-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-glow-accent"/>
          <span className="text-sm font-semibold text-glow-text">Static Analysis</span>
        </div>
        <p className="text-[10px] text-glow-muted/60 mb-3 leading-relaxed">
          Scans your Solidity code for vulnerabilities, bad patterns, and missing best practices.
        </p>
        <button onClick={runAnalysis} disabled={loading || !isSol}
          className="w-full flex items-center justify-center gap-2 py-2 bg-glow-gradient text-white text-xs font-semibold rounded-xl disabled:opacity-50">
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Scanning…</> : <><Shield className="w-3.5 h-3.5"/>Run Analysis</>}
        </button>
        {!isSol && <p className="text-[10px] text-glow-muted/40 text-center mt-1.5">Open a .sol file first</p>}
      </div>

      {/* Summary */}
      {summary && (
        <div className="px-4 py-3 border-b border-glow-border/30 flex-shrink-0">
          <div className="grid grid-cols-4 gap-2">
            {(["all","high","medium","low"] as const).map(s => {
              const count = s === "all" ? (findings?.length ?? 0) : summary[s];
              const cfg   = s === "all" ? { color:"text-glow-text", label:"All" } : SEV_CONFIG[s];
              return (
                <button key={s} onClick={() => setFilter(s)}
                  className={cn("py-1.5 rounded-lg text-center transition-colors border",
                    filter === s ? "bg-glow-accent/15 border-glow-accent/30" : "bg-glow-surface border-glow-border/30")}>
                  <p className={cn("text-base font-bold", cfg.color)}>{count}</p>
                  <p className="text-[9px] text-glow-muted/50 capitalize">{cfg.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Findings list */}
      <div className="flex-1 overflow-y-auto p-4">
        {findings === null && !loading && (
          <div className="text-center py-10">
            <Shield className="w-10 h-10 text-glow-muted/20 mx-auto mb-3"/>
            <p className="text-sm text-glow-muted/50">Click Run Analysis</p>
            <p className="text-xs text-glow-muted/30 mt-1">Checks for 15+ vulnerability patterns</p>
          </div>
        )}
        {findings?.length === 0 && (
          <div className="text-center py-10">
            <CheckCircle className="w-10 h-10 text-emerald-400/50 mx-auto mb-3"/>
            <p className="text-sm text-emerald-400">No issues found</p>
            <p className="text-xs text-glow-muted/40 mt-1">Contract looks clean!</p>
          </div>
        )}
        {visible.map((f, i) => <FindingCard key={`${f.id}-${i}`} f={f}/>)}
      </div>
    </div>
  );
}
