"use client";
import { useState, useRef, useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useFileSystemStore } from "@/store/fileSystemStore";
import { terminalLog } from "@/components/editor/Terminal";
import { useChatStore } from "@/store/chatStore";
import { ChatMessage } from "./ChatMessage";
import { Button } from "@/components/ui/Button";
import { Send, Plus, Sparkles, Code2, Bug, RefreshCw, Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicModel } from "@/app/api/models/route";

const QUICK_PROMPTS = [
  { icon: <Code2 className="w-3 h-3" />, label: "Generate code", prompt: "Generate code for: " },
  { icon: <Bug className="w-3 h-3" />, label: "Fix bug", prompt: "Fix this bug in my code: " },
  { icon: <RefreshCw className="w-3 h-3" />, label: "Refactor", prompt: "Refactor this code to be cleaner and more efficient: " },
  { icon: <Sparkles className="w-3 h-3" />, label: "Explain", prompt: "Explain how this works: " },
];

export function ChatPanel({ compact = false, editorMode = false }: { compact?: boolean; editorMode?: boolean }) {
  const { sessions, activeSessionId, createSession, addMessage, isStreaming, streamingContent, setStreaming, model, setModel } = useChatStore();
  const { tabs, activeTabId, updateTabContent } = useEditorStore();
  const { nodes, updateContent: updateFileContent } = useFileSystemStore();
  const [input, setInput] = useState("");
  const [models, setModels] = useState<PublicModel[]>([]);
  const [modelDropOpen, setModelDropOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];
  const activeTab = tabs.find(t => t.id === activeTabId);
  const selectedModel = models.find(m => m.id === model) ?? models[0];

  // Fetch available models
  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(d => {
      if (d.models?.length) setModels(d.models);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = createSession("New Chat");
      sessionId = session.id;
    }

    addMessage(sessionId!, { role: "user", content: trimmed, session_id: sessionId! });
    setInput("");
    setStreaming(true);

    const contextContent = activeTab
      ? `\n\nContext from current file (${activeTab.name}):\n\`\`\`${activeTab.language}\n${activeTab.content.slice(0, 3000)}\n\`\`\``
      : "";

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user", content: trimmed + contextContent }],
          model: model || selectedModel?.id,
          sessionId,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              fullContent += content;
              useChatStore.setState({ streamingContent: fullContent });
            } catch { /* skip */ }
          }
        }
      }

      // If editorMode: auto-apply code blocks to editor
      if (editorMode && fullContent && activeTabId) {
        const codeMatch = fullContent.match(/```(?:\w+)?\n([\s\S]+?)```/);
        if (codeMatch) {
          const code = codeMatch[1].trim();
          updateTabContent(activeTabId, code);
          // Also persist to filesystem
          const node = nodes.find(n => n.id === activeTabId);
          if (node) updateFileContent(node.id, code);
          terminalLog("AI applied code changes to editor", "ai");
        }
      }
      useChatStore.getState().finalizeStream(sessionId!);
    } catch (err) {
      setStreaming(false);
      addMessage(sessionId!, {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}. Check your AI settings in the Admin panel.`,
        session_id: sessionId!,
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className={cn("flex flex-col h-full bg-glow-bg", compact && "border-l border-glow-border")}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-glow-border bg-glow-surface/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-glow-accent" />
          <span className="text-sm font-semibold glow-text hidden sm:block">AI Assistant</span>
        </div>

        {/* Model selector */}
        {models.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setModelDropOpen(!modelDropOpen)}
              className="flex items-center gap-1.5 px-2 py-1 bg-glow-card border border-glow-border rounded-lg text-xs text-gray-300 hover:border-glow-accent/40 transition-colors max-w-[140px] sm:max-w-none"
            >
              <span className="truncate">{selectedModel?.name ?? "Select model"}</span>
              <ChevronDown className={cn("w-3 h-3 text-glow-muted flex-shrink-0 transition-transform", modelDropOpen && "rotate-180")} />
            </button>

            {modelDropOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelDropOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-64 bg-glow-card border border-glow-border rounded-xl shadow-card-shadow z-50 overflow-hidden animate-fade-in">
                  <div className="p-2 border-b border-glow-border">
                    <p className="text-xs font-medium text-gray-400 px-1">Select Model</p>
                  </div>
                  <div className="p-1 max-h-64 overflow-y-auto">
                    {["premium","fast","coding"].map(tier => {
                      const tierModels = models.filter(m => m.tier === tier);
                      if (!tierModels.length) return null;
                      return (
                        <div key={tier}>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider px-2 py-1">{tier}</p>
                          {tierModels.map(m => (
                            <button
                              key={m.id}
                              onClick={() => { setModel(m.id); setModelDropOpen(false); }}
                              className={cn(
                                "w-full flex items-start gap-2 px-2 py-2 rounded-lg text-left transition-colors",
                                (model || selectedModel?.id) === m.id ? "bg-glow-accent/10 text-glow-accent-light" : "hover:bg-glow-surface text-gray-300"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{m.name}</p>
                                <p className="text-[10px] text-gray-500">{m.provider} · {m.context_length ? `${(m.context_length/1000).toFixed(0)}k ctx` : ""}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={() => createSession()} title="New chat" className="h-7 w-7">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <div className="w-10 h-10 rounded-2xl bg-glow-gradient flex items-center justify-center mb-3 shadow-glow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-glow-text mb-1">GlowIDE AI</h3>
            <p className="text-xs text-glow-muted mb-4 max-w-48">Your intelligent Web3 coding partner.</p>
            <div className="grid grid-cols-2 gap-1.5 w-full max-w-xs">
              {QUICK_PROMPTS.map(qp => (
                <button key={qp.label} onClick={() => setInput(qp.prompt)} className="flex items-center gap-2 p-2 bg-glow-card border border-glow-border rounded-lg text-xs text-glow-muted hover:text-glow-text hover:border-glow-accent/40 transition-colors text-left">
                  {qp.icon} {qp.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
            {isStreaming && streamingContent && (
              <ChatMessage
                message={{ id: "streaming", session_id: activeSessionId || "", role: "assistant", content: streamingContent, created_at: new Date().toISOString() }}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Context indicator */}
      {activeTab && (
        <div className="mx-3 mb-1 px-2 py-1 bg-glow-card border border-glow-border rounded-lg flex items-center gap-2 flex-shrink-0">
          <Code2 className="w-3 h-3 text-glow-muted flex-shrink-0" />
          <span className="text-xs text-glow-muted truncate">Context: {activeTab.name}</span>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-glow-border flex-shrink-0">
        <div className="flex gap-2 bg-glow-card border border-glow-border rounded-xl p-2 focus-within:border-glow-accent/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything about your code…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-glow-text placeholder:text-glow-muted resize-none focus:outline-none min-h-[20px] max-h-32 overflow-y-auto"
            onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 128) + "px"; }}
          />
          <Button onClick={sendMessage} disabled={!input.trim() || isStreaming} isLoading={isStreaming} size="icon" className="self-end flex-shrink-0 h-8 w-8">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
