"use client";
import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useEditorStore } from "@/store/editorStore";
import { ChatMessage } from "./ChatMessage";
import { Button } from "@/components/ui/Button";
import { Send, Plus, Sparkles, Code2, Bug, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  { icon: <Code2 className="w-3 h-3" />, label: "Generate code", prompt: "Generate code for: " },
  { icon: <Bug className="w-3 h-3" />, label: "Fix bug", prompt: "Fix this bug in my code: " },
  { icon: <RefreshCw className="w-3 h-3" />, label: "Refactor", prompt: "Refactor this code to be cleaner and more efficient: " },
  { icon: <Sparkles className="w-3 h-3" />, label: "Explain", prompt: "Explain how this works: " },
];

export function ChatPanel({ compact = false }: { compact?: boolean }) {
  const { sessions, activeSessionId, createSession, addMessage, isStreaming, streamingContent, setStreaming, model } = useChatStore();
  const { tabs, activeTabId } = useEditorStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];
  const activeTab = tabs.find(t => t.id === activeTabId);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingContent]);

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

    // Add context from active file
    const contextContent = activeTab ? `\n\nContext from current file (${activeTab.name}):\n\`\`\`${activeTab.language}\n${activeTab.content.slice(0, 3000)}\n\`\`\`` : "";

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user", content: trimmed + contextContent }],
          model,
          sessionId,
        }),
      });

      if (!response.ok) throw new Error("Request failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              fullContent += content;
              useChatStore.setState({ streamingContent: fullContent });
            } catch {}
          }
        }
      }

      useChatStore.getState().finalizeStream(sessionId!);
    } catch (err) {
      setStreaming(false);
      addMessage(sessionId!, { role: "assistant", content: "Sorry, I encountered an error. Please check your AI settings and try again.", session_id: sessionId! });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className={cn("flex flex-col h-full bg-glow-bg", compact && "border-l border-glow-border")}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-glow-border bg-glow-surface/50">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-glow-accent" />
          <span className="text-sm font-semibold glow-text">AI Assistant</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => createSession()} title="New chat">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-glow-gradient flex items-center justify-center mb-3 shadow-glow-sm">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-glow-text mb-1">GlowIDE AI</h3>
            <p className="text-xs text-glow-muted mb-4 max-w-48">Your intelligent Web3 coding partner. Ask anything.</p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-64">
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
              <ChatMessage message={{ id: "streaming", session_id: activeSessionId || "", role: "assistant", content: streamingContent, created_at: new Date().toISOString() }} isStreaming />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Context indicator */}
      {activeTab && (
        <div className="mx-3 mb-1 px-2 py-1 bg-glow-card border border-glow-border rounded-lg flex items-center gap-2">
          <Code2 className="w-3 h-3 text-glow-muted" />
          <span className="text-xs text-glow-muted truncate">Context: {activeTab.name}</span>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-glow-border">
        <div className="flex gap-2 bg-glow-card border border-glow-border rounded-xl p-2 focus-within:border-glow-accent/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything about your code..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-glow-text placeholder:text-glow-muted resize-none focus:outline-none min-h-[20px] max-h-32 overflow-y-auto"
            style={{ height: "auto" }}
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
