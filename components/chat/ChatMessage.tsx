"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, Edit3, ExternalLink, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types";
import { CodePreview, extractPreviewableCode } from "@/components/preview/CodePreview";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onEdit?: (content: string) => void;
  onRetry?: () => void;
}

export function ChatMessage({ message, isStreaming, onEdit, onRetry }: ChatMessageProps) {
  const [copied, setCopied]   = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(message.content);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const previewable = !isUser ? extractPreviewableCode(message.content) : null;

  const openExternal = () => {
    const w = window.open("", "_blank", "width=900,height=600");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title></head><body style="margin:0;padding:16px;font-family:system-ui;background:#fff">${message.content.replace(/```[\w]*\n|```/g, "")}</body></html>`);
  };

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2 group">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-glow-accent px-4 py-2.5 text-sm text-white">
          {editing ? (
            <div className="space-y-2">
              <textarea autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                className="w-full bg-glow-accent-dim text-white text-sm rounded-lg p-2 resize-none focus:outline-none min-w-[200px]" rows={3} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setEditing(false); setEditVal(message.content); }} className="text-xs text-white/60 hover:text-white">Cancel</button>
                <button onClick={() => { onEdit?.(editVal); setEditing(false); }} className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-lg">Save &amp; Resend</button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        {!editing && (
          <div className="flex flex-col gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity self-end">
            <button onClick={() => setEditing(true)} className="p-1 rounded text-glow-muted hover:text-glow-text" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={copy} className="p-1 rounded text-glow-muted hover:text-glow-text" title="Copy">{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-2 group">
      <div className="flex items-start gap-3">
        {/* AI avatar */}
        <div className="w-7 h-7 rounded-xl bg-glow-gradient flex items-center justify-center flex-shrink-0 mt-0.5 shadow-glow-sm">
          <span className="text-white text-xs font-bold">AI</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn("text-sm text-glow-text prose prose-invert max-w-none prose-pre:bg-glow-bg prose-pre:border prose-pre:border-glow-border prose-pre:rounded-xl prose-code:text-glow-cyan prose-code:bg-glow-bg prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded", isStreaming && "after:content-['▋'] after:text-glow-accent after:animate-pulse")}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}
              components={{
                pre: ({ children }) => <pre className="overflow-x-auto text-xs">{children}</pre>,
                code: ({ node, className, children, ...props }) => {
                  const inline = !className;
                  return inline ? <code className="text-glow-cyan bg-glow-bg px-1 py-0.5 rounded text-xs" {...props}>{children}</code>
                    : <code className={cn("text-xs", className)} {...props}>{children}</code>;
                },
              }}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Preview button for HTML/React */}
          {previewable && !isStreaming && (
            <CodePreview code={previewable.code} language={previewable.language} className="mt-2" compact />
          )}

          {/* Action bar */}
          {!isStreaming && (
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={copy} className="flex items-center gap-1 px-2 py-1 text-xs text-glow-muted hover:text-glow-text bg-glow-card border border-glow-border rounded-lg transition-colors">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}{copied ? "Copied" : "Copy"}
              </button>
              {previewable && (
                <button onClick={openExternal} className="flex items-center gap-1 px-2 py-1 text-xs text-glow-muted hover:text-glow-text bg-glow-card border border-glow-border rounded-lg transition-colors">
                  <ExternalLink className="w-3 h-3" />Open
                </button>
              )}
              {onRetry && (
                <button onClick={onRetry} className="flex items-center gap-1 px-2 py-1 text-xs text-glow-muted hover:text-glow-text bg-glow-card border border-glow-border rounded-lg transition-colors">
                  <RotateCcw className="w-3 h-3" />Retry
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
