'use client';
export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { useChatStore } from '@/store/chatStore';
import { useWalletStore } from '@/store/walletStore';
import {
  Send, Plus, Sparkles, Code2, Bug, RefreshCw,
  Zap, ChevronDown, Edit2, Trash2, Check, X,
  PanelLeftOpen, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicModel } from '@/app/api/models/route';

const QUICK_PROMPTS = [
  { icon: Code2,    label: 'Generate Contract', prompt: 'Write a production ERC20 token contract for Arc Testnet with minting, burning and access control.' },
  { icon: Bug,      label: 'Code Review',        prompt: 'Review my Solidity code for security vulnerabilities, gas inefficiencies and best practice violations.' },
  { icon: RefreshCw,label: 'Explain Code',        prompt: 'Explain how this code works, line by line, with examples.' },
  { icon: Zap,      label: 'Optimize Gas',        prompt: 'How can I optimize this Solidity contract to reduce gas costs on Arc Testnet?' },
];

// Auto-generate a session title from the first user message
function generateTitle(msg: string): string {
  const clean = msg.trim().replace(/\n+/g, ' ');
  if (clean.length <= 42) return clean;
  // Find last space before 42 chars
  const cut = clean.slice(0, 42);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + '…';
}

export default function ChatPage() {
  const {
    sessions, activeSessionId, createSession, setActiveSession,
    addMessage, deleteSession, updateSessionTitle,
    isStreaming, streamingContent, setStreaming, model, setModel,
  } = useChatStore();
  const { isConnected, address } = useWalletStore();

  const [input, setInput]         = useState('');
  const [models, setModels]       = useState<PublicModel[]>([]);
  const [modelDropOpen, setModelDropOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editingTitle, setEditingTitle]   = useState('');
  const abortRef   = useRef<AbortController | null>(null);
  const endRef     = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const titleSentRef = useRef<Set<string>>(new Set()); // track which sessions already got title

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];
  const selectedModel = models.find(m => m.id === model) ?? models[0];

  // Fetch models
  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(d => { if (d.models?.length) setModels(d.models); }).catch(() => {});
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingContent]);

  const stopStreaming = () => {
    abortRef.current?.abort();
    useChatStore.getState().finalizeStream(activeSessionId ?? '');
  };

  const sendMessage = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || isStreaming) return;

    // Create session on first message if none active
    let sessionId = activeSessionId;
    if (!sessionId) {
      const s = createSession(''); // empty title until we set it
      sessionId = s.id;
      setActiveSession(s.id);
    }

    // Auto-title on first message
    const session = useChatStore.getState().sessions.find(s => s.id === sessionId);
    const isFirstMessage = !session?.messages?.length;
    if (isFirstMessage && !titleSentRef.current.has(sessionId!)) {
      titleSentRef.current.add(sessionId!);
      updateSessionTitle(sessionId!, generateTitle(text));
    }

    addMessage(sessionId!, { role: 'user', content: text, session_id: sessionId! });
    setInput('');
    setStreaming(true);

    try {
      abortRef.current = new AbortController();
      const currentMessages = useChatStore.getState().sessions.find(s => s.id === sessionId)?.messages ?? [];

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: currentMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
          model: model || selectedModel?.id,
          sessionId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? 'Request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? '';
            full += delta;
            useChatStore.setState({ streamingContent: full });
          } catch { /* skip */ }
        }
      }
      useChatStore.getState().finalizeStream(sessionId!);

      // Save to DB only if user is authenticated
      if (isConnected && address) {
        fetch('/api/chat/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, wallet: address }),
        }).catch(() => {});
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') { useChatStore.getState().finalizeStream(sessionId!); return; }
      setStreaming(false);
      addMessage(sessionId!, {
        role: 'assistant',
        content: `❌ Error: ${(err as Error).message}. Check your OpenRouter API key in Admin settings.`,
        session_id: sessionId!,
      });
    }
  }, [input, isStreaming, activeSessionId, createSession, setActiveSession, addMessage, setStreaming, updateSessionTitle, model, selectedModel, isConnected, address]); // eslint-disable-line

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleRetry = useCallback(() => {
    if (!messages.length) return;
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) sendMessage(lastUser.content);
  }, [messages, sendMessage]);

  const newChat = () => {
    const s = createSession('');
    setActiveSession(s.id);
    setSidebarOpen(false);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <AppLayout title="Chat">
      <div className="flex h-[calc(100dvh-48px)] md:h-[calc(100dvh-56px)] overflow-hidden relative">

        {/* ── Mobile backdrop ── */}
        {sidebarOpen && <div className="md:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}/>}

        {/* ── Sidebar ── */}
        <aside className={cn(
          "flex-shrink-0 border-r border-glow-border bg-glow-surface flex flex-col transition-transform duration-300",
          "fixed inset-y-0 left-0 z-30 w-64 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "md:w-56 lg:w-64"
        )}>
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-glow-border">
            <span className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Chats</span>
            <button onClick={newChat}
              className="p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors" title="New Chat">
              <Plus className="w-4 h-4"/>
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto py-1 space-y-0.5 px-1">
            {sessions.length === 0 ? (
              <p className="text-xs text-glow-muted text-center py-8">No chats yet</p>
            ) : (
              sessions.map(session => (
                <div key={session.id}
                  onClick={() => { setActiveSession(session.id); setSidebarOpen(false); }}
                  className={cn(
                    "group flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-all text-sm",
                    activeSessionId === session.id
                      ? "bg-glow-accent/15 border border-glow-accent/25 text-glow-accent-light"
                      : "text-glow-muted hover:text-glow-text hover:bg-glow-card border border-transparent"
                  )}>

                  {/* Title (editable) */}
                  {editingId === session.id ? (
                    <input autoFocus value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { updateSessionTitle(session.id, editingTitle); setEditingId(null); }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => { updateSessionTitle(session.id, editingTitle); setEditingId(null); }}
                      className="flex-1 bg-transparent text-xs focus:outline-none border-b border-glow-accent text-glow-text"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-xs truncate">
                      {session.title || <span className="italic text-glow-muted/60">New chat</span>}
                    </span>
                  )}

                  {/* Actions: only edit + delete */}
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingId(session.id); setEditingTitle(session.title ?? ''); }}
                      className="p-1 rounded text-glow-muted hover:text-glow-text hover:bg-glow-surface transition-colors" title="Rename">
                      <Edit2 className="w-3 h-3"/>
                    </button>
                    <button onClick={() => { deleteSession(session.id); if (activeSessionId === session.id) setActiveSession(null); }}
                      className="p-1 rounded text-glow-muted hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                      <Trash2 className="w-3 h-3"/>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── Main chat area ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Mobile toolbar */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-glow-border bg-glow-surface/50 flex-shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card">
              <PanelLeftOpen className="w-4 h-4"/>
            </button>
            <span className="text-xs text-glow-muted flex-1 truncate">
              {activeSession?.title || 'New Chat'}
            </span>
            <button onClick={newChat} className="p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card">
              <Plus className="w-4 h-4"/>
            </button>
          </div>

          {/* Messages or empty state */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {messages.length === 0 ? (
              /* Empty state — always show the chatbox area, no centered button */
              <div className="flex flex-col h-full">
                <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
                  <div className="relative mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-glow-gradient flex items-center justify-center shadow-glow-md">
                      <Sparkles className="w-7 h-7 text-white"/>
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-glow-accent/20 animate-ping"/>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-glow-text mb-1.5">GlowIDE AI</h2>
                  <p className="text-sm text-glow-muted max-w-sm mb-6 leading-relaxed">
                    Your intelligent Web3 coding partner. Write code, debug issues, deploy contracts, and build dApps.
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
                    {QUICK_PROMPTS.map(qp => (
                      <button key={qp.label} onClick={() => sendMessage(qp.prompt)}
                        className="flex items-center gap-2 p-3 bg-glow-card border border-glow-border rounded-xl hover:border-glow-accent/40 hover:bg-glow-accent/5 transition-all text-left group">
                        <qp.icon className="w-4 h-4 text-glow-accent flex-shrink-0"/>
                        <span className="text-xs text-glow-muted group-hover:text-glow-text transition-colors font-medium">{qp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onEdit={msg.role === 'user' ? (newContent) => sendMessage(newContent) : undefined}
                    onRetry={msg.role === 'assistant' && i === messages.length - 1 ? handleRetry : undefined}
                  />
                ))}
                {isStreaming && streamingContent && (
                  <ChatMessage
                    key="streaming"
                    message={{ id:'s', session_id:activeSessionId??'', role:'assistant', content:streamingContent, created_at:new Date().toISOString() }}
                    isStreaming
                  />
                )}
                <div ref={endRef}/>
              </div>
            )}
          </div>

          {/* ── Input area ── */}
          <div className="border-t border-glow-border bg-glow-surface/50 flex-shrink-0 p-3 space-y-2">
            {/* Model selector (compact) */}
            {models.length > 0 && (
              <div className="relative flex justify-end">
                <button onClick={() => setModelDropOpen(!modelDropOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-glow-card border border-glow-border rounded-lg text-xs text-glow-muted hover:border-glow-accent/40 transition-colors max-w-[200px]">
                  <span className="truncate">{selectedModel?.name ?? 'Select model'}</span>
                  <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform", modelDropOpen && "rotate-180")}/>
                </button>
                {modelDropOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModelDropOpen(false)}/>
                    <div className="absolute right-0 bottom-full mb-1 w-64 bg-glow-card border border-glow-border rounded-xl shadow-card-shadow z-50 overflow-hidden animate-fade-in max-h-64 overflow-y-auto">
                      {(['premium','fast','coding'] as const).map(tier => {
                        const tm = models.filter(m => m.tier === tier);
                        if (!tm.length) return null;
                        return (
                          <div key={tier}>
                            <p className="text-[10px] text-glow-muted uppercase tracking-wider px-3 py-1.5 sticky top-0 bg-glow-card border-b border-glow-border/50">{tier}</p>
                            {tm.map(m => (
                              <button key={m.id} onClick={() => { setModel(m.id); setModelDropOpen(false); }}
                                className={cn("w-full flex items-center justify-between px-3 py-2 text-left transition-colors",
                                  (model||selectedModel?.id)===m.id ? "bg-glow-accent/10 text-glow-accent-light" : "text-glow-text hover:bg-glow-surface")}>
                                <span className="text-xs font-medium truncate">{m.name}</span>
                                <span className="text-[10px] text-glow-muted flex-shrink-0 ml-2">{m.provider}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Text input */}
            <div className="flex gap-2 bg-glow-card border border-glow-border rounded-xl p-2.5 focus-within:border-glow-accent/50 transition-colors">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Ask anything about Web3, Solidity, or your code…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-glow-text placeholder:text-glow-muted/50 resize-none focus:outline-none min-h-[20px] max-h-36 overflow-y-auto"
                onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 144) + "px"; }}
              />
              {isStreaming ? (
                <button onClick={stopStreaming}
                  className="self-end flex-shrink-0 w-8 h-8 flex items-center justify-center bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors" title="Stop">
                  <span className="w-3 h-3 bg-red-400 rounded-sm"/>
                </button>
              ) : (
                <button onClick={() => sendMessage()} disabled={!input.trim()}
                  className={cn("self-end flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                    input.trim() ? "bg-glow-gradient text-white shadow-glow-sm hover:opacity-90" : "bg-glow-border text-glow-muted cursor-not-allowed")}>
                  <Send className="w-3.5 h-3.5"/>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
