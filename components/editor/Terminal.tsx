"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useWalletStore } from "@/store/walletStore";
import { Terminal as TermIcon, X, Maximize2, Minimize2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry { time: string; level: "info"|"success"|"warn"|"error"|"command"|"ai"; text: string; }

const LEVEL_COLORS = {
  info:    "text-glow-muted",
  success: "text-emerald-400",
  warn:    "text-amber-400",
  error:   "text-red-400",
  command: "text-glow-cyan",
  ai:      "text-glow-accent-light",
};

function timestamp() { return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

// Singleton log emitter so other components can log to terminal
type TerminalListener = (entry: LogEntry) => void;
const listeners = new Set<TerminalListener>();
export const terminalLog = (text: string, level: LogEntry["level"] = "info") => {
  const entry: LogEntry = { time: timestamp(), level, text };
  listeners.forEach(fn => fn(entry));
  // Also ship to activity API
  const wallet = (window as unknown as { __walletAddress?: string }).__walletAddress;
  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet_address: wallet, action: level === "command" ? `cmd:${text}` : text, details: { level } }),
  }).catch(() => {});
};

const COMMANDS: Record<string, (args: string[]) => string> = {
  help:  () => "Commands: help, clear, whoami, chain, compile <file>, deploy, ls, pwd, version",
  whoami: () => (window as unknown as { __walletAddress?: string }).__walletAddress ?? "Not connected",
  chain: () => "Arc Testnet · Chain ID 5042002 · RPC: rpc.testnet.arc.network",
  ls:    () => "Use the file tree panel to browse your project files.",
  pwd:   () => "/workspace/project",
  version: () => "GlowIDE v1.0.0 · Solidity 0.8.20 · Node.js runtime",
};

export function Terminal() {
  const [logs, setLogs]       = useState<LogEntry[]>([{ time: timestamp(), level: "success", text: "GlowIDE Terminal ready · type 'help' for commands" }]);
  const [input, setInput]     = useState("");
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory]   = useState<string[]>([]);
  const [histIdx, setHistIdx]   = useState(-1);
  const endRef    = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const { address } = useWalletStore();

  // Expose wallet address for terminalLog
  useEffect(() => {
    (window as unknown as { __walletAddress?: string }).__walletAddress = address ?? undefined;
  }, [address]);

  // Subscribe to external log events
  useEffect(() => {
    const fn: TerminalListener = (entry) => setLogs(p => [...p.slice(-200), entry]);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const runCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setLogs(p => [...p, { time: timestamp(), level: "command", text: `$ ${trimmed}` }]);
    setHistory(h => [trimmed, ...h.slice(0, 49)]);
    setHistIdx(-1);
    terminalLog(`cmd: ${trimmed}`, "command");

    if (trimmed === "clear") { setLogs([]); return; }
    const [name, ...args] = trimmed.split(/\s+/);
    const handler = COMMANDS[name];
    const output = handler ? handler(args) : `Command not found: ${name}. Type 'help'.`;
    setLogs(p => [...p, { time: timestamp(), level: handler ? "info" : "warn", text: output }]);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { runCommand(input); setInput(""); }
    if (e.key === "ArrowUp") { const i = Math.min(histIdx + 1, history.length - 1); setHistIdx(i); setInput(history[i] ?? ""); }
    if (e.key === "ArrowDown") { const i = Math.max(histIdx - 1, -1); setHistIdx(i); setInput(i === -1 ? "" : history[i]); }
  };

  return (
    <div className={cn("flex flex-col bg-[#080810] border-t border-glow-border font-mono text-xs transition-all", expanded ? "fixed inset-4 z-50 rounded-2xl border border-glow-border shadow-2xl" : "h-full")}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-glow-border/50 bg-glow-surface/50 flex-shrink-0">
        <TermIcon className="w-3.5 h-3.5 text-glow-accent" />
        <span className="text-xs font-semibold text-glow-muted">Terminal</span>
        <div className="flex items-center gap-1 ml-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-[10px] text-emerald-400">Arc Testnet</span>
        </div>
        <div className="flex-1" />
        <button onClick={() => setLogs([])} className="p-1 rounded text-glow-muted hover:text-glow-text hover:bg-glow-card" title="Clear">
          <X className="w-3 h-3" />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="p-1 rounded text-glow-muted hover:text-glow-text hover:bg-glow-card" title="Expand">
          {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" onClick={() => inputRef.current?.focus()}>
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 leading-5">
            <span className="text-glow-muted/50 flex-shrink-0">{log.time}</span>
            <span className={LEVEL_COLORS[log.level]}>{log.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-glow-border/30 bg-glow-surface/20 flex-shrink-0">
        <ChevronRight className="w-3.5 h-3.5 text-glow-cyan flex-shrink-0" />
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Enter command…"
          className="flex-1 bg-transparent text-glow-text placeholder-glow-muted/30 focus:outline-none text-xs"
          autoComplete="off" spellCheck={false}
        />
      </div>
    </div>
  );
}
