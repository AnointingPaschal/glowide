# GlowIDE

> AI-powered Web3 IDE and smart contract builder — built on Arc Testnet, powered by OpenRouter, deployed on Vercel.

![GlowIDE](https://img.shields.io/badge/GlowIDE-Web3%20IDE-7c3aed?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green?style=for-the-badge&logo=supabase)

## ✨ Features

- **Monaco Editor** — VS Code-grade editor with Solidity, TypeScript, JavaScript, Python, HTML/CSS support
- **AI Assistant** — OpenRouter-powered coding assistant with streaming responses
- **Smart Contract Tools** — Compile, deploy, verify, and interact with Solidity contracts on Arc Testnet
- **Arc Testnet** — Native integration with Chain ID 5042002, USDC as gas token
- **Circle Assets** — USDC, EURC, and cirBTC balance tracking and transfers
- **Wallet Auth** — Connect MetaMask, WalletConnect, or any injected wallet
- **Supabase Backend** — Auth, database, realtime, and storage
- **Admin Panel** — Configure OpenRouter API key, models, and system prompts without code changes

## 🗂 Project Structure

```
glowide/
├── app/
│   ├── page.tsx              # Landing page
│   ├── editor/page.tsx       # Full IDE
│   ├── chat/page.tsx         # AI chat
│   ├── deployments/page.tsx  # Contract deployments
│   ├── explorer/page.tsx     # Arc Testnet explorer
│   ├── wallet/page.tsx       # Wallet & balances
│   ├── admin/page.tsx        # Admin panel
│   ├── settings/page.tsx     # User settings
│   └── api/                  # API routes
├── components/
│   ├── ui/                   # Button, Card, Input, Modal, Badge
│   ├── layout/               # AppLayout, Sidebar, TopBar
│   ├── editor/               # Monaco, FileTree, Tabs, Terminal
│   ├── chat/                 # ChatPanel, ChatMessage
│   ├── wallet/               # WalletButton
│   └── contracts/            # ContractDeployer
├── lib/
│   ├── supabase.ts           # Supabase client
│   ├── arc-testnet.ts        # Arc chain config
│   ├── openrouter.ts         # OpenRouter streaming
│   ├── compiler.ts           # Solidity compiler wrapper
│   └── utils.ts              # Utilities
├── store/
│   ├── editorStore.ts        # Editor state (Zustand)
│   ├── chatStore.ts          # Chat state (Zustand)
│   └── walletStore.ts        # Wallet state (Zustand)
├── types/index.ts             # TypeScript types
└── supabase/
    ├── schema.sql             # Full database schema
    └── rls.sql                # Row Level Security policies
```

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/AnointingPaschal/glowide.git
cd glowide
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-id

OPENROUTER_API_KEY=sk-or-v1-...   # Optional: can be set via Admin panel
```

### 3. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor**
3. Run `supabase/schema.sql`
4. Run `supabase/rls.sql`
5. Enable Auth providers (Email, or wallet-based via magic link)
6. Copy your project URL and keys to `.env.local`

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option B: GitHub Import

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add all environment variables from `.env.example`
5. Click **Deploy**

### Required Environment Variables on Vercel

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID |
| `OPENROUTER_API_KEY` | OpenRouter API key (optional if set via admin) |

---

## 🔐 Admin Panel

Access the admin panel at `/admin` to configure:

- **OpenRouter API Key** — stored securely in Supabase `system_settings`
- **Default Model** — choose from Claude, GPT-4o, Llama, Gemini, and more
- **Temperature & Max Tokens** — tune AI response behavior
- **System Prompt** — customize the AI assistant's persona
- **Rate Limits** — control requests per user per day

The admin key is separate from user accounts. Set it in your environment or Supabase `admin_keys` table.

---

## ⛓ Arc Testnet

| Setting | Value |
|---|---|
| Network Name | Arc Testnet |
| Chain ID | 5042002 |
| RPC URL | https://rpc.testnet.arc.network |
| Explorer | https://testnet.arcscan.app |
| Gas Token | USDC |

### Add to MetaMask

Go to MetaMask → Networks → Add Network, then paste the settings above.

---

## 🪙 Circle Assets

GlowIDE tracks three Circle-issued assets on Arc Testnet:

| Asset | Symbol | Description |
|---|---|---|
| USD Coin | USDC | Native gas token on Arc Testnet |
| Euro Coin | EURC | Euro-backed stablecoin |
| Circle Bitcoin | cirBTC | Bitcoin wrapped by Circle |

---

## 🛠 Development

### Tech Stack

- **Framework**: Next.js 14 App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Editor**: Monaco Editor
- **State**: Zustand + TanStack Query
- **Blockchain**: wagmi v2 + viem
- **Backend**: Supabase (Auth + DB + Realtime)
- **AI**: OpenRouter (multi-model)
- **Deployment**: Vercel

### Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

### Adding a New Model

Edit `lib/openrouter.ts` and add to `POPULAR_MODELS`. Models are also configurable without code changes via the admin panel.

---

## 📄 License

MIT

---

Built with ⚡ by GlowIDE
