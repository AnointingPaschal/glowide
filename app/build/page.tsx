'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { useFileSystemStore } from '@/store/fileSystemStore';
import { useEditorStore } from '@/store/editorStore';
import { CONTRACT_TEMPLATES } from '@/lib/compiler';
import { DEFI_CATEGORY, CCTP_CATEGORY, PREDICTION_CATEGORY, AGENTIC_ECONOMY_CATEGORY, AI_AGENTS_CATEGORY, type Category, type Template } from '@/lib/build-templates';
import {
  Globe, Gamepad2, FileCode, Server, Zap, Search,
  ArrowRight, FolderOpen, Sparkles, Layers, LayoutGrid,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

// ── Original categories (Web App, Game, Smart Contract, API, dApp) ─────────
const CORE_CATEGORIES: Category[] = [
  {
    id: 'webapp', label: 'Web App', description: 'React, Next.js — full-stack web applications',
    color: 'from-blue-500/20 to-cyan-500/10', border: 'border-blue-500/25', accent: '#3b82f6',
    templates: [
      { name: 'React + Tailwind', description: 'Vite-powered React SPA with Tailwind styling', difficulty: 'beginner', tags: ['React', 'Vite', 'Tailwind'], files: [
        { name: 'App.tsx', content: `import { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-8">\n      <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">My App</h1>\n      <button onClick={() => setCount(c => c + 1)}\n        className="px-8 py-3 bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors font-semibold">\n        Count: {count}\n      </button>\n    </div>\n  );\n}` },
        { name: 'index.css', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody { margin: 0; }` },
        { name: 'package.json', content: JSON.stringify({ name:"my-app", version:"0.1.0", scripts:{dev:"vite",build:"vite build",preview:"vite preview"}, dependencies:{react:"^18","react-dom":"^18"}, devDependencies:{vite:"^5","@vitejs/plugin-react":"^4",tailwindcss:"^3",autoprefixer:"^10",postcss:"^8"} }, null, 2) },
      ]},
      { name: 'Next.js App Router', description: 'Full-stack Next.js app with the modern App Router', difficulty: 'beginner', tags: ['Next.js', 'React', 'SSR'], files: [
        { name: 'app/page.tsx', content: `export default function Home() {\n  return (\n    <main className="p-8">\n      <h1 className="text-3xl font-bold">Welcome to Next.js</h1>\n      <p className="text-gray-400 mt-2">Get started by editing app/page.tsx</p>\n    </main>\n  );\n}` },
        { name: 'app/layout.tsx', content: `import type { Metadata } from 'next';\nexport const metadata: Metadata = { title: 'My App' };\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>;\n}` },
        { name: 'package.json', content: JSON.stringify({ name:"my-nextjs-app", scripts:{dev:"next dev",build:"next build",start:"next start"}, dependencies:{next:"14",react:"^18","react-dom":"^18"}, devDependencies:{typescript:"^5","@types/react":"^18"} }, null, 2) },
      ]},
      { name: 'Real-Time Dashboard', description: 'Live-updating stats dashboard with charts and polling', difficulty: 'intermediate', tags: ['React', 'Charts', 'Polling'], files: [
        { name: 'Dashboard.tsx', content: `import { useState, useEffect } from 'react';\n\ninterface Stat { label: string; value: number; change: number; }\n\nexport default function Dashboard() {\n  const [stats, setStats] = useState<Stat[]>([\n    { label: 'Active Users', value: 1284, change: 3.2 },\n    { label: 'Revenue', value: 48291, change: -1.1 },\n    { label: 'Requests/min', value: 942, change: 8.4 },\n  ]);\n\n  useEffect(() => {\n    const interval = setInterval(() => {\n      setStats(prev => prev.map(s => ({ ...s, value: Math.max(0, s.value + Math.round((Math.random()-0.5)*20)) })));\n    }, 2000);\n    return () => clearInterval(interval);\n  }, []);\n\n  return (\n    <div style={{ background:'#0a0a12', minHeight:'100vh', padding:32, fontFamily:'system-ui' }}>\n      <h1 style={{ color:'#e8e8ee', fontSize:28, fontWeight:700, marginBottom:24 }}>Live Dashboard</h1>\n      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16 }}>\n        {stats.map(s => (\n          <div key={s.label} style={{ background:'#13141c', border:'1px solid #26262e', borderRadius:16, padding:20 }}>\n            <p style={{ color:'#8888a0', fontSize:12, textTransform:'uppercase' }}>{s.label}</p>\n            <p style={{ color:'#e8e8ee', fontSize:32, fontWeight:700, margin:'8px 0' }}>{s.value.toLocaleString()}</p>\n            <p style={{ color: s.change>=0?'#34d399':'#f87171', fontSize:13 }}>{s.change>=0?'+':''}{s.change}%</p>\n          </div>\n        ))}\n      </div>\n    </div>\n  );\n}` },
      ]},
    ],
  },
  {
    id: 'game', label: 'Game', description: 'Browser games — Canvas, WebGL, physics',
    color: 'from-purple-500/20 to-pink-500/10', border: 'border-purple-500/25', accent: '#a855f7',
    templates: [
      { name: 'Canvas Platformer', description: 'Physics-based side-scrolling platformer with jump mechanics', difficulty: 'intermediate', tags: ['Canvas', 'Physics', 'Game'], files: [
        { name: 'index.html', content: `<!DOCTYPE html>\n<html>\n<head>\n  <title>Platformer</title>\n  <style>*{margin:0;padding:0;background:#0f0f1a}canvas{display:block;margin:auto;margin-top:20px;border:1px solid #252540;border-radius:8px}</style>\n</head>\n<body><canvas id="c" width="800" height="400"></canvas><script src="game.js"></script></body>\n</html>` },
        { name: 'game.js', content: `const c = document.getElementById('c');\nconst ctx = c.getContext('2d');\nconst W = 800, H = 400;\nconst G = 0.6, JUMP = -14;\nconst keys = {};\nconst player = { x:100, y:300, w:36, h:36, vx:0, vy:0, onGround:false, color:'#7c3aed' };\nconst platforms = [{x:0,y:360,w:800,h:40},{x:200,y:280,w:150,h:16},{x:450,y:220,w:120,h:16},{x:620,y:160,w:140,h:16}];\ndocument.onkeydown = e => keys[e.code]=true;\ndocument.onkeyup   = e => keys[e.code]=false;\nfunction update() {\n  if (keys['ArrowLeft']||keys['KeyA']) player.vx=-4;\n  else if (keys['ArrowRight']||keys['KeyD']) player.vx=4;\n  else player.vx*=0.8;\n  if ((keys['Space']||keys['ArrowUp']||keys['KeyW'])&&player.onGround) { player.vy=JUMP; player.onGround=false; }\n  player.vy+=G; player.x+=player.vx; player.y+=player.vy;\n  player.onGround=false;\n  platforms.forEach(p=>{\n    if(player.x<p.x+p.w&&player.x+player.w>p.x&&player.y+player.h>p.y&&player.y+player.h<p.y+p.h+player.vy+1){\n      player.y=p.y-player.h; player.vy=0; player.onGround=true;\n    }\n  });\n  player.x=Math.max(0,Math.min(W-player.w,player.x));\n  if(player.y>H) { player.y=0; player.x=100; }\n}\nfunction draw() {\n  ctx.fillStyle='#08080f'; ctx.fillRect(0,0,W,H);\n  platforms.forEach(p=>{ ctx.fillStyle='#252540'; ctx.beginPath(); ctx.roundRect(p.x,p.y,p.w,p.h,4); ctx.fill(); });\n  ctx.fillStyle=player.color; ctx.beginPath(); ctx.roundRect(player.x,player.y,player.w,player.h,6); ctx.fill();\n  ctx.fillStyle='#fff'; ctx.font='12px monospace'; ctx.fillText('Arrow/WASD to move · Space to jump',10,20);\n}\nfunction loop(){ update(); draw(); requestAnimationFrame(loop); }\nloop();` },
      ]},
      { name: 'Snake Game', description: 'Classic snake with score tracking and increasing speed', difficulty: 'beginner', tags: ['Canvas', 'Classic'], files: [
        { name: 'index.html', content: `<!DOCTYPE html>\n<html><head><title>Snake</title><style>body{margin:0;background:#0f0f1a;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace}canvas{border:2px solid #7c3aed;border-radius:8px}</style></head>\n<body><canvas id="c" width="400" height="400"></canvas><script src="game.js"></script></body></html>` },
        { name: 'game.js', content: `const cv=document.getElementById('c'),ctx=cv.getContext('2d');const box=20;let snake=[{x:9*box,y:9*box}];let dir='RIGHT';let food={x:Math.floor(Math.random()*19)*box,y:Math.floor(Math.random()*19)*box};let score=0;\ndocument.addEventListener('keydown',e=>{const k=e.key;if(k==='ArrowLeft'&&dir!=='RIGHT')dir='LEFT';else if(k==='ArrowUp'&&dir!=='DOWN')dir='UP';else if(k==='ArrowRight'&&dir!=='LEFT')dir='RIGHT';else if(k==='ArrowDown'&&dir!=='UP')dir='DOWN';});\nfunction draw(){ctx.fillStyle='#08080f';ctx.fillRect(0,0,400,400);snake.forEach((s,i)=>{ctx.fillStyle=i===0?'#a855f7':'#7c3aed';ctx.fillRect(s.x,s.y,box,box);});ctx.fillStyle='#ef4444';ctx.fillRect(food.x,food.y,box,box);\nlet hx=snake[0].x,hy=snake[0].y;if(dir==='LEFT')hx-=box;if(dir==='UP')hy-=box;if(dir==='RIGHT')hx+=box;if(dir==='DOWN')hy+=box;\nif(hx===food.x&&hy===food.y){score++;food={x:Math.floor(Math.random()*19)*box,y:Math.floor(Math.random()*19)*box};}else{snake.pop();}\nconst newHead={x:hx,y:hy};\nif(hx<0||hy<0||hx>=400||hy>=400||snake.some(s=>s.x===hx&&s.y===hy)){clearInterval(game);ctx.fillStyle='#fff';ctx.font='24px monospace';ctx.fillText('Game Over! Score: '+score,60,200);return;}\nsnake.unshift(newHead);ctx.fillStyle='#fff';ctx.font='14px monospace';ctx.fillText('Score: '+score,10,20);}\nconst game=setInterval(draw,120);` },
      ]},
    ],
  },
  {
    id: 'contract', label: 'Smart Contract', description: 'Solidity contracts for Arc Testnet',
    color: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-500/25', accent: '#10b981',
    templates: [
      { name: 'ERC20 Token', description: 'Standard fungible token with mint/burn', difficulty: 'beginner', tags: ['Solidity', 'ERC-20'], files: [{ name: 'MyToken.sol', content: CONTRACT_TEMPLATES.erc20 }] },
      { name: 'ERC721 NFT', description: 'Standard NFT collection with metadata', difficulty: 'beginner', tags: ['Solidity', 'ERC-721', 'NFT'], files: [{ name: 'MyNFT.sol', content: CONTRACT_TEMPLATES.erc721 }] },
      { name: 'Simple Storage', description: 'Minimal contract for learning Solidity basics', difficulty: 'beginner', tags: ['Solidity', 'Basics'], files: [{ name: 'SimpleStorage.sol', content: CONTRACT_TEMPLATES.simple }] },
    ],
  },
  {
    id: 'api', label: 'API / Backend', description: 'Node.js, Express, Python — REST APIs',
    color: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-500/25', accent: '#f59e0b',
    templates: [
      { name: 'Express REST API', description: 'CRUD API with in-memory store and CORS', difficulty: 'beginner', tags: ['Node.js', 'Express', 'REST'], files: [
        { name: 'server.js', content: `const express = require('express');\nconst cors = require('cors');\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\nconst users = [];\n\napp.get('/health', (_, res) => res.json({ status:'ok', time: new Date() }));\napp.get('/users', (_, res) => res.json({ users }));\napp.post('/users', (req, res) => {\n  const { name, email } = req.body;\n  if (!name || !email) return res.status(400).json({ error:'name and email required' });\n  const user = { id: Date.now(), name, email, createdAt: new Date() };\n  users.push(user);\n  res.status(201).json(user);\n});\napp.delete('/users/:id', (req, res) => {\n  const idx = users.findIndex(u => u.id === +req.params.id);\n  if (idx === -1) return res.status(404).json({ error:'not found' });\n  users.splice(idx, 1);\n  res.json({ success: true });\n});\n\napp.listen(3001, () => console.log('API on :3001'));` },
        { name: 'package.json', content: JSON.stringify({ name:"my-api", version:"1.0.0", main:"server.js", scripts:{start:"node server.js",dev:"nodemon server.js"}, dependencies:{express:"^4.18",cors:"^2.8"} }, null, 2) },
      ]},
      { name: 'Python FastAPI', description: 'Typed REST API with Pydantic validation', difficulty: 'intermediate', tags: ['Python', 'FastAPI'], files: [
        { name: 'main.py', content: `from fastapi import FastAPI, HTTPException\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom pydantic import BaseModel\nfrom typing import List, Optional\nimport uvicorn\n\napp = FastAPI(title="My API")\napp.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])\n\nclass Item(BaseModel):\n    id: Optional[int] = None\n    name: str\n    description: Optional[str] = None\n\nitems: List[Item] = []\n\n@app.get("/items")\ndef get_items():\n    return items\n\n@app.post("/items", status_code=201)\ndef create_item(item: Item):\n    item.id = len(items) + 1\n    items.append(item)\n    return item\n\n@app.delete("/items/{item_id}")\ndef delete_item(item_id: int):\n    for i, it in enumerate(items):\n        if it.id == item_id:\n            items.pop(i)\n            return {"ok": True}\n    raise HTTPException(status_code=404)\n\nif __name__ == "__main__":\n    uvicorn.run(app, host="0.0.0.0", port=8000)` },
        { name: 'requirements.txt', content: `fastapi==0.109.0\nuvicorn[standard]==0.27.0\npydantic==2.6.0` },
      ]},
    ],
  },
  {
    id: 'dapp', label: 'Web3 dApp', description: 'Full dApp with wallet + contract + UI',
    color: 'from-violet-500/20 to-purple-500/10', border: 'border-violet-500/25', accent: '#7c3aed',
    templates: [
      { name: 'ERC20 Token dApp', description: 'Wallet connect + balance display + transfer UI', difficulty: 'intermediate', tags: ['React', 'Web3', 'MetaMask'], files: [
        { name: 'App.tsx', content: `import { useState } from 'react';\n\ndeclare global { interface Window { ethereum?: { request: (a:{method:string;params?:unknown[]})=>Promise<unknown> } } }\n\nconst CONTRACT = '0x...' as const; // Replace with your deployed contract\n\nexport default function App() {\n  const [address, setAddress] = useState<string|null>(null);\n\n  const connect = async () => {\n    if (!window.ethereum) return alert('Install MetaMask');\n    const [addr] = await window.ethereum.request({ method:'eth_requestAccounts' }) as string[];\n    setAddress(addr);\n  };\n\n  return (\n    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6 p-8">\n      <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">Token dApp</h1>\n      {!address ? (\n        <button onClick={connect} className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition-colors">\n          Connect Wallet\n        </button>\n      ) : (\n        <div className="text-center space-y-2">\n          <p className="text-emerald-400 font-medium">✓ Connected</p>\n          <p className="font-mono text-sm text-gray-300">{address.slice(0,6)}…{address.slice(-4)}</p>\n        </div>\n      )}\n    </div>\n  );\n}` },
        { name: 'package.json', content: JSON.stringify({ name:"my-dapp", version:"0.1.0", scripts:{dev:"vite",build:"vite build"}, dependencies:{react:"^18","react-dom":"^18",viem:"^2"}, devDependencies:{vite:"^5","@vitejs/plugin-react":"^4"} }, null, 2) },
      ]},
    ],
  },
];

