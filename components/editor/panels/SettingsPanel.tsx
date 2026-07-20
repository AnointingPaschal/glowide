"use client";
import { useEditorStore } from "@/store/editorStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { useGitHubStore } from "@/store/githubStore";
import { Monitor, Terminal as TermIcon, Sparkles, Github, LogOut, RotateCcw } from "lucide-react";

// Simple styled checkbox toggle — consistent look across all sections
function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-2 text-left group">
      <div className="min-w-0">
        <p className="text-xs text-glow-text font-medium">{label}</p>
        {desc && <p className="text-[10px] text-glow-muted/60 mt-0.5">{desc}</p>}
      </div>
      <div className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${checked ? "bg-glow-accent" : "bg-glow-border"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}/>
      </div>
    </button>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 pb-4 mb-4 border-b border-glow-border/40 last:border-0 last:pb-0 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-glow-accent"/>
        <p className="text-xs font-semibold text-glow-text">{title}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsPanel() {
  const editor = useEditorStore();
  const prefs = usePreferencesStore();
  const gh = useGitHubStore();

  return (
    <div className="p-4 overflow-y-auto h-full">
      <p className="text-sm font-semibold text-glow-text mb-4">Settings</p>

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      <Section icon={Monitor} title="Editor">
        <div className="space-y-2 mb-3">
          <label className="text-[10px] text-glow-muted/60 uppercase tracking-wider block">Theme</label>
          <select value={editor.theme} onChange={e => editor.setTheme(e.target.value as "vs-dark"|"vs-light"|"hc-black")}
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text focus:outline-none focus:border-glow-accent/50">
            <option value="vs-dark">Dark</option>
            <option value="vs-light">Light</option>
            <option value="hc-black">High Contrast</option>
          </select>
        </div>
        <div className="space-y-2 mb-1">
          <label className="text-[10px] text-glow-muted/60 uppercase tracking-wider block">Font Size</label>
          <select value={editor.fontSize} onChange={e => editor.setFontSize(Number(e.target.value))}
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text focus:outline-none focus:border-glow-accent/50">
            {[11,12,13,14,15,16,18,20].map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
        </div>
        <Toggle checked={editor.wordWrap === "on"} onChange={v => editor.setWordWrap(v ? "on" : "off")}
          label="Word Wrap" desc="Wrap long lines instead of scrolling horizontally"/>
        <Toggle checked={editor.minimap} onChange={editor.setMinimap}
          label="Minimap" desc="Show a miniature code overview on the right"/>
      </Section>

      {/* ── Terminal ───────────────────────────────────────────────────── */}
      <Section icon={TermIcon} title="Terminal">
        <Toggle checked={prefs.autoOpenTerminalOnCompile} onChange={prefs.setAutoOpenTerminalOnCompile}
          label="Auto-open on Compile" desc="Show the terminal automatically when compiling"/>
        <Toggle checked={prefs.autoOpenTerminalOnDeploy} onChange={prefs.setAutoOpenTerminalOnDeploy}
          label="Auto-open on Deploy" desc="Show the terminal automatically when deploying"/>
        <div className="space-y-2 mt-2">
          <label className="text-[10px] text-glow-muted/60 uppercase tracking-wider block">Terminal Font Size</label>
          <select value={prefs.terminalFontSize} onChange={e => prefs.setTerminalFontSize(Number(e.target.value) as 11|12|13|14)}
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text focus:outline-none focus:border-glow-accent/50">
            {[11,12,13,14].map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
        </div>
      </Section>

      {/* ── AI Assistant ───────────────────────────────────────────────── */}
      <Section icon={Sparkles} title="AI Assistant">
        <Toggle checked={prefs.rememberAIPermission} onChange={prefs.setRememberAIPermission}
          label="Remember file-edit permission" desc="Skip the one-time prompt and reuse your last choice across sessions"/>
        {prefs.rememberAIPermission && (
          <div className="flex items-center justify-between mt-2 p-2.5 bg-glow-surface border border-glow-border rounded-xl">
            <div>
              <p className="text-[10px] text-glow-muted/60 uppercase tracking-wider">Remembered choice</p>
              <p className={`text-xs font-medium mt-0.5 ${
                prefs.aiDefaultPermission === "granted" ? "text-emerald-400" :
                prefs.aiDefaultPermission === "denied" ? "text-red-400" : "text-glow-muted"
              }`}>
                {prefs.aiDefaultPermission === "granted" ? "Allowed" : prefs.aiDefaultPermission === "denied" ? "Denied" : "Not set yet"}
              </p>
            </div>
            {prefs.aiDefaultPermission !== "unset" && (
              <button onClick={prefs.resetAIPermissionMemory}
                className="flex items-center gap-1 text-[10px] text-glow-muted hover:text-glow-text transition-colors">
                <RotateCcw className="w-3 h-3"/>Reset
              </button>
            )}
          </div>
        )}
      </Section>

      {/* ── GitHub ─────────────────────────────────────────────────────── */}
      <Section icon={Github} title="GitHub">
        {gh.token ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Github className="w-4 h-4 text-glow-text flex-shrink-0"/>
              <span className="text-xs text-glow-text truncate">Connected as {gh.username}</span>
            </div>
            <button onClick={() => gh.setToken(null, null)} title="Disconnect"
              className="p-1.5 text-glow-muted hover:text-red-400 transition-colors flex-shrink-0">
              <LogOut className="w-3.5 h-3.5"/>
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-glow-muted/60">Not connected — head to the Git panel to connect with a Personal Access Token.</p>
        )}
      </Section>
    </div>
  );
}
