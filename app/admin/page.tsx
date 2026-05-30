'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWalletStore } from '@/store/walletStore';
import {
  Shield, Brain, Save, Eye, EyeOff, CheckCircle, Sliders, FileText,
  Plus, Trash2, Edit2, X, Loader2, DollarSign, Percent, Zap,
  ToggleLeft, ToggleRight, RefreshCw, Copy, AlertTriangle,
  Activity, Server, Globe, Lock, Users, BookOpen, CreditCard,
  Rocket, Wallet, ArrowDownToLine, ExternalLink, TrendingUp, Settings,
  Code2, ShieldCheck, Database,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ContractDeployCard, type DeployStatus } from '@/components/admin/ContractDeployCard';
import type { PublicModel } from '@/app/api/models/route';

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? '').toLowerCase();

const DEFAULT_MODELS: PublicModel[] = [
  { id:'anthropic/claude-sonnet-4-5', name:'Claude Sonnet 4.5', provider:'Anthropic', tier:'premium', context_length:200000, description:'Latest Claude', enabled:true },
  { id:'anthropic/claude-3.5-sonnet', name:'Claude 3.5 Sonnet', provider:'Anthropic', tier:'premium', context_length:200000, description:'Powerful & fast', enabled:true },
  { id:'anthropic/claude-3-haiku',    name:'Claude 3 Haiku',    provider:'Anthropic', tier:'fast',    context_length:200000, description:'Fastest Claude', enabled:true },
  { id:'openai/gpt-4o',               name:'GPT-4o',            provider:'OpenAI',    tier:'premium', context_length:128000, description:'OpenAI flagship', enabled:true },
  { id:'openai/gpt-4o-mini',          name:'GPT-4o Mini',       provider:'OpenAI',    tier:'fast',    context_length:128000, description:'Fast & affordable', enabled:true },
  { id:'google/gemini-flash-1.5',     name:'Gemini 1.5 Flash',  provider:'Google',    tier:'fast',    context_length:1000000,description:'1M context', enabled:true },
  { id:'meta-llama/llama-3.1-70b-instruct', name:'Llama 3.1 70B', provider:'Meta',   tier:'fast',    context_length:128000, description:'Open source', enabled:true },
  { id:'deepseek/deepseek-coder',     name:'DeepSeek Coder',    provider:'DeepSeek',  tier:'coding',  context_length:16000,  description:'Code specialist', enabled:true },
  { id:'mistralai/mistral-large',     name:'Mistral Large',     provider:'Mistral',   tier:'premium', context_length:32000,  description:'European AI', enabled:true },
];

const DEFAULT_SYSTEM_PROMPT = `You are GlowIDE AI, an expert coding assistant specialized in Web3 development, smart contracts, and full-stack engineering. You write production-grade, type-safe code with clear explanations.

Expertise: Solidity smart contracts, TypeScript/React/Next.js, Arc Testnet (Chain ID 5042002), Circle assets (USDC/EURC/cirBTC), CCTP cross-chain transfers, Web3 integration, security best practices, gas optimization.

Always write clean, well-commented, production-ready code.`;

const PROVIDER_COLORS: Record<string,string> = { Anthropic:'#CC785C', OpenAI:'#10A37F', Google:'#4285F4', Meta:'#0866FF', DeepSeek:'#5B5BD6', Mistral:'#FF7000' };
const ARC_EXPLORER = 'https://testnet.arcscan.app';

// ── Types ─────────────────────────────────────────────────────────────────────
interface UserPlan { id:string; wallet_address:string; plan:string; tokens_used:number; tokens_limit:number; storage_used_bytes:number; storage_limit_bytes:number; deployments_used:number; deployments_limit:number; subscription_end?:string; created_at:string; }
interface TrainingExample { id:string; user_message:string; assistant_response:string; category:string; enabled:boolean; created_at:string; }
interface PlanConfig { id:string; name:string; price:string; tokens_limit:number; storage_mb:number; deploys_limit:number; ai_requests:number; features:string[]; color:string; }
interface DeployStatus { compiling?:boolean; compiled?:boolean; deploying?:boolean; deployed?:boolean; address?:string; txHash?:string; error?:string; }

