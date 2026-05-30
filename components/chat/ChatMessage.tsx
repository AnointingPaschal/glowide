"use client";
import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Copy, Check, Edit3, RotateCcw, Eye, EyeOff,
  ChevronDown, Terminal, Code2, Maximize2, X, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types";
import { extractPreviewableCode } from "@/components/preview/CodePreview";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onEdit?: (content: string) => void;
  onRetry?: () => void;
}

// ── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ code, lang, onClose }: { code: string; lang: string; onClose: () => void }) {
  const openInTab = () => {
    const content = lang === "html"
      ? code
      : `<!DOCTYPE html><html><head><script>${code}<\/script></head><body></body></html>`;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-4xl h-[80vh] bg-[#0e0e1a] border border-glow-border rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-glow-border bg-[#111120] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-glow-accent"/>
            <span className="text-sm font-semibold text-glow-text">Preview</span>
            <span className="text-xs text-glow-muted font-mono">{lang}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openInTab}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light text-xs font-medium rounded-lg hover:bg-glow-accent/25 transition-colors">
              <ExternalLink className="w-3 h-3"/>Pop out
            </button>
            <button onClick={onClose} className="p-1.5 text-glow-muted hover:text-glow-text rounded-lg hover:bg-glow-card transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>
        {/* Preview iframe */}
        <div className="flex-1 bg-[#1a1a2e]">
          <iframe
            srcDoc={lang === "html" ? code : `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;padding:16px;background:#fff}</style><\/head><body><script>${code}<\/script><\/body><\/html>`}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Code Preview"
          />
        </div>
      </div>
    </div>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied]     = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewable = ["html", "css", "javascript", "js", "tsx", "jsx"].includes(lang.toLowerCase());
  const lineCount = code.split("\n").length;

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // Filename hint from lang
  const langLabel: Record<string, string> = {
    solidity: "Solidity",  typescript: "TypeScript", javascript: "JavaScript",
    python: "Python",      rust: "Rust",             bash: "Bash / Shell",
    html: "HTML",          css: "CSS",               json: "JSON",
    tsx: "TSX",            jsx: "JSX",               sql: "SQL",
  };
  const label = (langLabel[lang.toLowerCase()] ?? lang) || "Code";

  return (
    <>
      <div className="my-2 rounded-xl overflow-hidden border border-glow-border/60 shadow-md group/block"
        style={{ background: "linear-gradient(135deg,#0d0d18 0%,#0a0a14 100%)" }}>
        {/* Terminal bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-glow-border/40"
          style={{ background: "linear-gradient(90deg,#111120 0%,#0f0f1d 100%)" }}>
          <div className="flex items-center gap-2">
            {/* Traffic lights */}
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors cursor-default"/>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 hover:bg-amber-400 transition-colors cursor-default"/>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 hover:bg-emerald-400 transition-colors cursor-default"/>
            </div>
            <div className="flex items-center gap-1.5 ml-1.5 px-2 py-0.5 rounded-md bg-glow-surface">
              <Terminal className="w-3 h-3 text-glow-muted/60"/>
              <span className="text-[11px] text-glow-muted/80 font-mono">{label}</span>
            </div>
            <span className="text-[10px] text-glow-muted/40">{lineCount} lines</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {previewable && (
              <button onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-glow-muted hover:text-glow-cyan border border-glow-border/40 hover:border-glow-cyan/30 rounded-lg transition-all hover:bg-glow-cyan/5">
                <Eye className="w-3 h-3"/>Preview
              </button>
            )}
            <button onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 text-glow-muted hover:text-glow-text rounded-lg transition-colors hover:bg-white/5"
              title={collapsed ? "Expand" : "Collapse"}>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", collapsed && "rotate-180")}/>
            </button>
            <button onClick={copy}
              className={cn("flex items-center gap-1 px-2 py-1 text-[10px] border rounded-lg transition-all",
                copied
                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  : "text-glow-muted hover:text-glow-text border-glow-border/40 hover:border-glow-accent/30 hover:bg-glow-accent/5"
              )}>
              {copied ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Code body */}
        <div className={cn("overflow-hidden transition-all duration-200", collapsed ? "max-h-0" : "max-h-[600px] overflow-y-auto")}>
          <SyntaxHighlighter
            language={lang || "text"}
            style={vscDarkPlus}
            customStyle={{
              margin: 0, padding: "16px 20px",
              background: "transparent",
              fontSize: "13px",
              lineHeight: "1.65",
              fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
            }}
            showLineNumbers={lineCount > 3}
            lineNumberStyle={{ color: "#2d2d45", fontSize: "11px", minWidth: "2.5em", userSelect: "none" }}
            wrapLongLines={false}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>

      {previewOpen && <PreviewModal code={code} lang={lang} onClose={() => setPreviewOpen(false)}/>}
    </>
  );
}

// ── Streaming cursor ───────────────────────────────────────────────────────────
function StreamingCursor() {
  return <span className="inline-block w-0.5 h-4 bg-glow-accent ml-0.5 animate-pulse align-middle rounded-full"/>;
}

