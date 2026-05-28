'use client';

import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useChatStore } from '@/store/chatStore';
import { useEditorStore } from '@/store/editorStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  MessageSquare,
  Plus,
  Trash2,
  Search,
  Clock,
  Code2,
  Sparkles,
  BookOpen,
  Zap,
} from 'lucide-react';
import { formatRelativeTime, generateId } from '@/lib/utils';

export default function ChatPage() {
  const { sessions, activeSessionId, setActiveSession, createSession, deleteSession } = useChatStore();
  const { activeTabId, tabs } = useEditorStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const quickPrompts = [
    { icon: Code2, label: 'Generate Contract', prompt: 'Generate a Solidity ERC20 token contract with minting and burning capabilities.' },
    { icon: Sparkles, label: 'AI Code Review', prompt: 'Review my code for bugs, security issues, and performance improvements.' },
    { icon: BookOpen, label: 'Explain Code', prompt: 'Explain how this code works in simple terms.' },
    { icon: Zap, label: 'Optimize Gas', prompt: 'How can I optimize this Solidity contract to reduce gas costs?' },
  ];

  const handleNewSession = () => {
    const id = generateId();
    createSession(id, 'New Chat');
    setActiveSession(id);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (!activeSessionId) {
      handleNewSession();
    }
  };

  return (
    <AppLayout title="AI Assistant" description="Chat with your AI coding partner">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Session Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-glow-border flex flex-col bg-glow-surface/50">
          {/* Header */}
          <div className="p-4 border-b border-glow-border">
            <Button
              variant="gradient"
              size="sm"
              className="w-full"
              onClick={handleNewSession}
              >
              <Plus className="w-4 h-4 mr-1.5" /> New Chat
            </Button>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-glow-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full bg-glow-bg border border-glow-border rounded-lg pl-9 pr-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-glow-accent/50"
              />
            </div>
          </div>

          {/* Quick Prompts */}
          <div className="p-3 border-b border-glow-border">
            <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">Quick Start</p>
            <div className="space-y-1">
              {quickPrompts.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => handleQuickPrompt(qp.prompt)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-glow-card transition-colors group"
                >
                  <qp.icon className="w-3.5 h-3.5 text-glow-accent group-hover:text-glow-accent-light flex-shrink-0" />
                  <span className="text-xs text-gray-400 group-hover:text-gray-200 truncate">{qp.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                <MessageSquare className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-xs text-gray-500">No chats yet</p>
                <p className="text-xs text-gray-600 mt-1">Start a new conversation</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setActiveSession(session.id)}
                    className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                      activeSessionId === session.id
                        ? 'bg-glow-accent/10 border border-glow-accent/20'
                        : 'hover:bg-glow-card border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${
                          activeSessionId === session.id ? 'text-glow-accent-light' : 'text-gray-300'
                        }`}>
                          {session.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="w-2.5 h-2.5 text-gray-600" />
                          <span className="text-xs text-gray-600">
                            {formatRelativeTime(session.updated_at)}
                          </span>
                          {session.messages.length > 0 && (
                            <Badge variant="default" className="text-xs py-0 px-1">
                              {session.messages.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {session.messages.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1.5 truncate">
                        {session.messages[session.messages.length - 1]?.content?.slice(0, 60)}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Footer */}
          <div className="p-3 border-t border-glow-border">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{sessions.length} conversation{sessions.length !== 1 ? 's' : ''}</span>
              <span>{sessions.reduce((acc, s) => acc + s.messages.length, 0)} messages</span>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 overflow-hidden">
          {activeSessionId ? (
            <ChatPanel />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              {/* Glow orb */}
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full bg-glow-accent/20 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-glow-accent/30 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-glow-accent-light" />
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full bg-glow-accent/5 animate-ping" />
              </div>

              <h2 className="text-2xl font-semibold text-white mb-3">
                GlowIDE AI Assistant
              </h2>
              <p className="text-gray-400 max-w-md mb-8 leading-relaxed">
                Your intelligent coding partner. Write code, debug issues, deploy contracts,
                and build Web3 apps with AI-powered assistance.
              </p>

              <div className="grid grid-cols-2 gap-3 max-w-lg w-full mb-8">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={handleNewSession}
                    className="flex items-center gap-3 p-4 rounded-xl bg-glow-card border border-glow-border hover:border-glow-accent/40 hover:bg-glow-accent/5 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-glow-accent/10 flex items-center justify-center group-hover:bg-glow-accent/20 transition-colors">
                      <qp.icon className="w-4 h-4 text-glow-accent" />
                    </div>
                    <span className="text-sm text-gray-300 font-medium">{qp.label}</span>
                  </button>
                ))}
              </div>

              <Button variant="gradient" size="lg" onClick={handleNewSession}>
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
