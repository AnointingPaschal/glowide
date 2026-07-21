'use client';
export const dynamic = 'force-dynamic';
/**
 * Dynamic route for /chat/[id] — restores the specific chat session
 * when someone follows a shared link or reloads a chat URL directly.
 *
 * Strategy: set the session as active in zustand (persisted), then
 * redirect to /chat which renders the full UI. The redirect is fast
 * enough (~1 frame) that there's no real visual flash.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';
import { GlowLogo } from '@/components/ui/GlowLogo';

interface Props { params: { id: string } }

export default function ChatSessionPage({ params }: Props) {
  const router  = useRouter();

  useEffect(() => {
    const sessionId = params.id;
    const store = useChatStore.getState();
    const session = store.sessions.find(s => s.id === sessionId);
    if (session) {
      store.setActiveSession(sessionId);
    } else {
      // Session not in local store — try fetching from DB (wallet-synced history)
      // For now, store the ID so /chat can fetch it after wallet connect
      sessionStorage.setItem('pendingChatSessionId', sessionId);
    }
    router.replace('/chat');
  }, []); // eslint-disable-line

  // Very brief loading screen while setting state + redirecting
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-glow-bg">
      <GlowLogo size={40} animate className="dark:text-white text-purple-800 opacity-80"/>
      <p className="text-sm text-glow-muted">Loading chat…</p>
    </div>
  );
}