// ── UI helpers ─────────────────────────────────────────────────────────────────
const inputCls = 'w-full bg-glow-bg border border-glow-border rounded-xl px-3.5 py-2.5 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/60 focus:ring-1 focus:ring-glow-accent/20 transition-all';
function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <div className="mb-1.5"><p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">{children}</p>{hint && <p className="text-[10px] text-glow-muted/70 mt-0.5">{hint}</p>}</div>;
}
function Field({ children, className='' }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className}`}>{children}</div>;
}
function Toggle({ value, onChange }: { value:boolean; onChange:(v:boolean)=>void }) {
  return <button onClick={()=>onChange(!value)} className={`relative w-11 h-6 rounded-full transition-all ${value?'bg-glow-accent':'bg-glow-border'}`}><span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value?'translate-x-6':'translate-x-1'}`}/></button>;
}
function StatCard({ icon:Icon, label, value, sub, color }: { icon:React.ElementType; label:string; value:string|number; sub?:string; color:string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-glow-border bg-glow-card p-4">
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl" style={{background:color}}/>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:`${color}20`}}>
          <Icon className="w-4 h-4" style={{color}}/>
        </div>
        <div>
          <p className="text-[11px] text-glow-muted font-medium uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-glow-text leading-tight">{value}</p>
          {sub && <p className="text-[10px] text-glow-muted">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
function ModelRow({ model, onToggle, onEdit, onDelete }: { model:PublicModel; onToggle:()=>void; onEdit:()=>void; onDelete:()=>void }) {
  const pc = PROVIDER_COLORS[model.provider]??'#7c3aed';
  const tb = {premium:'bg-purple-500/15 text-purple-400 border-purple-500/25',fast:'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',coding:'bg-amber-500/15 text-amber-400 border-amber-500/25'}[model.tier]??'';
  return (
    <div className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${model.enabled?'border-glow-border bg-glow-card hover:border-glow-accent/30':'border-glow-border/50 bg-glow-surface/50 opacity-60'}`}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{background:pc}}>{model.provider.slice(0,1)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-glow-text">{model.name}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${tb}`}>{model.tier}</span>
          {model.context_length && <span className="text-[10px] text-glow-muted">{(model.context_length/1000).toFixed(0)}k ctx</span>}
        </div>
        <p className="text-[11px] text-glow-muted font-mono truncate mt-0.5">{model.id}</p>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-surface transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-glow-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
      </div>
      <Toggle value={model.enabled} onChange={onToggle}/>
    </div>
  );
}



const ADMIN_TABS = [
  { id:'overview' as const, label:'Overview',   icon:Activity   },
  { id:'ai'       as const, label:'AI Config',  icon:Brain      },
  { id:'models'   as const, label:'Models',     icon:Sliders    },
  { id:'prompt'   as const, label:'Prompt',     icon:FileText   },
  { id:'fees'     as const, label:'Fees',       icon:DollarSign },
  { id:'deploy'   as const, label:'Deploy',     icon:Rocket     },
  { id:'treasury' as const, label:'Treasury',   icon:Wallet     },
  { id:'users'    as const, label:'Users',      icon:Users      },
  { id:'training' as const, label:'Training',   icon:BookOpen   },
  { id:'plans'    as const, label:'Plans',      icon:CreditCard },
  { id:'website'  as const, label:'Website',    icon:Globe      },
];

type EthWin = Window & { ethereum?: { request: (a: {method: string; params?: unknown[]}) => Promise<unknown> } };

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ADMIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const { address, isConnected } = useWalletStore();

  // ── Auth ───────────────────────────────────────────────────────────────────
  const [isAuth, setIsAuth]   = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('glowide_admin_auth');
      if (stored) {
        const { wallet, ts } = JSON.parse(stored);
        if (Date.now() - ts < 7*24*60*60*1000) {
          const ok = ADMIN_WALLET ? wallet.toLowerCase() === ADMIN_WALLET : true;
          if (ok && wallet.toLowerCase() === address?.toLowerCase()) setIsAuth(true);
        } else localStorage.removeItem('glowide_admin_auth');
      }
    } catch { /**/ }
  }, [address]);

  const handleAuth = useCallback(() => {
    if (!isConnected || !address) { setAuthError('Connect your wallet first'); return; }
    if (ADMIN_WALLET && address.toLowerCase() !== ADMIN_WALLET) { setAuthError(`Unauthorized. Admin: ${ADMIN_WALLET.slice(0,10)}…`); return; }
    localStorage.setItem('glowide_admin_auth', JSON.stringify({ wallet: address.toLowerCase(), ts: Date.now() }));
    setIsAuth(true); setAuthError('');
    toast.success('Admin access granted');
  }, [isConnected, address]);

  useEffect(() => {
    if (!isConnected || !address || isAuth) return;
    if (!ADMIN_WALLET || address.toLowerCase() === ADMIN_WALLET) handleAuth();
  }, [isConnected, address, isAuth, handleAuth]);

  // ── Settings state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'overview'|'ai'|'models'|'prompt'|'fees'|'deploy'|'treasury'|'users'|'training'|'plans'|'website'>('overview');
  const [saving, setSaving]       = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyCopied, setKeyCopied]   = useState(false);
  const [models, setModels]         = useState<PublicModel[]>(DEFAULT_MODELS);
  const [editingModel, setEditingModel] = useState<PublicModel|null>(null);
  const [showNewForm, setShowNewForm]   = useState(false);
  const [newModel, setNewModel] = useState<{id:string;name:string;provider:string;tier:PublicModel['tier'];context_length:number;description:string}>({id:'',name:'',provider:'',tier:'fast',context_length:128000,description:''});

  // Data tabs state
  const [usersData, setUsersData] = useState<{users:UserPlan[];activity:Record<string,{actions:number;lastSeen:string;actions_list:string[]}>;stats:{totalUsers:number;totalDeployments:number;proUsers:number}}|null>(null);
  const [trainingExamples, setTrainingExamples] = useState<TrainingExample[]>([]);
  const [loadingUsers, setLoadingUsers]         = useState(false);
  const [loadingTraining, setLoadingTraining]   = useState(false);
  const [savingTraining, setSavingTraining]     = useState(false);
  const [treasuryBalance, setTreasuryBalance]   = useState('0');
  const [isWithdrawing, setIsWithdrawing]       = useState(false);
  const [withdrawTo, setWithdrawTo]             = useState('');
  const [testingDb, setTestingDb]               = useState(false);
  const [dbStatus, setDbStatus]                 = useState<Record<string,unknown>|null>(null);

  // Plans edit state
  const [plans, setPlans] = useState<PlanConfig[]>([
    { id:'free',       name:'Free',       price:'0',          tokens_limit:50000,   storage_mb:50,    deploys_limit:3,   ai_requests:100,  features:['3 deployments','50MB storage','100 AI requests/day'],     color:'#6b7280' },
    { id:'pro',        name:'Pro',        price:'10 USDC/mo', tokens_limit:500000,  storage_mb:500,   deploys_limit:50,  ai_requests:1000, features:['50 deployments','500MB storage','1000 AI requests/day'],   color:'#7c3aed' },
    { id:'enterprise', name:'Enterprise', price:'Custom',     tokens_limit:5000000, storage_mb:5000,  deploys_limit:500, ai_requests:10000,features:['500 deployments','5GB storage','10000 AI requests/day'],  color:'#f59e0b' },
  ]);
  const [editingPlan, setEditingPlan] = useState<PlanConfig|null>(null);

  // Deploy state
  const [deployStatuses, setDeployStatuses] = useState<Record<string,DeployStatus>>({});
  const [deployingId, setDeployingId]       = useState<string|null>(null);

  // Settings
  const [settings, setSettings] = useState({

  return null;
}
