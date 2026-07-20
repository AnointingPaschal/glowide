"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useWalletStore } from "@/store/walletStore";
import { useFileSystemStore, type FSNode } from "@/store/fileSystemStore";
import { useEditorStore } from "@/store/editorStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { Terminal as TermIcon, X, Maximize2, Minimize2, ChevronRight, Loader2 } from "lucide-react";
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

// Singleton log emitter so other components (AI chat, deploy panel, etc) can log to terminal
type TerminalListener = (entry: LogEntry) => void;
const listeners = new Set<TerminalListener>();
export const terminalLog = (text: string, level: LogEntry["level"] = "info") => {
  const entry: LogEntry = { time: timestamp(), level, text };
  listeners.forEach(fn => fn(entry));
  const wallet = (window as unknown as { __walletAddress?: string }).__walletAddress;
  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet_address: wallet, action: level === "command" ? `cmd:${text}` : text, details: { level } }),
  }).catch(() => {});
};

// Real binaries that need to run server-side in an ephemeral sandbox
const REAL_BINARIES = new Set(["node","npm","npx","yarn","pnpm","git","python3","python","pip3","pip","tsc","solc","grep","find","wc"]);

// Build a full "folder/subfolder/name" path string for a node
function buildPath(node: FSNode, nodes: FSNode[]): string {
  const parts: string[] = [node.name];
  let cur = node;
  while (cur.parentId) {
    const parent = nodes.find(n => n.id === cur.parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    cur = parent;
  }
  return parts.join("/");
}

export function Terminal() {
  const [logs, setLogs]       = useState<LogEntry[]>([{ time: timestamp(), level: "success", text: "GlowIDE Terminal ready · real node/npm/npx/git execution · type 'help' for commands" }]);
  const [input, setInput]     = useState("");
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory]   = useState<string[]>([]);
  const [histIdx, setHistIdx]   = useState(-1);
  const [running, setRunning]   = useState(false);
  const [heredoc, setHeredoc]   = useState<{ path: string; delimiter: string; lines: string[] } | null>(null);
  const endRef    = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const { address } = useWalletStore();
  const fsStore = useFileSystemStore();
  const { nodes, activeProjectId, createFile, createDirectory, deleteNode, updateContent, moveNode } = fsStore;
  const { openFile } = useEditorStore();
  const terminalFontSize = usePreferencesStore(s => s.terminalFontSize);

  useEffect(() => {
    (window as unknown as { __walletAddress?: string }).__walletAddress = address ?? undefined;
  }, [address]);

  useEffect(() => {
    const fn: TerminalListener = (entry) => setLogs(p => [...p.slice(-300), entry]);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const print = (text: string, level: LogEntry["level"] = "info") =>
    setLogs(p => [...p.slice(-300), { time: timestamp(), level, text }]);

  // Find a node by a "path/like/this" string, resolved relative to the active project
  const findByPath = useCallback((path: string): FSNode | undefined => {
    if (!activeProjectId) return undefined;
    const clean = path.replace(/^\.?\//, "");
    return nodes.find(n => n.projectId === activeProjectId && buildPath(n, nodes) === clean);
  }, [nodes, activeProjectId]);

  // Create any missing folders along a path, returning the parentId for the final segment
  const ensureDirPath = useCallback((dirParts: string[]): string | null => {
    if (!activeProjectId) return null;
    let parentId: string | null = null;
    for (const part of dirParts) {
      const live = useFileSystemStore.getState().nodes;
      let dir = live.find(n => n.projectId === activeProjectId && n.type === "directory" && n.parentId === parentId && n.name === part);
      if (!dir) dir = createDirectory(parentId, part, activeProjectId);
      parentId = dir.id;
    }
    return parentId;
  }, [activeProjectId, createDirectory]);

  const writeFile = useCallback((path: string, content: string) => {
    if (!activeProjectId) { print("No active project — open or create one in the File Explorer first.", "error"); return; }
    const parts = path.replace(/^\.?\//, "").split("/").filter(Boolean);
    const name = parts.pop();
    if (!name) return;
    const parentId = ensureDirPath(parts);
    const existing = findByPath(path);
    if (existing) updateContent(existing.id, content);
    else createFile(parentId, name, activeProjectId, content);
  }, [activeProjectId, ensureDirPath, findByPath, createFile, updateContent]);

  // ── Virtual filesystem commands — operate directly on fileSystemStore ─────
  const runVirtual = useCallback((name: string, args: string[]): boolean => {
    switch (name) {
      case "help":
        print("Virtual: ls, pwd, cd, mkdir, touch, rm, mv, cp, cat, nano <file>, cat > file << EOF, clear, whoami, chain, version");
        print("Real (server-executed): node, npm, npx, yarn, pnpm, git, python3, pip, tsc, solc — e.g. npm install ethers && node script.js");
        return true;
      case "clear": setLogs([]); return true;
      case "whoami": print(address ?? "Not connected"); return true;
      case "chain": print("Arc Testnet · Chain ID 5042002 · RPC: rpc.testnet.arc.network"); return true;
      case "version": print("GlowIDE v1.0.0 · Solidity 0.8.20 · Node.js runtime · real exec via /api/terminal/exec"); return true;
      case "pwd": print(`/workspace/${activeProjectId ? "project" : "(no active project)"}`); return true;
      case "ls": {
        if (!activeProjectId) { print("No active project.", "warn"); return true; }
        const dirArg = args[0];
        const parentNode = dirArg ? findByPath(dirArg) : undefined;
        const parentId = dirArg ? (parentNode?.id ?? null) : null;
        const children = fsStore.getChildren(parentId, activeProjectId);
        if (children.length === 0) { print("(empty)", "info"); return true; }
        print(children.map(c => c.type === "directory" ? `${c.name}/` : c.name).join("  "));
        return true;
      }
      case "mkdir": {
        if (!args[0]) { print("usage: mkdir <path>", "warn"); return true; }
        if (!activeProjectId) { print("No active project.", "error"); return true; }
        const parts = args[0].replace(/^\.?\//, "").split("/").filter(Boolean);
        ensureDirPath(parts);
        print(`Created directory ${args[0]}`, "success");
        return true;
      }
      case "touch": {
        if (!args[0]) { print("usage: touch <file>", "warn"); return true; }
        writeFile(args[0], "");
        print(`Created ${args[0]}`, "success");
        return true;
      }
      case "rm": {
        const path = args.filter(a => !a.startsWith("-"))[0];
        if (!path) { print("usage: rm [-r] <path>", "warn"); return true; }
        const node = findByPath(path);
        if (!node) { print(`rm: ${path}: No such file`, "error"); return true; }
        deleteNode(node.id);
        print(`Removed ${path}`, "success");
        return true;
      }
      case "mv": {
        const [src, dest] = args;
        if (!src || !dest) { print("usage: mv <src> <dest>", "warn"); return true; }
        const node = findByPath(src);
        if (!node) { print(`mv: ${src}: No such file`, "error"); return true; }
        const destParts = dest.replace(/^\.?\//, "").split("/").filter(Boolean);
        const newName = destParts.pop() ?? node.name;
        const newParentId = ensureDirPath(destParts);
        moveNode(node.id, newParentId);
        if (newName !== node.name) useFileSystemStore.getState().renameNode(node.id, newName);
        print(`Moved ${src} → ${dest}`, "success");
        return true;
      }
      case "cp": {
        const [src, dest] = args;
        if (!src || !dest) { print("usage: cp <src> <dest>", "warn"); return true; }
        const node = findByPath(src);
        if (!node || node.type !== "file") { print(`cp: ${src}: No such file`, "error"); return true; }
        writeFile(dest, node.content ?? "");
        print(`Copied ${src} → ${dest}`, "success");
        return true;
      }
      case "cat": {
        if (!args[0]) { print("usage: cat <file>", "warn"); return true; }
        const node = findByPath(args[0]);
        if (!node || node.type !== "file") { print(`cat: ${args[0]}: No such file`, "error"); return true; }
        (node.content ?? "").split("\n").forEach(line => print(line));
        return true;
      }
      case "nano":
      case "vim":
      case "vi": {
        if (!args[0]) { print(`usage: ${name} <file>`, "warn"); return true; }
        let node = findByPath(args[0]);
        if (!node && activeProjectId) {
          const parts = args[0].replace(/^\.?\//, "").split("/").filter(Boolean);
          const fname = parts.pop();
          if (fname) { const parentId = ensureDirPath(parts); node = createFile(parentId, fname, activeProjectId, ""); }
        }
        if (node) {
          const fileNode = { id: node.id, project_id: node.projectId, name: node.name, path: `/${node.name}`, type: "file" as const, content: node.content ?? "", language: node.language ?? "plaintext", created_at: node.createdAt, updated_at: node.updatedAt };
          openFile(fileNode);
          print(`Opened ${args[0]} in editor — GlowIDE has no in-terminal editor, use the tab that just opened.`, "info");
        }
        return true;
      }
      default: return false;
    }
  }, [activeProjectId, address, findByPath, ensureDirPath, writeFile, deleteNode, moveNode, createFile, openFile, fsStore]);

  // ── Real command execution — routes to /api/terminal/exec ────────────────
  const runReal = useCallback(async (cmd: string) => {
    if (!activeProjectId) { print("No active project — real commands run against your project's files. Open/create one first.", "warn"); return; }
    setRunning(true);
    try {
      const projectFiles = nodes
        .filter(n => n.projectId === activeProjectId && n.type === "file")
        .map(n => ({ path: buildPath(n, nodes), content: n.content ?? "" }));

      const res = await fetch("/api/terminal/exec", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, files: projectFiles }),
      });
      const d = await res.json() as { stdout?: string; stderr?: string; error?: string; timedOut?: boolean; updatedFiles?: Array<{path:string;content:string}> };

      if (d.error) { print(d.error, "error"); return; }
      if (d.stdout) d.stdout.split("\n").forEach(line => { if (line) print(line, "info"); });
      if (d.stderr) d.stderr.split("\n").forEach(line => { if (line) print(line, "warn"); });
      if (d.timedOut) print("Command timed out after 25s", "error");

      if (d.updatedFiles?.length) {
        for (const f of d.updatedFiles) writeFile(f.path, f.content);
        print(`Synced ${d.updatedFiles.length} file(s) back to project: ${d.updatedFiles.map(f=>f.path).join(", ")}`, "success");
      }
      if (!d.stdout && !d.stderr && !d.error) print("(no output)", "info");
    } catch (e) {
      print(`Execution failed: ${e}`, "error");
    } finally {
      setRunning(false);
    }
  }, [activeProjectId, nodes, writeFile]);

  const runCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // Heredoc capture mode: keep swallowing lines until the delimiter appears
    if (heredoc) {
      if (trimmed === heredoc.delimiter) {
        writeFile(heredoc.path, heredoc.lines.join("\n"));
        print(`Wrote ${heredoc.lines.length} line(s) to ${heredoc.path}`, "success");
        setHeredoc(null);
      } else {
        setHeredoc(h => h ? { ...h, lines: [...h.lines, cmd] } : h);
        print(cmd, "info");
      }
      return;
    }

    print(`$ ${trimmed}`, "command");
    setHistory(h => [trimmed, ...h.slice(0, 49)]);
    setHistIdx(-1);
    terminalLog(`cmd: ${trimmed}`, "command");

    // Detect heredoc start: cat > file.txt << 'EOF'  or  cat > file << EOF
    const heredocMatch = trimmed.match(/^cat\s*>>?\s*(\S+)\s*<<\s*['"]?(\w+)['"]?\s*$/);
    if (heredocMatch) {
      setHeredoc({ path: heredocMatch[1], delimiter: heredocMatch[2], lines: [] });
      print(`(heredoc mode — type your content, end with a line containing just "${heredocMatch[2]}")`, "info");
      return;
    }

    // echo "text" > file.txt  (simple redirect, no heredoc needed)
    const echoRedirect = trimmed.match(/^echo\s+(.+?)\s*(>>?)\s*(\S+)$/);
    if (echoRedirect) {
      const text = echoRedirect[1].replace(/^["']|["']$/g, "");
      const append = echoRedirect[2] === ">>";
      const existing = findByPath(echoRedirect[3]);
      const newContent = append ? `${existing?.content ?? ""}\n${text}` : text;
      writeFile(echoRedirect[3], newContent);
      print(`Wrote to ${echoRedirect[3]}`, "success");
      return;
    }

    const [name, ...args] = trimmed.split(/\s+/);
    if (runVirtual(name, args)) return;
    if (REAL_BINARIES.has(name)) { runReal(trimmed); return; }
    print(`Command not found: ${name}. Type 'help' for available commands.`, "warn");
  }, [heredoc, writeFile, findByPath, runVirtual, runReal]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { runCommand(input); setInput(""); }
    if (e.key === "ArrowUp") { const i = Math.min(histIdx + 1, history.length - 1); setHistIdx(i); setInput(history[i] ?? ""); }
    if (e.key === "ArrowDown") { const i = Math.max(histIdx - 1, -1); setHistIdx(i); setInput(i === -1 ? "" : history[i]); }
  };

  return (
    <div className={cn("flex flex-col bg-[#080810] border-t border-glow-border font-mono transition-all", expanded ? "fixed inset-4 z-50 rounded-2xl border border-glow-border shadow-2xl" : "h-full")}
      style={{ fontSize: `${terminalFontSize}px` }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-glow-border/50 bg-glow-surface/50 flex-shrink-0">
        <TermIcon className="w-3.5 h-3.5 text-glow-accent" />
        <span className="text-xs font-semibold text-glow-muted">Terminal</span>
        <div className="flex items-center gap-1 ml-2">
          {running
            ? <><Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin"/><span className="text-[10px] text-amber-400">Running…</span></>
            : <><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /><span className="text-[10px] text-emerald-400">Arc Testnet</span></>}
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
            <span className={cn(LEVEL_COLORS[log.level], "break-all")}>{log.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-glow-border/30 bg-glow-surface/20 flex-shrink-0">
        <ChevronRight className={cn("w-3.5 h-3.5 flex-shrink-0", heredoc ? "text-amber-400" : "text-glow-cyan")} />
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder={heredoc ? `> heredoc: ${heredoc.path} (end with ${heredoc.delimiter})` : "Enter command… (try: help)"}
          className="flex-1 min-w-0 bg-transparent text-glow-text placeholder-glow-muted/30 focus:outline-none"
          autoComplete="off" spellCheck={false} disabled={running}
        />
      </div>
    </div>
  );
}
