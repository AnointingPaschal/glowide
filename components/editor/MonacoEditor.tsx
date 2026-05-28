"use client";
import { useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useEditorStore } from "@/store/editorStore";
import { debounce } from "@/lib/utils";

const Editor = dynamic(() => import("@monaco-editor/react").then(m => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0e0e1a]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-glow-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-glow-muted">Loading editor...</span>
      </div>
    </div>
  ),
});

export function MonacoEditor() {
  const { tabs, activeTabId, updateTabContent, markTabSaved, theme, fontSize, wordWrap, minimap } = useEditorStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const editorRef = useRef<unknown>(null);
  const monacoRef = useRef<unknown>(null);

  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    try {
      await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: activeTab.fileId, content: activeTab.content }),
      });
      markTabSaved(activeTab.id);
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, [activeTab, markTabSaved]);

  // Auto-save with debounce
  const debouncedSave = useCallback(debounce(handleSave, 2000), [handleSave]);

  const handleChange = useCallback((value: string | undefined) => {
    if (!activeTabId || value === undefined) return;
    updateTabContent(activeTabId, value);
    debouncedSave();
  }, [activeTabId, updateTabContent, debouncedSave]);

  const handleMount = useCallback((editor: unknown, monaco: unknown) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Cmd/Ctrl+S to save
    (editor as { addCommand: (key: number, fn: () => void) => void }).addCommand(
      (monaco as { KeyMod: { CtrlCmd: number }; KeyCode: { KeyS: number } }).KeyMod.CtrlCmd | (monaco as { KeyMod: { CtrlCmd: number }; KeyCode: { KeyS: number } }).KeyCode.KeyS,
      handleSave
    );

    // Configure language-specific settings
    (monaco as { languages: { typescript: { typescriptDefaults: { setDiagnosticsOptions: (o: unknown) => void; setCompilerOptions: (o: unknown) => void } } } }).languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    (monaco as { languages: { typescript: { typescriptDefaults: { setDiagnosticsOptions: (o: unknown) => void; setCompilerOptions: (o: unknown) => void } } } }).languages.typescript.typescriptDefaults.setCompilerOptions({
      target: (monaco as { languages: { typescript: { ScriptTarget: { ES2020: number } } } }).languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: 2,
      strict: true,
    });
  }, [handleSave]);

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0e0e1a] text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-glow-gradient flex items-center justify-center mb-4 shadow-glow-md">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-glow-text mb-1">No file open</h3>
        <p className="text-sm text-glow-muted max-w-xs">Open a file from the explorer, or start a new project to begin coding.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <Editor
        height="100%"
        language={activeTab.language || "plaintext"}
        value={activeTab.content}
        theme={theme}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          fontSize,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          fontLigatures: true,
          wordWrap,
          minimap: { enabled: minimap },
          lineNumbers: "on",
          renderLineHighlight: "all",
          smoothScrolling: true,
          cursorBlinking: "phase",
          cursorSmoothCaretAnimation: "on",
          // formatOnSave: true, // handled manually
          formatOnPaste: true,
          autoIndent: "full",
          tabSize: 2,
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          suggest: { showMethods: true, showFunctions: true, showConstructors: true },
          inlineSuggest: { enabled: true },
          quickSuggestions: { other: true, comments: true, strings: false },
          parameterHints: { enabled: true },
          colorDecorators: true,
          "semanticHighlighting.enabled": true,
          renderWhitespace: "selection",
          stickyScroll: { enabled: true },
        }}
      />
    </div>
  );
}
