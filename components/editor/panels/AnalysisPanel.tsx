"use client";
import { useState, useCallback, useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import { Shield, AlertTriangle, Info, CheckCircle, Loader2, ExternalLink, ChevronDown, Sparkles, Download, MapPin } from "lucide-react";
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

// A-F letter grade from finding counts — mirrors how security scanners
// (MythX, Slither dashboards) typically communicate overall risk at a glance.
function computeGrade(summary: Summary): { grade: string; color: string; score: number } {
  const score = Math.max(0, 100 - summary.high*25 - summary.medium*10 - summary.low*3);
  if (score >= 90) return { grade: "A", color: "text-emerald-400", score };
  if (score >= 75) return { grade: "B", color: "text-lime-400",    score };
  if (score >= 60) return { grade: "C", color: "text-amber-400",   score };
  if (score >= 40) return { grade: "D", color: "text-orange-400",  score };
  return { grade: "F", color: "text-red-400", score };
}

function FindingCard({ f, onJumpTo, onAskAI }: { f: Finding; onJumpTo?: (line:number)=>void; onAskAI?: (f:Finding)=>void }) {
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
          <div className="flex items-center gap-3 flex-wrap">
            {f.line && onJumpTo && (
              <button onClick={() => onJumpTo(f.line!)}
                className="text-[10px] text-glow-accent hover:underline flex items-center gap-1"><MapPin className="w-3 h-3"/>Jump to line {f.line}</button>
            )}
            {onAskAI && (
              <button onClick={() => onAskAI(f)}
                className="text-[10px] text-glow-cyan hover:underline flex items-center gap-1"><Sparkles className="w-3 h-3"/>Ask AI to fix</button>
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
  const [scannedContent, setScannedContent] = useState<string|null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const isSol     = activeTab?.name?.endsWith(".sol");
  const isStale   = scannedContent !== null && activeTab?.content !== scannedContent;

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
      setScannedContent(activeTab.content);
    } finally { setLoading(false); }
  }, [activeTab]);

  const jumpToLine = (line: number) => {
    window.dispatchEvent(new CustomEvent("glowide:jump-to-line", { detail: { line } }));
  };

  const askAIToFix = (f: Finding) => {
    window.dispatchEvent(new CustomEvent("glowide:switch-plugin", { detail: "chat" }));
    // Give the panel a moment to mount before dispatching the prefill
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("glowide:ai-prefill", {
        detail: { text: `Fix this ${f.severity}-severity issue in my contract: "${f.title}"${f.line ? ` at line ${f.line}` : ""}. ${f.message}` }
      }));
    }, 150);
  };

  const exportReport = () => {
    if (!findings || !summary) return;
    const grade = computeGrade(summary);
    const lines = [
      `# Security Analysis Report`,
      `Contract: ${activeTab?.name ?? "unknown"}`,
      `Generated: ${new Date().toISOString()}`,
      `Grade: ${grade.grade} (${grade.score}/100)`,
      ``,
      `## Summary`,
      `- High: ${summary.high}`, `- Medium: ${summary.medium}`, `- Low: ${summary.low}`, `- Info: ${summary.info}`,
      ``, `## Findings`, ``,
      ...findings.map(f => `### [${f.severity.toUpperCase()}] ${f.title} (${f.id})${f.line ? ` — line ${f.line}` : ""}\n${f.message}\n`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(activeTab?.name ?? "contract").replace(".sol","")}-security-report.md`;
    a.click();
  };

  const visible = findings?.filter(f => filter === "all" || f.severity === filter) ?? [];
  const grade = summary ? computeGrade(summary) : null;

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
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Scanning…</> : <><Shield className="w-3.5 h-3.5"/>{findings ? "Re-run Analysis" : "Run Analysis"}</>}
        </button>
        {!isSol && <p className="text-[10px] text-glow-muted/40 text-center mt-1.5">Open a .sol file first</p>}
        {isStale && (
          <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0"/>
            <p className="text-[10px] text-amber-300">Code changed since last scan — results may be outdated</p>
          </div>
        )}
      </div>

      {/* Security grade + summary */}
      {summary && grade && (
        <div className="px-4 py-3 border-b border-glow-border/30 flex-shrink-0 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className={cn("w-12 h-12 rounded-2xl bg-glow-surface border-2 flex items-center justify-center flex-shrink-0",
              grade.grade==="A"?"border-emerald-500/40":grade.grade==="B"?"border-lime-500/40":grade.grade==="C"?"border-amber-500/40":grade.grade==="D"?"border-orange-500/40":"border-red-500/40")}>
              <span className={cn("text-xl font-black", grade.color)}>{grade.grade}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-glow-text">Security Score: {grade.score}/100</p>
              <p className="text-[10px] text-glow-muted/60">{findings?.length ?? 0} finding{findings?.length!==1?"s":""} across {Object.values(summary).filter(v=>v>0).length} severity level{Object.values(summary).filter(v=>v>0).length!==1?"s":""}</p>
            </div>
            <button onClick={exportReport} title="Export report as Markdown"
              className="p-2 text-glow-muted hover:text-glow-text hover:bg-glow-card rounded-lg transition-colors flex-shrink-0">
              <Download className="w-3.5 h-3.5"/>
            </button>
          </div>
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
        {visible.map((f, i) => <FindingCard key={`${f.id}-${i}`} f={f} onJumpTo={jumpToLine} onAskAI={askAIToFix}/>)}
      </div>
    </div>
  );
}
