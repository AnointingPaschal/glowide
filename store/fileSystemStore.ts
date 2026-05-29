import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FSNode {
  id: string;
  name: string;
  type: "file" | "directory";
  parentId: string | null;
  content?: string;
  language?: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  template?: string;
  createdAt: string;
  updatedAt: string;
}

interface FileSystemState {
  projects: Project[];
  nodes: FSNode[];
  activeProjectId: string | null;
  expandedDirs: Set<string>;

  // Project ops
  createProject: (name: string, description?: string) => Project;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setActiveProject: (id: string | null) => void;

  // File/dir ops
  createFile: (parentId: string | null, name: string, projectId: string, content?: string) => FSNode;
  createDirectory: (parentId: string | null, name: string, projectId: string) => FSNode;
  deleteNode: (id: string) => void;
  renameNode: (id: string, newName: string) => void;
  updateContent: (id: string, content: string) => void;
  moveNode: (id: string, newParentId: string | null) => void;

  // UI
  toggleDir: (id: string) => void;
  getChildren: (parentId: string | null, projectId: string) => FSNode[];
  getNode: (id: string) => FSNode | undefined;
}

function genId() { return Math.random().toString(36).slice(2, 10); }

function detectLanguage(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    sol: "solidity", py: "python", rs: "rust", go: "go", cpp: "cpp", c: "c",
    html: "html", css: "css", json: "json", md: "markdown", sh: "shell",
    yaml: "yaml", yml: "yaml", toml: "toml", env: "plaintext",
    java: "java", kt: "kotlin", swift: "swift", rb: "ruby", php: "php",
  };
  return map[ext] ?? "plaintext";
}

export const useFileSystemStore = create<FileSystemState>()(
  persist(
    (set, get) => ({
      projects: [],
      nodes: [],
      activeProjectId: null,
      expandedDirs: new Set(),

      createProject: (name, description) => {
        const p: Project = { id: genId(), name, description, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        set(s => ({ projects: [...s.projects, p] }));
        return p;
      },
      deleteProject: (id) => set(s => ({ projects: s.projects.filter(p => p.id !== id), nodes: s.nodes.filter(n => n.projectId !== id), activeProjectId: s.activeProjectId === id ? null : s.activeProjectId })),
      renameProject: (id, name) => set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p) })),
      setActiveProject: (id) => set({ activeProjectId: id }),

      createFile: (parentId, name, projectId, content = "") => {
        const node: FSNode = { id: genId(), name, type: "file", parentId, content, language: detectLanguage(name), projectId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        set(s => ({ nodes: [...s.nodes, node] }));
        return node;
      },
      createDirectory: (parentId, name, projectId) => {
        const node: FSNode = { id: genId(), name, type: "directory", parentId, projectId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        set(s => ({ nodes: [...s.nodes, node] }));
        return node;
      },
      deleteNode: (id) => {
        const getAllDescendants = (nodeId: string, nodes: FSNode[]): string[] => {
          const children = nodes.filter(n => n.parentId === nodeId).map(n => n.id);
          return [nodeId, ...children.flatMap(c => getAllDescendants(c, nodes))];
        };
        const toDelete = new Set(getAllDescendants(id, get().nodes));
        set(s => ({ nodes: s.nodes.filter(n => !toDelete.has(n.id)) }));
      },
      renameNode: (id, newName) => set(s => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, name: newName, language: n.type === "file" ? detectLanguage(newName) : n.language, updatedAt: new Date().toISOString() } : n) })),
      updateContent: (id, content) => set(s => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, content, updatedAt: new Date().toISOString() } : n) })),
      moveNode: (id, newParentId) => set(s => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, parentId: newParentId } : n) })),
      toggleDir: (id) => set(s => {
        const ex = new Set(s.expandedDirs);
        ex.has(id) ? ex.delete(id) : ex.add(id);
        return { expandedDirs: ex };
      }),
      getChildren: (parentId, projectId) => get().nodes.filter(n => n.parentId === parentId && n.projectId === projectId).sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
      getNode: (id) => get().nodes.find(n => n.id === id),
    }),
    {
      name: "glowide-filesystem",
      partialize: (s) => ({ projects: s.projects, nodes: s.nodes, activeProjectId: s.activeProjectId }),
    }
  )
);
