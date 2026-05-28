"use client";
import { AppLayout } from "@/components/layout/AppLayout";
import { FileTree } from "@/components/editor/FileTree";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { EditorTabs } from "@/components/editor/EditorTabs";
import { Terminal } from "@/components/editor/Terminal";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ContractDeployer } from "@/components/contracts/ContractDeployer";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useState, useCallback } from "react";
import { Play, Rocket, MessageSquare, Plus } from "lucide-react";
import type { CompileOutput } from "@/lib/compiler";
import { CONTRACT_TEMPLATES, detectLanguage } from "@/lib/compiler";
import { generateId } from "@/lib/utils";
import toast from "react-hot-toast";
import type { FileNode } from "@/types";

export default function EditorPage() {
  const { tabs, activeTabId, isTerminalOpen, toggleTerminal, setFiles, openFile } = useEditorStore();
  const [rightPanel, setRightPanel] = useState<"chat" | "deploy" | null>("chat");
  const [compileResult, setCompileResult] = useState<CompileOutput | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const activeTab = tabs.find(t => t.id === activeTabId);

  const compile = async () => {
    if (!activeTab) { toast.error("No file open"); return; }
    if (activeTab.language !== "solidity") { toast.error("Open a Solidity file to compile"); return; }
    setIsCompiling(true);
    try {
      const res = await fetch("/api/contracts/compile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCode: activeTab.content, contractName: activeTab.name.replace(".sol", "") }),
      });
      const result: CompileOutput = await res.json();
      setCompileResult(result);
      if (result.success) toast.success(`Compiled: ${result.contractName}`);
      else toast.error(`${result.errors?.length} error(s)`);
    } catch { toast.error("Compilation failed"); }
    finally { setIsCompiling(false); }
  };

  const newFile = useCallback((template?: keyof typeof CONTRACT_TEMPLATES) => {
    const name = template ? `${template}.sol` : "untitled.ts";
    const content = template ? CONTRACT_TEMPLATES[template] : "// New file\n";
    const file: FileNode = {
      id: generateId(), project_id: "demo", name, path: `/${name}`,
      type: "file", content, language: detectLanguage(name),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setFiles([...useEditorStore.getState().files, file]);
    openFile(file);
  }, [setFiles, openFile]);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-56px)]">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 bg-glow-surface border-b border-glow-border flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => newFile()}><Plus className="w-3.5 h-3.5" /><span className="text-xs">New</span></Button>
          <Button variant="ghost" size="sm" onClick={() => newFile("simple")} className="text-glow-cyan text-xs">SOL</Button>
          <Button variant="ghost" size="sm" onClick={() => newFile("erc20")} className="text-purple-400 text-xs">ERC20</Button>
          <Button variant="ghost" size="sm" onClick={() => newFile("erc721")} className="text-amber-400 text-xs">ERC721</Button>
          <div className="h-4 w-px bg-glow-border mx-1" />
          {activeTab && (<>
            <span className="text-xs text-glow-muted truncate max-w-xs">{activeTab.path}</span>
            {activeTab.isModified && <Badge variant="warning">unsaved</Badge>}
            <Badge variant="info">{activeTab.language}</Badge>
          </>)}
          <div className="flex-1" />
          {activeTab?.language === "solidity" && (
            <Button variant="secondary" size="sm" onClick={compile} isLoading={isCompiling} className="gap-1.5">
              <Play className="w-3 h-3" />Compile
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setRightPanel(rightPanel === "chat" ? null : "chat")}>
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRightPanel(rightPanel === "deploy" ? null : "deploy")}>
            <Rocket className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* IDE layout */}
        <div className="flex-1 min-h-0">
          <PanelGroup direction="horizontal">
            <Panel defaultSize={18} minSize={12} maxSize={35}>
              <div className="h-full bg-glow-surface border-r border-glow-border"><FileTree /></div>
            </Panel>
            <PanelResizeHandle />
            <Panel defaultSize={rightPanel ? 55 : 82} minSize={30}>
              <PanelGroup direction="vertical">
                <Panel defaultSize={isTerminalOpen ? 70 : 100} minSize={30}>
                  <div className="flex flex-col h-full bg-[#0e0e1a]">
                    <EditorTabs />
                    <MonacoEditor />
                  </div>
                </Panel>
                {isTerminalOpen && (<>
                  <PanelResizeHandle />
                  <Panel defaultSize={30} minSize={15} maxSize={60}><Terminal /></Panel>
                </>)}
              </PanelGroup>
            </Panel>
            {rightPanel && (<>
              <PanelResizeHandle />
              <Panel defaultSize={27} minSize={20} maxSize={45}>
                <div className="h-full bg-glow-bg border-l border-glow-border overflow-hidden">
                  <div className="flex border-b border-glow-border">
                    <button onClick={() => setRightPanel("chat")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${rightPanel === "chat" ? "text-glow-accent-light border-b-2 border-glow-accent" : "text-glow-muted hover:text-glow-text"}`}>
                      <MessageSquare className="w-3.5 h-3.5" />AI Chat
                    </button>
                    <button onClick={() => setRightPanel("deploy")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${rightPanel === "deploy" ? "text-glow-accent-light border-b-2 border-glow-accent" : "text-glow-muted hover:text-glow-text"}`}>
                      <Rocket className="w-3.5 h-3.5" />Deploy
                    </button>
                  </div>
                  <div className="h-[calc(100%-36px)] overflow-hidden">
                    {rightPanel === "chat" && <ChatPanel compact />}
                    {rightPanel === "deploy" && <div className="overflow-y-auto h-full"><ContractDeployer compiled={compileResult} /></div>}
                  </div>
                </div>
              </Panel>
            </>)}
          </PanelGroup>
        </div>
      </div>
    </AppLayout>
  );
}
