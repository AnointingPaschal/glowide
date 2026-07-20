import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorTab, FileNode } from "@/types";
import { generateId } from "@/lib/utils";

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  files: FileNode[];
  openFolders: Set<string>;
  activeProjectId: string | null;
  sidebarWidth: number;
  terminalHeight: number;
  isSidebarOpen: boolean;
  isTerminalOpen: boolean;
  isAIPanelOpen: boolean;
  aiPanelWidth: number;
  theme: "vs-dark" | "vs-light" | "hc-black";
  fontSize: number;
  wordWrap: "on" | "off";
  minimap: boolean;
  lastCompileResult: import("@/lib/compiler").CompileOutput | null;
  setCompileResult: (r: import("@/lib/compiler").CompileOutput | null) => void;
  
  // Actions
  setActiveProject: (projectId: string) => void;
  openFile: (file: FileNode) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  markTabSaved: (tabId: string) => void;
  setFiles: (files: FileNode[]) => void;
  toggleFolder: (folderId: string) => void;
  setSidebarWidth: (width: number) => void;
  setTerminalHeight: (height: number) => void;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
  toggleAIPanel: () => void;
  setAIPanelWidth: (width: number) => void;
  setTheme: (theme: "vs-dark" | "vs-light" | "hc-black") => void;
  setFontSize: (size: number) => void;
  setWordWrap: (wrap: "on" | "off") => void;
  setMinimap: (show: boolean) => void;
  closeAllTabs: () => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      files: [],
      openFolders: new Set(),
      activeProjectId: null,
      sidebarWidth: 260,
      terminalHeight: 200,
      isSidebarOpen: true,
      isTerminalOpen: true,
      isAIPanelOpen: true,
      aiPanelWidth: 360,
      lastCompileResult: null,
      setCompileResult: (r) => set({ lastCompileResult: r }),
      theme: "vs-dark",
      fontSize: 14,
      wordWrap: "on",
      minimap: false,

      setActiveProject: (projectId) =>
        set({ activeProjectId: projectId, tabs: [], activeTabId: null }),

      openFile: (file) => {
        const { tabs } = get();
        const existing = tabs.find((t) => t.fileId === file.id);
        if (existing) {
          set({ activeTabId: existing.id });
          return;
        }
        const newTab: EditorTab = {
          id: generateId(),
          fileId: file.id,
          name: file.name,
          path: file.path,
          language: (file.language || "plaintext") as EditorTab["language"],
          content: file.content || "",
          isModified: false,
          isActive: true,
        };
        set({
          tabs: [...tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: newTab.id,
        });
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get();
        const newTabs = tabs.filter((t) => t.id !== tabId);
        let newActiveId = activeTabId;
        if (activeTabId === tabId) {
          const idx = tabs.findIndex((t) => t.id === tabId);
          newActiveId = newTabs[idx]?.id || newTabs[idx - 1]?.id || null;
        }
        set({ tabs: newTabs, activeTabId: newActiveId });
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      updateTabContent: (tabId, content) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, content, isModified: true } : t
          ),
        })),

      markTabSaved: (tabId) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, isModified: false } : t
          ),
        })),

      setFiles: (files) => set({ files }),

      toggleFolder: (folderId) =>
        set((state) => {
          const newSet = new Set(state.openFolders);
          if (newSet.has(folderId)) newSet.delete(folderId);
          else newSet.add(folderId);
          return { openFolders: newSet };
        }),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setTerminalHeight: (height) => set({ terminalHeight: height }),
      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
      toggleTerminal: () => set((s) => ({ isTerminalOpen: !s.isTerminalOpen })),
      setTerminalOpen: (open) => set({ isTerminalOpen: open }),
      toggleAIPanel: () => set((s) => ({ isAIPanelOpen: !s.isAIPanelOpen })),
      setAIPanelWidth: (width) => set({ aiPanelWidth: width }),
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setWordWrap: (wordWrap) => set({ wordWrap }),
      setMinimap: (minimap) => set({ minimap }),
      closeAllTabs: () => set({ tabs: [], activeTabId: null }),
    }),
    {
      name: "glowide-editor",
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        wordWrap: state.wordWrap,
        minimap: state.minimap,
        sidebarWidth: state.sidebarWidth,
        terminalHeight: state.terminalHeight,
        isSidebarOpen: state.isSidebarOpen,
        isAIPanelOpen: state.isAIPanelOpen,
        aiPanelWidth: state.aiPanelWidth,
      }),
    }
  )
);
