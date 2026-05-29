"use client";
import { useState, useRef, useEffect } from "react";
import { useFileSystemStore, type FSNode } from "@/store/fileSystemStore";
import { useEditorStore } from "@/store/editorStore";
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  Plus, FolderPlus, Trash2, Edit2, Check, X, MoreHorizontal,
  FileCode, FileText, FileJson, Braces,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FILE_ICONS: Record<string, React.ElementType> = {
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
  sol: Braces, py: FileCode, rs: FileCode, go: FileCode,
  json: FileJson, md: FileText, html: FileCode, css: FileCode,
};
function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? File;
}
function getFileColor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const colors: Record<string, string> = {
    ts: "text-blue-400", tsx: "text-blue-400", js: "text-yellow-400", jsx: "text-yellow-400",
    sol: "text-purple-400", py: "text-green-400", rs: "text-orange-400", go: "text-cyan-400",
    json: "text-amber-400", md: "text-gray-400", html: "text-red-400", css: "text-pink-400",
    css3: "text-pink-400",
  };
  return colors[ext] ?? "text-glow-muted";
}

interface NodeRowProps {
  node: FSNode;
  depth: number;
  projectId: string;
}

function NodeRow({ node, depth, projectId }: NodeRowProps) {
  const { expandedDirs, toggleDir, deleteNode, renameNode, createFile, createDirectory, getChildren } = useFileSystemStore();
  const { openFile, tabs } = useEditorStore();
  const [renaming, setRenaming]     = useState(false);
  const [newName, setNewName]       = useState(node.name);
  const [showMenu, setShowMenu]     = useState(false);
  const [addingFile, setAddingFile] = useState(false);
  const [addingDir, setAddingDir]   = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  const isOpen  = expandedDirs.has(node.id);
  const Icon    = node.type === "directory" ? (isOpen ? FolderOpen : Folder) : getFileIcon(node.name);
  const isActive = tabs.some(t => t.id === node.id);

  useEffect(() => { if (renaming || addingFile || addingDir) inputRef.current?.focus(); }, [renaming, addingFile, addingDir]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const commitRename = () => {
    if (newName.trim() && newName !== node.name) renameNode(node.id, newName.trim());
    setRenaming(false);
  };
  const commitAddItem = (type: "file" | "directory") => {
    if (!newItemName.trim()) { setAddingFile(false); setAddingDir(false); return; }
    if (type === "file") createFile(node.id, newItemName.trim(), projectId);
    else createDirectory(node.id, newItemName.trim(), projectId);
    setNewItemName("");
    setAddingFile(false);
    setAddingDir(false);
  };
  const handleClick = () => {
    if (node.type === "directory") { toggleDir(node.id); return; }
    // Open file in editor
    const fileNode = { id: node.id, project_id: node.projectId, name: node.name, path: `/${node.name}`, type: "file" as const, content: node.content ?? "", language: node.language ?? "plaintext", created_at: node.createdAt, updated_at: node.updatedAt };
    openFile(fileNode);
  };

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-[3px] pr-2 rounded-lg cursor-pointer select-none transition-colors text-xs",
          "hover:bg-glow-card",
          isActive && "bg-glow-accent/10 text-glow-accent-light",
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={handleClick}
      >
        {node.type === "directory" ? (
          <span className="w-3 h-3 flex-shrink-0 text-glow-muted">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        ) : <span className="w-3 h-3 flex-shrink-0" />}

        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", node.type === "directory" ? "text-glow-accent/70" : getFileColor(node.name))} />

        {renaming ? (
          <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
            onBlur={commitRename}
            className="flex-1 bg-glow-bg border border-glow-accent/50 rounded px-1 py-px text-xs text-glow-text focus:outline-none"
            onClick={e => e.stopPropagation()} />
        ) : (
          <span className={cn("flex-1 truncate text-xs", isActive ? "text-glow-accent-light font-medium" : "text-glow-text/80")}>{node.name}</span>
        )}

        {/* Action icons — visible on hover */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          {node.type === "directory" && (
            <>
              <button onClick={() => { setAddingFile(true); setAddingDir(false); if (!isOpen) toggleDir(node.id); }}
                className="p-0.5 rounded text-glow-muted hover:text-glow-text hover:bg-glow-surface" title="New File">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={() => { setAddingDir(true); setAddingFile(false); if (!isOpen) toggleDir(node.id); }}
                className="p-0.5 rounded text-glow-muted hover:text-glow-text hover:bg-glow-surface" title="New Folder">
                <FolderPlus className="w-3 h-3" />
              </button>
            </>
          )}
          <button onClick={() => { setRenaming(true); setNewName(node.name); }}
            className="p-0.5 rounded text-glow-muted hover:text-glow-text hover:bg-glow-surface" title="Rename">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={() => deleteNode(node.id)}
            className="p-0.5 rounded text-glow-muted hover:text-red-400 hover:bg-red-500/10" title="Delete">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* New item inputs */}
      {node.type === "directory" && isOpen && (
        <>
          {(addingFile || addingDir) && (
            <div className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}>
              {addingFile ? <File className="w-3.5 h-3.5 text-glow-muted flex-shrink-0" /> : <Folder className="w-3.5 h-3.5 text-glow-accent/70 flex-shrink-0" />}
              <input ref={inputRef} value={newItemName} onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitAddItem(addingFile ? "file" : "directory"); if (e.key === "Escape") { setAddingFile(false); setAddingDir(false); setNewItemName(""); } }}
                onBlur={() => commitAddItem(addingFile ? "file" : "directory")}
                placeholder={addingFile ? "filename.ts" : "folder-name"}
                className="flex-1 bg-glow-bg border border-glow-accent/50 rounded px-1.5 py-0.5 text-xs text-glow-text focus:outline-none"
              />
            </div>
          )}
          {/* Children */}
          {getChildren(node.id, projectId).map(child => (
            <NodeRow key={child.id} node={child} depth={depth + 1} projectId={projectId} />
          ))}
        </>
      )}
    </div>
  );
}

