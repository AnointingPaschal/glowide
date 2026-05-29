"use client";
import { useEditorStore } from "@/store/editorStore";
import type { FileNode } from "@/types";
import { ChevronRight, ChevronDown, Plus, Trash2, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileIcon } from "@/lib/compiler";
import { useState } from "react";

interface FileTreeItemProps { node: FileNode; depth: number; nodes: FileNode[]; onSelect: (node: FileNode) => void; }

function FileTreeItem({ node, depth, nodes, onSelect }: FileTreeItemProps) {
  const { openFolders, toggleFolder, activeTabId, tabs } = useEditorStore();
  const isOpen = openFolders.has(node.id);
  const isActive = tabs.find(t => t.fileId === node.id && t.id === activeTabId);
  const children = nodes.filter(n => n.parent_id === node.id);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer group transition-colors text-sm",
          isActive ? "bg-glow-accent/20 text-glow-accent-light" : "text-glow-muted hover:text-glow-text hover:bg-glow-card"
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => {
          if (node.type === "directory") toggleFolder(node.id);
          else onSelect(node);
        }}
      >
        {node.type === "directory" ? (
          <>{isOpen ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}<span className="text-sm">{getFileIcon(node.name)}</span></>
        ) : (
          <><span className="w-3" /><span className="text-sm">{getFileIcon(node.name)}</span></>
        )}
        <span className="truncate flex-1">{node.name}</span>
        {node.type === "file" && tabs.find(t => t.fileId === node.id)?.isModified && (
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
        )}
      </div>
      {node.type === "directory" && isOpen && children.map(child => (
        <FileTreeItem key={child.id} node={child} depth={depth + 1} nodes={nodes} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface FileTreeProps { projectId?: string; }

export function FileTree({ projectId }: FileTreeProps) {
  const { files, openFile } = useEditorStore();
  const [search, setSearch] = useState("");
  const rootNodes = files.filter(f => !f.parent_id);
  const filteredRoots = search
    ? files.filter(f => f.type === "file" && f.name.toLowerCase().includes(search.toLowerCase()))
    : rootNodes;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-glow-border">
        <span className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Explorer</span>
        <button className="p-1 rounded text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors" title="New file">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-glow-border">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files..."
          className="w-full bg-glow-surface border border-glow-border rounded-md px-2 py-1 text-xs text-glow-text placeholder:text-glow-muted focus:outline-none focus:border-glow-accent/50"
        />
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <FileCode className="w-8 h-8 text-glow-muted mb-2" />
            <p className="text-xs text-glow-muted">No files yet</p>
            <p className="text-xs text-glow-muted">Open a project to get started</p>
          </div>
        ) : (
          filteredRoots.map(node => (
            <FileTreeItem key={node.id} node={node} depth={0} nodes={files} onSelect={openFile} />
          ))
        )}
      </div>
    </div>
  );
}
