import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatSession, ChatMessage } from "@/types";
import { generateId } from "@/lib/utils";

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;
  streamingContent: string;
  model: string;
  contextFiles: string[];
  
  // Actions
  createSession: (title?: string, projectId?: string) => ChatSession;
  setActiveSession: (sessionId: string | null) => void;
  addMessage: (sessionId: string, message: Omit<ChatMessage, "id" | "created_at">) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  updateStreamingMessage: (content: string) => void;
  finalizeStream: (sessionId: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  setModel: (model: string) => void;
  setContextFiles: (files: string[]) => void;
  deleteSession: (sessionId: string) => void;
  clearMessages: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  getActiveSession: () => ChatSession | null;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      isStreaming: false,
      streamingContent: "",
      model: "anthropic/claude-3.5-sonnet",
      contextFiles: [],

      createSession: (title = "New Chat", projectId) => {
        const session: ChatSession = {
          id: generateId(),
          user_id: "",
          project_id: projectId,
          title,
          model: get().model,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          messages: [],
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: session.id,
        }));
        return session;
      },

      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

      addMessage: (sessionId, message) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  updated_at: new Date().toISOString(),
                  messages: [
                    ...(s.messages || []),
                    {
                      ...message,
                      id: generateId(),
                      session_id: sessionId,
                      created_at: new Date().toISOString(),
                    },
                  ],
                }
              : s
          ),
        })),

      updateMessage: (sessionId, messageId, content) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: (s.messages || []).map((m) => m.id === messageId ? { ...m, content } : m) }
              : s
          ),
        })),

      updateStreamingMessage: (content) =>
        set((state) => ({ streamingContent: state.streamingContent + content })),

      finalizeStream: (sessionId) => {
        const { streamingContent } = get();
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: [
                    ...(s.messages || []),
                    {
                      id: generateId(),
                      session_id: sessionId,
                      role: "assistant" as const,
                      content: streamingContent,
                      created_at: new Date().toISOString(),
                    },
                  ],
                }
              : s
          ),
          isStreaming: false,
          streamingContent: "",
        }));
      },

      setStreaming: (isStreaming) => set({ isStreaming, streamingContent: isStreaming ? "" : get().streamingContent }),
      setModel: (model) => set({ model }),
      setContextFiles: (contextFiles) => set({ contextFiles }),

      deleteSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          activeSessionId:
            state.activeSessionId === sessionId ? null : state.activeSessionId,
        })),

      clearMessages: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, messages: [] } : s
          ),
        })),

      updateSessionTitle: (sessionId, title) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, title } : s
          ),
        })),

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId) || null;
      },
    }),
    {
      name: "glowide-chat",
      partialize: (state) => ({
        sessions: state.sessions.slice(0, 50), // Keep last 50 sessions
        model: state.model,
      }),
    }
  )
);
