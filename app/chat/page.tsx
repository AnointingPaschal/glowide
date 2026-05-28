'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useChatStore } from '@/store/chatStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  MessageSquare, Plus, Trash2, Search, Clock,
  Code2, Sparkles, BookOpen, Zap, PanelLeftOpen, X,
} from 'lucide-react';
import { formatRelativeTime, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const { sessions, activeSessionId, setActiveSession, createSession, deleteSession } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const quickPrompts = [
    { icon: Code2,    label: 'Generate Contract', prompt: 'Generate a Solidity ERC20 token contract with minting and burning capabilities.' },
    { icon: Sparkles, label: 'Code Review',        prompt: 'Review my code for bugs, security issues, and performance improvements.' },
    { icon: BookOpen, label: 'Explain Code',       prompt: 'Explain how this code works in simple terms.' },
    { icon: Zap,      label: 'Optimize Gas',       prompt: 'How can I optimize this Solidity contract to reduce gas costs?' },
  ];

  const handleNewSession = () => {
    const session = createSession('New Chat');
    setActiveSession(session.id);
    setSidebarOpen(false);
  };

  return (
    <AppLayout title="AI Assistant" description="Chat with your AI coding partner">
      {/* Outer container: flex row on ≥ md */}
      <div className="flex h-[calc(100dvh-48px)] md:h-[calc(100dvh-56px)] overflow-hidden relative">

        {/* ── Mobile overlay backdrop ── */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Session Sidebar ── */}
        <aside className={cn(
          // Base: full height, fixed on mobile (slide-in), static on desktop
          "flex-shrink-0 border-r border-glow-border flex flex-col bg-glow-surface/50 transition-transform duration-300",
          // Mobile: fixed overlay, slide in from left
          "fixed inset-y-0 left-0 z-30 w-[280px] md:static md:translate-x-0",
          // Mobile open/close transform
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Desktop always show, sized to fit
          "md:w-64 lg:w-72"
        )}>
          {/* Header */}
          <div className="flex items-center gap-2 p-3 border-b border-glow-border">
            <Button variant="gradient" size="sm" className="flex-1 text-xs" onClick={handleNewSession}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Chat
            </Button>
            <button
              className="md:hidden p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-glow-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search chats…"
                className="w-full bg-glow-bg border border-glow-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-glow-accent/50"
              />
            </div>
          </div>

          {/* Quick Start */}
          <div className="p-2 border-b border-glow-border">
            <p className="text-[10px] text-gray-500 font-semibold mb-1.5 uppercase tracking-wider">Quick Start</p>
            <div className="space-y-0.5">
              {quickPrompts.map(qp => (
                <button
                  key={qp.label}
                  onClick={handleNewSession}
                  className="w-full flex items-center gap-2 p-1.5 rounded-lg text-left hover:bg-glow-card transition-colors group"
                >
                  <qp.icon className="w-3 h-3 text-glow-accent group-hover:text-glow-accent-light flex-shrink-0" />
                  <span className="text-xs text-gray-400 group-hover:text-gray-200 truncate">{qp.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-center px-3">
                <MessageSquare className="w-6 h-6 text-gray-600 mb-1.5" />
                <p className="text-xs text-gray-500">No chats yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredSessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => { setActiveSession(session.id); setSidebarOpen(false); }}
                    className={cn(
                      "group relative p-2.5 rounded-lg cursor-pointer transition-all",
                      activeSessionId === session.id
                        ? "bg-glow-accent/10 border border-glow-accent/20"
                        : "hover:bg-glow-card border border-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs font-medium truncate",
                          activeSessionId === session.id ? "text-glow-accent-light" : "text-gray-300"
                        )}>
                          {session.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-gray-600" />
                          <span className="text-[10px] text-gray-600">{formatRelativeTime(session.updated_at)}</span>
                          {(session.messages?.length ?? 0) > 0 && (
                            <Badge variant="default" className="text-[10px] py-0 px-1">
                              {session.messages!.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteSession(session.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {(session.messages?.length ?? 0) > 0 && (
                      <p className="text-[10px] text-gray-600 mt-1 truncate">
                        {session.messages![session.messages!.length - 1]?.content?.slice(0, 55)}…
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-glow-border">
            <div className="flex items-center justify-between text-[10px] text-gray-600">
              <span>{sessions.length} chat{sessions.length !== 1 ? 's' : ''}</span>
              <span>{sessions.reduce((a, s) => a + (s.messages?.length ?? 0), 0)} msgs</span>
            </div>
          </div>
        </aside>

        {/* ── Main Chat Area ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Mobile: toolbar with sidebar toggle + new chat */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-glow-border bg-glow-surface/50 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <span className="text-xs text-glow-muted flex-1">
              {activeSessionId
                ? sessions.find(s => s.id === activeSessionId)?.title ?? 'Chat'
                : 'AI Assistant'}
            </span>
            <button
              onClick={handleNewSession}
              className="p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Chat panel or empty state */}
          {activeSessionId ? (
            <ChatPanel />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-4 md:p-8">
              {/* Glow orb */}
              <div className="relative mb-6">
                <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-glow-accent/20 flex items-center justify-center">
                  <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-glow-accent/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 md:w-8 md:h-8 text-glow-accent-light" />
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full bg-glow-accent/5 animate-ping" />
              </div>

              <h2 className="text-lg md:text-2xl font-semibold text-white mb-2">GlowIDE AI</h2>
              <p className="text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
                Your intelligent Web3 coding partner. Write code, debug issues, deploy contracts, and build dApps.
              </p>

              <div className="grid grid-cols-2 gap-2 max-w-xs md:max-w-lg w-full mb-6">
                {quickPrompts.map(qp => (
                  <button
                    key={qp.label}
                    onClick={handleNewSession}
                    className="flex items-center gap-2 md:gap-3 p-3 rounded-xl bg-glow-card border border-glow-border hover:border-glow-accent/40 hover:bg-glow-accent/5 transition-all text-left group"
                  >
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-glow-accent/10 flex items-center justify-center group-hover:bg-glow-accent/20 transition-colors flex-shrink-0">
                      <qp.icon className="w-3 h-3 md:w-4 md:h-4 text-glow-accent" />
                    </div>
                    <span className="text-xs md:text-sm text-gray-300 font-medium">{qp.label}</span>
                  </button>
                ))}
              </div>

              <Button variant="gradient" size="sm" onClick={handleNewSession} className="md:h-11 md:px-6 md:text-base">
                <Plus className="w-4 h-4 mr-2" />
                Start New Chat
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
