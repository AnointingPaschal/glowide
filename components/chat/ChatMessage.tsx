"use client";
import type { ChatMessage as ChatMsg } from "@/types";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useState } from "react";
import { Copy, Check, User, Zap } from "lucide-react";

interface Props { message: ChatMsg; isStreaming?: boolean; }

export function ChatMessage({ message, isStreaming }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className={cn("flex gap-3 px-4 py-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white",
        isUser ? "bg-glow-accent/80" : "bg-glow-gradient"
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        <div className={cn(
          "rounded-2xl px-4 py-2.5 max-w-[85%] text-sm",
          isUser
            ? "bg-glow-accent/20 border border-glow-accent/30 text-glow-text rounded-tr-sm"
            : "bg-glow-card border border-glow-border text-glow-text rounded-tl-sm"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isBlock = !!(props as { inline?: boolean }).inline === false && match;
                    const code = String(children).replace(/\n$/, "");
                    const id = Math.random().toString(36).slice(2);
                    if (isBlock) {
                      return (
                        <div className="relative group/code my-2">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0a14] border-b border-glow-border rounded-t-lg">
                            <span className="text-xs text-glow-muted">{match[1]}</span>
                            <button
                              onClick={() => copyCode(code, id)}
                              className="text-glow-muted hover:text-glow-text transition-colors"
                            >
                              {copied === id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <pre className="!mt-0 !rounded-t-none !bg-[#0a0a14] !border !border-glow-border">
                            <code className={className}>{children}</code>
                          </pre>
                        </div>
                      );
                    }
                    return <code className="bg-glow-surface px-1.5 py-0.5 rounded text-glow-cyan text-xs" {...props}>{children}</code>;
                  },
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                  h3: ({ children }) => <h3 className="text-base font-semibold mb-1 text-glow-text">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-sm font-semibold mb-1 text-glow-text">{children}</h4>,
                  strong: ({ children }) => <strong className="font-semibold text-glow-text">{children}</strong>,
                  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-glow-cyan underline">{children}</a>,
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && <span className="inline-block w-2 h-4 bg-glow-accent animate-pulse ml-0.5 rounded-sm" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
