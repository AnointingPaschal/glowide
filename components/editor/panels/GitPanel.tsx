"use client";
import { useState, useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useFileSystemStore } from "@/store/fileSystemStore";
import { useGitHubStore } from "@/store/githubStore";
import { GitBranch, Download, Github, Loader2, CheckCircle, AlertTriangle, FolderTree, Folder, File as FileIcon, LogOut, Upload, ExternalLink, ChevronDown } from "lucide-react";
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

  // ── GitHub connection (Personal Access Token) ─────────────────────────────
  const gh = useGitHubStore();
  const [tokenInput, setTokenInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [myRepos, setMyRepos] = useState<Array<{full_name:string; default_branch:string; private:boolean; language:string|null; stargazers_count:number; updated_at:string; owner:{login:string; avatar_url:string}}>>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [reposOpen, setReposOpen] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // ── Commit & push ──────────────────────────────────────────────────────────
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);

  const fsStore = useFileSystemStore();
  const { nodes, activeProjectId } = fsStore;
  const binding = activeProjectId ? gh.bindings[activeProjectId] : undefined;

  const connectGitHub = async () => {
    if (!tokenInput.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenInput.trim()}`, Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Invalid token" : `GitHub error ${res.status}`);
      const user = await res.json() as { login: string };
      gh.setToken(tokenInput.trim(), user.login);
      setTokenInput("");
      setStatus({type:"success", msg:`✓ Connected as ${user.login}`});
    } catch (e) {
      setStatus({type:"error", msg:String((e as Error).message ?? e)});
    } finally { setConnecting(false); }
  };

  const disconnectGitHub = () => {
    gh.setToken(null, null);
    setMyRepos([]);
    setStatus(null);
  };

  const loadMyRepos = async () => {
    if (!gh.token) return;
    setReposOpen(v => !v);
    if (myRepos.length > 0) return; // already loaded
    setLoadingRepos(true);
    try {
      // Paginate through every page GitHub returns — "all your repos", not just the first 50
      const allRepos: typeof myRepos = [];
      let page = 1;
      while (true) {
        const res = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`, {
          headers: { Authorization: `Bearer ${gh.token}`, Accept: "application/vnd.github+json" },
        });
        if (!res.ok) throw new Error(`GitHub error ${res.status}`);
        const batch = await res.json() as typeof myRepos;
        allRepos.push(...batch);
        if (batch.length < 100) break; // last page
        page++;
        if (page > 10) break; // safety cap at 1000 repos
      }
      setMyRepos(allRepos);
    } catch (e) { setStatus({type:"error", msg:String((e as Error).message ?? e)}); }
    finally { setLoadingRepos(false); }
  };

  const pickRepo = (fullName: string, defaultBranch: string) => {
    setUrl(`https://github.com/${fullName}`);
    setBranch(defaultBranch);
    setReposOpen(false);
  };

  // Files in the active project that differ from the last-synced snapshot
  const changedFiles = useMemo(() => {
    if (!binding || !activeProjectId) return [];
    const buildPath = (node: typeof nodes[number]): string => {
      const parts: string[] = [node.name];
      let cur = node;
      while (cur.parentId) {
        const parent = nodes.find(n => n.id === cur.parentId);
        if (!parent) break;
        parts.unshift(parent.name);
        cur = parent;
      }
      return parts.join("/");
    };
    return nodes
      .filter(n => n.projectId === activeProjectId && n.type === "file")
      .map(n => ({ path: buildPath(n), content: n.content ?? "" }))
      .filter(f => binding.snapshot[f.path] !== f.content);
  }, [nodes, activeProjectId, binding]);

  const commitAndPush = async () => {
    if (!binding || !gh.token || !activeProjectId || changedFiles.length === 0) return;
    setCommitting(true);
    try {
      const res = await fetch("/api/github/commit", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          token: gh.token, owner: binding.owner, repo: binding.repo, branch: binding.branch,
          message: commitMsg, files: changedFiles,
        }),
      });
      const d = await res.json() as { ok?: boolean; error?: string; commitUrl?: string; filesChanged?: number };
      if (d.error) throw new Error(d.error);
      // Update snapshot so these files no longer show as "changed"
      const newSnapshot = { ...binding.snapshot };
      changedFiles.forEach(f => { newSnapshot[f.path] = f.content; });
      gh.updateSnapshot(activeProjectId, newSnapshot);
      setCommitMsg("");
      setStatus({type:"success", msg:`✓ Pushed ${d.filesChanged} file(s) to ${binding.owner}/${binding.repo}`});
    } catch (e) {
      setStatus({type:"error", msg:`Push failed: ${e}`});
    } finally { setCommitting(false); }
  };

  // ── Clone: fetch the FULL recursive file tree (files + folders) in one call ──
  const cloneRepo = async () => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
    if (!match) { setStatus({type:"error",msg:"Invalid GitHub URL"}); return; }
    const [, owner, repo] = match;
    setLoading(true); setStatus(null); setTree([]); setRepoInfo(null);
    const authHeaders: HeadersInit = gh.token ? { Authorization: `Bearer ${gh.token}` } : {};
    try {
      // Resolve the actual default branch if the user left it as "main" but repo uses "master" etc.
      let useBranch = branch;
      const repoMetaRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers: authHeaders });
      if (repoMetaRes.ok) {
        const meta = await repoMetaRes.json() as { default_branch?: string };
        if (!branch || branch === "main") useBranch = meta.default_branch ?? "main";
      }

      // Recursive tree API — returns EVERY file and folder in the repo in one request
      const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${useBranch}?recursive=1`, { headers: authHeaders });
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
      const snapshot: Record<string,string> = {};
      const authHeaders: HeadersInit = gh.token ? { Authorization: `Bearer ${gh.token}` } : {};
      // Download in small concurrent batches to stay fast without hammering GitHub
      const BATCH = 8;
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        await Promise.all(batch.map(async (f) => {
          try {
            const content = await fetch(`${GITHUB_RAW}/${owner}/${repo}/${b}/${f.path}`, { headers: authHeaders }).then(r => r.text());
            const parts = f.path.split("/");
            const name = parts[parts.length - 1];
            const parentPath = parts.slice(0, -1).join("/");
            const parentId = dirIdByPath.get(parentPath) || null;
            fsStore.createFile(parentId, name, project.id, content);
            snapshot[f.path] = content;
            loaded++;
          } catch { /* skip unreadable file, continue with the rest */ }
        }));
        setStatus({type:"info", msg:`Loading… ${Math.min(i+BATCH,files.length)}/${files.length} files`});
      }

      fsStore.setActiveProject(project.id);
      if (gh.token) {
        gh.setBinding(project.id, { owner, repo, branch: b, snapshot });
      }
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

        {/* ── GitHub connection ────────────────────────────────────────── */}
        <div className="mb-3 p-3 bg-glow-surface border border-glow-border rounded-xl space-y-2">
          {gh.token ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Github className="w-4 h-4 text-glow-text flex-shrink-0"/>
                  <span className="text-xs text-glow-text font-medium truncate">Connected as {gh.username}</span>
                </div>
                <button onClick={disconnectGitHub} title="Disconnect"
                  className="p-1.5 text-glow-muted hover:text-red-400 transition-colors flex-shrink-0">
                  <LogOut className="w-3.5 h-3.5"/>
                </button>
              </div>
              <button onClick={loadMyRepos}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-glow-bg border border-glow-border rounded-lg text-xs text-glow-muted hover:text-glow-text transition-colors">
                <span>{loadingRepos ? "Loading all repos…" : myRepos.length > 0 ? `My Repositories (${myRepos.length})` : "My Repositories"}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${reposOpen?"rotate-180":""}`}/>
              </button>
              {reposOpen && (
                <div className="space-y-1.5">
                  {myRepos.length > 5 && (
                    <input value={repoSearch} onChange={e=>setRepoSearch(e.target.value)}
                      placeholder={`Search ${myRepos.length} repos…`}
                      className="w-full bg-glow-bg border border-glow-border rounded-lg px-2 py-1.5 text-[11px] text-glow-text placeholder-glow-muted/40 focus:outline-none focus:border-glow-accent/50"/>
                  )}
                  <div className="max-h-52 overflow-y-auto space-y-0.5 border border-glow-border rounded-lg p-1">
                    {loadingRepos && <p className="text-[10px] text-glow-muted/50 text-center py-3">Loading all your repos…</p>}
                    {!loadingRepos && myRepos.length === 0 && <p className="text-[10px] text-glow-muted/50 text-center py-2">No repos found</p>}
                    {myRepos
                      .filter(r => !repoSearch.trim() || r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
                      .map(r => (
                      <button key={r.full_name} onClick={() => pickRepo(r.full_name, r.default_branch)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-glow-card rounded-md text-left transition-colors">
                        {r.owner?.avatar_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.owner.avatar_url} alt="" className="w-4 h-4 rounded-full flex-shrink-0"/>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] text-glow-text truncate block">{r.full_name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {r.language && <span className="text-[9px] text-glow-muted">{r.language}</span>}
                            {r.stargazers_count > 0 && <span className="text-[9px] text-glow-muted">★ {r.stargazers_count}</span>}
                          </div>
                        </div>
                        {r.private && <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded flex-shrink-0">private</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] text-glow-muted/70">Connect GitHub to push commits and access private repos.</p>
              <div className="flex gap-2">
                <input value={tokenInput} onChange={e=>setTokenInput(e.target.value)} type="password"
                  placeholder="Personal Access Token (ghp_...)"
                  className="flex-1 min-w-0 bg-glow-bg border border-glow-border rounded-lg px-2.5 py-1.5 text-xs text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
                <button onClick={connectGitHub} disabled={connecting||!tokenInput.trim()}
                  className="flex-shrink-0 px-2.5 py-1.5 bg-glow-gradient text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : "Connect"}
                </button>
              </div>
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=GlowIDE" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-glow-accent hover:underline">
                Generate a token with "repo" scope <ExternalLink className="w-2.5 h-2.5"/>
              </a>
            </>
          )}
        </div>

        {/* ── Commit & Push (only when the active project is bound to a repo) ── */}
        {binding && (
          <div className="mb-3 p-3 bg-glow-accent/5 border border-glow-accent/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-glow-text">{binding.owner}/{binding.repo}</span>
              <span className="text-[10px] text-glow-muted">{binding.branch}</span>
            </div>
            <p className="text-[10px] text-glow-muted">{changedFiles.length} file{changedFiles.length!==1?"s":""} changed</p>
            {changedFiles.length > 0 && (
              <>
                <input value={commitMsg} onChange={e=>setCommitMsg(e.target.value)}
                  placeholder={`Update ${changedFiles.length} file(s) via GlowIDE`}
                  className="w-full bg-glow-bg border border-glow-border rounded-lg px-2.5 py-1.5 text-xs text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
                <button onClick={commitAndPush} disabled={committing}
                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-glow-gradient text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  {committing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
                  {committing ? "Pushing…" : "Commit & Push"}
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-[10px] text-glow-muted/60 mb-3">Clone a full GitHub repo — folders and all — into a real project.</p>

        <div className="space-y-2">
          <input value={url} onChange={e=>setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
          <div className="flex gap-2">
            <input value={branch} onChange={e=>setBranch(e.target.value)}
              placeholder="branch (auto-detected)"
              className="flex-1 min-w-0 bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
            <button onClick={cloneRepo} disabled={loading||!url}
              className="flex-shrink-0 px-3 py-2 bg-glow-gradient text-white text-xs font-semibold rounded-xl disabled:opacity-50 flex items-center gap-1.5">
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
