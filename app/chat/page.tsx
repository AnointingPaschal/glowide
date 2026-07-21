'use client';
export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { GlowLogoThinking } from '@/components/ui/GlowLogo';
import { useChatStore } from '@/store/chatStore';
import { useWalletStore } from '@/store/walletStore';
import {
  Send, Plus, Sparkles, Code2, Bug, RefreshCw, Zap,
  ChevronDown, Edit2, Trash2, PanelLeftOpen, Loader2,
  MessageSquare, SquareX, Bot, Cpu, Home, Wallet, FolderKanban,
  Rocket, Settings, ArrowRight, Wand2, Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicModel } from '@/app/api/models/route';

const QUICK_PROMPTS = [
  { icon: Code2,     label: 'ERC-20 Token',     prompt: 'Write a production ERC-20 token for Arc Testnet with minting, burning, and access control.' },
  { icon: Bug,       label: 'Code Review',       prompt: 'Review my Solidity code for security vulnerabilities, gas inefficiencies, and best practices.' },
  { icon: RefreshCw, label: 'Explain Code',      prompt: 'Explain how this code works, line by line, with clear examples.' },
  { icon: Zap,       label: 'Optimize Gas',      prompt: 'How can I optimize this Solidity contract to reduce gas costs on Arc Testnet?' },
];

const SUGGESTION_CARDS = [
  {
    id: 'send-usdc',
    icon: Coins,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    label: 'Send USDC',
    desc: 'Transfer USDC to any address on Arc Testnet instantly',
    prompt: 'Send 1 USDC to ',
    prefill: true,
  },
  {
    id: 'deploy-nft',
    icon: Sparkles,
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/15',
    label: 'Deploy NFT Collection',
    desc: 'Create an ERC-721 NFT contract with metadata and minting',
    prompt: 'Create a production ERC-721 NFT collection contract for Arc Testnet with metadata, minting, and a 500-item supply cap.',
  },
  {
    id: 'cctp-bridge',
    icon: ArrowRight,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    label: 'Bridge with CCTP',
    desc: 'Bridge USDC cross-chain using Circle\'s CCTP protocol',
    prompt: 'Bridge 5 USDC from Arc Testnet to Ethereum Sepolia using CCTP.',
  },
  {
    id: 'defi-lend',
    icon: Wand2,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    label: 'DeFi — Lend USDC',
    desc: 'Supply USDC to the lending pool to earn yield',
    prompt: 'Supply 10 USDC to the GlowIDE lending pool on Arc Testnet to earn yield.',
  },
  {
    id: 'write-contract',
    icon: Code2,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15',
    label: 'Write Smart Contract',
    desc: 'Build a custom Solidity contract for Arc Testnet',
    prompt: 'Write a Solidity smart contract that ',
    prefill: true,
  },
  {
    id: 'check-balance',
    icon: Wallet,
    iconColor: 'text-glow-accent-light',
    iconBg: 'bg-glow-accent/15',
    label: 'Check Wallet Balance',
    desc: 'View your USDC, EURC, cirBTC and USYC balances',
    prompt: 'Check my wallet balance',
  },
];

function generateTitle(msg: string): string {
  const clean = msg.trim().replace(/\n+/g, ' ');
  if (clean.length <= 42) return clean;
  const cut = clean.slice(0, 42);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + '…';
}

function groupSessionsByDate<T extends { updated_at?: string; created_at?: string }>(sessions: T[]) {
  const groups: { label: string; items: T[] }[] = [];
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOf(now);
  const yesterday = today - 86400000;
  const buckets: Record<string, T[]> = { Today: [], Yesterday: [], Older: [] };

  for (const s of sessions) {
    const t = new Date(s.updated_at ?? s.created_at ?? Date.now());
    const day = startOf(t);
    if (day === today) buckets.Today.push(s);
    else if (day === yesterday) buckets.Yesterday.push(s);
    else buckets.Older.push(s);
  }
  for (const label of ['Today', 'Yesterday', 'Older']) {
    if (buckets[label].length) groups.push({ label, items: buckets[label] });
  }
  return groups;
}

