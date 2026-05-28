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
import { useState, useCallback, useEffect } from "react";
import { Play, Rocket, MessageSquare, Plus, AlertCircle } from "lucide-react";
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
  const [isMobile, setIsMobile] = useState(false);
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  // Mobile notice
  if (isMobile) {
    return (
      <AppLayout title="Editor">
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Best on Desktop</h2>
          <p className="text-sm text-gray-400 max-w-xs mb-6 leading-relaxed">
            The code editor requires a larger screen for the best experience. Visit GlowIDE on a desktop or tablet browser.
          </p>
          <div className="space-y-2 w-full max-w-xs">
            {(Object.keys(CONTRACT_TEMPLATES) as Array<keyof typeof CONTRACT_TEMPLATES>).map(t => (
              <button
                key={t}
                onClick={() => newFile(t)}
                className="w-full px-4 py-2.5 bg-glow-card border border-glow-border rounded-lg text-sm text-gray-300 hover:border-glow-accent/40 hover:text-white transition-all text-left"
              >
                📄 {t} template
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-4">You can still browse templates. Full editing on desktop.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-56px)]">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-glow-border bg-glow-surface/50 flex-shrink-0">
          <div className="flex gap-1">
            {(Object.keys(CONTRACT_TEMPLATES) as Array<keyof typeof CONTRACT_TEMPLATES>).map(t => (
              <Button key={t} variant="ghost" size="sm" onClick={() => newFile(t)} className="text-xs h-7 px-2">
                {t}
              </Button>
            ))}
          </div>
          <div className="w-px h-4 bg-glow-border mx-1" />
          <Button size="sm" variant="secondary" onClick={() => newFile()} className="text-xs h-7">
            <Plus className="w-3.5 h-3.5 mr-1" />New
          </Button>

          <div className="flex-1" />

          {activeTab?.language === "solidity" && (
            <Button size="sm" onClick={compile} isLoading={isCompiling} className="h-7 text-xs">
              <Play className="w-3.5 h-3.5 mr-1" />
              {isCompiling ? "Compiling…" : "Compile"}
            </Button>
          )}

          {compileResult && (
            <Badge variant={compileResult.success ? "success" : "error"} className="text-xs">
              {compileResult.success ? "Compiled" : `${compileResult.errors?.length} error(s)`}
            </Badge>
          )}

          <div className="flex gap-1 ml-1">
            {(["chat", "deploy"] as const).map(p => (
              <Button
                key={p}
                variant={rightPanel === p ? "primary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setRightPanel(rightPanel === p ? null : p)}
                title={p === "chat" ? "AI Chat" : "Deploy"}
              >
                {p === "chat" ? <MessageSquare className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />}
              </Button>
            ))}
          </div>
        </div>

        {/* Main editor layout */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal">
            {/* File tree */}
            <Panel defaultSize={15} minSize={10} maxSize={25}>
              <div className="h-full overflow-hidden bg-glow-surface border-r border-glow-border">
                <FileTree />
              </div>
            </Panel>

            <PanelResizeHandle />

            {/* Editor + terminal */}
            <Panel defaultSize={rightPanel ? 60 : 85} minSize={40}>
              <PanelGroup direction="vertical">
                <Panel defaultSize={isTerminalOpen ? 70 : 100} minSize={40}>
                  <div className="flex flex-col h-full">
                    <EditorTabs />
                    <MonacoEditor />
                  </div>
                </Panel>

                {isTerminalOpen && (
                  <>
                    <PanelResizeHandle />
                    <Panel defaultSize={30} minSize={15} maxSize={50}>
                      <Terminal />
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            {/* Right panel: chat / deploy */}
            {rightPanel && (
              <>
                <PanelResizeHandle />
                <Panel defaultSize={25} minSize={20} maxSize={40}>
                  <div className="h-full overflow-hidden border-l border-glow-border">
                    {rightPanel === "chat" && <ChatPanel compact />}
                    {rightPanel === "deploy" && <ContractDeployer compiled={compileResult} />}
                  </div>
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>
      </div>
    </AppLayout>
  );
}
