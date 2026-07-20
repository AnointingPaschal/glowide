"use client";
import React from "react";
import { useCircleStore } from "@/store/circleStore";
import { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Copy, Check, Edit3, RotateCcw, Eye,
  ChevronDown, Terminal, Code2, X, ExternalLink,
  Hammer, FileCode, FolderOpen, FileEdit,
  CheckCircle, AlertTriangle, Loader2,
  Zap, Send, Globe, ArrowLeftRight, FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onEdit?: (content: string) => void;
  onRetry?: () => void;
  editorMode?: boolean;
}

// ── Detect code blocks in content ────────────────────────────────────────────
interface DetectedBlock { lang: string; code: string; filename?: string; }

function detectBlocks(content: string): DetectedBlock[] {
  const blocks: DetectedBlock[] = [];
  const re = /```(\w+)(?:\s+([^\n]+))?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    blocks.push({ lang: m[1], filename: m[2], code: m[3].trim() });
  }
  return blocks;
}

// File extensions that indicate named files (for "Create Project")
const FILE_EXTENSIONS = /\.(sol|ts|tsx|js|jsx|py|rs|go|json|html|css|md|yaml|yml|toml|sh|env)$/i;

// ── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ code, lang, onClose }: { code:string; lang:string; onClose:()=>void }) {
  const popout = () => {
    const html = (lang==="html"||lang==="jsx"||lang==="tsx")
      ? code
      : `<!DOCTYPE html><html><head><style>body{background:#0d0d18;color:#e2e8f0;font-family:system-ui;padding:20px}</style></head><body><script>${code}<\/script></body></html>`;
    const url = URL.createObjectURL(new Blob([html],{type:"text/html"}));
    window.open(url,"_blank");
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-4xl h-[78vh] bg-[#0e0e1a] border border-glow-border rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-glow-border bg-[#111120] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-glow-accent"/>
            <span className="text-xs font-semibold text-glow-text">Preview</span>
            <span className="text-[10px] text-glow-muted font-mono">{lang}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={popout} className="flex items-center gap-1 px-2.5 py-1 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light text-[10px] font-medium rounded-lg hover:bg-glow-accent/25 transition-colors">
              <ExternalLink className="w-3 h-3"/>Pop out
            </button>
            <button onClick={onClose} className="p-1 text-glow-muted hover:text-glow-text"><X className="w-3.5 h-3.5"/></button>
          </div>
        </div>
        <div className="flex-1 bg-[#0d0d18]">
          <iframe srcDoc={(lang==="html"||lang==="jsx"||lang==="tsx")?code:`<!DOCTYPE html><html><head><style>body{background:#0d0d18;color:#e2e8f0;font-family:system-ui;padding:16px}</style></head><body><script>${code}<\/script></body></html>`}
            className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin" title="Preview"/>
        </div>
      </div>
    </div>
  );
}

// ── Compact action chip (editorMode) ──────────────────────────────────────────
// Instead of dumping the full file/command into the chat transcript, show a
// small collapsed pill describing what's happening. The actual apply/execute
// logic already runs independently in ChatPanel — this is purely visual.
const SHELL_LANGS = new Set(["bash","sh","shell","zsh","console"]);

function ActionChip({ lang, filename, code }: { lang: string; filename?: string; code: string }) {
  const [expanded, setExpanded] = useState(false);
  const isShell = SHELL_LANGS.has(lang.toLowerCase());
  const lineCount = code.split("\n").length;
  const firstLine = code.split("\n")[0]?.trim().slice(0, 60) ?? "";

  return (
    <div className="my-1.5 rounded-xl border border-glow-border/50 bg-glow-surface/60 overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-glow-card/40 transition-colors text-left">
        {isShell
          ? <Terminal className="w-3.5 h-3.5 text-glow-cyan flex-shrink-0"/>
          : <FileEdit className="w-3.5 h-3.5 text-glow-accent flex-shrink-0"/>}
        <span className="text-[11px] text-glow-text font-medium truncate flex-1">
          {isShell ? `Run: ${firstLine}` : filename ? `Writing ${filename}` : `Code block`}
        </span>
        <span className="text-[10px] text-glow-muted/60 flex-shrink-0">{lineCount}L</span>
        <ChevronDown className={cn("w-3 h-3 text-glow-muted flex-shrink-0 transition-transform", expanded && "rotate-180")}/>
      </button>
      {expanded && (
        <pre className="px-3 py-2 text-[10px] font-mono text-glow-muted/80 border-t border-glow-border/30 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">{code}</pre>
      )}
    </div>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────
function CodeBlock({ code, lang, filename, onCompile, onCreateProject, isProject }:
  { code:string; lang:string; filename?:string; onCompile?:()=>void; onCreateProject?:()=>void; isProject?:boolean }) {
  const [copied, setCopied]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [preview, setPreview] = useState(false);

  const isSolidity  = lang.toLowerCase() === "solidity" || lang.toLowerCase() === "sol";
  const isPreviewable = ["html","css","javascript","js","tsx","jsx"].includes(lang.toLowerCase());
  const lineCount   = code.split("\n").length;

  const labelMap: Record<string,string> = {
    solidity:"Solidity", sol:"Solidity", typescript:"TypeScript", javascript:"JavaScript",
    python:"Python", rust:"Rust", bash:"Shell", html:"HTML", css:"CSS",
    json:"JSON", tsx:"TSX", jsx:"JSX", sql:"SQL", yaml:"YAML",
  };
  const label = (labelMap[lang.toLowerCase()] ?? lang) || "Code";

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  return (
    <>
      <div className="my-2 rounded-lg overflow-hidden border border-glow-border/50 shadow-sm"
        style={{background:"linear-gradient(135deg,#0c0c16 0%,#09090f 100%)"}}>

        {/* Header bar */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-glow-border/30"
          style={{background:"linear-gradient(90deg,#0f0f1c 0%,#0d0d18 100%)"}}>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500/70"/>
              <span className="w-2 h-2 rounded-full bg-amber-500/70"/>
              <span className="w-2 h-2 rounded-full bg-emerald-500/70"/>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/4">
              <Terminal className="w-2.5 h-2.5 text-glow-muted/60"/>
              <span className="text-[10px] text-glow-muted/70 font-mono">{filename || label}</span>
            </div>
            <span className="text-[9px] text-glow-muted/30">{lineCount}L</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Solidity → Compile button */}
            {isSolidity && onCompile && (
              <button onClick={onCompile}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-glow-cyan border border-glow-cyan/25 bg-glow-cyan/8 rounded hover:bg-glow-cyan/15 transition-colors font-medium">
                <Hammer className="w-2.5 h-2.5"/>Compile
              </button>
            )}
            {/* Multiple files → Create Project button */}
            {isProject && onCreateProject && (
              <button onClick={onCreateProject}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/25 bg-emerald-500/8 rounded hover:bg-emerald-500/15 transition-colors font-medium">
                <FolderPlus className="w-2.5 h-2.5"/>Project
              </button>
            )}
            {isPreviewable && (
              <button onClick={()=>setPreview(true)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-glow-muted border border-glow-border/30 rounded hover:text-glow-cyan hover:border-glow-cyan/25 transition-colors">
                <Eye className="w-2.5 h-2.5"/>Preview
              </button>
            )}
            <button onClick={()=>setCollapsed(!collapsed)}
              className="p-0.5 text-glow-muted/50 hover:text-glow-text rounded transition-colors">
              <ChevronDown className={cn("w-3 h-3 transition-transform duration-150",collapsed&&"rotate-180")}/>
            </button>
            <button onClick={copy}
              className={cn("flex items-center gap-1 px-2 py-0.5 text-[10px] border rounded transition-all",
                copied?"text-emerald-400 border-emerald-500/25 bg-emerald-500/8":"text-glow-muted/70 border-glow-border/30 hover:text-glow-text hover:border-glow-accent/20")}>
              {copied?<Check className="w-2.5 h-2.5"/>:<Copy className="w-2.5 h-2.5"/>}
              {copied?"Copied":"Copy"}
            </button>
          </div>
        </div>

        {/* Code */}
        <div className={cn("overflow-hidden transition-all duration-150",collapsed?"max-h-0":"max-h-[450px] overflow-y-auto")}>
          <SyntaxHighlighter language={lang||"text"} style={vscDarkPlus}
            customStyle={{margin:0,padding:"12px 16px",background:"transparent",fontSize:"12px",lineHeight:"1.6",fontFamily:"'JetBrains Mono','Fira Code',Consolas,monospace"}}
            showLineNumbers={lineCount>4}
            lineNumberStyle={{color:"#2a2a3e",fontSize:"10px",minWidth:"2em",userSelect:"none"}}
            wrapLongLines={false}>
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
      {preview && <PreviewModal code={code} lang={lang} onClose={()=>setPreview(false)}/>}
    </>
  );
}

// ── Send to editor ────────────────────────────────────────────────────────────
function sendToEditor(files: Array<{filename:string;content:string;lang:string}>) {
  // Store in sessionStorage so editor page reads on load
  sessionStorage.setItem("glowide_editor_files", JSON.stringify(files));
  sessionStorage.setItem("glowide_editor_action", files.length === 1 ? "compile" : "project");
  // Dispatch event in case editor is already open on this page (ChatPanel in editor)
  window.dispatchEvent(new CustomEvent("glowide:load-files", { detail: { files, action: files.length === 1 ? "compile" : "project" } }));
  // Navigate to editor tab
  window.location.href = "/editor";
}

// ── AI Avatar ─────────────────────────────────────────────────────────────────
function AIAvatar({ isStreaming }: { isStreaming?:boolean }) {
  return (
    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 relative","bg-gradient-to-br from-glow-accent to-purple-700",isStreaming&&"animate-pulse")}>
      <Code2 className="w-3 h-3 text-white"/>
      {isStreaming && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-[#070710] animate-pulse"/>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Transaction Confirmation Card ────────────────────────────────────────────
// Sepolia testnet token addresses used by Developer-Controlled wallet transfers
const TOKEN_ADDR: Record<string, string> = {
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
};

const TOOL_ICONS: Record<string, React.ElementType> = {
  circle_transfer:         Send,
  circle_contract_execute: Zap,
  circle_cctp_bridge:      ArrowLeftRight,
  circle_gateway_transfer: Globe,
  circle_nanopayment:      Zap,
  get_wallet_balance:      CheckCircle,
};

const TOOL_LABELS: Record<string, string> = {
  circle_transfer:         "Send USDC",
  circle_contract_execute: "Execute Contract",
  circle_cctp_bridge:      "CCTP Bridge",
  circle_gateway_transfer: "Gateway Transfer",
  circle_nanopayment:      "Nanopayment",
  get_wallet_balance:      "Check Balance",
};

function TxConfirmCard({ toolCall, onExecute, onReject }:{
  toolCall: { id: string; name: string; args: Record<string, unknown> };
  onExecute(r: { success: boolean; message: string; txId?: string }): void;
  onReject(): void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [result,  setResult]  = React.useState<{ success: boolean; message: string; txId?: string } | null>(null);
  const circle = useCircleStore();
  const Icon   = TOOL_ICONS[toolCall.name] ?? Zap;
  const label  = TOOL_LABELS[toolCall.name] ?? toolCall.name;

  const execute = async () => {
    setLoading(true);
    try {
      const { name, args } = toolCall;
      const walletId = circle.activeWalletId ?? circle.wallets[0]?.id;

      if (!walletId && name !== "get_wallet_balance") {
        throw new Error("No Circle Developer Wallet found — create one in the Wallet tab first.");
      }

      let body: Record<string, unknown> = { walletId, blockchain: "ETH-SEPOLIA" };

      if (name === "circle_transfer") {
        body = { ...body, action: "transfer", to: args.to, amount: args.amount,
          tokenAddress: TOKEN_ADDR[(args.token as string)?.toUpperCase()] ?? undefined };
      } else if (name === "circle_contract_execute") {
        body = { ...body, action: "contract",
          contractAddress: args.contractAddress, abiFunctionSignature: args.abiFunctionSignature,
          abiParameters: args.abiParameters ?? [], value: args.value ?? "0" };
      } else if (name === "circle_cctp_bridge") {
        body = { ...body, action: "contract",
          contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
          abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
          abiParameters: [args.amount, 0, args.destinationAddress, args.destinationAddress] };
      } else if (name === "circle_gateway_transfer") {
        const res = await fetch("/api/circle/gateway", { method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ action: "transfer", sourceAddress: circle.wallets[0]?.address,
            destinationAddress: args.destinationAddress, amount: args.amount,
            sourceBlockchain: "ETH-SEPOLIA", destinationBlockchain: args.destinationChain }) });
        const d = await res.json() as { error?: string; id?: string };
        if (d.error) throw new Error(d.error);
        const r = { success: true, message: `Gateway transfer initiated${d.id ? `: ${d.id.slice(0,16)}…` : ""}`, txId: d.id };
        setResult(r); onExecute(r); setLoading(false); return;
      } else if (name === "circle_nanopayment") {
        const now = Math.floor(Date.now()/1000);
        const res = await fetch("/api/circle/nanopay", { method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ action: "settle", payerAddress: circle.wallets[0]?.address, payeeAddress: args.to,
            amount: args.amount, validAfter: now-60, validBefore: now+3600,
            nonce: "0x" + Math.random().toString(16).slice(2).padEnd(64,"0") }) });
        const d = await res.json() as { error?: string; settlementId?: string };
        if (d.error) throw new Error(d.error);
        const r = { success: true, message: `Nanopayment sent gas-free${d.settlementId ? `: ${d.settlementId.slice(0,16)}…` : ""}`, txId: d.settlementId };
        setResult(r); onExecute(r); setLoading(false); return;
      } else if (name === "get_wallet_balance") {
        const res = await fetch("/api/circle/dev-wallet", { method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ action: "balances", walletId }) });
        const d = await res.json() as { tokenBalances?: unknown[] };
        const r = { success: true, message: `Found ${d.tokenBalances?.length ?? 0} token balance(s)` };
        setResult(r); onExecute(r); setLoading(false); return;
      }

      // Real on-chain execution via Circle Developer-Controlled Wallets — server-signed,
      // no PIN/userToken needed, executes immediately.
      const res  = await fetch("/api/circle/dev-wallet", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const data = await res.json() as { id?: string; state?: string; txHash?: string; error?: string };

      if (data.error) throw new Error(data.error);

      const r = {
        success: true,
        message: data.txHash
          ? `✓ Executed on-chain: ${data.txHash.slice(0,16)}…`
          : data.id
            ? `✓ Transaction submitted (${data.state ?? "pending"}): ${data.id.slice(0,16)}…`
            : "Action completed",
        txId: data.id ?? data.txHash,
      };
      setResult(r); onExecute(r);
    } catch (e) {
      const r = { success: false, message: String(e) };
      setResult(r); onExecute(r);
    } finally { setLoading(false); }
  };

  if (result) return (
    <div className={cn("flex items-start gap-2 p-3 rounded-xl border text-xs mt-2",
      result.success ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20")}>
      {result.success ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0"/> : <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0"/>}
      <p className={result.success ? "text-emerald-400" : "text-red-400"}>{result.message}</p>
    </div>
  );

  return (
    <div className="mt-3 bg-glow-card border border-glow-accent/30 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-glow-accent/10 border-b border-glow-accent/20">
        <Icon className="w-4 h-4 text-glow-accent"/>
        <span className="text-sm font-semibold text-glow-accent-light">{label}</span>
        <span className="text-xs text-glow-muted/60 ml-auto">Requires confirmation</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {Object.entries(toolCall.args).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="text-glow-muted/60 w-28 flex-shrink-0 capitalize">{k.replace(/_/g," ")}</span>
            <span className="text-glow-text font-mono break-all">{String(v)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <button onClick={execute} disabled={loading}
          className="flex-1 py-2 bg-glow-gradient text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
          Confirm
        </button>
        <button onClick={onReject} disabled={loading}
          className="px-4 py-2 bg-glow-card border border-glow-border text-glow-muted text-sm rounded-xl hover:border-red-500/30 hover:text-red-400">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ChatMessage({ message, isStreaming, onEdit, onRetry, editorMode }: ChatMessageProps) {
  const [copied, setCopied]   = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(message.content);
  const isUser = message.role === "user";

  // Detect tool-call messages (JSON payload created by chat/page.tsx after AI
  // requests a transaction) and render the interactive confirm card instead
  // of raw JSON text.
  const toolCallData = useMemo(() => {
    if (isUser || isStreaming) return null;
    const trimmed = message.content.trim();
    if (!trimmed.startsWith("{") || !trimmed.includes("__toolCall")) return null;
    try {
      const parsed = JSON.parse(trimmed) as { __toolCall?: { id: string; name: string; args: Record<string, unknown> } };
      return parsed.__toolCall ?? null;
    } catch { return null; }
  }, [isUser, isStreaming, message.content]);

  // Detect all code blocks in this message
  const blocks = useMemo(() =>
    !isUser && !isStreaming ? detectBlocks(message.content) : [],
  [isUser, isStreaming, message.content]);

  // Check if there's a .sol block
  const solBlocks   = blocks.filter(b => b.lang.toLowerCase() === "sol" || b.lang.toLowerCase() === "solidity");
  // Check if there are multiple named-file blocks
  const namedBlocks = blocks.filter(b => b.filename && FILE_EXTENSIONS.test(b.filename));
  const isMultiFile = namedBlocks.length >= 2 || (blocks.length >= 2 && blocks.some(b => b.lang === "solidity" || b.lang === "sol"));

  const handleCompile = useCallback((code:string, lang:string) => {
    sendToEditor([{ filename: "Contract.sol", content: code, lang }]);
  }, []);

  const handleCreateProject = useCallback(() => {
    const files = (namedBlocks.length >= 2 ? namedBlocks : blocks).map(b => ({
      filename: b.filename || `file.${b.lang}`,
      content:  b.code,
      lang:     b.lang,
    }));
    sendToEditor(files);
  }, [namedBlocks, blocks]);

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  // ── User message ──────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end px-3 py-1 group animate-slide-in-right">
        <div className="relative max-w-[80%] lg:max-w-[68%]">
          {editing ? (
            <div className="space-y-1.5 min-w-[260px]">
              <textarea autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                className="w-full bg-glow-accent/80 text-white text-xs rounded-xl rounded-tr-sm p-2.5 resize-none focus:outline-none border border-glow-accent/60 min-h-[50px]" rows={3}/>
              <div className="flex gap-1.5 justify-end">
                <button onClick={()=>{setEditing(false);setEditVal(message.content);}}
                  className="text-[10px] text-glow-muted px-2.5 py-1 rounded-lg border border-glow-border">Cancel</button>
                <button onClick={()=>{onEdit?.(editVal);setEditing(false);}}
                  className="text-[10px] bg-glow-accent text-white px-2.5 py-1 rounded-lg">Resend</button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-glow-accent to-purple-700 rounded-xl rounded-tr-sm px-3 py-2 text-[11px] text-white shadow-sm shadow-glow-accent/15 whitespace-pre-wrap break-words">
              {message.content}
            </div>
          )}
          {!editing && (
            <div className="absolute -bottom-6 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <TinyBtn icon={copied?Check:Copy} label="Copy" onClick={copy} green={copied}/>
              {onEdit && <TinyBtn icon={Edit3} label="Edit" onClick={()=>{setEditing(true);setEditVal(message.content);}}/>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Tool-call message (AI requested a real transaction) ─────────────────────
  if (!isUser && toolCallData) {
    return (
      <div className="px-3 py-1.5 group animate-slide-in-left">
        <div className="flex items-start gap-2.5">
          <AIAvatar isStreaming={false}/>
          <div className="flex-1 min-w-0">
            <TxConfirmCard toolCall={toolCallData} onExecute={()=>{}} onReject={()=>{}}/>
          </div>
        </div>
      </div>
    );
  }

  // ── AI message ────────────────────────────────────────────────────────────
  return (
    <div className={cn("px-3 py-1.5 group",isStreaming?"animate-fade-in":"animate-slide-in-left")}>
      <div className="flex items-start gap-2.5">
        <AIAvatar isStreaming={isStreaming}/>
        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-[11px] leading-relaxed text-glow-text prose prose-invert max-w-none",
            "prose-p:my-1.5 prose-p:text-[11px] prose-p:text-glow-text prose-p:leading-relaxed",
            "prose-headings:text-glow-text prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1",
            "prose-h1:text-xs prose-h2:text-xs prose-h3:text-[11px]",
            "prose-ul:my-1.5 prose-li:my-0 prose-li:text-[11px] prose-li:text-glow-text",
            "prose-ol:my-1.5",
            "prose-strong:text-glow-text prose-strong:font-semibold",
            "prose-a:text-glow-cyan",
            "prose-blockquote:border-l-2 prose-blockquote:border-glow-accent/50 prose-blockquote:text-glow-muted prose-blockquote:pl-3 prose-blockquote:my-2",
            "prose-hr:border-glow-border/30 prose-hr:my-3",
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: (() => {
                  let blockCounter = -1; // reset each render pass, incremented per fenced block
                  return function CodeRenderer({ className, children }: { className?: string; children?: React.ReactNode }) {
                    const match = /language-(\w+)/.exec(className||"");
                    const lang  = match?.[1]??"";
                    const code  = String(children).replace(/\n$/,"");
                    if (!className) {
                      return <code className="bg-[#1a1a2e] text-glow-cyan px-1 py-0.5 rounded text-[11px] font-mono border border-glow-border/30">{children}</code>;
                    }
                    blockCounter++;
                    const filename = blocks[blockCounter]?.filename;
                    // In editorMode, show a compact action chip instead of the full
                    // code dump — the file/command is applied behind the scenes by
                    // ChatPanel; the chat transcript just needs to say what happened.
                    if (editorMode) {
                      return <ActionChip lang={lang} filename={filename} code={code}/>;
                    }
                    const isSol = lang==="sol"||lang==="solidity";
                    return (
                      <CodeBlock code={code} lang={lang} filename={filename}
                        onCompile={isSol ? ()=>handleCompile(code,lang) : undefined}
                        onCreateProject={isMultiFile ? handleCreateProject : undefined}
                        isProject={isMultiFile}
                      />
                    );
                  };
                })(),
                pre({ children }) { return <>{children}</>; },
                table({ children }) {
                  return <div className="overflow-x-auto my-2 rounded-lg border border-glow-border/40"><table className="w-full text-xs border-collapse">{children}</table></div>;
                },
                th({ children }) {
                  return <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-glow-muted uppercase tracking-wider bg-glow-surface border-b border-glow-border/40">{children}</th>;
                },
                td({ children }) {
                  return <td className="px-2.5 py-1.5 text-xs text-glow-text border-b border-glow-border/20">{children}</td>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && <span className="inline-block w-0.5 h-3.5 bg-glow-accent ml-0.5 animate-pulse align-middle rounded-sm"/>}
          </div>

          {/* Multi-file Create Project banner (outside markdown) */}
          {isMultiFile && !isStreaming && (
            <button onClick={handleCreateProject}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-500/20 transition-colors">
              <FolderPlus className="w-3.5 h-3.5"/>Create Project in Editor ({blocks.length} files)
            </button>
          )}
          {/* Solidity compile banner */}
          {solBlocks.length > 0 && !isMultiFile && !isStreaming && (
            <button onClick={()=>handleCompile(solBlocks[0].code, "solidity")}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-glow-cyan/10 border border-glow-cyan/20 text-glow-cyan text-xs font-medium rounded-lg hover:bg-glow-cyan/20 transition-colors">
              <Hammer className="w-3.5 h-3.5"/>Compile in Editor
            </button>
          )}

          {/* Action row */}
          {!isStreaming && (
            <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <TinyBtn icon={copied?Check:Copy} label={copied?"Copied":"Copy"} onClick={copy} green={copied}/>
              {onRetry && <TinyBtn icon={RotateCcw} label="Retry" onClick={onRetry}/>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TinyBtn({ icon:Icon, label, onClick, green }:{icon:React.ElementType;label:string;onClick:()=>void;green?:boolean}) {
  return (
    <button onClick={onClick}
      className={cn("flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border transition-all",
        green?"text-emerald-400 border-emerald-500/20 bg-emerald-500/8":"text-glow-muted/60 border-glow-border/30 bg-glow-card/30 hover:text-glow-text hover:border-glow-accent/20")}>
      <Icon className="w-2.5 h-2.5"/>{label}
    </button>
  );
}
