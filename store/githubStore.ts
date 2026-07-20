import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * GitHub connection + per-project repo bindings.
 * Token is a user-supplied Personal Access Token, stored client-side only —
 * it's sent directly to GitHub's API (via our commit proxy) and never
 * persisted on our server.
 */
export interface RepoBinding {
  owner: string;
  repo: string;
  branch: string;
  snapshot: Record<string, string>; // path -> content at last sync (clone or push)
}

interface GitHubState {
  token: string | null;
  username: string | null;
  bindings: Record<string, RepoBinding>; // keyed by fileSystemStore projectId

  setToken: (token: string | null, username?: string | null) => void;
  setBinding: (projectId: string, binding: RepoBinding) => void;
  updateSnapshot: (projectId: string, snapshot: Record<string, string>) => void;
  clearBinding: (projectId: string) => void;
}

export const useGitHubStore = create<GitHubState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      bindings: {},

      setToken: (token, username) => set({ token, username: username ?? null }),
      setBinding: (projectId, binding) =>
        set((s) => ({ bindings: { ...s.bindings, [projectId]: binding } })),
      updateSnapshot: (projectId, snapshot) =>
        set((s) => {
          const existing = s.bindings[projectId];
          if (!existing) return s;
          return { bindings: { ...s.bindings, [projectId]: { ...existing, snapshot } } };
        }),
      clearBinding: (projectId) =>
        set((s) => {
          const next = { ...s.bindings };
          delete next[projectId];
          return { bindings: next };
        }),
    }),
    { name: "glowide-github" }
  )
);
