"use client";
import { useState, useRef, useEffect } from "react";
import { Terminal as TerminalIcon, X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalLine { id: string; type: "input" | "output" | "error" | "info"; content: string; timestamp: string; }

const WELCOME = [
  { id: "w1", type: "info" as const, content: "GlowIDE Terminal — Arc Testnet Ready", timestamp: new Date().toISOString() },
  { id: "w2", type: "info" as const, content: "Type 'help' to see available commands", timestamp: new Date().toISOString() },
];

const COMMANDS: Record<string, string> = {
  help: `Available commands:\n  compile <file>  — Compile a Solidity contract\n  deploy          — Deploy compiled contract\n  test            — Run tests\n  clear           — Clear terminal\n  network         — Show network info\n  wallet          — Show wallet info`,
  network: `Network: Arc Testnet\nChain ID: 5042002\nRPC: https://rpc.testnet.arc.network\nExplorer: https://testnet.arcscan.app\nGas Token: USDC`,
  clear: "__CLEAR__",
};

export function Terminal() {
  const [lines, setLines] = useState<TerminalLine[]>(WELCOME);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  const addLine = (content: string, type: TerminalLine["type"] = "output") => {
    setLines(prev => [...prev, { id: Math.random().toString(36), type, content, timestamp: new Date().toISOString() }]);
  };

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    addLine(`$ ${trimmed}`, "input");
    setHistory(h => [trimmed, ...h.slice(0, 49)]);
    setHistoryIdx(-1);

    const result = COMMANDS[trimmed.split(" ")[0]];
    if (result === "__CLEAR__") { setLines(WELCOME); return; }
    if (result) { addLine(result, "output"); return; }
    addLine(`Command not found: ${trimmed.split(" ")[0]}. Type 'help' for available commands.`, "error");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { handleCommand(input); setInput(""); }
    else if (e.key === "ArrowUp") {
      const idx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(idx);
      setInput(history[idx] || "");
    } else if (e.key === "ArrowDown") {
      const idx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(idx);
      setInput(idx === -1 ? "" : history[idx]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a14] font-mono text-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-glow-border bg-glow-surface">
        <TerminalIcon className="w-3.5 h-3.5 text-glow-muted" />
        <span className="text-xs text-glow-muted font-sans">Terminal</span>
        <div className="flex-1" />
        <button onClick={() => setLines(WELCOME)} className="p-1 text-glow-muted hover:text-glow-text transition-colors" title="Clear">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5" onClick={() => inputRef.current?.focus()}>
        {lines.map(line => (
          <div key={line.id} className={cn("leading-5 whitespace-pre-wrap break-words text-xs",
            line.type === "input" && "text-glow-cyan",
            line.type === "output" && "text-glow-text",
            line.type === "error" && "text-red-400",
            line.type === "info" && "text-glow-muted",
          )}>
            {line.content}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-glow-border">
        <span className="text-glow-accent text-xs">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent text-xs text-glow-text placeholder:text-glow-muted focus:outline-none"
          placeholder="Enter command..."
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
}