const ALL_CATEGORIES: Category[] = [
  ...CORE_CATEGORIES,
  DEFI_CATEGORY,
  CCTP_CATEGORY,
  PREDICTION_CATEGORY,
  AGENTIC_ECONOMY_CATEGORY,
  AI_AGENTS_CATEGORY,
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  webapp: Globe, game: Gamepad2, contract: FileCode, api: Server, dapp: Zap,
  defi: Layers, cctp: ArrowRight, prediction: Sparkles, 'agentic-economy': Zap, 'ai-agents': Sparkles,
};

const DIFFICULTY_COLORS: Record<Template['difficulty'], string> = {
  beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  intermediate: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  advanced: 'bg-red-500/15 text-red-400 border-red-500/25',
};

interface FlatTemplate extends Template { categoryId: string; categoryLabel: string; accent: string; }

export default function BuildPage() {
  const router = useRouter();
  const { createProject, createFile, setActiveProject } = useFileSystemStore();
  const { openFile } = useEditorStore();
  const [projectName, setProjectName] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const flatTemplates: FlatTemplate[] = useMemo(() =>
    ALL_CATEGORIES.flatMap(cat => cat.templates.map(t => ({ ...t, categoryId: cat.id, categoryLabel: cat.label, accent: cat.accent }))),
  []);

  const filtered = useMemo(() => {
    let list = flatTemplates;
    if (activeCategory !== 'all') list = list.filter(t => t.categoryId === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [flatTemplates, activeCategory, search]);

  const loadTemplate = (template: FlatTemplate) => {
    const name = projectName.trim() || template.name.toLowerCase().replace(/\s+/g, '-');
    const project = createProject(name, `${template.categoryLabel} — ${template.name}`);
    setActiveProject(project.id);

    let firstFileNode: ReturnType<typeof createFile> | null = null;
    for (const f of template.files) {
      const parts = f.name.split('/');
      let parentId: string | null = null;
      if (parts.length > 1) {
        for (let i = 0; i < parts.length - 1; i++) {
          const existing = useFileSystemStore.getState().nodes.find(n => n.name === parts[i] && n.parentId === parentId && n.projectId === project.id);
          if (existing) { parentId = existing.id; continue; }
          const dir = useFileSystemStore.getState().createDirectory(parentId, parts[i], project.id);
          parentId = dir.id;
        }
      }
      const node = createFile(parentId, parts[parts.length - 1], project.id, f.content);
      if (!firstFileNode) firstFileNode = node;
    }

    if (firstFileNode) {
      openFile({ id: firstFileNode.id, project_id: project.id, name: firstFileNode.name, path: `/${firstFileNode.name}`, type: 'file', content: firstFileNode.content ?? '', language: firstFileNode.language ?? 'plaintext', created_at: firstFileNode.createdAt, updated_at: firstFileNode.updatedAt });
    }
    toast.success(`"${name}" loaded → opening editor`);
    router.push('/editor');
  };

  const totalTemplates = flatTemplates.length;

  return (
    <AppLayout title="Arc Lab">
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-glow-accent"/>
                <h1 className="text-xl md:text-2xl font-bold text-glow-text">Arc Lab</h1>
              </div>
              <p className="text-sm text-glow-muted mt-1">Real, working starter projects across {ALL_CATEGORIES.length} categories — load any one directly into your File Explorer.</p>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-2 bg-glow-card border border-glow-border rounded-xl text-center">
                <p className="text-lg font-bold text-glow-text leading-none">{totalTemplates}</p>
                <p className="text-[10px] text-glow-muted uppercase tracking-wider mt-1">Projects</p>
              </div>
              <div className="px-3 py-2 bg-glow-card border border-glow-border rounded-xl text-center">
                <p className="text-lg font-bold text-glow-text leading-none">{ALL_CATEGORIES.length}</p>
                <p className="text-[10px] text-glow-muted uppercase tracking-wider mt-1">Categories</p>
              </div>
            </div>
          </div>

          {/* Project name + search */}
          <div className="flex gap-3 flex-col sm:flex-row">
            <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name (optional)"
              className="flex-1 sm:max-w-xs bg-glow-card border border-glow-border rounded-xl px-3.5 py-2.5 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/50" />
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-glow-muted/50 absolute left-3 top-1/2 -translate-y-1/2"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects, tags, tech…"
                className="w-full bg-glow-card border border-glow-border rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/50" />
            </div>
          </div>

          {/* Category filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setActiveCategory('all')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0',
                activeCategory === 'all' ? 'bg-glow-gradient text-white' : 'bg-glow-card border border-glow-border text-glow-muted hover:text-glow-text')}>
              <LayoutGrid className="w-3.5 h-3.5"/>All
            </button>
            {ALL_CATEGORIES.map(cat => {
              const Icon = CATEGORY_ICONS[cat.id] ?? FileCode;
              const isActive = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 border',
                    isActive ? 'text-white border-transparent' : 'bg-glow-card border-glow-border text-glow-muted hover:text-glow-text')}
                  style={isActive ? { background: cat.accent } : undefined}>
                  <Icon className="w-3.5 h-3.5"/>{cat.label}
                  <span className="opacity-60">{cat.templates.length}</span>
                </button>
              );
            })}
          </div>

          {/* Template grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-10 h-10 text-glow-muted/20 mx-auto mb-3"/>
              <p className="text-sm text-glow-muted">No projects match "{search}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(t => (
                <button key={`${t.categoryId}-${t.name}`} onClick={() => loadTemplate(t)}
                  className="group p-4 bg-glow-card border border-glow-border rounded-2xl hover:border-glow-accent/40 transition-all text-left flex flex-col">
                  <div className="flex items-start justify-between mb-1.5 gap-2">
                    <p className="text-sm font-semibold text-glow-text">{t.name}</p>
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0', DIFFICULTY_COLORS[t.difficulty])}>
                      {t.difficulty}
                    </span>
                  </div>
                  <p className="text-[11px] text-glow-muted leading-snug mb-2.5">{t.description}</p>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${t.accent}22`, color: t.accent }}>{t.categoryLabel}</span>
                    <Badge variant="default" className="text-[10px]">{t.files.length} files</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {t.tags.map(tag => <span key={tag} className="text-[10px] font-mono text-glow-muted bg-glow-surface px-1.5 py-0.5 rounded">{tag}</span>)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-glow-accent group-hover:text-glow-accent-light transition-colors mt-auto pt-1">
                    <FolderOpen className="w-3.5 h-3.5" />Load into Editor
                    <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
