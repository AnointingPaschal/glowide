"use client";
import React from "react";
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
  Zap, Send, Globe, ArrowLeftRight, FolderPlus, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types";
import { resolveActiveWallet, executeContractCall, executeTransfer } from "@/lib/walletExec";
import { useChatStore } from "@/store/chatStore";
import { useLocalWalletStore } from "@/store/localWalletStore";

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
import { GlowLogo } from "@/components/ui/GlowLogo";

function AIAvatar({ isStreaming }: { isStreaming?:boolean }) {
  return (
    <div className="relative flex-shrink-0 mt-0.5 w-6 h-6">
      {isStreaming && (
        <div className="absolute inset-0 rounded-full bg-glow-accent/20 blur-sm animate-pulse"/>
      )}
      <GlowLogo
        size={24}
        animate={isStreaming}
        className={`relative dark:text-white text-purple-800 ${isStreaming ? "" : "opacity-70"}`}
      />
    </div>
  );
}

// ── Inline wallet creation — real BIP-39 generation, embedded directly in
// chat so the user never has to leave the conversation to get started. ─────
function InlineCreateWallet({ onDone }: { onDone: () => void }) {
  const [step, setStep] = React.useState<"generating"|"backup"|"password"|"done">("generating");
  const [mnemonic, setMnemonic] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string|null>(null);

  React.useEffect(() => {
    (async () => {
      const { ethers } = await import("ethers");
      const wallet = ethers.Wallet.createRandom();
      setMnemonic(wallet.mnemonic!.phrase);
      setStep("backup");
    })();
  }, []);

  const finish = async () => {
    if (!password || password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setCreating(true); setError(null);
    try {
      const { ethers } = await import("ethers");
      const wallet = ethers.Wallet.fromPhrase(mnemonic);
      const encryptedJson = await wallet.encrypt(password);
      useLocalWalletStore.getState().addWallet({
        id: crypto.randomUUID(), name: "Website Wallet", address: wallet.address,
        encryptedJson, createdAt: Date.now(),
      });
      setStep("done");
      setTimeout(onDone, 1200);
    } catch (e) {
      setError(String(e));
    } finally { setCreating(false); }
  };

  return (
    <div className="mt-3 bg-glow-card border border-glow-accent/25 rounded-2xl overflow-hidden shadow-lg animate-scale-in">
      <div className="flex items-center gap-2 px-4 py-3 bg-glow-accent/10 border-b border-glow-accent/20">
        <Zap className="w-4 h-4 text-glow-accent"/>
        <span className="text-sm font-semibold text-glow-accent-light">Create Website Wallet</span>
      </div>

      {step === "generating" && (
        <div className="px-4 py-6 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-glow-accent animate-spin"/>
          <p className="text-xs text-glow-muted">Generating your wallet…</p>
        </div>
      )}

      {step === "backup" && (
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs text-glow-muted">Save this recovery phrase somewhere safe. It's the only way to recover your wallet — nobody else can retrieve it for you.</p>
          <div className="grid grid-cols-3 gap-1.5 p-3 bg-glow-bg border border-glow-border rounded-xl">
            {mnemonic.split(" ").map((w, i) => (
              <div key={i} className="flex items-center gap-1 text-[11px] font-mono text-glow-text">
                <span className="text-glow-muted/40">{i+1}.</span>{w}
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="w-3.5 h-3.5 rounded accent-glow-accent"/>
            <span className="text-xs text-glow-text">I've saved my recovery phrase</span>
          </label>
          <button onClick={()=>setStep("password")} disabled={!confirmed}
            className="w-full py-2.5 bg-glow-gradient text-white text-sm font-semibold rounded-xl disabled:opacity-50">
            Continue
          </button>
        </div>
      )}

      {step === "password" && (
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs text-glow-muted">Set a password to encrypt your wallet on this device.</p>
          <input type="password" value={password} onChange={e=>{setPassword(e.target.value); setError(null);}}
            placeholder="Password (min. 6 characters)" autoFocus
            onKeyDown={e=>{if(e.key==="Enter") finish();}}
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2.5 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50"/>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={finish} disabled={creating}
            className="w-full py-2.5 bg-glow-gradient text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
            {creating ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
            {creating ? "Creating…" : "Create Wallet"}
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="px-4 py-6 flex flex-col items-center gap-2">
          <CheckCircle className="w-8 h-8 text-emerald-400"/>
          <p className="text-sm font-semibold text-emerald-400">Wallet created!</p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Transaction Confirmation Card ────────────────────────────────────────────
// Real Arc Testnet token addresses — used for transfers via the shared wallet dispatch
const TOKEN_ADDR: Record<string, string> = {
  USDC:   "0x3600000000000000000000000000000000000000",
  EURC:   "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  CIRBTC: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
  USYC:   "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
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

function Row({ label, value, mono }: { label:string; value:string; mono?:boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-glow-muted/50 w-20 flex-shrink-0">{label}</span>
      <span className={cn("text-glow-text break-all", mono && "font-mono")}>{value}</span>
    </div>
  );
}

interface TxResult {
  success: boolean; message: string; txId?: string;
  walletType?: "local" | "circle" | "metamask"; from?: string; to?: string;
  amount?: string; token?: string; network?: string; timestamp?: string;
}

const ARC_EXPLORER = "https://testnet.arcscan.app";

// ── Final transaction result — shown live after execution AND persisted
// permanently into the message once successful, so reloading the chat never
// reverts back to a Confirm button (which would risk a duplicate send). ────
function TxResultCard({ result, onRetry, onCancel }: { result: TxResult; onRetry?: () => void; onCancel?: () => void }) {
  return (
    <div className={cn(
      "mt-2 rounded-2xl border overflow-hidden text-xs shadow-lg animate-scale-in",
      result.success ? "bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 border-emerald-500/25" : "bg-gradient-to-b from-red-500/10 to-red-500/5 border-red-500/25"
    )}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5">
        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
          result.success ? "bg-emerald-500/20" : "bg-red-500/20")}>
          {result.success ? <CheckCircle className="w-4 h-4 text-emerald-400"/> : <AlertTriangle className="w-4 h-4 text-red-400"/>}
        </div>
        <p className={cn("font-semibold text-sm", result.success ? "text-emerald-400" : "text-red-400")}>
          {result.success ? (result.txId ? "Transaction Confirmed" : "Wallet Balance") : "Transaction Failed"}
        </p>
      </div>
      {result.success ? (
        <div className="px-4 py-3 space-y-2">
          {result.amount && !result.message.includes('\n') && (
            <div className="text-center py-2 mb-1">
              <p className="text-2xl font-bold text-glow-text">{result.amount} <span className="text-glow-accent-light">{result.token ?? ""}</span></p>
            </div>
          )}
          {result.message.includes('\n') ? (
            <pre className="text-xs text-glow-text font-mono whitespace-pre-wrap leading-relaxed bg-glow-surface/60 rounded-xl p-3">{result.message}</pre>
          ) : (
            <>
              {result.from && <Row label="From" value={result.from} mono/>}
              {result.to     && <Row label="To" value={result.to} mono/>}
              {result.network && <Row label="Network" value={result.network}/>}
              {result.txId && <Row label="Tx Hash" value={result.txId} mono/>}
              {result.timestamp && <Row label="Time" value={new Date(result.timestamp).toLocaleString()}/>}
            </>
          )}
          {result.txId && (
            <a href={`${ARC_EXPLORER}/tx/${result.txId}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 mt-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15 transition-colors font-medium">
              <ExternalLink className="w-3.5 h-3.5"/>View on ArcScan
            </a>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 space-y-3">
          <p className="text-red-400/90">{result.message}</p>
          {(onRetry || onCancel) && (
            <div className="flex gap-2">
              {onRetry && (
                <button onClick={onRetry}
                  className="flex-1 py-2 bg-glow-gradient text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5"/>Retry
                </button>
              )}
              {onCancel && (
                <button onClick={onCancel}
                  className="px-4 py-2 bg-glow-card border border-glow-border text-glow-muted text-xs font-semibold rounded-xl hover:text-glow-text transition-colors">
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TxConfirmCard({ toolCall, onExecute, onReject, messageId, sessionId }:{
  toolCall: { id: string; name: string; args: Record<string, unknown> };
  onExecute(r: TxResult): void;
  onReject(): void;
  messageId?: string;
  sessionId?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [signingWith, setSigningWith] = React.useState<"local"|"circle"|"metamask"|null>(null);
  const [result,  setResult]  = React.useState<TxResult | null>(null);
  const [creatingWallet, setCreatingWallet] = React.useState(false);
  const localWallet = useLocalWalletStore();
  const hasAnyWallet = !!resolveActiveWallet();
  const Icon   = TOOL_ICONS[toolCall.name] ?? Zap;
  const label  = TOOL_LABELS[toolCall.name] ?? toolCall.name;

  // Persist the final result into the actual message (and sync to DB) so
  // reloading the chat never reverts back to showing Confirm again — that
  // would risk the user accidentally re-sending the same transaction.
  const persistResult = (r: TxResult) => {
    if (messageId && sessionId) {
      useChatStore.getState().updateMessage(sessionId, messageId, JSON.stringify({ __txResult: r }));
      const session = useChatStore.getState().sessions.find(s => s.id === sessionId);
      const wallet = resolveActiveWallet();
      if (session && wallet?.address) {
        fetch("/api/chat/sessions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, wallet: wallet.address }),
        }).catch(() => {});
      }
    }
  };

  const execute = async () => {
    setLoading(true);
    try {
      const { name, args } = toolCall;
      const wallet = resolveActiveWallet();
      setSigningWith(wallet?.type ?? null);

      if (!wallet && name !== "circle_gateway_transfer" && name !== "circle_nanopayment") {
        throw new Error("No wallet connected — connect one in the Wallet tab, then approve this transaction.");
      }

      if (name === "circle_transfer") {
        const r = await executeTransfer({
          to: args.to as string, amount: args.amount as string,
          tokenAddress: TOKEN_ADDR[(args.token as string)?.toUpperCase()],
        });
        if (r.error) throw new Error(r.error);
        const result: TxResult = {
          success: true, message: r.txHash ? `✓ Sent — ${r.txHash.slice(0,16)}…` : "✓ Transfer sent", txId: r.txHash,
          walletType: wallet?.type, from: wallet?.address,
          to: args.to as string, amount: args.amount as string, token: (args.token as string)?.toUpperCase() ?? "USDC",
          network: "Arc Testnet", timestamp: new Date().toISOString(),
        };
        setResult(result); onExecute(result); persistResult(result); setLoading(false); return;
      }

      if (name === "circle_contract_execute") {
        const r = await executeContractCall({
          contractAddress: args.contractAddress as string,
          signature: args.abiFunctionSignature as string,
          params: (args.abiParameters as Array<string|number>) ?? [],
        });
        if (r.error) throw new Error(r.error);
        const result: TxResult = {
          success: true, message: r.txHash ? `✓ Executed on-chain — ${r.txHash.slice(0,16)}…` : "✓ Transaction submitted", txId: r.txHash,
          walletType: wallet?.type, from: wallet?.address,
          to: args.contractAddress as string, network: "Arc Testnet", timestamp: new Date().toISOString(),
        };
        setResult(result); onExecute(result); persistResult(result); setLoading(false); return;
      }

      if (name === "circle_cctp_bridge") {
        const r = await executeContractCall({
          contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
          signature: "depositForBurn(uint256,uint32,bytes32,address)",
          params: [args.amount as string, 0, args.destinationAddress as string, args.destinationAddress as string],
        });
        if (r.error) throw new Error(r.error);
        const result: TxResult = {
          success: true, message: r.txHash ? `✓ Bridging via CCTP — ${r.txHash.slice(0,16)}…` : "✓ Bridge transaction submitted", txId: r.txHash,
          walletType: wallet?.type, from: wallet?.address,
          to: args.destinationAddress as string, amount: args.amount as string, token: "USDC",
          network: "Arc Testnet → " + ((args.destinationChain as string) ?? "destination chain"), timestamp: new Date().toISOString(),
        };
        setResult(result); onExecute(result); persistResult(result); setLoading(false); return;
      }

      // Circle-only products — Gateway (instant cross-chain USDC) and
      // Nanopay (x402 gasless micropayments) are Circle infrastructure with
      // no MetaMask/local-wallet equivalent, so these still require a Circle wallet.
      if (name === "circle_gateway_transfer") {
        const res = await fetch("/api/circle/gateway", { method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ action: "transfer", sourceAddress: wallet?.address,
            destinationAddress: args.destinationAddress, amount: args.amount,
            sourceBlockchain: "ARC-TESTNET", destinationBlockchain: args.destinationChain }) });
        const d = await res.json() as { error?: string; id?: string };
        if (d.error) throw new Error(d.error);
        const r = { success: true, message: `Gateway transfer initiated${d.id ? `: ${d.id.slice(0,16)}…` : ""}`, txId: d.id };
        setResult(r); onExecute(r); persistResult(r); setLoading(false); return;
      }
      if (name === "circle_nanopayment") {
        const now = Math.floor(Date.now()/1000);
        const res = await fetch("/api/circle/nanopay", { method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ action: "settle", payerAddress: wallet?.address, payeeAddress: args.to,
            amount: args.amount, validAfter: now-60, validBefore: now+3600,
            nonce: "0x" + Math.random().toString(16).slice(2).padEnd(64,"0") }) });
        const d = await res.json() as { error?: string; settlementId?: string };
        if (d.error) throw new Error(d.error);
        const r = { success: true, message: `Nanopayment sent gas-free${d.settlementId ? `: ${d.settlementId.slice(0,16)}…` : ""}`, txId: d.settlementId };
        setResult(r); onExecute(r); persistResult(r); setLoading(false); return;
      }

      if (name === "get_wallet_balance") {
        const addr = wallet?.address;
        if (!addr) {
          const r = { success: true, message: "No wallet connected — create or import one in the Wallet tab." };
          setResult(r); onExecute(r); setLoading(false); return;
        }
        try {
          const res = await fetch(`/api/wallet/arc-balances?address=${addr}`);
          const d = await res.json() as {
            balances?: Record<string, { name: string; amount: string; decimals: number }>;
            nativeGasUSDC?: string;
            error?: string;
          };
          if (d.error) throw new Error(d.error);
          const bals = d.balances ?? {};
          const lines: string[] = [];
          if (d.nativeGasUSDC && parseFloat(d.nativeGasUSDC) > 0)
            lines.push(`USDC (native gas): ${parseFloat(d.nativeGasUSDC).toFixed(4)}`);
          for (const [sym, b] of Object.entries(bals))
            if (parseFloat(b.amount) > 0)
              lines.push(`${sym}: ${parseFloat(b.amount).toFixed(sym === 'cirBTC' ? 6 : 2)}`);
          const message = lines.length === 0
            ? `Wallet: ${addr.slice(0,8)}…${addr.slice(-6)}\n\nAll balances are 0 on Arc Testnet.`
            : `Wallet: ${addr.slice(0,8)}…${addr.slice(-6)}\n\n${lines.join('\n')}`;
          const r = { success: true, message };
          setResult(r); onExecute(r); setLoading(false); return;
        } catch {
          const r = { success: true, message: `Wallet: ${addr.slice(0,8)}…${addr.slice(-6)}\n\nCouldn't fetch live balances — check the Wallet tab.` };
          setResult(r); onExecute(r); setLoading(false); return;
        }
      }

      throw new Error(`Unknown action: ${name}`);
    } catch (e) {
      const r = { success: false, message: String(e) };
      setResult(r); onExecute(r);
    } finally { setLoading(false); }
  };

  if (result) return (
    <TxResultCard result={result}
      onRetry={!result.success ? () => { setResult(null); execute(); } : undefined}
      onCancel={!result.success ? onReject : undefined}/>
  );

  if (creatingWallet) {
    return <InlineCreateWallet onDone={() => setCreatingWallet(false)}/>;
  }

  return (
    <div className="mt-3 bg-glow-card border border-glow-accent/25 rounded-2xl overflow-hidden shadow-lg animate-scale-in">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-glow-accent/15 to-glow-cyan/10 border-b border-glow-accent/20">
        <div className="w-7 h-7 rounded-full bg-glow-accent/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-glow-accent"/>
        </div>
        <span className="text-sm font-semibold text-glow-accent-light flex-1">{label}</span>
        <span className="text-[10px] text-glow-muted/60 bg-glow-surface px-2 py-1 rounded-full">Review</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {Object.entries(toolCall.args).filter(([k]) => k !== "reason").map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="text-glow-muted/60 w-24 flex-shrink-0 capitalize">{k.replace(/_/g," ")}</span>
            <span className="text-glow-text font-mono break-all">{String(v)}</span>
          </div>
        ))}
      </div>

      {!hasAnyWallet ? (
        <div className="px-4 pb-4 space-y-2.5">
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-300/90">You don't have a wallet yet. Create one now to continue — takes a few seconds.</p>
          </div>
          <button onClick={() => setCreatingWallet(true)}
            className="w-full py-2.5 bg-glow-gradient text-white text-sm font-semibold rounded-xl">
            Create Wallet
          </button>
        </div>
      ) : (
        <div className="flex gap-2 px-4 pb-4">
          <button onClick={execute} disabled={loading}
            className="flex-1 py-2.5 bg-glow-gradient text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-transform active:scale-[0.98]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
            {loading
              ? signingWith === "local" ? "Enter password to sign…" : signingWith === "circle" ? "Signing via Circle…" : signingWith === "metamask" ? "Confirm in MetaMask…" : "Signing…"
              : "Confirm"}
          </button>
          <button onClick={onReject} disabled={loading}
            className="px-4 py-2.5 bg-glow-card border border-glow-border text-glow-muted text-sm rounded-xl hover:border-red-500/30 hover:text-red-400 transition-colors">
            Cancel
          </button>
        </div>
      )}
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

  // Detect a PERSISTED transaction result (set once TxConfirmCard finishes
  // executing successfully) — takes priority over toolCallData so a
  // completed transaction never reverts back to showing Confirm on reload.
  const txResultData = useMemo(() => {
    if (isUser || isStreaming) return null;
    const trimmed = message.content.trim();
    if (!trimmed.startsWith("{") || !trimmed.includes("__txResult")) return null;
    try {
      const parsed = JSON.parse(trimmed) as { __txResult?: TxResult };
      return parsed.__txResult ?? null;
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
            <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="flex items-center bg-glow-card border border-glow-border rounded-full shadow-sm overflow-hidden">
                <button onClick={copy} title="Copy" aria-label="Copy"
                  className={cn("flex items-center justify-center w-7 h-7 transition-colors", copied ? "text-emerald-400" : "text-glow-muted/60 hover:text-glow-text hover:bg-glow-surface")}>
                  {copied ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
                </button>
                {onEdit && (
                  <>
                    <div className="w-px h-4 bg-glow-border"/>
                    <button onClick={()=>{setEditing(true);setEditVal(message.content);}} title="Edit" aria-label="Edit"
                      className="flex items-center justify-center w-7 h-7 text-glow-muted/60 hover:text-glow-text hover:bg-glow-surface transition-colors">
                      <Edit3 className="w-3 h-3"/>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Persisted transaction result (already executed — never shows Confirm again) ──
  if (!isUser && txResultData) {
    return (
      <div className="px-3 py-1.5 group animate-slide-in-left">
        <div className="flex items-start gap-2.5">
          <AIAvatar isStreaming={false}/>
          <div className="flex-1 min-w-0">
            <TxResultCard result={txResultData}/>
          </div>
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
            <TxConfirmCard toolCall={toolCallData} onExecute={()=>{}} onReject={()=>{}} messageId={message.id} sessionId={message.session_id}/>
          </div>
        </div>
      </div>
    );
  }

  // ── AI message ────────────────────────────────────────────────────────────
  return (
    <div className={cn("px-3 py-2 group",isStreaming?"animate-fade-in":"animate-slide-in-left")}>
      <div className="flex items-start gap-2.5">
        <AIAvatar isStreaming={isStreaming}/>
        <div className="flex-1 min-w-0 bg-glow-card/60 border border-glow-border/40 rounded-2xl rounded-tl-sm px-3.5 py-3 shadow-sm">
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
            <div className="flex mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="flex items-center bg-glow-card border border-glow-border rounded-full shadow-sm overflow-hidden">
                <button onClick={copy} title={copied ? "Copied" : "Copy"} aria-label="Copy"
                  className={cn("flex items-center justify-center w-7 h-7 transition-colors", copied ? "text-emerald-400" : "text-glow-muted/60 hover:text-glow-text hover:bg-glow-surface")}>
                  {copied ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
                </button>
                {onRetry && (
                  <>
                    <div className="w-px h-4 bg-glow-border"/>
                    <button onClick={onRetry} title="Regenerate" aria-label="Regenerate"
                      className="flex items-center justify-center w-7 h-7 text-glow-muted/60 hover:text-glow-text hover:bg-glow-surface transition-colors">
                      <RotateCcw className="w-3 h-3"/>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TinyBtn({ icon:Icon, label, onClick, green }:{icon:React.ElementType;label:string;onClick:()=>void;green?:boolean}) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={cn("flex items-center justify-center w-6 h-6 rounded-full border transition-all active:scale-90",
        green?"text-emerald-400 border-emerald-500/25 bg-emerald-500/10":"text-glow-muted/50 border-glow-border/30 bg-glow-card/40 hover:text-glow-text hover:border-glow-accent/30 hover:bg-glow-card")}>
      <Icon className="w-3 h-3"/>
    </button>
  );
}
