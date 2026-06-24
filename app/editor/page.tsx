"use client";
export const dynamic = "force-dynamic";
import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { EditorTabs } from "@/components/editor/EditorTabs";
import { Terminal, terminalLog } from "@/components/editor/Terminal";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ContractDeployer } from "@/components/contracts/ContractDeployer";
import { AnalysisPanel } from "@/components/editor/panels/AnalysisPanel";
import { VerifyPanel }   from "@/components/editor/panels/VerifyPanel";
import { UnitTestPanel } from "@/components/editor/panels/UnitTestPanel";
import { GasPanel }      from "@/components/editor/panels/GasPanel";
import { GitPanel }      from "@/components/editor/panels/GitPanel";
import { FileTreePanel } from "@/components/filesystem/FileTree";
import { useEditorStore } from "@/store/editorStore";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import {
  Play, Rocket, MessageSquare, Save, Download, FolderOpen,
  BookOpen, ChevronRight, ChevronDown, X, Terminal as TermIcon,
  Code2, Zap, Shield, GitBranch, Star, FileCode, Plus,
  ArrowRight, CheckCircle, AlertTriangle, BadgeCheck,
  FlaskConical, Gauge, FolderTree, Settings,
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

// ── Sidebar plugin icons ─────────────────────────────────────────────────────
type Plugin = "files"|"samples"|"deploy"|"chat"|"analysis"|"test"|"verify"|"gas"|"git"|"settings";

const PLUGINS: Array<{id:Plugin; icon:React.ElementType; label:string; group:"top"|"bottom"}> = [
  { id:"files",    icon:FolderTree,    label:"File Explorer",      group:"top"    },
  { id:"samples",  icon:BookOpen,      label:"Arc Workstation",    group:"top"    },
  { id:"deploy",   icon:Rocket,        label:"Deploy & Run",       group:"top"    },
  { id:"analysis", icon:Shield,        label:"Static Analysis",    group:"top"    },
  { id:"test",     icon:FlaskConical,  label:"Unit Testing",       group:"top"    },
  { id:"verify",   icon:BadgeCheck,    label:"Verify Contract",    group:"top"    },
  { id:"gas",      icon:Gauge,         label:"Gas Profiler",       group:"top"    },
  { id:"git",      icon:GitBranch,     label:"Git",                group:"top"    },
  { id:"chat",     icon:MessageSquare, label:"AI Assistant",       group:"bottom" },
  { id:"settings", icon:Settings,      label:"Settings",           group:"bottom" },
];

// ── Samples panel ─────────────────────────────────────────────────────────────
function SamplesPanel({ onLoad }: { onLoad:(p:SampleProject)=>void }) {
  const [expanded, setExpanded] = useState<string|null>(null);
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-3 pt-3 pb-2 border-b border-glow-border/40">
        <div className="flex items-center gap-2 mb-0.5">
          <BookOpen className="w-3.5 h-3.5 text-glow-accent"/>
          <span className="text-xs font-semibold text-glow-text">Arc Workstation</span>
        </div>
        <p className="text-[10px] text-glow-muted/60">Production templates for Arc Testnet + Circle</p>
      </div>
      <div className="p-2 space-y-1.5">
        {ARC_SAMPLES.map(s => (
          <div key={s.id} className={cn("rounded-xl border transition-all overflow-hidden",
            expanded===s.id?"border-glow-accent/30 bg-glow-accent/5":"border-glow-border/50 bg-glow-card/30")}>
            <button className="w-full flex items-center gap-2.5 p-3 text-left" onClick={()=>setExpanded(expanded===s.id?null:s.id)}>
              <div className="w-8 h-8 rounded-lg bg-glow-accent/15 flex items-center justify-center flex-shrink-0">
                {s.id.includes("nft")?"⭐":s.id.includes("defi")?"⚡":s.id.includes("dao")?"🏛":s.id.includes("cctp")?"🌉":s.id.includes("multi")?"🔐":s.id.includes("pay")?"💸":s.id.includes("usyc")?"📈":s.id.includes("wallet")?"👛":"📄"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-semibold text-glow-text truncate">{s.title}</p>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border flex-shrink-0",DIFFICULTY_COLOR[s.difficulty])}>{s.difficulty}</span>
                </div>
                <p className="text-[10px] text-glow-muted/70 line-clamp-1">{s.description}</p>
              </div>
              <ChevronRight className={cn("w-3.5 h-3.5 text-glow-muted/40 flex-shrink-0 transition-transform",expanded===s.id&&"rotate-90")}/>
            </button>
            {expanded===s.id && (
              <div className="px-3 pb-3 space-y-2 border-t border-glow-border/30 pt-2">
                <div className="flex flex-wrap gap-1">
                  {s.tags.map(t=><span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-glow-surface border border-glow-border/50 text-glow-muted/60">{t}</span>)}
                </div>
                {s.files.map(f=><div key={f.name} className="flex items-center gap-1.5 text-[10px] text-glow-muted/60"><FileCode className="w-3 h-3"/><span>{f.name}</span></div>)}
                <button onClick={()=>onLoad(s)} className="w-full flex items-center justify-center gap-1.5 py-2 bg-glow-gradient text-white text-xs font-semibold rounded-lg">
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

// ═══════════════════════════════════════════════════════════════════════════════
export default function EditorPage() {
  const { tabs, activeTabId, isTerminalOpen, toggleTerminal, closeTab, setActiveTab, lastCompileResult, setCompileResult: storeSet } = useEditorStore();

  const [activePlugin,   setActivePlugin]   = useState<Plugin>("files");
  const [compileResult,  setCompileResult]  = useState<CompileOutput|null>(null);
  const [isCompiling,    setIsCompiling]    = useState(false);
  const [buildLog,       setBuildLog]       = useState<Array<{type:"info"|"success"|"error"|"warn";text:string;ts:number}>>([]);
  const [solcVersion,    setSolcVersion]    = useState("0.8.20");
  const [versions,       setVersions]       = useState<Array<{version:string;label:string;tag?:string}>>([]);
  const [verDropOpen,    setVerDropOpen]    = useState(false);

  const activeTab     = tabs.find(t => t.id === activeTabId);
  const hasSolidity   = activeTab?.language === "solidity" || activeTab?.name?.endsWith(".sol");
  const combinedResult= compileResult ?? lastCompileResult;

  // Load compiler versions
  useEffect(() => {
    fetch("/api/contracts/versions").then(r=>r.json())
      .then(d=>{ if(d.versions?.length) setVersions(d.versions); }).catch(()=>{});
  }, []);

  // Load files from chat
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
        id:"chat-"+Date.now()+"-"+i, fileId:"cf-"+i, name:f.filename, path:"/"+f.filename,
        language:f.lang as Language, content:f.content, isModified:false, isActive:i===files.length-1,
      }));
      useEditorStore.setState(state => ({
        tabs: [...state.tabs.filter(t=>!newTabs.some(nt=>nt.name===t.name)), ...newTabs],
        activeTabId: newTabs[newTabs.length-1].id,
      }));
      toast.success(action==="compile"?"Contract loaded — click Compile":`${files.length} files loaded`);
    } catch { /* skip */ }
  }, []);

  const log = useCallback((text:string, type:"info"|"success"|"error"|"warn"="info") => {
    setBuildLog(l=>[...l.slice(-200),{type,text,ts:Date.now()}]);
    terminalLog(text, type==="warn"?"warn":type);
  }, []);

  const loadSample = useCallback((p:SampleProject) => {
    const newTabs = p.files.map((f,i) => ({
      id:`sample-${p.id}-${i}`, fileId:`sf-${i}`, name:f.name, path:`/${p.id}/${f.name}`,
      language:(f.language==="solidity"?"solidity":f.language==="typescript"?"typescript":f.language==="markdown"?"markdown":"typescript") as Language,
      content:f.content, isModified:false, isActive:i===0,
    }));
    useEditorStore.setState(state => ({
      tabs:[...state.tabs.filter(t=>!newTabs.some(nt=>nt.name===t.name)),...newTabs],
      activeTabId:newTabs[0].id,
    }));
    toast.success(`${p.title} loaded — ${p.files.length} files`);
    log(`Loaded: ${p.title}`, "success");
  }, [log]);

  const handleSave = useCallback(() => {
    if (!activeTab) return;
    toast.success(`Saved ${activeTab.name}`);
    log(`Saved: ${activeTab.name}`, "success");
  }, [activeTab, log]);

  useEffect(() => {
    const h=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key==="s"){e.preventDefault();handleSave();}};
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h);
  }, [handleSave]);

  const compile = useCallback(async () => {
    if (!activeTab) { toast.error("Open a Solidity file first"); return; }
    if (!activeTab.name.endsWith(".sol")) { toast.error("Select a .sol file to compile"); return; }
    setIsCompiling(true); setCompileResult(null);
    log(`Compiling ${activeTab.name} (solc ${solcVersion})…`, "info");
    try {
      const res  = await fetch("/api/contracts/compile", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ sourceCode:activeTab.content, contractName:activeTab.name.replace(".sol",""), version:solcVersion }),
      });
      const result: CompileOutput = await res.json();
      setCompileResult(result); storeSet(result);
      if (result.success) {
        toast.success(`Compiled: ${result.contractName}`);
        log(`✓ ${result.contractName} — solc ${result.metadata?.compiler?.version ?? solcVersion}`, "success");
        if (result.bytecode) log(`Bytecode: ${result.bytecode.length/2} bytes`, "info");
        result.warnings?.forEach((w:{message:string})=>log(`⚠ ${w.message}`,"warn"));
      } else {
        toast.error(`${result.errors?.length ?? 1} error(s)`);
        result.errors?.forEach((e:{message:string})=>log(`✗ ${e.message}`,"error"));
      }
    } catch(e) { toast.error("Compile failed"); log(`Error: ${e}`,"error"); }
    finally    { setIsCompiling(false); }
  }, [activeTab, log, solcVersion, storeSet]);

  const downloadProject = async () => {
    if (!tabs.length) { toast.error("No files to download"); return; }
    try {
      const JSZip = (await import("jszip")).default;
      const zip   = new JSZip();
      tabs.forEach(t=>zip.file(t.name||"file.txt", t.content||""));
      const blob  = await zip.generateAsync({type:"blob"});
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a"); a.href=url; a.download="arc-project.zip"; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${tabs.length} files`);
    } catch(e) { toast.error("Download failed"); }
  };

  const newFile = () => {
    const name = prompt("File name (e.g. MyContract.sol)"); if (!name) return;
    const ext  = name.split(".").pop()??"sol";
    const lang = ext==="sol"?"solidity":ext==="ts"?"typescript":ext==="json"?"json":"typescript";
    const defaults: Record<string,string> = {
      sol:`// SPDX-License-Identifier: MIT\npragma solidity ${solcVersion.startsWith("0.8")?"^0.8.20":"^"+solcVersion};\n\ncontract ${name.replace(".sol","")} {\n    \n}\n`,
      ts:`import { ethers } from "ethers";\n\nconst provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");\n\nasync function main() {\n    \n}\n\nmain().catch(console.error);\n`,
      json:`{\n  "name": "my-project",\n  "version": "1.0.0"\n}\n`,
    };
    const id="new-"+Date.now();
    useEditorStore.setState(state=>({
      tabs:[...state.tabs,{id,fileId:id,name,path:"/"+name,language:lang as Language,content:defaults[ext]??"",isModified:false,isActive:true}],
      activeTabId:id,
    }));
  };

  // ── Render plugin panel content ────────────────────────────────────────────
  const renderPlugin = () => {
    switch(activePlugin) {
      case "files":    return <FileTreePanel/>;
      case "samples":  return <SamplesPanel onLoad={loadSample}/>;
      case "deploy":   return <div className="h-full overflow-y-auto"><ContractDeployer compiled={combinedResult}/></div>;
      case "analysis": return <AnalysisPanel/>;
      case "test":     return <UnitTestPanel/>;
      case "verify":   return <VerifyPanel compiled={combinedResult}/>;
      case "gas":      return <GasPanel compiled={combinedResult}/>;
      case "git":      return <GitPanel/>;
      case "chat":     return <ChatPanel compact editorMode/>;
      case "settings": return (
        <div className="p-4 space-y-4">
          <p className="text-sm font-semibold text-glow-text">Editor Settings</p>
          <div className="space-y-2">
            <label className="text-[10px] text-glow-muted/60 uppercase tracking-wider block">Theme</label>
            <select className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text">
              <option>VS Code Dark</option><option>GitHub Dark</option><option>Monokai</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-glow-muted/60 uppercase tracking-wider block">Font Size</label>
            <select className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text">
              <option>12px</option><option>13px</option><option>14px</option><option>16px</option>
            </select>
          </div>
        </div>
      );
    }
  };

  const pluginLabel = PLUGINS.find(p=>p.id===activePlugin)?.label ?? "Plugin";

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100dvh-56px)] bg-[#080812]">

        {/* ── Top toolbar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-glow-border bg-[#080812] flex-shrink-0">
          <div className="flex items-center gap-1.5 mr-1 min-w-0 flex-shrink-0">
            <FileCode className="w-3.5 h-3.5 text-glow-muted/50 flex-shrink-0"/>
            <span className="text-xs text-glow-muted/70 truncate max-w-[120px]">{activeTab?.name ?? "No file"}</span>
            {activeTab?.isModified && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"/>}
          </div>

          <div className="flex items-center gap-0.5">
            <ToolBtn icon={Plus}     label="New file"         onClick={newFile}/>
            <ToolBtn icon={Save}     label="Save (Ctrl+S)"   onClick={handleSave}     disabled={!activeTab}/>
            <ToolBtn icon={Download} label="Download ZIP"    onClick={downloadProject} disabled={!tabs.length}/>
            <ToolBtn icon={TermIcon} label="Toggle terminal" onClick={toggleTerminal}  active={isTerminalOpen}/>
          </div>

          <div className="flex-1"/>

          {/* Status badges */}
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

          {/* Compiler version + Compile button */}
          {hasSolidity && (
            <div className="flex items-center gap-1 relative">
              <div className="relative">
                <button onClick={()=>setVerDropOpen(!verDropOpen)}
                  className="flex items-center gap-1 px-2 py-1.5 bg-glow-card border border-glow-border rounded-lg text-[10px] text-glow-muted hover:text-glow-text font-mono">
                  v{solcVersion}
                  <ChevronDown className={cn("w-3 h-3 transition-transform",verDropOpen&&"rotate-180")}/>
                </button>
                {verDropOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={()=>setVerDropOpen(false)}/>
                    <div className="absolute right-0 bottom-full mb-1 w-44 bg-[#0e0e1a] border border-glow-border rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto animate-fade-in">
                      <p className="text-[9px] text-glow-muted/50 uppercase tracking-widest px-3 py-2 border-b border-glow-border/30 sticky top-0 bg-[#0e0e1a]">Compiler</p>
                      {versions.map(v=>(
                        <button key={v.version} onClick={()=>{setSolcVersion(v.version);setVerDropOpen(false);}}
                          className={cn("w-full flex items-center justify-between px-3 py-2 text-xs transition-colors",
                            solcVersion===v.version?"bg-glow-accent/10 text-glow-accent-light":"text-glow-muted hover:bg-glow-card/50")}>
                          <span className="font-mono">{v.version}</span>
                          {v.tag&&<span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold",v.tag==="latest"?"bg-emerald-500/15 text-emerald-400":"bg-glow-accent/15 text-glow-accent-light")}>{v.tag}</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button onClick={compile} disabled={isCompiling}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-gradient text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                {isCompiling?<><span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin"/><span>Compiling…</span></>
                  :<><Play className="w-3.5 h-3.5"/><span>Compile</span></>}
              </button>
            </div>
          )}
        </div>

        {/* ── Main layout ──────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Plugin sidebar (icon strip) ─────────────────────────── */}
          <div className="w-10 flex-shrink-0 bg-[#080812] border-r border-glow-border flex flex-col items-center py-2 gap-1">
            {PLUGINS.filter(p=>p.group==="top").map(p=>(
              <PluginBtn key={p.id} plugin={p} active={activePlugin===p.id} onClick={()=>setActivePlugin(p.id)}/>
            ))}
            <div className="flex-1"/>
            {PLUGINS.filter(p=>p.group==="bottom").map(p=>(
              <PluginBtn key={p.id} plugin={p} active={activePlugin===p.id} onClick={()=>setActivePlugin(p.id)}/>
            ))}
          </div>

          {/* ── Plugin panel ────────────────────────────────────────── */}
          <div className="w-64 flex-shrink-0 border-r border-glow-border bg-[#080812] flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-glow-border/50 flex-shrink-0">
              <p className="text-[9px] font-bold text-glow-muted/50 uppercase tracking-widest">{pluginLabel}</p>
            </div>
            <div className="flex-1 overflow-hidden">{renderPlugin()}</div>
          </div>

          {/* ── Editor + terminal ────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <PanelGroup direction="vertical">
              <Panel defaultSize={isTerminalOpen?72:100} minSize={35}>
                <div className="flex flex-col h-full">
                  <EditorTabs/>
                  <div className="flex-1 overflow-hidden"><MonacoEditor/></div>
                </div>
              </Panel>
              {isTerminalOpen && (
                <>
                  <PanelResizeHandle className="h-[3px] bg-glow-border/30 hover:bg-glow-accent/40 cursor-row-resize"/>
                  <Panel defaultSize={28} minSize={12} maxSize={55}><Terminal/></Panel>
                </>
              )}
            </PanelGroup>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Tiny toolbar button ─────────────────────────────────────────────────────
function ToolBtn({ icon:Icon, label, onClick, disabled, active }: {
  icon:React.ElementType; label:string; onClick:()=>void; disabled?:boolean; active?:boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className={cn("p-1.5 rounded-lg transition-colors",
        active?"bg-glow-accent/20 text-glow-accent-light":
        disabled?"text-glow-muted/20 cursor-not-allowed":
        "text-glow-muted/60 hover:text-glow-text hover:bg-glow-card")}>
      <Icon className="w-3.5 h-3.5"/>
    </button>
  );
}

// ── Plugin sidebar button ───────────────────────────────────────────────────
function PluginBtn({ plugin, active, onClick }: { plugin:{icon:React.ElementType;label:string}; active:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} title={plugin.label}
      className={cn("w-8 h-8 flex items-center justify-center rounded-lg transition-all",
        active?"bg-glow-accent/20 text-glow-accent-light border border-glow-accent/30":"text-glow-muted/50 hover:text-glow-muted hover:bg-glow-card/50")}>
      <plugin.icon className="w-4 h-4"/>
    </button>
  );
}
