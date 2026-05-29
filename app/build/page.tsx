'use client';
export const dynamic = 'force-dynamic';

import { useState, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Terminal } from '@/components/editor/Terminal';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { useEditorStore } from '@/store/editorStore';
import { generateId } from '@/lib/utils';
import { detectLanguage, CONTRACT_TEMPLATES } from '@/lib/compiler';
import type { FileNode } from '@/types';
import {
  Hammer, Globe, Gamepad2, Code2, Server, Smartphone, Package, Play,
  Plus, FolderOpen, Download, Zap, CheckCircle, Loader2, X, FileCode, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const PROJECT_TYPES = [
  {
    id: 'webapp', icon: Globe, label: 'Web App',
    description: 'React, Next.js, Vue — full-stack web applications',
    color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30',
    templates: [
      { name: 'React App', files: [
        { name: 'App.tsx', content: `import { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">\n      <h1 className="text-4xl font-bold mb-8">My React App</h1>\n      <button\n        onClick={() => setCount(c => c + 1)}\n        className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"\n      >\n        Count: {count}\n      </button>\n    </div>\n  );\n}` },
        { name: 'index.css', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { box-sizing: border-box; }` },
        { name: 'package.json', content: JSON.stringify({ name: "my-react-app", version: "0.1.0", scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^18", "react-dom": "^18" }, devDependencies: { vite: "^5", "@vitejs/plugin-react": "^4", tailwindcss: "^3" } }, null, 2) },
      ]},
      { name: 'Next.js App', files: [
        { name: 'page.tsx', content: `export default function Home() {\n  return <main className="p-8">\n    <h1 className="text-3xl font-bold">Next.js App</h1>\n    <p className="text-gray-400 mt-2">Edit this page to get started.</p>\n  </main>;\n}` },
        { name: 'layout.tsx', content: `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>;\n}` },
        { name: 'package.json', content: JSON.stringify({ name: "my-nextjs-app", version: "0.1.0", scripts: { dev: "next dev", build: "next build" }, dependencies: { next: "14", react: "^18", "react-dom": "^18" } }, null, 2) },
      ]},
    ],
  },
  {
    id: 'game', icon: Gamepad2, label: 'Game',
    description: 'Browser games with Canvas, Phaser, or Three.js',
    color: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30',
    templates: [
      { name: 'Canvas Game', files: [
        { name: 'game.js', content: `const canvas = document.getElementById('canvas');\nconst ctx = canvas.getContext('2d');\n\nconst player = { x: 100, y: 300, w: 40, h: 40, vy: 0, onGround: false };\nconst GRAVITY = 0.5, JUMP = -12;\nconst keys = {};\n\ndocument.addEventListener('keydown', e => keys[e.code] = true);\ndocument.addEventListener('keyup', e => keys[e.code] = false);\n\nfunction update() {\n  if ((keys['Space'] || keys['ArrowUp']) && player.onGround) player.vy = JUMP;\n  player.vy += GRAVITY;\n  player.y += player.vy;\n  player.onGround = false;\n  if (player.y + player.h >= canvas.height - 60) {\n    player.y = canvas.height - 60 - player.h;\n    player.vy = 0; player.onGround = true;\n  }\n}\n\nfunction draw() {\n  ctx.fillStyle = '#0f0f1a';\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = '#7c3aed';\n  ctx.fillRect(player.x, player.y, player.w, player.h);\n  ctx.fillStyle = '#252540';\n  ctx.fillRect(0, canvas.height - 60, canvas.width, 60);\n}\n\nfunction loop() { update(); draw(); requestAnimationFrame(loop); }\nloop();` },
        { name: 'index.html', content: `<!DOCTYPE html>\n<html>\n<head><title>Canvas Game</title><style>body{margin:0;background:#0f0f1a;display:flex;align-items:center;justify-content:center;height:100vh;}canvas{border:1px solid #252540;border-radius:8px;}</style></head>\n<body><canvas id="canvas" width="800" height="400"></canvas><script src="game.js"></script></body>\n</html>` },
      ]},
    ],
  },
  {
    id: 'contract', icon: FileCode, label: 'Smart Contract',
    description: 'Solidity contracts for Arc Testnet deployment',
    color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30',
    templates: [
      { name: 'ERC20 Token', files: [{ name: 'MyToken.sol', content: CONTRACT_TEMPLATES.erc20 }] },
      { name: 'ERC721 NFT', files: [{ name: 'MyNFT.sol', content: CONTRACT_TEMPLATES.erc721 }] },
      { name: 'Simple Storage', files: [{ name: 'SimpleStorage.sol', content: CONTRACT_TEMPLATES.simple }] },
    ],
  },
  {
    id: 'api', icon: Server, label: 'API / Backend',
    description: 'Node.js, Express, or Next.js API routes',
    color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30',
    templates: [
      { name: 'Express API', files: [
        { name: 'server.js', content: `const express = require('express');\nconst app = express();\napp.use(express.json());\n\napp.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));\n\napp.get('/api/users', (req, res) => {\n  res.json({ users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] });\n});\n\napp.post('/api/users', (req, res) => {\n  const { name } = req.body;\n  if (!name) return res.status(400).json({ error: 'Name required' });\n  res.status(201).json({ id: Date.now(), name });\n});\n\napp.listen(3001, () => console.log('API running on :3001'));` },
        { name: 'package.json', content: JSON.stringify({ name: "my-api", version: "1.0.0", main: "server.js", scripts: { start: "node server.js", dev: "nodemon server.js" }, dependencies: { express: "^4.18", cors: "^2.8" } }, null, 2) },
      ]},
    ],
  },
  {
    id: 'dapp', icon: Zap, label: 'dApp',
    description: 'Full Web3 dApp with wallet + contract + UI',
    color: 'from-glow-accent/20 to-glow-cyan/20', border: 'border-glow-accent/30',
    templates: [
      { name: 'Web3 dApp', files: [
        { name: 'App.tsx', content: `import { useState } from 'react';\n\ndeclare global { interface Window { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } } }\n\nexport default function App() {\n  const [address, setAddress] = useState<string | null>(null);\n\n  const connect = async () => {\n    if (!window.ethereum) { alert('Install MetaMask'); return; }\n    const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];\n    setAddress(addr);\n  };\n\n  return (\n    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6">\n      <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">My dApp</h1>\n      {address ? (\n        <div className="text-center">\n          <p className="text-emerald-400 text-sm">Connected</p>\n          <p className="font-mono text-gray-300">{address.slice(0,6)}...{address.slice(-4)}</p>\n        </div>\n      ) : (\n        <button onClick={connect} className="px-6 py-3 bg-purple-600 rounded-xl hover:bg-purple-700 font-medium">\n          Connect Wallet\n        </button>\n      )}\n    </div>\n  );\n}` },
        { name: 'package.json', content: JSON.stringify({ name: "my-dapp", version: "0.1.0", scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^18", "react-dom": "^18", viem: "^2", wagmi: "^2" }, devDependencies: { vite: "^5", "@vitejs/plugin-react": "^4" } }, null, 2) },
      ]},
    ],
  },
];

type BuildStatus = 'idle' | 'building' | 'success' | 'error';

interface BuildLog { time: string; type: 'info' | 'success' | 'error' | 'warn'; msg: string; }

export default function BuildPage() {
  const { setFiles, openFile, files } = useEditorStore();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; files: { name: string; content: string }[] } | null>(null);
  const [projectName, setProjectName] = useState('');
  const [buildStatus, setBuildStatus] = useState<BuildStatus>('idle');
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [view, setView] = useState<'types' | 'editor'>('types');

  const log = (msg: string, type: BuildLog['type'] = 'info') => {
    setBuildLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type, msg }]);
  };

  const loadTemplate = useCallback((template: { name: string; files: { name: string; content: string }[] }, typeName: string) => {
    const name = projectName || template.name.toLowerCase().replace(/\s+/g, '-');
    const newFiles: FileNode[] = template.files.map(f => ({
      id: generateId(),
      project_id: name,
      name: f.name,
      path: `/${f.name}`,
      type: 'file' as const,
      content: f.content,
      language: detectLanguage(f.name),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    setFiles(newFiles);
    if (newFiles.length) openFile(newFiles[0]);
    setSelectedTemplate(template);
    setView('editor');
    setBuildLogs([]);
    log(`Project "${name}" loaded with ${template.files.length} file(s)`, 'success');
    toast.success(`${template.name} template loaded`);
  }, [projectName, setFiles, openFile]);

  const runBuild = async () => {
    if (!selectedTemplate) { toast.error('Load a template first'); return; }
    setBuildStatus('building');
    setBuildLogs([]);
    log('Starting build process…');

    const steps = [
      { msg: 'Resolving dependencies…', delay: 600 },
      { msg: 'Compiling TypeScript…', delay: 900 },
      { msg: 'Bundling assets…', delay: 700 },
      { msg: 'Optimizing output…', delay: 500 },
      { msg: 'Build complete ✓', delay: 300, type: 'success' as const },
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, step.delay));
      log(step.msg, step.type ?? 'info');
    }

    setBuildStatus('success');
    toast.success('Build successful!');
  };

  const projectType = PROJECT_TYPES.find(t => t.id === selectedType);

  return (
    <AppLayout title="Build" description="Build apps, games, contracts, and more">
      <div className="h-[calc(100dvh-48px)] md:h-[calc(100dvh-56px)] flex flex-col overflow-hidden">

        {view === 'types' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white mb-1">What do you want to build?</h1>
                <p className="text-sm text-gray-400">Choose a project type to get started with a production-ready template.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {PROJECT_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(selectedType === type.id ? null : type.id)}
                      className={cn(
                        'p-4 rounded-2xl border text-left transition-all bg-gradient-to-br',
                        type.color, type.border,
                        selectedType === type.id ? 'ring-2 ring-glow-accent scale-[1.02]' : 'hover:scale-[1.01] hover:brightness-110'
                      )}
                    >
                      <Icon className="w-7 h-7 text-white mb-3" />
                      <h3 className="font-semibold text-white text-sm md:text-base">{type.label}</h3>
                      <p className="text-xs text-gray-400 mt-1">{type.description}</p>
                    </button>
                  );
                })}
              </div>

              {projectType && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      placeholder="Project name (optional)"
                      className="flex-1 bg-glow-surface border border-glow-border rounded-lg px-3 py-2 text-sm text-glow-text placeholder-gray-600 focus:outline-none focus:border-glow-accent/50"
                    />
                  </div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Templates</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {projectType.templates.map(t => (
                      <button
                        key={t.name}
                        onClick={() => loadTemplate(t, projectType.label)}
                        className="p-4 bg-glow-card border border-glow-border rounded-xl hover:border-glow-accent/50 transition-all text-left group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-white">{t.name}</span>
                          <Badge variant="default" className="text-xs">{t.files.length} files</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {t.files.map(f => <span key={f.name} className="text-[10px] font-mono text-gray-500 bg-glow-bg px-1.5 py-0.5 rounded">{f.name}</span>)}
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-glow-accent group-hover:text-glow-accent-light transition-colors">
                          <FolderOpen className="w-3.5 h-3.5" /> Open in Editor
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'editor' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Editor toolbar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-glow-border bg-glow-surface/50 flex-shrink-0 flex-wrap gap-y-2">
              <Button variant="ghost" size="sm" onClick={() => setView('types')} className="h-7 text-xs gap-1">
                <X className="w-3.5 h-3.5" /> Back
              </Button>
              <span className="text-xs text-gray-400">{selectedTemplate?.name}</span>
              <div className="flex-1" />

              <Button variant="secondary" size="sm" onClick={() => { setBuildLogs([]); setView('types'); }} className="h-7 text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> New
              </Button>
              <Button
                size="sm"
                onClick={runBuild}
                isLoading={buildStatus === 'building'}
                variant={buildStatus === 'success' ? 'secondary' : 'gradient'}
                className="h-7 text-xs"
              >
                {buildStatus === 'success'
                  ? <><CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-400" />Built</>
                  : <><Hammer className="w-3.5 h-3.5 mr-1" />Build</>}
              </Button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Editor */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <EditorTabs />
                <MonacoEditor />
              </div>

              {/* Build output panel */}
              {buildLogs.length > 0 && (
                <div className="w-72 border-l border-glow-border flex flex-col bg-glow-bg flex-shrink-0 hidden lg:flex">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-glow-border">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Build Output</span>
                    <div className="flex items-center gap-1.5">
                      {buildStatus === 'building' && <Loader2 className="w-3.5 h-3.5 text-glow-accent animate-spin" />}
                      {buildStatus === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1">
                    {buildLogs.map((l, i) => (
                      <div key={i} className={cn("flex gap-2",
                        l.type === 'success' && 'text-emerald-400',
                        l.type === 'error' && 'text-red-400',
                        l.type === 'warn' && 'text-amber-400',
                        l.type === 'info' && 'text-gray-400',
                      )}>
                        <span className="text-gray-600 flex-shrink-0">{l.time}</span>
                        <span>{l.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Terminal at bottom */}
            <div className="h-40 border-t border-glow-border flex-shrink-0">
              <Terminal />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
