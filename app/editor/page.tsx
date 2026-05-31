"use client";
export const dynamic = "force-dynamic";
import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FileTreePanel } from "@/components/filesystem/FileTree";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { EditorTabs } from "@/components/editor/EditorTabs";
import { Terminal, terminalLog } from "@/components/editor/Terminal";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ContractDeployer } from "@/components/contracts/ContractDeployer";
import { useEditorStore } from "@/store/editorStore";
import { useFileSystemStore } from "@/store/fileSystemStore";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Play, Rocket, MessageSquare, Plus, AlertCircle, Save, FileCode, Download } from "lucide-react";
import type { CompileOutput } from "@/lib/compiler";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

export default function EditorPage() {
  const { tabs, activeTabId, isTerminalOpen, toggleTerminal, updateTabContent } = useEditorStore();
  const { activeProjectId, nodes, updateContent } = useFileSystemStore();
  const [rightPanel, setRightPanel] = useState<"chat"|"deploy"|null>("chat");
  const [compileResult, setCompileResult] = useState<CompileOutput | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Read files sent from Chat (Compile or Create Project)
  useEffect(() => {
    const filesJson = sessionStorage.getItem("glowide_editor_files");
    const action    = sessionStorage.getItem("glowide_editor_action");
    if (!filesJson) return;
    try {
      const files: Array<{filename:string;content:string;lang:string}> = JSON.parse(filesJson);
      sessionStorage.removeItem("glowide_editor_files");
      sessionStorage.removeItem("glowide_editor_action");
      if (!files.length) return;
      // Import files into editor tabs
      const newTabs = files.map((f,i) => ({
        id: 'chat-' + Date.now() + '-' + i,
        fileId: 'chat-file-' + i,
        name: f.filename,
        path: '/' + f.filename,
        language: f.lang as import("@/types").Language,
        content: f.content,
        isModified: false,
        isActive: i === files.length - 1,
      } as import("@/types").EditorTab));
      const lastTab = newTabs[newTabs.length-1];
      useEditorStore.setState(state => ({
        tabs: [...state.tabs.filter(t=>!newTabs.some(nt=>nt.name===t.name)), ...newTabs],
        activeTabId: lastTab.id,
      }));
      if (action === "compile") {
        toast.success("Contract loaded — click Compile to build");
      } else {
        toast.success(files.length + " files loaded into editor");
      }
    } catch { /* skip */ }
  }, []); // eslint-disable-line

  // Download project as ZIP
  const downloadProject = async () => {
    const { tabs: allTabs } = useEditorStore.getState();
    if (!allTabs.length) { toast.error("No files to download"); return; }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      allTabs.forEach(t => { zip.file(t.name || "file.txt", t.content || ""); });
      const blob = await zip.generateAsync({ type:"blob" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url; a.download = "glowide-project.zip"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Project downloaded");
    } catch(e) { toast.error("Download failed: " + (e as Error).message); }
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Save active tab content to filesystem store
  const handleSave = useCallback(() => {
    if (!activeTab) return;
    const node = nodes.find(n => n.id === activeTab.id);
    if (node) { updateContent(node.id, activeTab.content); terminalLog(`Saved: ${activeTab.name}`, "success"); }
    toast.success(`${activeTab.name} saved`);
  }, [activeTab, nodes, updateContent]);

  // Ctrl+S save
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleSave]);

  const compile = async () => {
    if (!activeTab) { toast.error("Open a Solidity file first"); return; }
    if (!activeTab.name.endsWith(".sol")) { toast.error("Only .sol files can be compiled"); return; }
    setIsCompiling(true);
    setCompileResult(null);
    terminalLog(`Compiling ${activeTab.name}…`, "info");
    try {
      const res = await fetch("/api/contracts/compile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCode: activeTab.content, contractName: activeTab.name.replace(".sol","") }),
      });
      const result: CompileOutput = await res.json();
      setCompileResult(result);
      if (result.success) {
        toast.success(`Compiled: ${result.contractName}`);
        terminalLog(`✓ ${result.contractName} compiled successfully`, "success");
        if (result.warnings?.length) result.warnings.forEach((w: { message: string }) => terminalLog(`⚠ ${w.message}`, "warn"));
      } else {
        toast.error(`${result.errors?.length ?? 1} error(s)`);
        result.errors?.forEach((e: { message: string }) => terminalLog(`✗ ${e.message}`, "error"));
      }
    } catch (e) {
      toast.error("Compilation failed");
      terminalLog(`Compilation error: ${e}`, "error");
    } finally { setIsCompiling(false); }
  };

  if (isMobile) {
    return (
      <AppLayout title="Editor">
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mb-4" />
          <h2 className="text-lg font-semibold text-glow-text mb-2">Best on Desktop</h2>
          <p className="text-sm text-glow-muted">Open GlowIDE on a desktop browser for the full editor experience.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100dvh-56px)]">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-glow-border bg-glow-surface/50 flex-shrink-0">
          <div className="flex items-center gap-1 mr-1">
            <FileCode className="w-3.5 h-3.5 text-glow-muted" />
            <span className="text-xs text-glow-muted">{activeTab?.name ?? "No file open"}</span>
            {false && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />}
          </div>

          <div className="flex-1" />

          {activeTab && (
            <Button variant="ghost" size="sm" onClick={handleSave} className="h-7 text-xs gap-1">
              <Save className="w-3.5 h-3.5" />Save
            </Button>
          )}

          {activeTab?.language === "solidity" && (
            <Button size="sm" onClick={compile} isLoading={isCompiling} className="h-7 text-xs gap-1">
              <Play className="w-3.5 h-3.5" />
              {isCompiling ? "Compiling…" : "Compile"}
            </Button>
          )}

          {compileResult?.success && (
            <Badge variant="success" className="text-xs">✓ {compileResult.contractName}</Badge>
          )}
          {compileResult && !compileResult.success && (
            <Badge variant="error" className="text-xs">{compileResult.errors?.length} error(s)</Badge>
          )}

          <div className="flex gap-0.5 ml-1">
            {([["chat", MessageSquare], ["deploy", Rocket]] as const).map(([id, Icon]) => (
              <Button key={id} variant={rightPanel === id ? "primary" : "ghost"} size="icon" className="h-7 w-7"
                onClick={() => setRightPanel(rightPanel === id ? null : id)} title={id === "chat" ? "AI Chat" : "Deploy"}>
                <Icon className="w-3.5 h-3.5" />
              </Button>
            ))}
          </div>
        </div>

        {/* Main layout */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal">
            {/* File tree */}
            <Panel defaultSize={18} minSize={12} maxSize={30}>
              <div className="h-full border-r border-glow-border">
                <FileTreePanel />
              </div>
            </Panel>

            <PanelResizeHandle />

            {/* Editor + terminal */}
            <Panel defaultSize={rightPanel ? 55 : 82} minSize={35}>
              <PanelGroup direction="vertical">
                <Panel defaultSize={isTerminalOpen ? 68 : 100} minSize={35}>
                  <div className="flex flex-col h-full">
                    <EditorTabs />
                    <MonacoEditor />
                  </div>
                </Panel>
                {isTerminalOpen && (
                  <>
                    <PanelResizeHandle />
                    <Panel defaultSize={32} minSize={15} maxSize={55}>
                      <Terminal />
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            {/* Right panel */}
            {rightPanel && (
              <>
                <PanelResizeHandle />
                <Panel defaultSize={27} minSize={22} maxSize={40}>
                  <div className="h-full border-l border-glow-border overflow-hidden">
                    {rightPanel === "chat" && <ChatPanel compact editorMode />}
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
