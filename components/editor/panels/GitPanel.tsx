"use client";
import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { GitBranch, Download, Github, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import type { Language } from "@/types";

const GITHUB_RAW = "https://raw.githubusercontent.com";
const GITHUB_API = "https://api.github.com";

interface RepoFile { name:string; path:string; download_url?:string; type:"file"|"dir"; }

export function GitPanel() {
  const [url,     setUrl]     = useState("");
  const [branch,  setBranch]  = useState("main");
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState<{type:"success"|"error"|"info"; msg:string}|null>(null);
  const [files,   setFiles]   = useState<RepoFile[]>([]);

  const fetchRepo = async () => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) { setStatus({type:"error",msg:"Invalid GitHub URL"}); return; }
    const [,owner,repo] = match;
    setLoading(true); setStatus(null); setFiles([]);
    try {
      const res  = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/?ref=${branch}`);
      if (!res.ok) throw new Error(`GitHub: ${res.status} ${res.statusText}`);
      const data = await res.json() as RepoFile[];
      setFiles(data.filter(f => f.type === "file" && (f.name.endsWith(".sol")||f.name.endsWith(".ts")||f.name.endsWith(".json")||f.name.endsWith(".md"))));
      setStatus({type:"info", msg:`Found ${data.length} items — showing source files`});
    } catch(e) { setStatus({type:"error", msg:String(e)}); }
    finally    { setLoading(false); }
  };

  const loadFile = async (file: RepoFile) => {
    if (!file.download_url) return;
    setLoading(true);
    try {
      const content = await fetch(file.download_url).then(r => r.text());
      const ext = file.name.split(".").pop() ?? "txt";
      const lang: Language = ext==="sol"?"solidity":ext==="ts"?"typescript":ext==="json"?"json":"markdown";
      const id = "git-"+Date.now();
      useEditorStore.setState(state => ({
        tabs: [...state.tabs.filter(t=>t.name!==file.name), {id, fileId:id, name:file.name, path:file.path, language:lang, content, isModified:false, isActive:true}],
        activeTabId: id,
      }));
      setStatus({type:"success", msg:`Loaded ${file.name}`});
    } catch(e) { setStatus({type:"error", msg:`Load failed: ${e}`}); }
    finally    { setLoading(false); }
  };

  const loadAll = async () => {
    for (const f of files) await loadFile(f);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-glow-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-glow-accent"/>
          <span className="text-sm font-semibold text-glow-text">Git</span>
        </div>
        <p className="text-[10px] text-glow-muted/60 mb-3">Clone from GitHub and load source files into the editor.</p>

        <div className="space-y-2">
          <input value={url} onChange={e=>setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
          <div className="flex gap-2">
            <input value={branch} onChange={e=>setBranch(e.target.value)}
              placeholder="branch (main)"
              className="flex-1 bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
            <button onClick={fetchRepo} disabled={loading||!url}
              className="px-3 py-2 bg-glow-gradient text-white text-xs font-semibold rounded-xl disabled:opacity-50 flex items-center gap-1.5">
              {loading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Github className="w-3.5 h-3.5"/>}
              Clone
            </button>
          </div>
        </div>

        {status && (
          <div className={`mt-2 px-3 py-2 rounded-xl text-[10px] flex items-center gap-2 ${
            status.type==="success"?"bg-emerald-500/10 text-emerald-400":
            status.type==="error"?"bg-red-500/10 text-red-400":
            "bg-glow-surface text-glow-muted"}`}>
            {status.type==="success"?<CheckCircle className="w-3 h-3"/>:<AlertTriangle className="w-3 h-3"/>}
            {status.msg}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {files.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-glow-muted/60 uppercase tracking-wider">{files.length} files</p>
              <button onClick={loadAll} className="text-[10px] text-glow-accent hover:underline flex items-center gap-1">
                <Download className="w-3 h-3"/>Load all
              </button>
            </div>
            {files.map(f => (
              <button key={f.path} onClick={() => loadFile(f)}
                className="w-full flex items-center gap-2.5 p-2.5 bg-glow-card border border-glow-border rounded-xl hover:border-glow-accent/40 transition-colors text-left">
                <span className="text-base flex-shrink-0">
                  {f.name.endsWith(".sol")?"⬡":f.name.endsWith(".ts")?"⬢":f.name.endsWith(".json")?"📄":"📝"}
                </span>
                <span className="text-xs text-glow-text truncate">{f.name}</span>
                <Download className="w-3 h-3 text-glow-muted/40 ml-auto flex-shrink-0"/>
              </button>
            ))}
          </div>
        )}

        {files.length === 0 && (
          <div className="text-center py-10">
            <Github className="w-10 h-10 text-glow-muted/20 mx-auto mb-3"/>
            <p className="text-sm text-glow-muted/50">Enter a GitHub repo URL</p>
            <p className="text-xs text-glow-muted/30 mt-1">Loads .sol, .ts, .json, .md files</p>
          </div>
        )}
      </div>
    </div>
  );
}
