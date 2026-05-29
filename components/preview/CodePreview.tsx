"use client";
import { useState, useEffect, useRef } from "react";
import { Eye, ExternalLink, X, RefreshCw, Code } from "lucide-react";

interface CodePreviewProps {
  code: string;
  language: string;
  className?: string;
  compact?: boolean;
}

function buildHtml(code: string, lang: string): string {
  if (lang === "html") return code;
  if (lang === "typescript" || lang === "javascript" || lang === "tsx" || lang === "jsx") {
    // Wrap React-like code in a runnable HTML page via Babel standalone
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css"/>
  <style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#fff}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
    ${code}
    const rootEl = document.getElementById('root');
    const root = ReactDOM.createRoot(rootEl);
    // Try to render default export or App
    const Component = typeof App !== 'undefined' ? App : (typeof exports !== 'undefined' && exports.default) ? exports.default : () => React.createElement('div', null, 'No component found');
    root.render(React.createElement(Component));
  </script>
</body>
</html>`;
  }
  return "";
}

function canPreview(lang: string): boolean {
  return ["html","typescript","javascript","tsx","jsx"].includes(lang);
}

export function CodePreview({ code, language, className = "", compact = false }: CodePreviewProps) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);

  if (!canPreview(language) || !code.trim()) return null;

  const html = buildHtml(code, language);

  const openExternal = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className={className}>
      {/* Preview toggle button */}
      <button onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-glow-muted bg-glow-card border border-glow-border rounded-lg hover:border-glow-accent/40 hover:text-glow-text transition-all">
        <Eye className="w-3.5 h-3.5" />Preview
      </button>

      {open && (
        <div className={`mt-2 rounded-xl border border-glow-border overflow-hidden bg-white ${fullscreen ? "fixed inset-4 z-50 mt-0" : compact ? "h-48" : "h-72"}`}>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-glow-surface border-b border-glow-border">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
            </div>
            <span className="flex-1 text-xs text-glow-muted">Preview</span>
            <button onClick={() => setKey(k => k+1)} className="p-1 text-glow-muted hover:text-glow-text"><RefreshCw className="w-3 h-3" /></button>
            <button onClick={openExternal} className="p-1 text-glow-muted hover:text-glow-text"><ExternalLink className="w-3 h-3" /></button>
            <button onClick={() => setFullscreen(!fullscreen)} className="p-1 text-glow-muted hover:text-glow-text"><Code className="w-3 h-3" /></button>
            <button onClick={() => setOpen(false)} className="p-1 text-glow-muted hover:text-glow-text"><X className="w-3 h-3" /></button>
          </div>
          <iframe key={key} ref={iframeRef} srcDoc={html} sandbox="allow-scripts allow-same-origin" className="w-full h-full border-0 bg-white" title="Code Preview" />
        </div>
      )}
    </div>
  );
}

// Detect if a message contains previewable code
export function extractPreviewableCode(content: string): { code: string; language: string } | null {
  const match = content.match(/```(html|tsx?|jsx?)\n([\s\S]+?)```/);
  if (!match) return null;
  const lang = match[1].replace("typescript","typescript").replace("ts","typescript").replace("js","javascript").replace("jsx","jsx").replace("tsx","tsx");
  return { code: match[2].trim(), language: lang };
}