export default function ChatPage() {
  const {
    sessions, activeSessionId, createSession, setActiveSession,
    addMessage, deleteSession, updateSessionTitle,
    isStreaming, streamingContent, setStreaming, model, setModel,
  } = useChatStore();
  const { isConnected, address } = useWalletStore();

  const [input, setInput]                 = useState('');
  const [models, setModels]               = useState<PublicModel[]>([]);
  const [modelDropOpen, setModelDropOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editingTitle, setEditingTitle]   = useState('');
  const [userScrolled, setUserScrolled]   = useState(false);

  const abortRef     = useRef<AbortController | null>(null);
  const endRef       = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const titleSentRef = useRef<Set<string>>(new Set());
  const isNearBottom = useRef(true);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages      = useMemo(() => activeSession?.messages ?? [], [activeSession]);
  const selectedModel = models.find(m => m.id === model) ?? models[0];

  // Fetch models + default model from admin settings
  useEffect(() => {
    Promise.all([
      fetch('/api/models').then(r=>r.json()).catch(()=>({models:[]})),
      fetch('/api/admin/public-settings').then(r=>r.json()).catch(()=>({})),
    ]).then(([modelsData, settings]) => {
      if (modelsData.models?.length) setModels(modelsData.models);
      // Only set default model if user hasn't already selected one
      const currentModel = useChatStore.getState().model;
      const defaultFallback = 'anthropic/claude-3.5-sonnet';
      if (!currentModel || currentModel === defaultFallback) {
        const adminDefault = settings.default_model;
        if (adminDefault) setModel(adminDefault);
      }
    });
  }, [setModel]);

  // Load chat sessions from DB when wallet connects
  useEffect(() => {
    if (!isConnected || !address) return;
    fetch(`/api/chat/sessions?wallet=${address}`)
      .then(r => r.json())
      .then(({ sessions: dbSessions }) => {
        if (!dbSessions?.length) return;
        // Merge DB sessions into local store (DB takes priority)
        const store = useChatStore.getState();
        const existingIds = new Set(store.sessions.map((s: {id:string}) => s.id));
        const newSessions = dbSessions.filter((s: {id:string}) => !existingIds.has(s.id));
        if (newSessions.length) {
          useChatStore.setState(state => ({
            sessions: [...newSessions, ...state.sessions].sort((a,b) =>
              new Date(b.updated_at||0).getTime() - new Date(a.updated_at||0).getTime()
            ),
          }));
        }
      }).catch(() => {});
  }, [isConnected, address]);

  // Smart scroll: only auto-scroll if user hasn't manually scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isNearBottom.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, streamingContent]);

  // Track if user has scrolled away from bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottom.current = distFromBottom < 120;
      setUserScrolled(distFromBottom > 200);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Unique URL per chat session ──────────────────────────────────────────
  // Each session gets its own shareable URL (/chat/SESSION_ID).
  // The URL updates whenever the active session changes, and on first load
  // we restore the session that the URL was pointing at.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const newPath = activeSessionId ? `/chat/${activeSessionId}` : '/chat';
    if (window.location.pathname !== newPath) {
      window.history.replaceState({ sessionId: activeSessionId }, '', newPath);
    }
  }, [activeSessionId]);

  useEffect(() => {
    // On mount: if the URL has a session ID, restore that session
    const parts = window.location.pathname.split('/');
    const urlSessionId = parts[2];
    if (urlSessionId) {
      const session = useChatStore.getState().sessions.find(s => s.id === urlSessionId);
      if (session) setActiveSession(urlSessionId);
    }
  }, []); // eslint-disable-line

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setUserScrolled(false);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    useChatStore.getState().finalizeStream(activeSessionId ?? '');
  };

  const sendMessage = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || isStreaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const s = createSession('');
      sessionId = s.id;
      setActiveSession(s.id);
    }

    const session = useChatStore.getState().sessions.find(s => s.id === sessionId);
    if (!session?.messages?.length && !titleSentRef.current.has(sessionId!)) {
      titleSentRef.current.add(sessionId!);
      updateSessionTitle(sessionId!, generateTitle(text));
    }

    addMessage(sessionId!, { role: 'user', content: text, session_id: sessionId! });
    setInput('');
    setUserScrolled(false);
    isNearBottom.current = true;
    setStreaming(true);

    // Reset textarea height
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }

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

      // API returns plain JSON (not a stream)
      const data = await res.json() as { content?: string; error?: string; toolCall?: { id: string; name: string; args: Record<string, unknown> } };
      if (data.error) throw new Error(data.error);

      const content = data.content ?? '';

      // Animate content character by character so it feels like streaming —
      // scaled to length so short replies still "type" nicely while long
      // ones never drag past well under a second.
      useChatStore.setState({ isStreaming: true, streamingContent: '' });
      const totalSteps = 40;
      const chunkSize = Math.max(3, Math.ceil(content.length / totalSteps));
      for (let i = 0; i < content.length; i += chunkSize) {
        if (abortRef.current?.signal.aborted) break;
        useChatStore.setState({ streamingContent: content.slice(0, i + chunkSize) });
        await new Promise(r => setTimeout(r, 4));
      }
      useChatStore.setState({ streamingContent: content });
      useChatStore.getState().finalizeStream(sessionId!);

      // If AI returned a tool call, append a pending-confirm message
      if (data.toolCall) {
        addMessage(sessionId!, {
          role: 'assistant',
          content: JSON.stringify({ __toolCall: data.toolCall }),
          session_id: sessionId!,
        });
      }

      // Save session to DB after AI responds
      if (isConnected && address) {
        const savedSession = useChatStore.getState().sessions.find(s => s.id === sessionId);
        if (savedSession) {
          fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session: savedSession, wallet: address }),
          }).catch(() => {});
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') { useChatStore.getState().finalizeStream(sessionId!); return; }
      setStreaming(false);
      addMessage(sessionId!, {
        role: 'assistant',
        content: `❌ ${(err as Error).message}`,
        session_id: sessionId!,
      });
    }
  }, [input, isStreaming, activeSessionId, createSession, setActiveSession, addMessage, setStreaming, updateSessionTitle, model, selectedModel, isConnected, address]); // eslint-disable-line

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleRetry = useCallback(() => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) sendMessage(lastUser.content);
  }, [messages, sendMessage]);

  const newChat = () => {
    const s = createSession('');
    setActiveSession(s.id);
    setSidebarOpen(false);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <AppLayout title="Chat">
      <div className="flex h-[calc(100dvh-48px)] md:h-[calc(100dvh-56px)] overflow-hidden relative">

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSidebarOpen(false)}/>
        )}

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className={cn(
          "flex-shrink-0 border-r border-glow-border flex flex-col transition-transform duration-300",
          "fixed inset-y-0 left-0 z-30 w-64 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "md:w-56 lg:w-64 bg-glow-surface"
        )}>
          {/* Profile */}
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
            <div className="w-8 h-8 rounded-full bg-glow-gradient flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 text-white"/>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-glow-text truncate">
                {address ? `${address.slice(0,6)}…${address.slice(-4)}` : 'Guest'}
              </p>
              <p className="text-[10px] text-glow-muted">Web3 Builder</p>
            </div>
          </div>

          {/* Primary nav */}
          <nav className="px-2.5 space-y-0.5 pb-2">
            <Link href="/" className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors text-sm">
              <Home className="w-4 h-4"/>Home
            </Link>
            <button onClick={newChat} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-glow-accent/10 text-glow-accent-light font-medium hover:bg-glow-accent/15 transition-colors text-sm">
              <Plus className="w-4 h-4"/>New Chat
            </button>
            <Link href="/wallet" className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors text-sm">
              <Wallet className="w-4 h-4"/>Wallet
            </Link>
            <Link href="/build" className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors text-sm">
              <FolderKanban className="w-4 h-4"/>Arc Lab
            </Link>
            <Link href="/deployments" className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors text-sm">
              <Rocket className="w-4 h-4"/>Deployments
            </Link>
          </nav>

          <div className="h-px bg-glow-border/60 mx-3"/>

          {/* History, grouped by date */}
          <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3 min-h-0">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <MessageSquare className="w-7 h-7 text-glow-muted/25 mb-2"/>
                <p className="text-xs text-glow-muted/50">No chats yet</p>
              </div>
            ) : (
              groupSessionsByDate(sessions).map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-wider px-2 mb-1">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.items.map(session => (
                      <div key={session.id}
                        onClick={() => { setActiveSession(session.id); setSidebarOpen(false); }}
                        className={cn(
                          "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all",
                          activeSessionId === session.id
                            ? "bg-glow-accent/15 text-glow-accent-light"
                            : "text-glow-muted hover:text-glow-text hover:bg-glow-card"
                        )}>
                        {editingId === session.id ? (
                          <input autoFocus value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { updateSessionTitle(session.id, editingTitle); setEditingId(null); }
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            onBlur={() => { updateSessionTitle(session.id, editingTitle); setEditingId(null); }}
                            className="flex-1 bg-transparent text-xs focus:outline-none border-b border-glow-accent text-glow-text"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className="flex-1 text-xs truncate leading-relaxed">
                            {session.title || <span className="italic opacity-50">New chat</span>}
                          </span>
                        )}
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditingId(session.id); setEditingTitle(session.title ?? ''); }}
                            className="p-1 rounded text-glow-muted/60 hover:text-glow-text hover:bg-glow-surface transition-colors">
                            <Edit2 className="w-3 h-3"/>
                          </button>
                          <button onClick={() => { deleteSession(session.id); if (activeSessionId === session.id) setActiveSession(null); }}
                            className="p-1 rounded text-glow-muted/60 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3 h-3"/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Arc Lab CTA */}
          <div className="p-2.5">
            <Link href="/build" className="block p-3 rounded-2xl bg-glow-gradient text-white shadow-sm hover:opacity-95 transition-opacity">
              <div className="flex items-center gap-1.5 mb-1">
                <Wand2 className="w-3.5 h-3.5"/>
                <p className="text-xs font-semibold">Explore Arc Lab</p>
              </div>
              <p className="text-[10px] text-white/80 leading-snug">Real starter projects — DeFi, CCTP, AI agents & more</p>
            </Link>
          </div>

          <Link href="/settings" className="flex items-center gap-2.5 mx-2.5 mb-3 px-2.5 py-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors text-sm">
            <Settings className="w-4 h-4"/>Settings
          </Link>
        </aside>

        {/* ── Main chat ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#070710]">

          {/* Mobile header */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-glow-border bg-[#080812] flex-shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-glow-muted hover:text-glow-text">
              <PanelLeftOpen className="w-4 h-4"/>
            </button>
            <span className="text-xs text-glow-muted flex-1 truncate">
              {activeSession?.title || 'New Chat'}
            </span>
            <button onClick={newChat} className="p-1.5 rounded-lg text-glow-muted hover:text-glow-text">
              <Plus className="w-4 h-4"/>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full overflow-y-auto">
                <div className="max-w-2xl mx-auto px-5 py-8 md:py-12">

                  {/* Hero greeting */}
                  <div className="mb-8">
                    <p className="text-[28px] font-bold text-glow-text leading-tight mb-1">
                      Welcome{address ? `, ${address.slice(0,6)}…${address.slice(-4)}` : ''}! 👋
                    </p>
                    <p className="text-lg text-glow-muted/70 font-normal">How can I help you today?</p>
                  </div>

                  {/* 6 suggestion cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {SUGGESTION_CARDS.map(card => (
                      <button key={card.id}
                        onClick={() => card.prefill ? setInput(card.prompt) : sendMessage(card.prompt)}
                        className="group flex items-start gap-3 p-4 bg-glow-card rounded-2xl text-left hover:bg-glow-accent/8 transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(124,58,237,0.3)]">
                        <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <card.icon className={`w-4 h-4 ${card.iconColor}`}/>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-glow-text mb-0.5 group-hover:text-white transition-colors">{card.label}</p>
                          <p className="text-[11px] text-glow-muted/70 leading-snug">{card.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Compact quick-start row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {QUICK_PROMPTS.map(qp => (
                      <button key={qp.label} onClick={() => sendMessage(qp.prompt)}
                        className="flex items-center gap-2 px-3 py-2 bg-glow-surface rounded-xl hover:bg-glow-card transition-colors text-left group">
                        <qp.icon className="w-3.5 h-3.5 text-glow-accent flex-shrink-0"/>
                        <span className="text-[11px] text-glow-muted group-hover:text-glow-text transition-colors font-medium leading-tight">{qp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-3 pb-6">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onEdit={msg.role === 'user' ? sendMessage : undefined}
                    onRetry={msg.role === 'assistant' && i === messages.length - 1 ? handleRetry : undefined}
                  />
                ))}
                {isStreaming && streamingContent && (
                  <ChatMessage
                    key="streaming"
                    message={{ id: 's', session_id: activeSessionId ?? '', role: 'assistant', content: streamingContent, created_at: new Date().toISOString() }}
                    isStreaming
                  />
                )}
                {isStreaming && !streamingContent && (
                  <div className="animate-fade-in">
                    <GlowLogoThinking/>
                  </div>
                )}
                <div ref={endRef}/>
              </div>
            )}
          </div>

          {/* Scroll to bottom button */}
          {userScrolled && (
            <div className="absolute bottom-28 right-4 z-10 animate-fade-in">
              <button onClick={scrollToBottom}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-card border border-glow-border text-glow-muted text-xs rounded-full shadow-lg hover:border-glow-accent/40 hover:text-glow-text transition-all">
                <ChevronDown className="w-3.5 h-3.5"/>Latest
              </button>
            </div>
          )}

          {/* ── Input area ──────────────────────────────────────────── */}
          <div className="border-t border-glow-border/50 bg-[#080812] flex-shrink-0 px-3 py-2 space-y-1.5">
            {/* Model selector */}
            {models.length > 0 && (
              <div className="relative flex items-center gap-2">
                <div className="flex-1"/>
                <button onClick={() => setModelDropOpen(!modelDropOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-glow-card border border-glow-border/60 rounded-lg text-[11px] text-glow-muted hover:border-glow-accent/40 transition-colors max-w-[180px]">
                  <Cpu className="w-3 h-3 flex-shrink-0"/>
                  <span className="truncate">{selectedModel?.name ?? 'Select model'}</span>
                  <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform", modelDropOpen && "rotate-180")}/>
                </button>
                {modelDropOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModelDropOpen(false)}/>
                    <div className="absolute right-0 bottom-full mb-1 w-64 bg-[#0e0e1a] border border-glow-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in max-h-64 overflow-y-auto">
                      {(['premium','fast','coding'] as const).map(tier => {
                        const tm = models.filter(m => m.tier === tier);
                        if (!tm.length) return null;
                        return (
                          <div key={tier}>
                            <p className="text-[10px] text-glow-muted uppercase tracking-wider px-3 py-1.5 sticky top-0 bg-[#0e0e1a] border-b border-glow-border/30">{tier}</p>
                            {tm.map(m => (
                              <button key={m.id} onClick={() => { setModel(m.id); setModelDropOpen(false); }}
                                className={cn("w-full flex items-center justify-between px-3 py-2 text-left transition-colors",
                                  (model || selectedModel?.id) === m.id ? "bg-glow-accent/10 text-glow-accent-light" : "text-glow-text hover:bg-glow-card/50")}>
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
            <div className={cn(
              "flex gap-2 bg-glow-card rounded-xl p-2.5 transition-all duration-200",
              isStreaming
                ? "shadow-[0_0_0_1px_rgba(124,58,237,0.25),0_1px_3px_rgba(0,0,0,0.4)]"
                : "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.4)] focus-within:shadow-[0_0_0_1px_rgba(124,58,237,0.35),0_1px_4px_rgba(0,0,0,0.5)]"
            )}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Ask anything about Web3, Solidity, or your code… (Shift+Enter for new line)"
                rows={1} disabled={isStreaming}
                className="flex-1 bg-transparent text-sm text-glow-text placeholder:text-glow-muted/40 resize-none focus:outline-none min-h-[22px] max-h-40 overflow-y-auto disabled:opacity-60"
                onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; }}
              />
              {isStreaming ? (
                <button onClick={stopStreaming}
                  className="self-end flex-shrink-0 w-8 h-8 flex items-center justify-center bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors" title="Stop">
                  <SquareX className="w-4 h-4 text-red-400"/>
                </button>
              ) : (
                <button onClick={() => sendMessage()} disabled={!input.trim()}
                  className={cn("self-end flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                    input.trim() ? "bg-glow-gradient text-white shadow-glow-sm hover:opacity-90" : "bg-glow-border/50 text-glow-muted/40 cursor-not-allowed")}>
                  <Send className="w-3.5 h-3.5"/>
                </button>
              )}
            </div>
            <p className="text-[10px] text-glow-muted/40 text-center">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
