"use client";
import { useEditorStore } from "@/store/editorStore";
import { X, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileIcon } from "@/lib/file-icons";

export function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore();

  if (tabs.length === 0) return (
    <div className="h-9 bg-[#0d0d18] border-b border-glow-border/50 flex items-center px-4">
      <span className="text-[10px] text-glow-muted/40 italic">No files open</span>
    </div>
  );

  return (
    <div className="flex h-9 bg-[#0d0d18] border-b border-glow-border/50 overflow-x-auto scrollbar-thin flex-shrink-0">
      {tabs.map(tab => {
        const active = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-0 border-r border-glow-border/30 text-xs whitespace-nowrap transition-all relative min-w-0 max-w-48 flex-shrink-0",
              active
                ? "bg-[#080812] text-glow-text"
                : "bg-[#0d0d18] text-glow-muted/60 hover:text-glow-muted hover:bg-[#0a0a14]"
            )}>
            {/* Active indicator bar */}
            {active && <div className="absolute top-0 left-0 right-0 h-[2px] bg-glow-accent rounded-b-sm"/>}

            <FileIcon name={tab.name} size={14}/>
            <span className="truncate text-[11px]">{tab.name}</span>

            {tab.isModified ? (
              <Circle className="w-1.5 h-1.5 fill-amber-400 text-amber-400 flex-shrink-0 ml-0.5" strokeWidth={0}/>
            ) : (
              <X className="w-3 h-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 flex-shrink-0 ml-0.5 hover:text-red-400 transition-all"
                onClick={e => { e.stopPropagation(); closeTab(tab.id); }}/>
            )}
          </button>
        );
      })}
      {/* Spacer */}
      <div className="flex-1 border-b-0"/>
    </div>
  );
}
