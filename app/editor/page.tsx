"use client";
export const dynamic = "force-dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { EditorTabs } from "@/components/editor/EditorTabs";
import { Terminal, terminalLog } from "@/components/editor/Terminal";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ContractDeployer } from "@/components/contracts/ContractDeployer";
import { useEditorStore } from "@/store/editorStore";
import { useFileSystemStore } from "@/store/fileSystemStore";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import {
  Play, Rocket, MessageSquare, Save, Download, FolderOpen,
  BookOpen, ChevronRight, X, Layers, Terminal as TermIcon,
  Code2, Zap, Shield, GitBranch, Star, FileCode, Plus,
  Blocks, ArrowRight, CheckCircle, AlertTriangle,
} from "lucide-react";
import type { CompileOutput } from "@/lib/compiler";
import type { Language } from "@/types";
import { ARC_SAMPLES, type SampleProject } from "@/lib/arc-samples";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const DIFFICULTY_COLOR = {
  beginner:     "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  intermediate: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  advanced:     "text-red-400 bg-red-500/10 border-red-500/20",
};

// ── File Tree (slim panel) ────────────────────────────────────────────────────
function FileTree() {
  const { tabs, activeTabId, closeTab } = useEditorStore();
  const setActiveTab = useEditorStore(s => s.setActiveTab);

  if (!tabs.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-3 gap-3 text-center">
        <FileCode className="w-8 h-8 text-glow-muted/20"/>
        <p className="text-xs text-glow-muted/50">No files open</p>
        <p className="text-[10px] text-glow-muted/30">Load a sample or paste code</p>
      </div>
    );
  }
  return (
    <div className="py-2">
      <p className="text-[9px] text-glow-muted/40 uppercase tracking-widest px-3 pb-1.5">Files</p>
      {tabs.map(tab => (
        <div key={tab.id}
          className={cn("flex items-center gap-2 px-3 py-1.5 cursor-pointer group transition-colors",
            tab.id === activeTabId ? "bg-glow-accent/10 text-glow-accent-light" : "text-glow-muted/70 hover:text-glow-text hover:bg-glow-card/40"
          )}
          onClick={() => setActiveTab(tab.id)}>
          <FileCode className="w-3.5 h-3.5 flex-shrink-0"/>
          <span className="text-xs truncate flex-1">{tab.name}</span>
          {tab.isModified && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0"/>}
          <button onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-glow-muted hover:text-red-400 flex-shrink-0">
            <X className="w-3 h-3"/>
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Sample Projects Panel ─────────────────────────────────────────────────────
function SamplesPanel({ onLoad }: { onLoad: (p: SampleProject) => void }) {
  const [expanded, setExpanded] = useState<string|null>(null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-3 pt-3 pb-2 border-b border-glow-border/40">
        <div className="flex items-center gap-2 mb-0.5">
          <BookOpen className="w-3.5 h-3.5 text-glow-accent"/>
          <span className="text-xs font-semibold text-glow-text">Arc Workstation</span>
        </div>
        <p className="text-[10px] text-glow-muted/60">Production templates for Arc Testnet</p>
      </div>
      <div className="p-2 space-y-1.5">
        {ARC_SAMPLES.map(sample => (
          <div key={sample.id}
            className={cn("rounded-xl border transition-all overflow-hidden",
              expanded === sample.id ? "border-glow-accent/30 bg-glow-accent/5" : "border-glow-border/50 bg-glow-card/30")}>
            <button className="w-full flex items-center gap-2.5 p-3 text-left"
              onClick={() => setExpanded(expanded === sample.id ? null : sample.id)}>
              <div className="w-8 h-8 rounded-lg bg-glow-accent/15 flex items-center justify-center flex-shrink-0">
                {sample.id.includes('nft')     ? <Star className="w-4 h-4 text-glow-accent"/>
                 : sample.id.includes('defi')  ? <Zap className="w-4 h-4 text-amber-400"/>
                 : sample.id.includes('dao')   ? <Layers className="w-4 h-4 text-emerald-400"/>
                 : sample.id.includes('cctp')  ? <ArrowRight className="w-4 h-4 text-blue-400"/>
                 : sample.id.includes('multi') ? <Shield className="w-4 h-4 text-red-400"/>
                 : <Code2 className="w-4 h-4 text-glow-accent"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-semibold text-glow-text truncate">{sample.title}</p>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border flex-shrink-0", DIFFICULTY_COLOR[sample.difficulty])}>
                    {sample.difficulty}
                  </span>
                </div>
                <p className="text-[10px] text-glow-muted/70 leading-tight line-clamp-1">{sample.description}</p>
              </div>
              <ChevronRight className={cn("w-3.5 h-3.5 text-glow-muted/40 flex-shrink-0 transition-transform", expanded === sample.id && "rotate-90")}/>
            </button>

            {expanded === sample.id && (
              <div className="px-3 pb-3 space-y-2 border-t border-glow-border/30 pt-2">
                <div className="flex flex-wrap gap-1">
                  {sample.tags.map(t => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-glow-surface border border-glow-border/50 text-glow-muted/60">{t}</span>
                  ))}
                </div>
                <div className="space-y-1">
                  {sample.files.map(f => (
                    <div key={f.name} className="flex items-center gap-1.5 text-[10px] text-glow-muted/60">
                      <FileCode className="w-3 h-3"/>
                      <span>{f.name}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => onLoad(sample)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-glow-gradient text-white text-xs font-semibold rounded-lg">
                  <FolderOpen className="w-3.5 h-3.5"/>Load Project
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Editor Page ──────────────────────────────────────────────────────────
export default function EditorPage() {
  const { tabs, activeTabId, isTerminalOpen, toggleTerminal, updateTabContent, closeTab, setActiveTab } = useEditorStore();
  const { updateContent, nodes } = useFileSystemStore();

  const [rightPanel,     setRightPanel]     = useState<"chat"|"deploy"|"samples"|null>("samples");
  const [compileResult,  setCompileResult]  = useState<CompileOutput|null>(null);
  const [isCompiling,    setIsCompiling]    = useState(false);
  const [buildLog,       setBuildLog]       = useState<Array<{type:"info"|"success"|"error"|"warn"; text:string; ts:number}>>([]);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // ── Log helper ────────────────────────────────────────────────────────────
  const log = useCallback((text: string, type: "info"|"success"|"error"|"warn" = "info") => {
    setBuildLog(l => [...l.slice(-200), { type, text, ts: Date.now() }]);
    terminalLog(text, type === "warn" ? "warn" : type);
  }, []);

  // ── Load sample project ───────────────────────────────────────────────────
  const loadSample = useCallback((project: SampleProject) => {
    const newTabs = project.files.map((f, i) => ({
      id: `sample-${project.id}-${i}`,
      fileId: `sample-file-${i}`,
      name: f.name,
      path: `/${project.id}/${f.name}`,
      language: (f.language === "solidity" ? "solidity" : f.language === "typescript" ? "typescript" : f.language === "markdown" ? "markdown" : "typescript") as Language,
      content: f.content,
      isModified: false,
      isActive: i === 0,
    }));
    useEditorStore.setState(state => ({
      tabs: [...state.tabs.filter(t => !newTabs.some(nt => nt.name === t.name)), ...newTabs],
      activeTabId: newTabs[0].id,
    }));
    toast.success(`${project.title} loaded — ${project.files.length} files`);
    log(`Loaded project: ${project.title}`, "success");
    setRightPanel(null);
  }, [log]);

  // ── Load from chat sessionStorage ─────────────────────────────────────────
  useEffect(() => {
    const filesJson = sessionStorage.getItem("glowide_editor_files");
    const action    = sessionStorage.getItem("glowide_editor_action");
    if (!filesJson) return;
    try {
      const files: Array<{filename:string;content:string;lang:string}> = JSON.parse(filesJson);
      sessionStorage.removeItem("glowide_editor_files");
      sessionStorage.removeItem("glowide_editor_action");
      if (!files.length) return;
      const newTabs = files.map((f,i) => ({
        id: 'chat-' + Date.now() + '-' + i,
        fileId: 'chat-file-' + i,
        name: f.filename,
        path: '/' + f.filename,
        language: f.lang as Language,
        content: f.content,
        isModified: false,
        isActive: i === files.length - 1,
      }));
      const lastTab = newTabs[newTabs.length-1];
      useEditorStore.setState(state => ({
        tabs: [...state.tabs.filter(t=>!newTabs.some(nt=>nt.name===t.name)), ...newTabs],
        activeTabId: lastTab.id,
      }));
      toast.success(action === "compile" ? "Contract loaded — click Compile" : `${files.length} files loaded`);
    } catch { /* skip */ }
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!activeTab) return;
    const node = nodes.find(n => n.id === activeTab.id);
    if (node) updateContent(node.id, activeTab.content);
    toast.success(`Saved ${activeTab.name}`);
    log(`Saved: ${activeTab.name}`, "success");
  }, [activeTab, nodes, updateContent, log]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey||e.metaKey) && e.key==="s") { e.preventDefault(); handleSave(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleSave]);

  // ── Compile ───────────────────────────────────────────────────────────────
  const compile = useCallback(async () => {
    if (!activeTab) { toast.error("Open a Solidity file first"); return; }
    if (!activeTab.name.endsWith(".sol")) { toast.error("Select a .sol file to compile"); return; }
    setIsCompiling(true);
    setCompileResult(null);
    log(`Compiling ${activeTab.name}…`, "info");
    try {
      const res = await fetch("/api/contracts/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCode: activeTab.content, contractName: activeTab.name.replace(".sol","") }),
      });
      const result: CompileOutput = await res.json();
      setCompileResult(result);
      if (result.success) {
        toast.success(`Compiled: ${result.contractName}`);
        log(`✓ ${result.contractName} compiled successfully`, "success");
        if (result.warnings?.length) result.warnings.forEach((w: {message:string}) => log(`⚠ ${w.message}`, "warn"));
        if (result.bytecode) log(`Bytecode: ${result.bytecode.length/2} bytes`, "info");
        if (result.abi) log(`ABI: ${result.abi.length} functions/events`, "info");
      } else {
        toast.error(`${result.errors?.length ?? 1} compile error(s)`);
        result.errors?.forEach((e: {message:string}) => log(`✗ ${e.message}`, "error"));
      }
    } catch(e) {
      toast.error("Compilation failed");
      log(`Error: ${e}`, "error");
    } finally { setIsCompiling(false); }
  }, [activeTab, log]);

  // ── Download ZIP ──────────────────────────────────────────────────────────
  const downloadProject = async () => {
    if (!tabs.length) { toast.error("No files open"); return; }
    try {
      const JSZip = (await import("jszip")).default;
      const zip   = new JSZip();
      tabs.forEach(t => zip.file(t.name||"file.txt", t.content||""));
      const blob = await zip.generateAsync({ type:"blob" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "arc-project.zip"; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${tabs.length} files`);
    } catch(e) { toast.error("Download failed"); }
  };

  // ── New file ──────────────────────────────────────────────────────────────
  const newFile = () => {
    const name = prompt("File name (e.g. MyContract.sol)");
    if (!name) return;
    const ext  = name.split('.').pop() ?? 'sol';
    const lang = ext === 'sol' ? 'solidity' : ext === 'ts' ? 'typescript' : ext === 'json' ? 'json' : 'typescript';
    const id   = 'new-' + Date.now();
    const defaultContent: Record<string,string> = {
      sol: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\n\ncontract ${name.replace('.sol','')} {\n    \n}\n`,
      ts:  `import { ethers } from "ethers";\n\nasync function main() {\n  // Arc Testnet: https://rpc.testnet.arc.network\n  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");\n  \n}\n\nmain().catch(console.error);\n`,
      json: `{\n  "name": "my-project",\n  "version": "1.0.0"\n}\n`,
    };
    useEditorStore.setState(state => ({
      tabs: [...state.tabs, { id, fileId:id, name, path:'/'+name, language:lang as Language, content: defaultContent[ext] ?? '', isModified:false, isActive:true }],
      activeTabId: id,
    }));
  };

  const hasSolidity = activeTab?.language === "solidity" || activeTab?.name?.endsWith(".sol");
  const solTabs = tabs.filter(t => t.language === "solidity" || t.name?.endsWith(".sol"));

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100dvh-56px)] bg-[#080812]">

        {/* ── Top toolbar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-glow-border bg-[#080812] flex-shrink-0">

          {/* File info */}
          <div className="flex items-center gap-1.5 mr-2 min-w-0 flex-shrink-0">
            <FileCode className="w-3.5 h-3.5 text-glow-muted/50 flex-shrink-0"/>
            <span className="text-xs text-glow-muted/70 truncate max-w-[140px]">{activeTab?.name ?? "No file"}</span>
            {activeTab?.isModified && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0"/>}
          </div>

          {/* Left actions */}
          <div className="flex items-center gap-1">
            <ToolBtn icon={Plus} label="New file" onClick={newFile}/>
            <ToolBtn icon={Save} label="Save (Ctrl+S)" onClick={handleSave} disabled={!activeTab}/>
            <ToolBtn icon={Download} label="Download ZIP" onClick={downloadProject} disabled={!tabs.length}/>
            <ToolBtn icon={TermIcon} label="Toggle terminal" onClick={toggleTerminal} active={isTerminalOpen}/>
          </div>

          <div className="flex-1"/>

          {/* Compile badge */}
          {compileResult?.success && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CheckCircle className="w-3 h-3 text-emerald-400"/>
              <span className="text-[10px] text-emerald-400 font-semibold">{compileResult.contractName}</span>
            </div>
          )}
          {compileResult && !compileResult.success && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-3 h-3 text-red-400"/>
              <span className="text-[10px] text-red-400">{compileResult.errors?.length} error(s)</span>
            </div>
          )}

          {/* Compile button */}
          {hasSolidity && (
            <button onClick={compile} disabled={isCompiling}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-gradient text-white text-xs font-semibold rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity">
              {isCompiling ? (
                <><span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin"/><span>Compiling…</span></>
              ) : (
                <><Play className="w-3.5 h-3.5"/><span>Compile</span></>
              )}
            </button>
          )}

          {/* Right panel toggles */}
          <div className="flex gap-0.5 ml-1">
            {([
              ["samples", BookOpen, "Samples"],
              ["chat",    MessageSquare, "AI Chat"],
              ["deploy",  Rocket, "Deploy"],
            ] as const).map(([id, Icon, label]) => (
              <button key={id} onClick={() => setRightPanel(rightPanel === id ? null : id)}
                title={label}
                className={cn("p-1.5 rounded-lg transition-colors",
                  rightPanel === id ? "bg-glow-accent/20 text-glow-accent-light" : "text-glow-muted/60 hover:text-glow-text hover:bg-glow-card")}>
                <Icon className="w-3.5 h-3.5"/>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main layout ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal">

            {/* Left: File tree */}
            <Panel defaultSize={15} minSize={10} maxSize={22}>
              <div className="h-full border-r border-glow-border overflow-hidden bg-[#080812]">
                <FileTree/>
              </div>
            </Panel>
            <PanelResizeHandle className="w-[3px] bg-glow-border/30 hover:bg-glow-accent/40 transition-colors cursor-col-resize"/>

            {/* Center: Editor + terminal */}
            <Panel defaultSize={rightPanel ? 55 : 85} minSize={35}>
              <PanelGroup direction="vertical">
                <Panel defaultSize={isTerminalOpen ? 70 : 100} minSize={35}>
                  <div className="flex flex-col h-full">
                    <EditorTabs/>
                    <div className="flex-1 overflow-hidden">
                      <MonacoEditor/>
                    </div>
                  </div>
                </Panel>
                {isTerminalOpen && (
                  <>
                    <PanelResizeHandle className="h-[3px] bg-glow-border/30 hover:bg-glow-accent/40 transition-colors cursor-row-resize"/>
                    <Panel defaultSize={30} minSize={12} maxSize={55}>
                      <Terminal/>
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            {/* Right panel */}
            {rightPanel && (
              <>
                <PanelResizeHandle className="w-[3px] bg-glow-border/30 hover:bg-glow-accent/40 transition-colors cursor-col-resize"/>
                <Panel defaultSize={30} minSize={22} maxSize={42}>
                  <div className="h-full border-l border-glow-border overflow-hidden bg-[#080812] flex flex-col">
                    {rightPanel === "samples" && <SamplesPanel onLoad={loadSample}/>}
                    {rightPanel === "chat"    && <ChatPanel compact editorMode/>}
                    {rightPanel === "deploy"  && (
                      <div className="flex-1 overflow-y-auto">
                        <ContractDeployer compiled={compileResult}/>
                      </div>
                    )}
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

// ── Tiny toolbar button ────────────────────────────────────────────────────────
function ToolBtn({ icon:Icon, label, onClick, disabled, active }: { icon:React.ElementType; label:string; onClick:()=>void; disabled?:boolean; active?:boolean; }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className={cn("p-1.5 rounded-lg transition-colors text-xs",
        active ? "bg-glow-accent/20 text-glow-accent-light" :
        disabled ? "text-glow-muted/20 cursor-not-allowed" :
        "text-glow-muted/60 hover:text-glow-text hover:bg-glow-card")}>
      <Icon className="w-3.5 h-3.5"/>
    </button>
  );
}