// ── AI Avatar ─────────────────────────────────────────────────────────────────
function AIAvatar({ isStreaming }: { isStreaming?: boolean }) {
  return (
    <div className={cn(
      "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-glow-sm relative",
      "bg-gradient-to-br from-glow-accent to-purple-600",
      isStreaming && "animate-pulse"
    )}>
      <Code2 className="w-3.5 h-3.5 text-white"/>
      {isStreaming && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#080812] animate-pulse"/>
      )}
    </div>
  );
}

// ── Main ChatMessage ──────────────────────────────────────────────────────────
export function ChatMessage({ message, isStreaming, onEdit, onRetry }: ChatMessageProps) {
  const [copied, setCopied]   = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(message.content);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // ── User message ──────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2 group animate-slide-in-right">
        <div className="relative max-w-[82%] lg:max-w-[70%]">
          {editing ? (
            <div className="space-y-2 w-full min-w-[300px]">
              <textarea autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                className="w-full bg-glow-accent/80 text-white text-sm rounded-2xl rounded-tr-sm p-3 resize-none focus:outline-none border border-glow-accent/60 min-h-[60px]"
                rows={3}/>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setEditing(false); setEditVal(message.content); }}
                  className="text-xs text-glow-muted hover:text-glow-text px-3 py-1.5 rounded-lg border border-glow-border">Cancel</button>
                <button onClick={() => { onEdit?.(editVal); setEditing(false); }}
                  className="text-xs bg-glow-accent text-white px-3 py-1.5 rounded-lg hover:bg-glow-accent/90">Resend</button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-glow-accent to-purple-600 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white shadow-md shadow-glow-accent/20 whitespace-pre-wrap break-words">
              {message.content}
            </div>
          )}
          {!editing && (
            <div className="absolute -bottom-7 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionBtn icon={copied ? Check : Copy} label="Copy" onClick={copy} green={copied}/>
              {onEdit && <ActionBtn icon={Edit3} label="Edit" onClick={() => { setEditing(true); setEditVal(message.content); }}/>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── AI message ────────────────────────────────────────────────────────────
  return (
    <div className={cn("px-3 py-1.5 group", isStreaming ? "animate-fade-in" : "animate-slide-in-left")}>
      <div className="flex items-start gap-3">
        <AIAvatar isStreaming={isStreaming}/>

        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-sm text-glow-text prose prose-invert max-w-none",
            "prose-p:leading-relaxed prose-p:my-2 prose-p:text-glow-text",
            "prose-headings:text-glow-text prose-headings:font-bold",
            "prose-ul:my-2 prose-li:my-0.5 prose-li:text-glow-text",
            "prose-ol:my-2",
            "prose-strong:text-glow-text prose-strong:font-semibold",
            "prose-a:text-glow-cyan hover:prose-a:underline",
            "prose-blockquote:border-l-glow-accent/50 prose-blockquote:text-glow-muted",
            "prose-hr:border-glow-border",
            "prose-table:border-collapse",
            "prose-th:text-glow-muted prose-th:text-xs prose-th:uppercase prose-th:tracking-wider",
            "prose-td:text-glow-text prose-td:border-glow-border/30",
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const lang  = match?.[1] ?? "";
                  const code  = String(children).replace(/\n$/, "");
                  const inline = !className;
                  if (inline) {
                    return (
                      <code className="bg-[#1a1a2e] text-glow-cyan px-1.5 py-0.5 rounded text-[12px] font-mono border border-glow-border/40">
                        {children}
                      </code>
                    );
                  }
                  return <CodeBlock code={code} lang={lang}/>;
                },
                pre({ children }) { return <>{children}</>; },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-3 rounded-xl border border-glow-border/40">
                      <table className="w-full text-sm border-collapse">{children}</table>
                    </div>
                  );
                },
                th({ children }) {
                  return <th className="px-3 py-2 text-left text-xs font-semibold text-glow-muted uppercase tracking-wider bg-glow-surface border-b border-glow-border/40">{children}</th>;
                },
                td({ children }) {
                  return <td className="px-3 py-2 text-sm text-glow-text border-b border-glow-border/20">{children}</td>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && <StreamingCursor/>}
          </div>

          {/* Action bar */}
          {!isStreaming && (
            <div className="flex items-center gap-1 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionBtn icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy"} onClick={copy} green={copied}/>
              {onRetry && <ActionBtn icon={RotateCcw} label="Retry" onClick={onRetry}/>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tiny action button ────────────────────────────────────────────────────────
function ActionBtn({ icon: Icon, label, onClick, green }: { icon: React.ElementType; label: string; onClick: () => void; green?: boolean }) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border transition-all",
        green
          ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/10"
          : "text-glow-muted border-glow-border/50 bg-glow-card/50 hover:text-glow-text hover:border-glow-accent/30 hover:bg-glow-accent/5"
      )}>
      <Icon className="w-3 h-3"/>{label}
    </button>
  );
}