export function FileTreePanel() {
  const { projects, nodes, activeProjectId, createProject, deleteProject, renameProject, setActiveProject, createFile, createDirectory, getChildren, expandedDirs, toggleDir } = useFileSystemStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName]       = useState("");
  const [addRoot, setAddRoot]               = useState<"file"|"dir"|null>(null);
  const [rootItemName, setRootItemName]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef  = useRef<HTMLInputElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const rootNodes = activeProjectId ? getChildren(null, activeProjectId) : [];

  const commitNewProject = () => {
    if (!projectName.trim()) { setShowNewProject(false); return; }
    const p = createProject(projectName.trim());
    setActiveProject(p.id);
    setShowNewProject(false);
    setProjectName("");
  };
  const commitRootItem = () => {
    if (!activeProjectId || !rootItemName.trim()) { setAddRoot(null); return; }
    if (addRoot === "file") createFile(null, rootItemName.trim(), activeProjectId);
    else createDirectory(null, rootItemName.trim(), activeProjectId);
    setRootItemName(""); setAddRoot(null);
  };

  useEffect(() => { if (showNewProject) inputRef.current?.focus(); }, [showNewProject]);
  useEffect(() => { if (addRoot) rootRef.current?.focus(); }, [addRoot]);

  return (
    <div className="flex flex-col h-full bg-glow-surface text-xs select-none">
      {/* Project selector */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-glow-border flex-shrink-0">
        <select
          value={activeProjectId ?? ""}
          onChange={e => setActiveProject(e.target.value || null)}
          className="flex-1 bg-transparent text-xs text-glow-text focus:outline-none truncate"
        >
          <option value="">— Select Project —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setShowNewProject(true)} className="ml-1 p-1 rounded text-glow-muted hover:text-glow-text hover:bg-glow-card" title="New Project">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New project input */}
      {showNewProject && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-glow-border">
          <input ref={inputRef} value={projectName} onChange={e => setProjectName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitNewProject(); if (e.key === "Escape") { setShowNewProject(false); setProjectName(""); } }}
            onBlur={commitNewProject}
            placeholder="my-project"
            className="flex-1 bg-glow-bg border border-glow-accent/50 rounded-lg px-2 py-1 text-xs text-glow-text focus:outline-none"
          />
        </div>
      )}

      {/* File tree or empty state */}
      <div className="flex-1 overflow-y-auto py-1">
        {!activeProject ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <FolderOpen className="w-8 h-8 text-glow-muted/40 mb-2" />
            <p className="text-glow-muted text-xs">No project selected</p>
            <button onClick={() => setShowNewProject(true)} className="mt-2 text-xs text-glow-accent hover:text-glow-accent-light">
              + New Project
            </button>
          </div>
        ) : (
          <>
            {/* Root toolbar */}
            <div className="flex items-center justify-between px-2 py-1 mb-0.5">
              <span className="text-[10px] font-semibold text-glow-muted uppercase tracking-wider truncate">{activeProject.name}</span>
              <div className="flex gap-0.5">
                <button onClick={() => setAddRoot("file")} className="p-0.5 rounded text-glow-muted hover:text-glow-text hover:bg-glow-card" title="New File">
                  <Plus className="w-3 h-3" />
                </button>
                <button onClick={() => setAddRoot("dir")} className="p-0.5 rounded text-glow-muted hover:text-glow-text hover:bg-glow-card" title="New Folder">
                  <FolderPlus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Root new item input */}
            {addRoot && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 mb-0.5">
                {addRoot === "file" ? <File className="w-3.5 h-3.5 text-glow-muted flex-shrink-0" /> : <Folder className="w-3.5 h-3.5 text-glow-accent/70 flex-shrink-0" />}
                <input ref={rootRef} value={rootItemName} onChange={e => setRootItemName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") commitRootItem(); if (e.key === "Escape") { setAddRoot(null); setRootItemName(""); } }}
                  onBlur={commitRootItem}
                  placeholder={addRoot === "file" ? "index.ts" : "src"}
                  className="flex-1 bg-glow-bg border border-glow-accent/50 rounded px-1.5 py-0.5 text-xs text-glow-text focus:outline-none"
                />
              </div>
            )}

            {/* Nodes */}
            {rootNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-20 text-center px-4">
                <p className="text-glow-muted text-xs">Empty project</p>
                <button onClick={() => setAddRoot("file")} className="mt-1 text-xs text-glow-accent hover:text-glow-accent-light">+ Add file</button>
              </div>
            ) : (
              rootNodes.map(node => <NodeRow key={node.id} node={node} depth={0} projectId={activeProjectId!} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
