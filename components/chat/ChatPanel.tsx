"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useFileSystemStore } from "@/store/fileSystemStore";
import { terminalLog } from "@/components/editor/Terminal";
import { useWalletStore } from "@/store/walletStore";
import { useCircleStore } from "@/store/circleStore";
import { useChatStore } from "@/store/chatStore";
import { ChatMessage } from "./ChatMessage";
import { Button } from "@/components/ui/Button";
import { Send, Plus, Sparkles, Code2, Bug, RefreshCw, Zap, ChevronDown, ShieldCheck, ShieldOff, FilePlus2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicModel } from "@/app/api/models/route";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { usePreferencesStore } from "@/store/preferencesStore";

const QUICK_PROMPTS = [
  { icon: <Code2 className="w-3 h-3" />, label: "Generate code", prompt: "Generate code for: " },
  { icon: <Bug className="w-3 h-3" />, label: "Fix bug", prompt: "Fix this bug in my code: " },
  { icon: <RefreshCw className="w-3 h-3" />, label: "Refactor", prompt: "Refactor this code to be cleaner and more efficient: " },
  { icon: <Sparkles className="w-3 h-3" />, label: "Explain", prompt: "Explain how this works: " },
];

// Detect fenced code blocks, optionally with a filename in the info string
// e.g. ```solidity MyToken.sol\n...``` or plain ```solidity\n...```
interface DetectedBlock { lang: string; filename?: string; code: string; }
const SHELL_LANGS = new Set(["bash","sh","shell","zsh","console"]);
function detectBlocks(content: string): DetectedBlock[] {
  const blocks: DetectedBlock[] = [];
  const re = /```(\w+)(?:\s+([^\n]+))?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    blocks.push({ lang: m[1], filename: m[2]?.trim(), code: m[3].trim() });
  }
  return blocks;
}

export function ChatPanel({ compact = false, editorMode = false }: { compact?: boolean; editorMode?: boolean }) {
  const { sessions, activeSessionId, createSession, addMessage, isStreaming, streamingContent, setStreaming, model, setModel } = useChatStore();
  const siteSettings = useSiteSettings();
  const { address } = useWalletStore();
  const circle = useCircleStore();
  const { tabs, activeTabId, updateTabContent } = useEditorStore();
  const fsStore = useFileSystemStore();
  const { nodes, activeProjectId, updateContent: updateFileContent, createFile, createDirectory } = fsStore;
  const [input, setInput] = useState("");
  const [models, setModels] = useState<PublicModel[]>([]);
  const [modelDropOpen, setModelDropOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Per-session code-edit permission ─────────────────────────────────────
  // Defaults to resetting on every page load ("per session"), unless the
  // user has opted into "remember my choice" in Settings, in which case we
  // reuse whatever they picked last time instead of asking again.
  const prefs = usePreferencesStore();
  const [editPermission, setEditPermission] = useState<"unset"|"granted"|"denied">(
    () => (prefs.rememberAIPermission ? prefs.aiDefaultPermission : "unset")
  );
  const [pendingApply, setPendingApply] = useState<{ blocks: DetectedBlock[]; sessionId: string } | null>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = useMemo(() => activeSession?.messages || [], [activeSession]);
  const activeTab = tabs.find(t => t.id === activeTabId);
  const selectedModel = models.find(m => m.id === model) ?? models[0];

  // All files in the active project — gives the AI awareness of the codebase
  // structure beyond just the currently open tab.
  const projectFilePaths = useMemo(() => {
    if (!activeProjectId) return [];
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
      .map(buildPath)
      .slice(0, 100); // cap for prompt size
  }, [nodes, activeProjectId]);

  // Fetch available models
  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(d => {
      if (d.models?.length) setModels(d.models);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const abortRef = useRef<AbortController | null>(null);

  const stopStreaming = () => {
    abortRef.current?.abort();
    useChatStore.getState().finalizeStream(activeSessionId ?? "");
  };

  // Apply detected code blocks to the right file — matched by filename if the
  // AI specified one, otherwise falls back to whatever tab is currently open.
  // Walks a path like "contracts/token", creating any missing directories
  // along the way, and returns the final parentId to create/find a file in.
  const ensureDirPath = (dirParts: string[], projectId: string): string | null => {
    let parentId: string | null = null;
    for (const part of dirParts) {
      const liveNodes = useFileSystemStore.getState().nodes;
      let dir = liveNodes.find(n => n.projectId === projectId && n.type === "directory" && n.parentId === parentId && n.name === part);
      if (!dir) dir = createDirectory(parentId, part, projectId);
      parentId = dir.id;
    }
    return parentId;
  };

  const applyBlocksToFiles = (blocks: DetectedBlock[]) => {
    let applied = 0;
    for (const block of blocks) {
      if (block.filename) {
        // Support nested paths, e.g. "contracts/token/MyToken.sol" — creates
        // any missing folders automatically.
        const parts = block.filename.split("/").filter(Boolean);
        const name = parts.pop();
        if (!name) continue;
        const parentId = activeProjectId ? ensureDirPath(parts, activeProjectId) : null;
        const liveNodes = useFileSystemStore.getState().nodes;
        const existing = activeProjectId
          ? liveNodes.find(n => n.projectId === activeProjectId && n.type === "file" && n.parentId === parentId && n.name === name)
          : undefined;
        if (existing) {
          updateFileContent(existing.id, block.code);
          if (existing.id === activeTabId) updateTabContent(activeTabId, block.code);
          applied++;
        } else if (activeProjectId) {
          createFile(parentId, name, activeProjectId, block.code);
          applied++;
        }
      } else if (activeTabId) {
        // No filename given — apply to the currently active tab
        updateTabContent(activeTabId, block.code);
        const node = nodes.find(n => n.id === activeTabId);
        if (node) updateFileContent(node.id, block.code);
        applied++;
      }
    }
    return applied;
  };

  // Build a "folder/subfolder/name" path string for a project node
  const buildNodePath = (node: {id:string; name:string; parentId:string|null}): string => {
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

  // Execute AI-requested shell commands (```bash blocks) in the same server
  // sandbox the interactive Terminal uses, log output there, and sync any
  // files the command creates/modifies back into the project.
  const runShellBlocks = async (blocks: DetectedBlock[]) => {
    if (!activeProjectId) { terminalLog("No active project — can't run commands without one.", "warn"); return; }
    const projectFiles = nodes
      .filter(n => n.projectId === activeProjectId && n.type === "file")
      .map(n => ({ path: buildNodePath(n), content: n.content ?? "" }));

    for (const block of blocks) {
      const commands = block.code.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
      for (const cmd of commands) {
        terminalLog(`$ ${cmd}`, "ai");
        try {
          const res = await fetch("/api/terminal/exec", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ command: cmd, files: projectFiles }),
          });
          const d = await res.json() as { stdout?:string; stderr?:string; error?:string; updatedFiles?: Array<{path:string;content:string}> };
          if (d.error) { terminalLog(d.error, "error"); continue; }
          if (d.stdout) d.stdout.split("\n").forEach(l => l && terminalLog(l, "info"));
          if (d.stderr) d.stderr.split("\n").forEach(l => l && terminalLog(l, "warn"));
          if (d.updatedFiles?.length) {
            for (const f of d.updatedFiles) {
              const parts = f.path.split("/").filter(Boolean);
              const name = parts.pop();
              if (!name) continue;
              const parentId = ensureDirPath(parts, activeProjectId);
              const liveNodes = useFileSystemStore.getState().nodes;
              const existing = liveNodes.find(n => n.projectId === activeProjectId && n.type === "file" && n.parentId === parentId && n.name === name);
              if (existing) updateFileContent(existing.id, f.content);
              else createFile(parentId, name, activeProjectId, f.content);
            }
            terminalLog(`Synced ${d.updatedFiles.length} file(s) from command output`, "success");
          }
        } catch (e) { terminalLog(`Execution failed: ${e}`, "error"); }
      }
    }
  };

  const sendMessage = async (overrideInput?: string) => {
    const trimmed = (overrideInput ?? input).trim();
    if (!trimmed || isStreaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = createSession("New Chat");
      sessionId = session.id;
    }

    addMessage(sessionId!, { role: "user", content: trimmed, session_id: sessionId! });
    setInput("");
    setStreaming(true);

    const contextContent = activeTab
      ? `\n\nContext from current file (${activeTab.name}):\n\`\`\`${activeTab.language}\n${activeTab.content.slice(0, 3000)}\n\`\`\``
      : "";
    const fileListContext = projectFilePaths.length
      ? `\n\nProject files (${projectFilePaths.length}): ${projectFilePaths.join(", ")}`
      : "";

    try {
      abortRef.current = new AbortController();
      const response = await fetch("/api/ai/chat", {
        signal: abortRef.current.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user", content: trimmed + contextContent + fileListContext }],
          model: model || selectedModel?.id,
          sessionId,
          walletContext: {
            circleUserId: circle.circleUserId,
            wallets:      circle.wallets,
            address:      address,
          },
          editorContext: activeTab ? {
            fileName: activeTab.name,
            fileContent: activeTab.content?.slice(0, 6000),
          } : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }

      // API returns plain JSON (non-streaming) — animate it into streamingContent
      // so it still feels like a live response, then finalize into a real message.
      const json = await response.json() as {
        content?: string; error?: string;
        toolCall?: { id: string; name: string; args: Record<string, unknown> };
      };
      if (json.error) throw new Error(json.error);
      const fullContent = json.content ?? "";

      useChatStore.setState({ isStreaming: true, streamingContent: "" });
      const chunkSize = 8;
      for (let i = 0; i < fullContent.length; i += chunkSize) {
        if (abortRef.current?.signal.aborted) break;
        useChatStore.setState({ streamingContent: fullContent.slice(0, i + chunkSize) });
        await new Promise(r => setTimeout(r, 10));
      }
      useChatStore.setState({ streamingContent: fullContent });
      useChatStore.getState().finalizeStream(sessionId!);

      // Tool call (real transaction request) — render as an interactive card
      if (json.toolCall) {
        addMessage(sessionId!, {
          role: "assistant",
          content: JSON.stringify({ __toolCall: json.toolCall }),
          session_id: sessionId!,
        });
      }

      // editorMode: detect code blocks and either apply immediately (if the
      // user already granted permission this session) or ask first. File
      // blocks get written to disk; ```bash blocks get executed for real.
      if (editorMode && fullContent) {
        const blocks = detectBlocks(fullContent);
        if (blocks.length > 0) {
          const shellBlocks = blocks.filter(b => SHELL_LANGS.has(b.lang.toLowerCase()));
          const fileBlocks  = blocks.filter(b => !SHELL_LANGS.has(b.lang.toLowerCase()));
          if (editPermission === "granted") {
            const applied = fileBlocks.length ? applyBlocksToFiles(fileBlocks) : 0;
            if (applied) terminalLog(`AI applied changes to ${applied} file(s)`, "ai");
            if (shellBlocks.length) await runShellBlocks(shellBlocks);
          } else if (editPermission === "unset") {
            setPendingApply({ blocks, sessionId: sessionId! });
          }
          // if "denied", silently skip — code stays visible in chat only
        }
      }
    } catch (err) {
      setStreaming(false);
      addMessage(sessionId!, {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}. Check your AI settings in the Admin panel.`,
        session_id: sessionId!,
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const grantPermission = (grant: boolean) => {
    const decision = grant ? "granted" : "denied";
    setEditPermission(decision);
    if (prefs.rememberAIPermission) prefs.setAIDefaultPermission(decision);
    if (grant && pendingApply) {
      const shellBlocks = pendingApply.blocks.filter(b => SHELL_LANGS.has(b.lang.toLowerCase()));
      const fileBlocks  = pendingApply.blocks.filter(b => !SHELL_LANGS.has(b.lang.toLowerCase()));
      const applied = fileBlocks.length ? applyBlocksToFiles(fileBlocks) : 0;
      if (applied) terminalLog(`AI applied changes to ${applied} file(s)`, "ai");
      if (shellBlocks.length) runShellBlocks(shellBlocks);
    }
    setPendingApply(null);
  };

  return (
    <div className={cn("flex flex-col h-full bg-glow-bg", compact && "border-l border-glow-border")}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-glow-border bg-glow-surface/60 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-glow-gradient flex items-center justify-center flex-shrink-0 overflow-hidden">
            {siteSettings.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={siteSettings.logoUrl} alt={siteSettings.siteName} className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display="none"; }}/>
              : <Zap className="w-3.5 h-3.5 text-white" />}
          </div>
          <span className="text-sm font-semibold text-glow-text hidden sm:block truncate">AI Assistant</span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Model selector */}
          {models.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setModelDropOpen(!modelDropOpen)}
                className="flex items-center gap-1.5 px-2 py-1 bg-glow-card border border-glow-border rounded-lg text-xs text-gray-300 hover:border-glow-accent/40 transition-colors max-w-[120px]"
              >
                <span className="truncate">{selectedModel?.name ?? "Select model"}</span>
                <ChevronDown className={cn("w-3 h-3 text-glow-muted flex-shrink-0 transition-transform", modelDropOpen && "rotate-180")} />
              </button>

              {modelDropOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setModelDropOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-64 bg-glow-card border border-glow-border rounded-xl shadow-card-shadow z-50 overflow-hidden animate-fade-in">
                    <div className="p-2 border-b border-glow-border">
                      <p className="text-xs font-medium text-gray-400 px-1">Select Model</p>
                    </div>
                    <div className="p-1 max-h-64 overflow-y-auto">
                      {["premium","fast","coding"].map(tier => {
                        const tierModels = models.filter(m => m.tier === tier);
                        if (!tierModels.length) return null;
                        return (
                          <div key={tier}>
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider px-2 py-1">{tier}</p>
                            {tierModels.map(m => (
                              <button
                                key={m.id}
                                onClick={() => { setModel(m.id); setModelDropOpen(false); }}
                                className={cn(
                                  "w-full flex items-start gap-2 px-2 py-2 rounded-lg text-left transition-colors",
                                  (model || selectedModel?.id) === m.id ? "bg-glow-accent/10 text-glow-accent-light" : "hover:bg-glow-surface text-gray-300"
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{m.name}</p>
                                  <p className="text-[10px] text-gray-500">{m.provider} · {m.context_length ? `${(m.context_length/1000).toFixed(0)}k ctx` : ""}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Per-session edit permission indicator */}
          {editorMode && (
            <button
              onClick={() => setEditPermission(p => {
                const next = p === "granted" ? "denied" : "granted";
                if (prefs.rememberAIPermission) prefs.setAIDefaultPermission(next);
                return next;
              })}
              title={editPermission === "granted" ? "AI can edit your files this session — click to revoke" : "AI cannot edit files — click to allow for this session"}
              className={cn("flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[10px] font-medium transition-colors",
                editPermission === "granted"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-glow-card border-glow-border text-glow-muted hover:text-glow-text")}
            >
              {editPermission === "granted" ? <ShieldCheck className="w-3 h-3"/> : <ShieldOff className="w-3 h-3"/>}
            </button>
          )}

          <Button variant="ghost" size="icon" onClick={() => createSession()} title="New chat" className="h-7 w-7">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-glow-gradient flex items-center justify-center mb-3 shadow-glow-sm overflow-hidden">
              {siteSettings.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={siteSettings.logoUrl} alt={siteSettings.siteName} className="w-full h-full object-contain p-1.5" onError={e => { (e.target as HTMLImageElement).style.display="none"; }}/>
                : <Sparkles className="w-6 h-6 text-white" />}
            </div>
            <h3 className="text-sm font-semibold text-glow-text mb-1">{siteSettings.siteName} AI</h3>
            <p className="text-xs text-glow-muted mb-4 max-w-52">Your intelligent Web3 coding partner. Ask about your code, generate contracts, or execute real transactions.</p>
            <div className="grid grid-cols-2 gap-1.5 w-full max-w-xs">
              {QUICK_PROMPTS.map(qp => (
                <button key={qp.label} onClick={() => setInput(qp.prompt)} className="flex items-center gap-2 p-2.5 bg-glow-card border border-glow-border rounded-xl text-xs text-glow-muted hover:text-glow-text hover:border-glow-accent/40 transition-colors text-left">
                  {qp.icon} {qp.label}
                </button>
              ))}
            </div>
            {editorMode && (
              <p className="text-[10px] text-glow-muted/50 mt-4 flex items-center gap-1">
                <ShieldOff className="w-3 h-3"/> File editing is off — tap the shield above to allow it
              </p>
            )}
          </div>
        ) : (
          <div className="py-2">
            {messages.map(msg => <ChatMessage key={msg.id} message={msg} editorMode={editorMode}/>)}
            {isStreaming && streamingContent && (
              <ChatMessage
                message={{ id: "streaming", session_id: activeSessionId || "", role: "assistant", content: streamingContent, created_at: new Date().toISOString() }}
                isStreaming
                editorMode={editorMode}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Permission prompt — appears the first time the AI wants to write code or run a command */}
      {pendingApply && (
        <div className="mx-3 mb-2 p-3 bg-glow-accent/8 border border-glow-accent/25 rounded-xl flex-shrink-0 space-y-2">
          <div className="flex items-start gap-2">
            <FilePlus2 className="w-4 h-4 text-glow-accent flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-glow-text">
              {(() => {
                const shellCount = pendingApply.blocks.filter(b => SHELL_LANGS.has(b.lang.toLowerCase())).length;
                const fileCount  = pendingApply.blocks.length - shellCount;
                const parts: string[] = [];
                if (fileCount)  parts.push(`write to ${fileCount} file${fileCount>1?"s":""}`);
                if (shellCount) parts.push(`run ${shellCount} command${shellCount>1?"s":""}`);
                return `AI wants to ${parts.join(" and ")} this session. Allow it?`;
              })()}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => grantPermission(true)}
              className="flex-1 py-1.5 bg-glow-gradient text-white text-xs font-semibold rounded-lg">Allow this session</button>
            <button onClick={() => grantPermission(false)}
              className="flex-1 py-1.5 bg-glow-card border border-glow-border text-glow-muted text-xs font-semibold rounded-lg">Not now</button>
          </div>
        </div>
      )}

      {/* Context indicator */}
      {activeTab && (
        <div className="mx-3 mb-2 px-2.5 py-1.5 bg-glow-card border border-glow-border rounded-lg flex items-center gap-2 flex-shrink-0">
          <Code2 className="w-3 h-3 text-glow-accent flex-shrink-0" />
          <span className="text-xs text-glow-muted truncate">Context: {activeTab.name}</span>
          {projectFilePaths.length > 0 && (
            <span className="text-[10px] text-glow-muted/50 ml-auto flex-shrink-0">+{projectFilePaths.length} files</span>
          )}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-glow-border flex-shrink-0">
        <div className="flex gap-2 bg-glow-card border border-glow-border rounded-xl p-2 focus-within:border-glow-accent/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything about your code…"
            rows={1}
            className="flex-1 min-w-0 bg-transparent text-sm text-glow-text placeholder:text-glow-muted resize-none focus:outline-none min-h-[20px] max-h-32 overflow-y-auto"
            onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 128) + "px"; }}
          />
          {isStreaming ? (
            <Button onClick={stopStreaming} size="icon" variant="secondary" className="self-end flex-shrink-0 h-8 w-8" title="Stop generation">
              <span className="w-3 h-3 bg-current rounded-sm" />
            </Button>
          ) : (
            <Button onClick={() => sendMessage()} disabled={!input.trim()} size="icon" className="self-end flex-shrink-0 h-8 w-8">
              <Send className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
