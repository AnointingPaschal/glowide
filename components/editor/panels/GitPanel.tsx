"use client";
import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useFileSystemStore } from "@/store/fileSystemStore";
import { GitBranch, Download, Github, Loader2, CheckCircle, AlertTriangle, FolderTree, Folder, File as FileIcon } from "lucide-react";
import type { Language } from "@/types";

const GITHUB_RAW = "https://raw.githubusercontent.com";
const GITHUB_API  = "https://api.github.com";

// One entry per blob (file) or tree (folder) from GitHub's recursive tree API
interface TreeEntry { path: string; type: "blob" | "tree"; sha: string; size?: number; }

const TEXT_EXTENSIONS = new Set([
  "sol","ts","tsx","js","jsx","json","md","txt","yml","yaml","toml","env",
  "css","html","py","rs","go","java","kt","swift","rb","php","sh","gitignore",
]);

const MAX_FILES = 300;       // safety cap so a huge repo doesn't hang the browser
const MAX_FILE_BYTES = 500_000; // skip huge binary-ish files

function detectLanguage(name: string): Language {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, Language> = {
    sol: "solidity", ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", css: "css", html: "html", yml: "yaml", yaml: "yaml",
  };
  return map[ext] ?? "markdown";
}

export function GitPanel() {
  const [url,      setUrl]      = useState("");
  const [branch,   setBranch]   = useState("main");
  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState<{type:"success"|"error"|"info"; msg:string}|null>(null);
  const [tree,     setTree]     = useState<TreeEntry[]>([]);
  const [repoInfo, setRepoInfo] = useState<{owner:string; repo:string; branch:string}|null>(null);
  const [loadingProject, setLoadingProject] = useState(false);

  const fsStore = useFileSystemStore();

  // ── Clone: fetch the FULL recursive file tree (files + folders) in one call ──
  const cloneRepo = async () => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
    if (!match) { setStatus({type:"error",msg:"Invalid GitHub URL"}); return; }
    const [, owner, repo] = match;
    setLoading(true); setStatus(null); setTree([]); setRepoInfo(null);
    try {
      // Resolve the actual default branch if the user left it as "main" but repo uses "master" etc.
      let useBranch = branch;
      const repoMetaRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`);
      if (repoMetaRes.ok) {
        const meta = await repoMetaRes.json() as { default_branch?: string };
        if (!branch || branch === "main") useBranch = meta.default_branch ?? "main";
      }

      // Recursive tree API — returns EVERY file and folder in the repo in one request
      const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${useBranch}?recursive=1`);
      if (!res.ok) throw new Error(`GitHub: ${res.status} ${res.statusText}`);
      const data = await res.json() as { tree: TreeEntry[]; truncated?: boolean };

      // Keep both files (blob) and folders (tree) so we can rebuild the real hierarchy
      const filtered = data.tree.filter(e => {
        if (e.type === "tree") return true;
        const ext = e.path.split(".").pop()?.toLowerCase() ?? "";
        return TEXT_EXTENSIONS.has(ext) && (e.size ?? 0) < MAX_FILE_BYTES;
      });

      const fileCount = filtered.filter(e => e.type === "blob").length;
      if (fileCount > MAX_FILES) {
        setStatus({type:"error", msg:`Repo has ${fileCount} matching files — over the ${MAX_FILES} limit. Try a smaller repo or a subfolder.`});
        setLoading(false);
        return;
      }

      setTree(filtered);
      setRepoInfo({ owner, repo, branch: useBranch });
      setStatus({
        type: "info",
        msg: `Found ${fileCount} file(s) across ${filtered.filter(e=>e.type==="tree").length} folder(s)${data.truncated ? " (repo truncated by GitHub — very large repo)" : ""}`,
      });
    } catch (e) { setStatus({type:"error", msg:String(e)}); }
    finally { setLoading(false); }
  };

  // ── Load Project: download all file contents, rebuild real folder structure
  //    in the File Explorer (fileSystemStore), and switch to it ──────────────
  const loadProject = async () => {
    if (!repoInfo || tree.length === 0) return;
    setLoadingProject(true);
    try {
      const { owner, repo, branch: b } = repoInfo;
      const project = fsStore.createProject(repo, `Cloned from github.com/${owner}/${repo}`);

      // Map GitHub folder path -> our FSNode id, so we can nest correctly
      const dirIdByPath = new Map<string, string>();
      dirIdByPath.set("", ""); // root

      const folders = tree.filter(e => e.type === "tree").sort((a,b2) => a.path.split("/").length - b2.path.split("/").length);
      for (const dir of folders) {
        const parts = dir.path.split("/");
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join("/");
        const parentId = dirIdByPath.get(parentPath) || null;
        const node = fsStore.createDirectory(parentId, name, project.id);
        dirIdByPath.set(dir.path, node.id);
      }

      const files = tree.filter(e => e.type === "blob");
      let loaded = 0;
      // Download in small concurrent batches to stay fast without hammering GitHub
      const BATCH = 8;
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        await Promise.all(batch.map(async (f) => {
          try {
            const content = await fetch(`${GITHUB_RAW}/${owner}/${repo}/${b}/${f.path}`).then(r => r.text());
            const parts = f.path.split("/");
            const name = parts[parts.length - 1];
            const parentPath = parts.slice(0, -1).join("/");
            const parentId = dirIdByPath.get(parentPath) || null;
            fsStore.createFile(parentId, name, project.id, content);
            loaded++;
          } catch { /* skip unreadable file, continue with the rest */ }
        }));
        setStatus({type:"info", msg:`Loading… ${Math.min(i+BATCH,files.length)}/${files.length} files`});
      }

      fsStore.setActiveProject(project.id);
      setStatus({type:"success", msg:`✓ Project "${repo}" created with ${loaded} file(s) — switching to File Explorer`});
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("glowide:switch-plugin", { detail: "files" }));
      }, 400);
    } catch (e) {
      setStatus({type:"error", msg:`Project load failed: ${e}`});
    } finally {
      setLoadingProject(false);
    }
  };

  // Quick single-file load into an editor tab (for peeking at one file without a full project)
  const loadFile = async (entry: TreeEntry) => {
    if (!repoInfo || entry.type !== "blob") return;
    try {
      const content = await fetch(`${GITHUB_RAW}/${repoInfo.owner}/${repoInfo.repo}/${repoInfo.branch}/${entry.path}`).then(r => r.text());
      const name = entry.path.split("/").pop() ?? entry.path;
      const id = "git-" + Date.now();
      useEditorStore.setState(state => ({
        tabs: [...state.tabs.filter(t=>t.name!==name), {id, fileId:id, name, path:entry.path, language:detectLanguage(name), content, isModified:false, isActive:true}],
        activeTabId: id,
      }));
      setStatus({type:"success", msg:`Opened ${entry.path}`});
    } catch (e) { setStatus({type:"error", msg:`Load failed: ${e}`}); }
  };

  // Build a nested view for display (folders first, indented by depth)
  const displayTree = tree
    .slice()
    .sort((a,b2) => a.path.localeCompare(b2.path))
    .map(e => ({ ...e, depth: e.path.split("/").length - 1 }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-glow-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-glow-accent"/>
          <span className="text-sm font-semibold text-glow-text">Git</span>
        </div>
        <p className="text-[10px] text-glow-muted/60 mb-3">Clone a full GitHub repo — folders and all — into a real project.</p>

        <div className="space-y-2">
          <input value={url} onChange={e=>setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
          <div className="flex gap-2">
            <input value={branch} onChange={e=>setBranch(e.target.value)}
              placeholder="branch (auto-detected)"
              className="flex-1 bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
            <button onClick={cloneRepo} disabled={loading||!url}
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
            {status.type==="success"?<CheckCircle className="w-3 h-3 flex-shrink-0"/>:status.type==="error"?<AlertTriangle className="w-3 h-3 flex-shrink-0"/>:<Loader2 className="w-3 h-3 flex-shrink-0 animate-spin"/>}
            <span className="break-words">{status.msg}</span>
          </div>
        )}

        {tree.length > 0 && (
          <button onClick={loadProject} disabled={loadingProject}
            className="mt-3 w-full py-2.5 bg-glow-gradient text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {loadingProject ? <Loader2 className="w-4 h-4 animate-spin"/> : <FolderTree className="w-4 h-4"/>}
            {loadingProject ? "Creating Project…" : "Load Project into File Explorer"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {displayTree.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-glow-muted/60 uppercase tracking-wider">
                {displayTree.filter(e=>e.type==="blob").length} files · {displayTree.filter(e=>e.type==="tree").length} folders
              </p>
            </div>
            {displayTree.map(f => (
              <button key={f.path} onClick={() => loadFile(f)} disabled={f.type==="tree"}
                style={{ paddingLeft: `${8 + f.depth * 14}px` }}
                className="w-full flex items-center gap-2 py-1.5 pr-2.5 hover:bg-glow-card rounded-lg transition-colors text-left disabled:cursor-default">
                {f.type === "tree"
                  ? <Folder className="w-3.5 h-3.5 text-glow-accent/70 flex-shrink-0"/>
                  : <FileIcon className="w-3.5 h-3.5 text-glow-muted/50 flex-shrink-0"/>}
                <span className={`text-xs truncate ${f.type==="tree"?"text-glow-muted font-medium":"text-glow-text"}`}>
                  {f.path.split("/").pop()}
                </span>
              </button>
            ))}
          </div>
        )}

        {displayTree.length === 0 && (
          <div className="text-center py-10">
            <Github className="w-10 h-10 text-glow-muted/20 mx-auto mb-3"/>
            <p className="text-sm text-glow-muted/50">Enter a GitHub repo URL</p>
            <p className="text-xs text-glow-muted/30 mt-1">Clones the entire repo — folders included</p>
          </div>
        )}
      </div>
    </div>
  );
}
