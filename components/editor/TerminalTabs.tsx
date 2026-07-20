"use client";
import { useState } from "react";
import { Terminal } from "./Terminal";
import { Plus, X, Terminal as TermIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabMeta { id: string; title: string; }

let tabCounter = 1;
function newTab(): TabMeta {
  return { id: `term-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, title: `${tabCounter++}: bash` };
}

/**
 * VSCode-style terminal panel: a tab strip above one or more independent
 * Terminal instances. Inactive tabs stay mounted (just visually hidden) so
 * their command history and output survive switching between them.
 */
export function TerminalTabs() {
  const [tabs, setTabs]         = useState<TabMeta[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState(tabs[0].id);

  const addTab = () => {
    const t = newTab();
    setTabs(prev => [...prev, t]);
    setActiveId(t.id);
  };

  const closeTab = (id: string) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== id);
      if (remaining.length === 0) {
        const fresh = newTab();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === id) setActiveId(remaining[remaining.length - 1].id);
      return remaining;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#080810]">
      {/* Tab strip */}
      <div className="flex items-center gap-0.5 px-2 pt-1.5 border-b border-glow-border/50 bg-glow-surface/30 flex-shrink-0 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveId(tab.id)}
            className={cn(
              "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-[11px] font-mono whitespace-nowrap transition-colors border-b-2",
              activeId === tab.id
                ? "bg-[#080810] text-glow-text border-glow-accent"
                : "text-glow-muted border-transparent hover:bg-glow-card/50 hover:text-glow-text"
            )}>
            <TermIcon className="w-3 h-3 flex-shrink-0"/>
            {tab.title}
            <span onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
              className="ml-1 p-0.5 rounded hover:bg-glow-border/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="w-2.5 h-2.5"/>
            </span>
          </button>
        ))}
        <button onClick={addTab} title="New Terminal"
          className="flex items-center justify-center w-6 h-6 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card/50 transition-colors flex-shrink-0 ml-1">
          <Plus className="w-3.5 h-3.5"/>
        </button>
      </div>

      {/* All terminal instances stay mounted; only the active one is visible,
          so switching tabs never loses history or a running command's output. */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map(tab => (
          <div key={tab.id} className={cn("absolute inset-0", activeId === tab.id ? "block" : "hidden")}>
            <Terminal/>
          </div>
        ))}
      </div>
    </div>
  );
}
