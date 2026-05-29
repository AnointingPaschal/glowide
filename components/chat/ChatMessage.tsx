"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Copy, Check, Edit3, ExternalLink, RotateCcw, Eye,
  ChevronDown, Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types";
import { extractPreviewableCode, CodePreview } from "@/components/preview/CodePreview";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onEdit?: (content: string) => void;
  onRetry?: () => void;
}

export function ChatMessage({ message, isStreaming, onEdit, onRetry }: ChatMessageProps) {
  const [copied, setCopied]     = useState(false);
  const [editing, setEditing]   = useState(false);
  const [editVal, setEditVal]   = useState(message.content);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const previewable = !isUser ? extractPreviewableCode(message.content) : null;

  const openExternal = () => {
    const blob = new Blob([message.content.replace(/```[\w]*\n|```/g, "")], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  // ── User message ──────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2 group">
        <div className="relative max-w-[80%]">
          {editing ? (
            <div className="space-y-2">
              <textarea autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                className="w-full bg-glow-accent/80 text-white text-sm rounded-2xl rounded-tr-sm p-3 resize-none focus:outline-none min-w-[200px] border border-glow-accent"
                rows={3}/>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setEditing(false); setEditVal(message.content); }}
                  className="text-xs text-glow-muted hover:text-glow-text px-3 py-1 rounded-lg border border-glow-border">Cancel</button>
                <button onClick={() => { onEdit?.(editVal); setEditing(false); }}
                  className="text-xs bg-glow-accent text-white px-3 py-1 rounded-lg hover:bg-glow-accent/90">Save & Resend</button>
              </div>
            </div>
          ) : (
            <div className="bg-glow-accent rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white whitespace-pre-wrap">
              {message.content}
            </div>
          )}
          {!editing && (
            <div className="absolute -bottom-6 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
    <div className="px-4 py-2 group">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-7 h-7 rounded-xl bg-glow-gradient flex items-center justify-center flex-shrink-0 mt-0.5 shadow-glow-sm">
          <span className="text-white text-[10px] font-bold">AI</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Message content */}
          <div className={cn(
            "text-sm text-glow-text prose prose-invert max-w-none",
            "prose-p:leading-relaxed prose-p:my-2",
            "prose-headings:text-glow-text",
            "prose-ul:my-2 prose-li:my-0.5",
            "prose-a:text-glow-cyan hover:prose-a:text-glow-accent-light",
            isStreaming && "after:content-['▋'] after:text-glow-accent after:animate-pulse after:ml-0.5"
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // ── Code blocks → bash-editor style ──────────────────────
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const lang = match?.[1] ?? "";
                  const code = String(children).replace(/\n$/, "");
                  const inline = !className;

                  if (inline) {
                    return (
                      <code className="bg-[#1a1a2e] text-glow-cyan px-1.5 py-0.5 rounded text-xs font-mono border border-glow-border/40">
                        {children}
                      </code>
                    );
                  }

                  return <CodeBlock code={code} lang={lang}/>;
                },
                // Keep standard elements
                pre({ children }) { return <>{children}</>; },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Previewable code preview */}
          {previewable && !isStreaming && (
            <CodePreview code={previewable.code} language={previewable.language} className="mt-2" compact/>
          )}

          {/* Action bar */}
          {!isStreaming && (
            <div className="flex items-center gap-1 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionBtn icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy"} onClick={copy} green={copied}/>
              {previewable && <ActionBtn icon={Eye} label="Preview" onClick={openExternal}/>}
              {onRetry && <ActionBtn icon={RotateCcw} label="Regenerate" onClick={onRetry}/>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────
function ActionBtn({ icon: Icon, label, onClick, green }: { icon: React.ElementType; label: string; onClick: () => void; green?: boolean }) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 text-xs rounded-lg border transition-colors",
        green
          ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/10"
          : "text-glow-muted border-glow-border bg-glow-card hover:text-glow-text hover:border-glow-accent/30"
      )}>
      <Icon className="w-3 h-3"/>{label}
    </button>
  );
}

// ── Code block with bash-editor style ─────────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied]       = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const previewable = extractPreviewableCode("```" + lang + "\n" + code + "\n```");

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-glow-border/60 bg-[#0d0d16] shadow-lg">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111120] border-b border-glow-border/40">
        <div className="flex items-center gap-2">
          {/* macOS-style dots */}
          <span className="w-3 h-3 rounded-full bg-red-500/80"/>
          <span className="w-3 h-3 rounded-full bg-amber-500/80"/>
          <span className="w-3 h-3 rounded-full bg-emerald-500/80"/>
          <div className="flex items-center gap-1.5 ml-2">
            <Terminal className="w-3 h-3 text-glow-muted"/>
            <span className="text-[11px] text-glow-muted font-mono">{lang || "code"}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {previewable && (
            <button onClick={() => { const p = document.createElement("div"); p.click(); }}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-glow-muted hover:text-glow-text border border-glow-border rounded-md hover:border-glow-accent/30 transition-colors">
              <Eye className="w-3 h-3"/>Preview
            </button>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-glow-muted hover:text-glow-text rounded transition-colors">
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", collapsed && "rotate-180")}/>
          </button>
          <button onClick={copy}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-glow-muted hover:text-glow-text border border-glow-border rounded-md hover:border-glow-accent/30 transition-colors">
            {copied ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3"/>}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Code */}
      {!collapsed && (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <SyntaxHighlighter
            language={lang || "text"}
            style={vscDarkPlus}
            customStyle={{
              margin: 0, padding: "16px",
              background: "#0d0d16",
              fontSize: "13px",
              lineHeight: "1.6",
              fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
            }}
            showLineNumbers={code.split("\n").length > 5}
            lineNumberStyle={{ color: "#374151", fontSize: "11px", minWidth: "2.5em" }}
            wrapLongLines={false}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}
