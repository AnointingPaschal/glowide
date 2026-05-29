'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { useFileSystemStore } from '@/store/fileSystemStore';
import { useEditorStore } from '@/store/editorStore';
import { CONTRACT_TEMPLATES } from '@/lib/compiler';
import {
  Globe, Gamepad2, FileCode, Server, Zap, Hammer,
  ArrowRight, FolderOpen, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const detectLanguage = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = { ts:'typescript', tsx:'typescript', js:'javascript', jsx:'javascript', sol:'solidity', py:'python', html:'html', css:'css', json:'json', md:'markdown' };
  return map[ext] ?? 'plaintext';
};

const PROJECT_TYPES = [
  {
    id: 'webapp', icon: Globe, label: 'Web App', color: 'from-blue-500/20 to-cyan-500/10', border: 'border-blue-500/25', accent: '#3b82f6',
    description: 'React, Next.js, Vue — full-stack web applications',
    templates: [
      { name: 'React + Tailwind', files: [
        { name: 'App.tsx', content: `import { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-8">\n      <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">My App</h1>\n      <button onClick={() => setCount(c => c + 1)}\n        className="px-8 py-3 bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors font-semibold">\n        Count: {count}\n      </button>\n    </div>\n  );\n}` },
        { name: 'index.css', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody { margin: 0; }` },
        { name: 'package.json', content: JSON.stringify({ name:"my-app", version:"0.1.0", scripts:{dev:"vite",build:"vite build",preview:"vite preview"}, dependencies:{react:"^18",  "react-dom":"^18"}, devDependencies:{vite:"^5","@vitejs/plugin-react":"^4",tailwindcss:"^3",autoprefixer:"^10",postcss:"^8"} }, null, 2) },
      ]},
      { name: 'Next.js App Router', files: [
        { name: 'app/page.tsx', content: `export default function Home() {\n  return (\n    <main className="p-8">\n      <h1 className="text-3xl font-bold">Welcome to Next.js</h1>\n      <p className="text-gray-400 mt-2">Get started by editing app/page.tsx</p>\n    </main>\n  );\n}` },
        { name: 'app/layout.tsx', content: `import type { Metadata } from 'next';\nexport const metadata: Metadata = { title: 'My App' };\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>;\n}` },
        { name: 'package.json', content: JSON.stringify({ name:"my-nextjs-app", scripts:{dev:"next dev",build:"next build",start:"next start"}, dependencies:{next:"14",react:"^18","react-dom":"^18"}, devDependencies:{typescript:"^5","@types/react":"^18"} }, null, 2) },
      ]},
    ],
  },
  {
    id: 'game', icon: Gamepad2, label: 'Game', color: 'from-purple-500/20 to-pink-500/10', border: 'border-purple-500/25', accent: '#a855f7',
    description: 'Browser games — Canvas, WebGL, Phaser',
    templates: [
      { name: 'Canvas Platformer', files: [
        { name: 'index.html', content: `<!DOCTYPE html>\n<html>\n<head>\n  <title>Platformer</title>\n  <style>*{margin:0;padding:0;background:#0f0f1a}canvas{display:block;margin:auto;margin-top:20px;border:1px solid #252540;border-radius:8px}</style>\n</head>\n<body><canvas id="c" width="800" height="400"></canvas><script src="game.js"></script></body>\n</html>` },
        { name: 'game.js', content: `const c = document.getElementById('c');\nconst ctx = c.getContext('2d');\nconst W = 800, H = 400;\nconst G = 0.6, JUMP = -14;\nconst keys = {};\nconst player = { x:100, y:300, w:36, h:36, vx:0, vy:0, onGround:false, color:'#7c3aed' };\nconst platforms = [{x:0,y:360,w:800,h:40},{x:200,y:280,w:150,h:16},{x:450,y:220,w:120,h:16},{x:620,y:160,w:140,h:16}];\ndocument.onkeydown = e => keys[e.code]=true;\ndocument.onkeyup   = e => keys[e.code]=false;\nfunction update() {\n  if (keys['ArrowLeft']||keys['KeyA']) player.vx=-4;\n  else if (keys['ArrowRight']||keys['KeyD']) player.vx=4;\n  else player.vx*=0.8;\n  if ((keys['Space']||keys['ArrowUp']||keys['KeyW'])&&player.onGround) { player.vy=JUMP; player.onGround=false; }\n  player.vy+=G; player.x+=player.vx; player.y+=player.vy;\n  player.onGround=false;\n  platforms.forEach(p=>{\n    if(player.x<p.x+p.w&&player.x+player.w>p.x&&player.y+player.h>p.y&&player.y+player.h<p.y+p.h+player.vy+1){\n      player.y=p.y-player.h; player.vy=0; player.onGround=true;\n    }\n  });\n  player.x=Math.max(0,Math.min(W-player.w,player.x));\n  if(player.y>H) { player.y=0; player.x=100; }\n}\nfunction draw() {\n  ctx.fillStyle='#08080f'; ctx.fillRect(0,0,W,H);\n  platforms.forEach(p=>{ ctx.fillStyle='#252540'; ctx.beginPath(); ctx.roundRect(p.x,p.y,p.w,p.h,4); ctx.fill(); });\n  ctx.fillStyle=player.color; ctx.beginPath(); ctx.roundRect(player.x,player.y,player.w,player.h,6); ctx.fill();\n  ctx.fillStyle='#fff'; ctx.font='12px monospace'; ctx.fillText('Arrow/WASD to move · Space to jump',10,20);\n}\nfunction loop(){ update(); draw(); requestAnimationFrame(loop); }\nloop();` },
      ]},
    ],
  },
  {
    id: 'contract', icon: FileCode, label: 'Smart Contract', color: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-500/25', accent: '#10b981',
    description: 'Solidity contracts for Arc Testnet',
    templates: [
      { name: 'ERC20 Token', files: [{ name: 'MyToken.sol', content: CONTRACT_TEMPLATES.erc20 }] },
      { name: 'ERC721 NFT', files: [{ name: 'MyNFT.sol', content: CONTRACT_TEMPLATES.erc721 }] },
      { name: 'Simple Storage', files: [{ name: 'SimpleStorage.sol', content: CONTRACT_TEMPLATES.simple }] },
      { name: 'DeFi Staking', files: [{ name: 'StakingPool.sol', content: CONTRACT_TEMPLATES.simple }] },
    ],
  },
  {
    id: 'api', icon: Server, label: 'API / Backend', color: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-500/25', accent: '#f59e0b',
    description: 'Node.js, Express, REST APIs',
    templates: [
      { name: 'Express REST API', files: [
        { name: 'server.js', content: `const express = require('express');\nconst cors = require('cors');\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\nconst users = [];\n\napp.get('/health', (_, res) => res.json({ status:'ok', time: new Date() }));\napp.get('/users', (_, res) => res.json({ users }));\napp.post('/users', (req, res) => {\n  const { name, email } = req.body;\n  if (!name || !email) return res.status(400).json({ error:'name and email required' });\n  const user = { id: Date.now(), name, email, createdAt: new Date() };\n  users.push(user);\n  res.status(201).json(user);\n});\napp.delete('/users/:id', (req, res) => {\n  const idx = users.findIndex(u => u.id === +req.params.id);\n  if (idx === -1) return res.status(404).json({ error:'not found' });\n  users.splice(idx, 1);\n  res.json({ success: true });\n});\n\napp.listen(3001, () => console.log('API on :3001'));` },
        { name: 'package.json', content: JSON.stringify({ name:"my-api", version:"1.0.0", main:"server.js", scripts:{start:"node server.js",dev:"nodemon server.js"}, dependencies:{express:"^4.18",cors:"^2.8"} }, null, 2) },
      ]},
      { name: 'Python FastAPI', files: [
        { name: 'main.py', content: `from fastapi import FastAPI, HTTPException\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom pydantic import BaseModel\nfrom typing import List, Optional\nimport uvicorn\n\napp = FastAPI(title="My API")\napp.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])\n\nclass Item(BaseModel):\n    id: Optional[int] = None\n    name: str\n    description: Optional[str] = None\n\nitems: List[Item] = []\n\n@app.get("/items")\ndef get_items():\n    return items\n\n@app.post("/items", status_code=201)\ndef create_item(item: Item):\n    item.id = len(items) + 1\n    items.append(item)\n    return item\n\n@app.delete("/items/{item_id}")\ndef delete_item(item_id: int):\n    for i, it in enumerate(items):\n        if it.id == item_id:\n            items.pop(i)\n            return {"ok": True}\n    raise HTTPException(status_code=404)\n\nif __name__ == "__main__":\n    uvicorn.run(app, host="0.0.0.0", port=8000)` },
        { name: 'requirements.txt', content: `fastapi==0.109.0\nuvicorn[standard]==0.27.0\npydantic==2.6.0` },
      ]},
    ],
  },
  {
    id: 'dapp', icon: Zap, label: 'Web3 dApp', color: 'from-violet-500/20 to-purple-500/10', border: 'border-violet-500/25', accent: '#7c3aed',
    description: 'Full dApp with wallet + contract + UI',
    templates: [
      { name: 'ERC20 dApp', files: [
        { name: 'App.tsx', content: `import { useState } from 'react';\n\ndeclare global { interface Window { ethereum?: { request: (a:{method:string;params?:unknown[]})=>Promise<unknown> } } }\n\nconst CONTRACT = '0x...' as const; // Replace with your deployed contract\nconst ABI = ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'];\n\nexport default function App() {\n  const [address, setAddress] = useState<string|null>(null);\n  const [balance, setBalance] = useState<string|null>(null);\n\n  const connect = async () => {\n    if (!window.ethereum) return alert('Install MetaMask');\n    const [addr] = await window.ethereum.request({ method:'eth_requestAccounts' }) as string[];\n    setAddress(addr);\n  };\n\n  return (\n    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6 p-8">\n      <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">Token dApp</h1>\n      {!address ? (\n        <button onClick={connect} className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition-colors">\n          Connect Wallet\n        </button>\n      ) : (\n        <div className="text-center space-y-2">\n          <p className="text-emerald-400 font-medium">✓ Connected</p>\n          <p className="font-mono text-sm text-gray-300">{address.slice(0,6)}…{address.slice(-4)}</p>\n          {balance && <p className="text-lg font-bold">{balance} tokens</p>}\n        </div>\n      )}\n    </div>\n  );\n}` },
        { name: 'package.json', content: JSON.stringify({ name:"my-dapp", version:"0.1.0", scripts:{dev:"vite",build:"vite build"}, dependencies:{react:"^18","react-dom":"^18",viem:"^2"}, devDependencies:{vite:"^5","@vitejs/plugin-react":"^4"} }, null, 2) },
      ]},
    ],
  },
];

export default function BuildPage() {
  const router = useRouter();
  const { createProject, createFile, setActiveProject } = useFileSystemStore();
  const { openFile } = useEditorStore();
  const [selected, setSelected]     = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  const loadTemplate = (template: { name: string; files: { name: string; content: string }[] }, typeName: string) => {
    const name = projectName.trim() || template.name.toLowerCase().replace(/\s+/g, '-');
    const project = createProject(name, `${typeName} — ${template.name}`);
    setActiveProject(project.id);

    // Create all files
    let firstFileNode: any = null;
    for (const f of template.files) {
      // Handle nested paths like app/page.tsx
      const parts = f.name.split('/');
      let parentId: string | null = null;
      if (parts.length > 1) {
        // Create intermediate dirs
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

    // Open first file in editor
    if (firstFileNode) {
      openFile({ id: firstFileNode.id, project_id: project.id, name: firstFileNode.name, path: `/${firstFileNode.name}`, type: 'file', content: firstFileNode.content ?? '', language: firstFileNode.language ?? 'plaintext', created_at: firstFileNode.createdAt, updated_at: firstFileNode.updatedAt });
    }
    toast.success(`"${name}" loaded → opening editor`);
    router.push('/editor');
  };

  const selectedType = PROJECT_TYPES.find(t => t.id === selected);

  return (
    <AppLayout title="Build">
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-glow-text">Build Something</h1>
            <p className="text-sm text-glow-muted mt-1">Choose a template to scaffold your project and open it in the editor.</p>
          </div>

          {/* Project name input */}
          <div className="flex gap-3 items-center">
            <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name (optional)"
              className="flex-1 max-w-xs bg-glow-card border border-glow-border rounded-xl px-3.5 py-2.5 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/50" />
          </div>

          {/* Project type grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {PROJECT_TYPES.map(type => {
              const Icon = type.icon;
              const isSelected = selected === type.id;
              return (
                <button key={type.id} onClick={() => setSelected(isSelected ? null : type.id)}
                  className={cn('p-4 rounded-2xl border text-left transition-all bg-gradient-to-br flex flex-col gap-2', type.color, type.border, isSelected && 'ring-2 ring-glow-accent')}>
                  <Icon className="w-6 h-6" style={{ color: type.accent }} />
                  <p className="font-semibold text-glow-text text-sm">{type.label}</p>
                  <p className="text-[11px] text-glow-muted leading-tight">{type.description}</p>
                </button>
              );
            })}
          </div>

          {/* Templates for selected type */}
          {selectedType && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">{selectedType.label} Templates</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedType.templates.map(t => (
                  <button key={t.name} onClick={() => loadTemplate(t, selectedType.label)}
                    className="group p-4 bg-glow-card border border-glow-border rounded-2xl hover:border-glow-accent/40 transition-all text-left">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-semibold text-glow-text">{t.name}</p>
                      <Badge variant="default" className="text-[10px]">{t.files.length} files</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {t.files.map(f => <span key={f.name} className="text-[10px] font-mono text-glow-muted bg-glow-surface px-1.5 py-0.5 rounded">{f.name.split('/').pop()}</span>)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-glow-accent group-hover:text-glow-accent-light transition-colors">
                      <FolderOpen className="w-3.5 h-3.5" />Open in Editor
                      <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
