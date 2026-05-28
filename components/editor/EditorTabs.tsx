"use client";
import { useEditorStore } from "@/store/editorStore";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileIcon } from "@/lib/compiler";

export function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore();

  if (tabs.length === 0) return (
    <div className="h-9 bg-glow-surface border-b border-glow-border flex items-center px-4">
      <span className="text-xs text-glow-muted">No open files</span>
    </div>
  );

  return (
    <div className="flex h-9 bg-glow-surface border-b border-glow-border overflow-x-auto scrollbar-thin">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 border-r border-glow-border text-xs whitespace-nowrap transition-colors group min-w-0 max-w-40",
            tab.id === activeTabId
              ? "bg-glow-bg text-glow-text border-t-2 border-t-glow-accent"
              : "bg-glow-surface text-glow-muted hover:text-glow-text hover:bg-glow-card"
          )}
        >
          <span className="text-sm leading-none">{getFileIcon(tab.name)}</span>
          <span className="truncate">{tab.name}</span>
          {tab.isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
          <span
            onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
            className={cn(
              "ml-auto p-0.5 rounded transition-colors flex-shrink-0",
              "opacity-0 group-hover:opacity-100",
              tab.id === activeTabId && "opacity-100",
              "hover:bg-glow-border text-glow-muted hover:text-glow-text"
            )}
          >
            <X className="w-3 h-3" />
          </span>
        </button>
      ))}
    </div>
  );
}
