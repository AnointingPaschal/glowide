'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWalletStore } from '@/store/walletStore';
import {
  Shield, Brain, Save, ImageIcon, Upload, Eye, EyeOff, CheckCircle, Sliders, FileText,
  Plus, Trash2, Edit2, X, Loader2, DollarSign, Percent, Zap,
  ToggleLeft, ToggleRight, RefreshCw, Copy, AlertTriangle,
  Activity, Server, Globe, Lock, Users, BookOpen, CreditCard,
  Code2, Rocket, Wallet, ArrowDownToLine, ExternalLink, TrendingUp, Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ContractArgInputs } from '@/components/admin/ContractArgInputs';
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

Expertise:
- Solidity smart contracts (ERC20, ERC721, DeFi, security patterns)
- TypeScript, React, Next.js, Node.js, Express, Python
- Arc Testnet (Chain ID 5042002), Circle assets (USDC, EURC, cirBTC)
- Web3 integration with viem/wagmi/ethers.js
- Security best practices and gas optimization
- Full-stack app architecture, REST & WebSocket APIs

Always write clean, well-commented, production-ready code.`;

const PROVIDER_COLORS: Record<string,string> = { Anthropic:'#CC785C', OpenAI:'#10A37F', Google:'#4285F4', Meta:'#0866FF', DeepSeek:'#5B5BD6', Mistral:'#FF7000' };

interface UserPlan { id:string; wallet_address:string; plan:string; tokens_used:number; tokens_limit:number; storage_used_bytes:number; storage_limit_bytes:number; deployments_used:number; deployments_limit:number; subscription_end?:string; created_at:string; }
interface TrainingExample { id:string; user_message:string; assistant_response:string; category:string; enabled:boolean; created_at:string; }

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

// ══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const { address, isConnected } = useWalletStore();

  // ── Wallet-based auth (persisted in localStorage) ──────────────────────────
  const [isAuth, setIsAuth]   = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    // Restore session from localStorage
    try {
      const stored = localStorage.getItem('glowide_admin_auth');
      if (stored) {
        const { wallet, ts } = JSON.parse(stored);
        const age = Date.now() - ts;
        if (age < 7 * 24 * 60 * 60 * 1000) { // 7-day session
          const ok = ADMIN_WALLET ? wallet.toLowerCase() === ADMIN_WALLET : true;
          if (ok && wallet.toLowerCase() === address?.toLowerCase()) setIsAuth(true);
        } else { localStorage.removeItem('glowide_admin_auth'); }
      }
    } catch { /* ignore */ }
  }, [address]);

  const handleAuth = useCallback(() => {
    if (!isConnected || !address) { setAuthError('Connect your wallet first'); return; }
    const wallet = address.toLowerCase();
    if (ADMIN_WALLET && wallet !== ADMIN_WALLET) {
      setAuthError(`Unauthorized wallet. Admin address: ${ADMIN_WALLET.slice(0,10)}...`);
      return;
    }
    localStorage.setItem('glowide_admin_auth', JSON.stringify({ wallet, ts: Date.now() }));
    setIsAuth(true);
    setAuthError('');
    toast.success('Admin access granted');
  }, [isConnected, address]);

  const handleLogout = () => {
    localStorage.removeItem('glowide_admin_auth');
    setIsAuth(false);
  };

  // Also auto-auth if wallet matches and already connected
  useEffect(() => {
    if (!isConnected || !address || isAuth) return;
    const ok = !ADMIN_WALLET || address.toLowerCase() === ADMIN_WALLET;
    if (ok) handleAuth();
  }, [isConnected, address, isAuth, handleAuth]);

  // ── Settings state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'overview'|'ai'|'models'|'prompt'|'fees'|'deploy'|'treasury'|'users'|'training'|'plans'|'website'>('overview');
  const [saving, setSaving]       = useState(false);
  const [testingDb, setTestingDb] = useState(false);
  const [dbStatus, setDbStatus]   = useState<Record<string,unknown> | null>(null);

  const testDbConnection = async () => {
    setTestingDb(true);
    setDbStatus(null);
    try {
      const res = await fetch('/api/admin/debug', { headers: { authorization: `Wallet ${address}` } });
      const data = await res.json();
      setDbStatus(data);
      const hasErrors = Object.values(data).some(v => typeof v === 'object' && v !== null && 'error' in v);
      if (hasErrors) toast.error('DB has issues — see status below');
      else toast.success('Database connection OK');
    } catch (err) {
      setDbStatus({ exception: String(err) });
      toast.error('Connection test failed');
    } finally { setTestingDb(false); }
  };
  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels]       = useState<PublicModel[]>(DEFAULT_MODELS);
  const [editingModel, setEditingModel] = useState<PublicModel|null>(null);
  const [showNewForm, setShowNewForm]   = useState(false);
  const [newModel, setNewModel] = useState<{id:string;name:string;provider:string;tier:PublicModel['tier'];context_length:number;description:string}>({id:'',name:'',provider:'',tier:'fast',context_length:128000,description:''});
  const [usersData, setUsersData] = useState<{
    users:UserPlan[];
    activity:Record<string,{actions:number;lastSeen:string;actions_list:string[]}>;
    transactions:Record<string,unknown>[];
    walletBalances:Record<string,unknown>[];
    walletConnections:Record<string,unknown>[];
    stats:{totalUsers:number;totalDeployments:number;proUsers:number;totalConnections:number;totalTransactions:number};
  }|null>(null);
  const [trainingExamples, setTrainingExamples] = useState<TrainingExample[]>([]);
  const [loadingUsers, setLoadingUsers]         = useState(false);
  const [loadingTraining, setLoadingTraining]   = useState(false);
  const [savingTraining, setSavingTraining]     = useState(false);
  const [treasuryBalance, setTreasuryBalance]   = useState('0');
  const [withdrawTo, setWithdrawTo]             = useState('');
  const [withdrawAmt, setWithdrawAmt]           = useState('');
  const [editingPlan, setEditingPlan] = useState<null|{id:string;name:string;price:string;tokens:number;storage:number;deploys:number;ai:number;features:string;color:string}>(null);
  const [isWithdrawing, setIsWithdrawing]       = useState(false);
  const [deployingContract, setDeployingContract] = useState<string|null>(null);
  const [contractBuildStatus, setContractBuildStatus] = useState<Record<string,{
    compiling?:boolean; compiled?:boolean; deploying?:boolean;
    deployed?:boolean; address?:string; txHash?:string; error?:string;
  }>>({});

  const [settings, setSettings] = useState({
    openrouterKey:'', defaultModel:'anthropic/claude-sonnet-4-5',
    temperature:0.7, maxTokens:4096, systemPrompt:DEFAULT_SYSTEM_PROMPT,
    rateLimitPerUser:100, deploymentFee:'0', feeRecipient:'',
    deploymentFeePercent:'0', freeDeployments:'3',
    verificationFee:'0', launchpadFee:'0', feesEnabled:false,
    treasuryAddress:'', launchpadFactory:'', adminWallet: address ?? '',
  });
  const [siteSettings, setSiteSettings] = useState({
    siteName:'GlowIDE', siteTagline:'AI-Powered Web3 IDE', siteDescription:'Build smarter on Web3',
    logoUrl:'', primaryColor:'#7c3aed',
    usdcLogoUrl:'https://www.circle.com/hubfs/USDC/USDC_icon_1.svg',
    eurcLogoUrl:'https://www.circle.com/hubfs/EURC/EURC_icon.svg',
    cirBTCLogoUrl:'https://cryptologos.cc/logos/bitcoin-btc-logo.svg',
  });

  // Auth header for API calls
  const authHeader = useCallback(() => ({
    'Content-Type': 'application/json',
    authorization: `Wallet ${address ?? ''}`,
  }), [address]);

  // Load settings on auth
  useEffect(() => {
    if (!isAuth) return;
    fetch('/api/admin/settings', { headers: { authorization: `Wallet ${address}` } })
      .then(r => r.json())
      .then(d => {
        const m = Object.fromEntries((d.settings ?? []).map((x: {key:string;value:string}) => [x.key, x.value]));
        setSettings(p => ({
          ...p,
          ...(m.openrouter_api_key        && {openrouterKey:       m.openrouter_api_key}),
          ...(m.default_model             && {defaultModel:        m.default_model}),
          ...(m.temperature               && {temperature:         parseFloat(m.temperature)}),
          ...(m.max_tokens                && {maxTokens:           parseInt(m.max_tokens)}),
          ...(m.system_prompt             && {systemPrompt:        m.system_prompt}),
          ...(m.deployment_fee            && {deploymentFee:       m.deployment_fee}),
          ...(m.fee_recipient             && {feeRecipient:        m.fee_recipient}),
          ...(m.deployment_fee_percent    && {deploymentFeePercent:m.deployment_fee_percent}),
          ...(m.free_deployments          && {freeDeployments:     m.free_deployments}),
          ...(m.verification_fee          && {verificationFee:     m.verification_fee}),
          ...(m.launchpad_fee              && {launchpadFee:         m.launchpad_fee}),
          ...(m.fees_enabled              && {feesEnabled:         m.fees_enabled==='true'}),
          ...(m.treasury_address          && {treasuryAddress:     m.treasury_address}),
          ...(m.launchpad_factory         && {launchpadFactory:    m.launchpad_factory}),
          ...(m.admin_wallet              && {adminWallet:         m.admin_wallet}),
        }));
        if (m.site_name)        setSiteSettings(p => ({...p, siteName:       m.site_name}));
        if (m.site_tagline)     setSiteSettings(p => ({...p, siteTagline:    m.site_tagline}));
        if (m.site_description) setSiteSettings(p => ({...p, siteDescription:m.site_description}));
        if (m.logo_url)         setSiteSettings(p => ({...p, logoUrl:        m.logo_url}));
        if (m.primary_color)    setSiteSettings(p => ({...p, primaryColor:   m.primary_color}));
        if (m.available_models) try { setModels(JSON.parse(m.available_models)); } catch { /* use defaults */ }
      }).catch(err => console.error('Failed to load settings:', err));
  }, [isAuth, address]);

  // Load users
  useEffect(() => {
    if (!isAuth || activeTab !== 'users') return;
    setLoadingUsers(true);
    fetch('/api/admin/users', { headers: { authorization: `Wallet ${address}` } })
      .then(r => r.json()).then(d => setUsersData(d)).catch(()=>{}).finally(()=>setLoadingUsers(false));
  }, [isAuth, activeTab, address]);

  // Load training
  useEffect(() => {
    if (!isAuth || activeTab !== 'training') return;
    setLoadingTraining(true);
    fetch('/api/admin/training', { headers: { authorization: `Wallet ${address}` } })
      .then(r => r.json()).then(d => { if (d.examples) setTrainingExamples(d.examples); }).catch(()=>{}).finally(()=>setLoadingTraining(false));
  }, [isAuth, activeTab, address]);

  // Load treasury balance
  useEffect(() => {
    if (!isAuth || activeTab !== 'treasury' || !settings.treasuryAddress) return;
    fetch(`/api/treasury?contract=${settings.treasuryAddress}`)
      .then(r => r.json()).then(d => setTreasuryBalance(d.balance ?? '0')).catch(()=>{});
  }, [isAuth, activeTab, settings.treasuryAddress]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string,string> = {
        openrouter_api_key:      settings.openrouterKey,
        default_model:           settings.defaultModel,
        temperature:             String(settings.temperature),
        max_tokens:              String(settings.maxTokens),
        system_prompt:           settings.systemPrompt,
        available_models:        JSON.stringify(models),
        deployment_fee:          settings.deploymentFee,
        fee_recipient:           settings.feeRecipient,
        deployment_fee_percent:  settings.deploymentFeePercent,
        free_deployments:        settings.freeDeployments,
        launchpad_fee:           settings.launchpadFee,
        verification_fee:        settings.verificationFee,
        fees_enabled:            String(settings.feesEnabled),
        treasury_address:         settings.treasuryAddress,
        launchpad_factory:        settings.launchpadFactory || '',
        // treasury_address already set above
        //         settings.treasuryAddress,
        admin_wallet:            settings.adminWallet || address || '',
        rate_limit_per_user:     String(settings.rateLimitPerUser),
        site_name:               siteSettings.siteName,
        site_tagline:            siteSettings.siteTagline,
        site_description:        siteSettings.siteDescription,
        logo_url:                siteSettings.logoUrl,
        primary_color:           siteSettings.primaryColor,
      };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ settings: payload }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(data.error ?? `Save failed (${res.status})`);
      if (data.saved === 0 && data.errors?.length) {
        // Nothing saved - show first error detail
        const firstErr = data.errors?.[0] ?? 'Unknown error';
        throw new Error(`Nothing saved. First error: ${firstErr}`);
      }
      if (data.errors?.length) {
        toast.error(`Partially saved (${data.saved}/${data.saved + data.errors.length}). Check console.`);
        console.error('[admin save] errors:', data.errors);
      } else {
        toast.success(`Saved ${data.saved} settings ✓`);
      }
    } catch (err) {
      toast.error('Save failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally { setSaving(false); }
  };

  // Treasury withdraw
  const handleWithdraw = async () => {
    if (!withdrawTo || !settings.treasuryAddress) return;
    const provider = (window as Window & {ethereum?:{request:(a:{method:string;params?:unknown[]})=>Promise<unknown>}}).ethereum;
    if (!provider || !address) { toast.error('Connect wallet first'); return; }
    setIsWithdrawing(true);
    try {
      const to = withdrawTo.trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error('Invalid address');
      // Call withdrawAll(address) — selector: keccak4("withdrawAll(address)") = 0x6b6b9e76
      const paddedTo = to.slice(2).padStart(64, '0');
      const data = '0x6b6b9e76' + paddedTo;
      const txHash = await provider.request({ method:'eth_sendTransaction', params:[{ from:address, to:settings.treasuryAddress, data }] }) as string;
      toast.success(`Withdrawal sent: ${txHash.slice(0,18)}…`);
    } catch (err) {
      toast.error((err as Error).message.slice(0, 80));
    } finally { setIsWithdrawing(false); }
  };

  // Models helpers
  const addModel = () => {
    if (!newModel.id || !newModel.name) { toast.error('ID and name required'); return; }
    if (models.find(m => m.id === newModel.id)) { toast.error('Model ID exists'); return; }
    setModels(m => [...m, { ...newModel, enabled:true }]);
    setNewModel({id:'',name:'',provider:'',tier:'fast',context_length:128000,description:''});
    setShowNewForm(false);
    toast.success('Model added');
  };

  // ── Not connected ──────────────────────────────────────────────────────────
  // ── Deploy platform contract ──────────────────────────────────────────
  const deployContract = async (contractId: string, constructorArgs: string[]) => {
    if (!isConnected || !address) { toast.error('Connect admin wallet'); return; }
    const provider = (window as Window & {ethereum?:{request:(a:{method:string;params?:unknown[]})=>Promise<unknown>}}).ethereum;
    if (!provider) { toast.error('No wallet provider'); return; }

    setDeployingContract(contractId);
    setContractBuildStatus(p => ({ ...p, [contractId]: { compiling:true } }));

    try {
      // Compile
      const compRes = await fetch('/api/admin/deploy-contract', {
        method:'POST', headers:{'Content-Type':'application/json', authorization:`Wallet ${address}`},
        body:JSON.stringify({ contractName: contractId }),
      });
      const compiled = await compRes.json();
      if (!compiled.success) throw new Error(compiled.errors?.[0]?.message ?? 'Compile failed');
      setContractBuildStatus(p => ({ ...p, [contractId]: { ...p[contractId], compiling:false, compiled:true, deploying:true } }));

      // Encode args
      let constructorHex = '';
      for (const v of constructorArgs) {
        if (/^0x[0-9a-fA-F]{40}$/.test(v)) {
          constructorHex += v.replace(/^0x/i,'').toLowerCase().padStart(64,'0');
        } else {
          try { constructorHex += BigInt(v||'0').toString(16).padStart(64,'0'); }
          catch { constructorHex += '0'.padStart(64,'0'); }
        }
      }
      const deployData = compiled.bytecode + constructorHex;

      // Gas estimate
      let gasLimit = '0x989680';
      try {
        const g = await provider.request({ method:'eth_estimateGas', params:[{from:address,data:deployData}] }) as string;
        gasLimit = '0x' + Math.ceil(parseInt(g,16)*1.3).toString(16);
      } catch { /* use default */ }

      // Deploy
      const txHash = await provider.request({ method:'eth_sendTransaction', params:[{from:address,data:deployData,gas:gasLimit}] }) as string;

      // Wait for receipt
      let contractAddress = '';
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 2500));
        const receipt = await provider.request({ method:'eth_getTransactionReceipt', params:[txHash] }).catch(()=>null) as {contractAddress?:string;status?:string}|null;
        if (receipt) {
          if (receipt.status === '0x0') throw new Error('Transaction reverted');
          contractAddress = receipt.contractAddress ?? '';
          break;
        }
      }
      if (!contractAddress) throw new Error('Timed out waiting for confirmation');

      // Auto-save
      await fetch('/api/admin/deploy-contract', {
        method:'PATCH', headers:{'Content-Type':'application/json', authorization:`Wallet ${address}`},
        body:JSON.stringify({ contractName:contractId, contractAddress, txHash, deployer:address, abi:compiled.abi, bytecode:compiled.bytecode }),
      });

      if (contractId === 'GlowIDETreasury') setSettings(p => ({...p, treasuryAddress: contractAddress}));
      if (contractId === 'GlowLaunchpad')   setSettings(p => ({...p, launchpadFactory: contractAddress}));

      setContractBuildStatus(p => ({ ...p, [contractId]: { compiled:true, deployed:true, address:contractAddress, txHash } }));
      toast.success(`${contractId} deployed + saved!`);
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0,120);
      setContractBuildStatus(p => ({ ...p, [contractId]: { error:msg } }));
      toast.error(msg.slice(0,80));
    } finally { setDeployingContract(null); }
  };


  if (!isConnected) {
    return (
      <AppLayout title="Admin">
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="w-full max-w-sm text-center space-y-5">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-glow-gradient items-center justify-center shadow-glow-lg">
              <Shield className="w-8 h-8 text-white"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-glow-text">GlowIDE Admin</h1>
              <p className="text-sm text-glow-muted mt-1">Connect the admin wallet to access the control panel</p>
              {ADMIN_WALLET && <p className="text-xs text-glow-muted/60 mt-2 font-mono">{ADMIN_WALLET.slice(0,10)}…{ADMIN_WALLET.slice(-6)}</p>}
            </div>
            <div className="bg-glow-card border border-glow-border rounded-2xl p-6 flex flex-col items-center gap-4">
              <Wallet className="w-10 h-10 text-glow-accent/50"/>
              <p className="text-sm text-glow-muted">Use the <strong className="text-glow-text">Connect</strong> button in the top bar to connect your admin wallet</p>
              {authError && <p className="text-xs text-red-400">{authError}</p>}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Connected but not admin ────────────────────────────────────────────────
  if (!isAuth) {
    return (
      <AppLayout title="Admin">
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="w-full max-w-sm text-center space-y-5">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-red-500/20 items-center justify-center">
              <Lock className="w-8 h-8 text-red-400"/>
            </div>
            <h2 className="text-xl font-bold text-glow-text">Access Restricted</h2>
            <p className="text-sm text-glow-muted">Connected: <span className="font-mono text-glow-text">{address?.slice(0,10)}…</span></p>
            {ADMIN_WALLET && <p className="text-xs text-amber-400">Admin wallet: {ADMIN_WALLET.slice(0,10)}…{ADMIN_WALLET.slice(-6)}</p>}
            {authError && <p className="text-xs text-red-400">{authError}</p>}
            {!ADMIN_WALLET && <button onClick={handleAuth} className="px-6 py-2.5 bg-glow-accent text-white text-sm font-semibold rounded-xl hover:bg-glow-accent/90 transition-colors">Access Admin (Dev Mode)</button>}
          </div>
        </div>
      </AppLayout>
    );
  }

  const enabledModels = models.filter(m => m.enabled).length;
  const hasFee = parseFloat(settings.deploymentFee) > 0;
  const formattedBalance = (parseFloat(treasuryBalance) / 1e6).toFixed(6);

  const TABS = [
    { id:'overview',  label:'Overview',    icon:Activity   },
    { id:'ai',        label:'AI Config',   icon:Brain      },
    { id:'models',    label:'Models',      icon:Sliders    },
    { id:'prompt',    label:'Prompt',      icon:FileText   },
    { id:'fees',      label:'Fees',        icon:DollarSign },
    { id:'deploy',    label:'Deploy',      icon:Rocket     },
    { id:'treasury',  label:'Treasury',    icon:Wallet     },
    { id:'users',     label:'Users',       icon:Users      },
    { id:'training',  label:'Training',    icon:BookOpen   },
    { id:'plans',     label:'Plans',       icon:CreditCard },
    { id:'website',   label:'Website',     icon:Globe      },
  ] as const;

  return (
    <AppLayout title="Admin Panel">
      <div className="min-h-full bg-glow-bg">
        {/* Header */}
        <div className="border-b border-glow-border bg-glow-surface/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 md:px-6 flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-glow-gradient flex items-center justify-center shadow-glow-sm"><Shield className="w-4 h-4 text-white"/></div>
              <div><h1 className="text-sm font-bold text-glow-text">Admin Panel</h1><p className="text-[10px] text-glow-muted font-mono">{address?.slice(0,10)}…</p></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>Admin
              </span>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-accent hover:bg-glow-accent/90 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 shadow-glow-sm">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Save className="w-3.5 h-3.5"/>}
                {saving ? 'Saving…' : 'Save All'}
              </button>
              <button onClick={handleLogout} className="text-xs text-glow-muted hover:text-red-400 transition-colors">Log out</button>
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-4 md:px-6 flex gap-1 overflow-x-auto pb-px">
            {TABS.map(t => (
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${activeTab===t.id?'border-glow-accent text-glow-accent-light':'border-transparent text-glow-muted hover:text-glow-text'}`}>
                <t.icon className="w-3.5 h-3.5"/>{t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Sliders}    label="Models"     value={enabledModels}  sub={`of ${models.length} enabled`} color="#7c3aed"/>
                <StatCard icon={DollarSign} label="Deploy Fee" value={hasFee?`${settings.deploymentFee} USDC`:'Free'} sub={settings.feesEnabled?'Active':'Disabled'} color="#10b981"/>
                <StatCard icon={Activity}   label="Rate Limit" value={settings.rateLimitPerUser} sub="req/user/day" color="#06b6d4"/>
                <StatCard icon={Wallet}     label="Treasury"   value={`${formattedBalance} USDC`} sub={settings.treasuryAddress?'Configured':'Not set'} color="#f59e0b"/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2"><Brain className="w-4 h-4 text-glow-accent"/><span className="text-sm font-semibold text-glow-text">AI Configuration</span></div>
                  {[['API Key', settings.openrouterKey ? '••••'+settings.openrouterKey.slice(-4) : 'Not set', !settings.openrouterKey],
                    ['Default Model', models.find(m=>m.id===settings.defaultModel)?.name??settings.defaultModel, false],
                    ['Temperature', String(settings.temperature), false]].map(([k,v,warn]) => (
                    <div key={k as string} className="flex items-center justify-between text-sm">
                      <span className="text-glow-muted">{k as string}</span>
                      <span className={warn ? 'text-amber-400 flex items-center gap-1' : 'text-glow-text font-mono'}>
                        {warn && <AlertTriangle className="w-3 h-3"/>}{v as string}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-glow-cyan"/><span className="text-sm font-semibold text-glow-text">Platform</span></div>
                  {[['Site Name', siteSettings.siteName],['Network','Arc Testnet'],['Chain ID','5042002'],['Treasury', settings.treasuryAddress?settings.treasuryAddress.slice(0,12)+'…':'Not configured']].map(([k,v]) => (
                    <div key={k} className="flex items-center justify-between text-sm"><span className="text-glow-muted">{k}</span><span className="text-glow-text font-mono text-xs">{v}</span></div>
                  ))}
                </div>
              </div>
              {!settings.openrouterKey && (
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"/>
                  <p className="text-sm text-amber-300">OpenRouter API key not configured. AI chat will not work until you add it in <button onClick={()=>setActiveTab('ai')} className="underline">AI Config</button>.</p>
                </div>
              )}

              {/* Database connection tester */}
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Server className="w-4 h-4 text-glow-cyan"/><span className="text-sm font-semibold text-glow-text">Database Connection</span></div>
                  <div className="flex gap-2">
                    <button onClick={testDbConnection} disabled={testingDb}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-glow-surface border border-glow-border rounded-lg text-glow-muted hover:text-glow-text disabled:opacity-50 transition-colors">
                      {testingDb ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RefreshCw className="w-3.5 h-3.5"/>}
                      Test DB
                    </button>
                    <a href="/api/admin/env-check" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-glow-surface border border-glow-border rounded-lg text-glow-muted hover:text-glow-text transition-colors">
                      Check Env Vars ↗
                    </a>
                  </div>
                </div>
                <p className="text-xs text-glow-muted">If Save All shows errors, run this to diagnose Supabase connectivity. Also run the SQL in <code className="text-glow-accent">supabase/schema.sql</code> to fix RLS.</p>
                {dbStatus && (
                  <div className="bg-glow-bg border border-glow-border rounded-xl p-3 space-y-1.5 max-h-48 overflow-y-auto">
                    {Object.entries(dbStatus).map(([k, v]) => {
                      const isErr = typeof v === 'object' && v !== null && 'error' in v;
                      return (
                        <div key={k} className="flex items-start gap-2 text-xs">
                          <span className={isErr ? 'text-red-400' : 'text-emerald-400'} style={{minWidth:'12px'}}>{isErr ? '✗' : '✓'}</span>
                          <span className="text-glow-muted font-mono">{k}:</span>
                          <span className={isErr ? 'text-red-300' : 'text-glow-text'}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI CONFIG */}
          {activeTab === 'ai' && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1"><Server className="w-4 h-4 text-glow-accent"/><span className="text-sm font-semibold text-glow-text">OpenRouter API</span></div>
                <Field>
                  <Label hint="Get your key at openrouter.ai/keys">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input type={showApiKey?'text':'password'} value={settings.openrouterKey} onChange={e=>setSettings(p=>({...p,openrouterKey:e.target.value}))} placeholder="sk-or-v1-…" className={`${inputCls} pr-10 font-mono`}/>
                      <button onClick={()=>setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-glow-muted hover:text-glow-text">
                        {showApiKey?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>
                  {settings.openrouterKey && <p className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/>API key configured</p>}
                </Field>
                <Field>
                  <Label>Default Model</Label>
                  <select value={settings.defaultModel} onChange={e=>setSettings(p=>({...p,defaultModel:e.target.value}))} className={inputCls}>
                    {['premium','fast','coding'].map(tier=>{
                      const tm = models.filter(m=>m.tier===tier&&m.enabled);
                      if(!tm.length) return null;
                      return <optgroup key={tier} label={tier.charAt(0).toUpperCase()+tier.slice(1)}>{tm.map(m=><option key={m.id} value={m.id}>{m.name} — {m.provider}</option>)}</optgroup>;
                    })}
                  </select>
                </Field>
              </div>
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-5">
                <div className="flex items-center gap-2 mb-1"><Zap className="w-4 h-4 text-glow-cyan"/><span className="text-sm font-semibold text-glow-text">Generation Parameters</span></div>
                <Field>
                  <div className="flex items-center justify-between mb-2"><Label>Temperature</Label><span className="text-sm font-bold text-glow-accent font-mono">{settings.temperature}</span></div>
                  <input type="range" min="0" max="1" step="0.05" value={settings.temperature} onChange={e=>setSettings(p=>({...p,temperature:parseFloat(e.target.value)}))} className="w-full h-1.5 appearance-none bg-glow-border rounded-full accent-glow-accent cursor-pointer"/>
                  <div className="flex justify-between text-[10px] text-glow-muted mt-1"><span>🎯 Precise</span><span>🎨 Creative</span></div>
                </Field>
                <Field>
                  <div className="flex items-center justify-between mb-2"><Label>Max Output Tokens</Label><span className="text-sm font-bold text-glow-accent font-mono">{settings.maxTokens.toLocaleString()}</span></div>
                  <input type="range" min="512" max="8192" step="256" value={settings.maxTokens} onChange={e=>setSettings(p=>({...p,maxTokens:parseInt(e.target.value)}))} className="w-full h-1.5 appearance-none bg-glow-border rounded-full accent-glow-accent cursor-pointer"/>
                </Field>
                <Field><Label hint="Max AI requests per user per 24h">Rate Limit (req/user/24h)</Label><input type="number" min="1" value={settings.rateLimitPerUser} onChange={e=>setSettings(p=>({...p,rateLimitPerUser:parseInt(e.target.value)||100}))} className={inputCls}/></Field>
              </div>
            </div>
          )}

          {/* MODELS */}
          {activeTab === 'models' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div><h2 className="text-base font-semibold text-glow-text">Available Models</h2><p className="text-xs text-glow-muted mt-0.5">{enabledModels} of {models.length} enabled</p></div>
                <button onClick={()=>setShowNewForm(!showNewForm)} className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light text-xs font-medium rounded-lg hover:bg-glow-accent/25 transition-colors"><Plus className="w-3.5 h-3.5"/>Add Model</button>
              </div>
              {showNewForm && (
                <div className="bg-glow-card border border-glow-accent/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-glow-text">New Model</span><button onClick={()=>setShowNewForm(false)} className="text-glow-muted hover:text-glow-text"><X className="w-4 h-4"/></button></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field><Label>Model ID (OpenRouter)</Label><input value={newModel.id} onChange={e=>setNewModel(p=>({...p,id:e.target.value}))} placeholder="provider/model-name" className={`${inputCls} font-mono`}/></Field>
                    <Field><Label>Display Name</Label><input value={newModel.name} onChange={e=>setNewModel(p=>({...p,name:e.target.value}))} placeholder="GPT-4o" className={inputCls}/></Field>
                    <Field><Label>Provider</Label><input value={newModel.provider} onChange={e=>setNewModel(p=>({...p,provider:e.target.value}))} placeholder="OpenAI" className={inputCls}/></Field>
                    <Field><Label>Tier</Label><select value={newModel.tier} onChange={e=>setNewModel(p=>({...p,tier:e.target.value as PublicModel['tier']}))} className={inputCls}><option value="premium">⭐ Premium</option><option value="fast">⚡ Fast</option><option value="coding">💻 Coding</option></select></Field>
                    <Field><Label>Context Length</Label><input type="number" value={newModel.context_length} onChange={e=>setNewModel(p=>({...p,context_length:parseInt(e.target.value)||128000}))} className={inputCls}/></Field>
                    <Field><Label>Description</Label><input value={newModel.description} onChange={e=>setNewModel(p=>({...p,description:e.target.value}))} placeholder="Short description" className={inputCls}/></Field>
                  </div>
                  <div className="flex gap-2 justify-end"><button onClick={()=>setShowNewForm(false)} className="px-4 py-2 text-sm text-glow-muted border border-glow-border rounded-lg">Cancel</button><button onClick={addModel} className="px-4 py-2 text-sm font-medium bg-glow-accent text-white rounded-lg hover:bg-glow-accent/90">Add Model</button></div>
                </div>
              )}
              {editingModel && (
                <div className="bg-glow-card border border-glow-accent/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-glow-text">Edit: {editingModel.name}</span><button onClick={()=>setEditingModel(null)} className="text-glow-muted hover:text-glow-text"><X className="w-4 h-4"/></button></div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field><Label>Name</Label><input value={editingModel.name} onChange={e=>setEditingModel(p=>p?{...p,name:e.target.value}:p)} className={inputCls}/></Field>
                    <Field><Label>Provider</Label><input value={editingModel.provider} onChange={e=>setEditingModel(p=>p?{...p,provider:e.target.value}:p)} className={inputCls}/></Field>
                    <Field><Label>Description</Label><input value={editingModel.description??''} onChange={e=>setEditingModel(p=>p?{...p,description:e.target.value}:p)} className={inputCls}/></Field>
                    <Field><Label>Context</Label><input type="number" value={editingModel.context_length??128000} onChange={e=>setEditingModel(p=>p?{...p,context_length:parseInt(e.target.value)}:p)} className={inputCls}/></Field>
                    <Field><Label>Tier</Label><select value={editingModel.tier} onChange={e=>setEditingModel(p=>p?{...p,tier:e.target.value as PublicModel['tier']}:p)} className={inputCls}><option value="premium">⭐ Premium</option><option value="fast">⚡ Fast</option><option value="coding">💻 Coding</option></select></Field>
                  </div>
                  <div className="flex gap-2 justify-end"><button onClick={()=>setEditingModel(null)} className="px-4 py-2 text-sm text-glow-muted border border-glow-border rounded-lg">Cancel</button><button onClick={()=>{setModels(m=>m.map(x=>x.id===editingModel!.id?editingModel!:x));setEditingModel(null);toast.success('Model updated');}} className="px-4 py-2 text-sm font-medium bg-glow-accent text-white rounded-lg"><CheckCircle className="w-3.5 h-3.5 inline mr-1"/>Save</button></div>
                </div>
              )}
              {(['premium','fast','coding'] as const).map(tier=>{
                const tm=models.filter(m=>m.tier===tier); if(!tm.length) return null;
                const tc={premium:{label:'⭐ Premium',color:'#a855f7'},fast:{label:'⚡ Fast',color:'#06b6d4'},coding:{label:'💻 Coding',color:'#f59e0b'}}[tier];
                return <div key={tier} className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider px-1" style={{color:tc.color}}>{tc.label}</p>{tm.map(m=><ModelRow key={m.id} model={m} onToggle={async ()=>{
                  const updated = models.map(x=>x.id===m.id?{...x,enabled:!x.enabled}:x);
                  setModels(updated);
                  await fetch('/api/models', {method:'POST', headers:{'Content-Type':'application/json',authorization:`Wallet ${address}`}, body:JSON.stringify({models:updated})}).catch(()=>{});
                  toast.success('Model ' + (models.find(x=>x.id===m.id)?.enabled ? 'disabled' : 'enabled'));
                }} onEdit={()=>setEditingModel(m)} onDelete={()=>{setModels(ms=>ms.filter(x=>x.id!==m.id));toast.success('Removed');}}/>)}</div>;
              })}
            </div>
          )}

          {/* PROMPT */}
          {activeTab === 'prompt' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div><h2 className="text-base font-semibold text-glow-text">System Prompt</h2><p className="text-xs text-glow-muted mt-0.5">Defines AI personality for all users</p></div>
                <button onClick={()=>{setSettings(p=>({...p,systemPrompt:DEFAULT_SYSTEM_PROMPT}));toast.success('Reset to default');}} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-glow-muted border border-glow-border rounded-lg hover:bg-glow-card"><RefreshCw className="w-3 h-3"/>Reset</button>
              </div>
              <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-glow-border bg-glow-surface/50">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500/60"/><span className="w-2.5 h-2.5 rounded-full bg-amber-500/60"/><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60"/></div>
                  <span className="text-[11px] text-glow-muted font-mono">system_prompt.txt</span>
                  <span className="text-[11px] text-glow-muted">{settings.systemPrompt.length} chars</span>
                </div>
                <textarea rows={18} value={settings.systemPrompt} onChange={e=>setSettings(p=>({...p,systemPrompt:e.target.value}))} className="w-full bg-transparent px-4 py-3 text-sm text-glow-text font-mono resize-none focus:outline-none leading-relaxed" spellCheck={false}/>
              </div>
            </div>
          )}

          {/* FEES */}
          {activeTab === 'fees' && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5">
                <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-glow-text">Enable Deployment Fees</h3><p className="text-xs text-glow-muted mt-0.5">Charge users USDC when deploying contracts</p></div><Toggle value={settings.feesEnabled} onChange={v=>setSettings(p=>({...p,feesEnabled:v}))}/></div>
                {settings.feesEnabled && <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"/><p className="text-xs text-emerald-300">Fees are active.</p></div>}
              </div>
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-glow-accent"/><span className="text-sm font-semibold text-glow-text">Fee Structure</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field><Label hint="Fixed USDC per deployment">Deployment Fee (USDC)</Label><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-glow-muted">$</span><input type="number" min="0" step="0.01" value={settings.deploymentFee} onChange={e=>setSettings(p=>({...p,deploymentFee:e.target.value}))} className={`${inputCls} pl-7`} placeholder="0.00"/></div></Field>
                  <Field><Label>Gas Fee Surcharge (%)</Label><div className="relative"><Percent className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-glow-muted"/><input type="number" min="0" max="100" step="0.1" value={settings.deploymentFeePercent} onChange={e=>setSettings(p=>({...p,deploymentFeePercent:e.target.value}))} className={`${inputCls} pr-9`} placeholder="0"/></div></Field>
                  <Field><Label hint="Free deployments before charging">Free Tier (deploys/user)</Label><input type="number" min="0" value={settings.freeDeployments} onChange={e=>setSettings(p=>({...p,freeDeployments:e.target.value}))} className={inputCls}/></Field>
                  <Field><Label>Verification Fee (USDC)</Label><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-glow-muted">$</span><input type="number" min="0" step="0.01" value={settings.verificationFee} onChange={e=>setSettings(p=>({...p,verificationFee:e.target.value}))} className={`${inputCls} pl-7`} placeholder="0.00"/></div></Field>
                </div>
              </div>
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-4">
                <Field><Label hint="All fees sent to this address (can be treasury contract)">Fee Recipient Address</Label><input type="text" value={settings.feeRecipient} onChange={e=>setSettings(p=>({...p,feeRecipient:e.target.value}))} placeholder="0x…" className={`${inputCls} font-mono`}/>{settings.feeRecipient && !/^0x[0-9a-fA-F]{40}$/.test(settings.feeRecipient) && <p className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Invalid address</p>}</Field>
              </div>
            </div>
          )}

          {/* TREASURY */}
          {/* ── DEPLOY ──────────────────────────────────────────────── */}
          {activeTab === 'deploy' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-base font-semibold text-glow-text">Deploy Platform Contracts</h2>
                <p className="text-xs text-glow-muted mt-0.5">Compile and deploy directly — addresses auto-saved to database</p>
              </div>

              {!isConnected && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0"/>
                  <p className="text-xs text-amber-400">Connect your admin wallet to deploy contracts</p>
                </div>
              )}

              <ContractArgInputs
                cid="GlowIDETreasury"
                title="GlowIDE Treasury"
                description="Collects all platform fees. Admin-only withdrawal on Arc Testnet."
                color="#10b981"
                labels={['admin_ (your wallet address)']}
                defaults={[address ?? '']}
                currentAddress={settings.treasuryAddress}
                onDeploy={deployContract}
                deployingId={deployingContract}
                status={contractBuildStatus['GlowIDETreasury'] ?? {}}
                isConnected={isConnected}
                onSaveAddress={(val) => setSettings(p => ({...p, treasuryAddress: val}))}
              />

              <ContractArgInputs
                cid="GlowLaunchpad"
                title="GlowIDE Launchpad Factory"
                description="Token launch factory with LP locking. Powers the Launchpad page."
                color="#7c3aed"
                labels={['admin_ (your wallet)','dexRouter_ (0x00…0 if no DEX)','launchFee_ (wei, 0=free)','feeRecipient_']}
                defaults={[address ?? '', '0x0000000000000000000000000000000000000000', '0', address ?? '']}
                currentAddress={settings.launchpadFactory ?? ''}
                onDeploy={deployContract}
                deployingId={deployingContract}
                status={contractBuildStatus['GlowLaunchpad'] ?? {}}
                isConnected={isConnected}
                onSaveAddress={(val) => setSettings(p => ({...p, launchpadFactory: val}))}
              />
            </div>
          )}

                    {activeTab === 'treasury' && (
            <div className="space-y-5 animate-fade-in">
              <div><h2 className="text-base font-semibold text-glow-text">Treasury</h2><p className="text-xs text-glow-muted mt-0.5">Platform fee collection — GlowIDETreasury.sol on Arc Testnet</p></div>

              {/* Contract addresses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {label:'Treasury Contract', key:'treasuryAddress' as const, val:settings.treasuryAddress, color:'#10b981', desc:'Collects platform fees'},
                  {label:'Launchpad Factory',  key:'launchpadFactory' as const, val:settings.launchpadFactory||'', color:'#7c3aed', desc:'Token launch factory'},
                ].map(c=>(
                  <div key={c.key} className="bg-glow-card border border-glow-border rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-glow-text">{c.label}</p>
                      {c.val
                        ? <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">✓ Live</span>
                        : <button onClick={()=>setActiveTab('deploy')} className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Deploy →</button>}
                    </div>
                    {c.val ? (
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono text-glow-text truncate flex-1">{c.val}</code>
                        <button onClick={()=>navigator.clipboard.writeText(c.val)} className="p-1 text-glow-muted hover:text-glow-text"><Copy className="w-3 h-3"/></button>
                        <a href={'https://testnet.arcscan.app/address/'+c.val} target="_blank" rel="noopener noreferrer" className="p-1 text-glow-muted hover:text-glow-cyan"><ExternalLink className="w-3 h-3"/></a>
                      </div>
                    ) : <p className="text-xs text-glow-muted/60">{c.desc}</p>}
                    <input value={c.val} onChange={e=>setSettings(p=>({...p,[c.key]:e.target.value}))} placeholder="0x… paste if deployed" className={`${inputCls} font-mono text-xs mt-1`}/>
                  </div>
                ))}
              </div>
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1"><Settings className="w-4 h-4 text-glow-accent"/><span className="text-sm font-semibold text-glow-text">Treasury Settings</span></div>
                <Field><Label hint="Deploy GlowIDETreasury.sol and paste the address here">Treasury Address</Label><input type="text" value={settings.treasuryAddress} onChange={e=>setSettings(p=>({...p,treasuryAddress:e.target.value}))} placeholder="0x…" className={`${inputCls} font-mono`}/></Field>
                <Field><Label hint="The wallet authorized to withdraw from the treasury">Admin Wallet</Label><input type="text" value={settings.adminWallet} onChange={e=>setSettings(p=>({...p,adminWallet:e.target.value}))} placeholder="0x…" className={`${inputCls} font-mono`}/></Field>
                {settings.treasuryAddress && (
                  <div className="flex items-center gap-3">
                    <a href={`https://testnet.arcscan.app/address/${settings.treasuryAddress}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-glow-cyan hover:text-glow-text transition-colors"><ExternalLink className="w-3.5 h-3.5"/>View on ArcScan</a>
                    <button onClick={()=>fetch(`/api/treasury?contract=${settings.treasuryAddress}`).then(r=>r.json()).then(d=>setTreasuryBalance(d.balance??'0'))} className="flex items-center gap-1.5 text-xs text-glow-muted hover:text-glow-text transition-colors"><RefreshCw className="w-3.5 h-3.5"/>Refresh Balance</button>
                  </div>
                )}
              </div>

              {/* Balance + withdraw */}
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-400"/><span className="text-sm font-semibold text-glow-text">Balance &amp; Withdraw</span></div>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <div><p className="text-xs text-glow-muted">Available Balance</p><p className="text-2xl font-bold text-emerald-400">{formattedBalance} USDC</p></div>
                  <Wallet className="w-8 h-8 text-emerald-400/50"/>
                </div>
                <Field><Label hint="Where to send withdrawn funds">Withdraw To</Label><input type="text" value={withdrawTo || settings.adminWallet} onChange={e=>setWithdrawTo(e.target.value)} placeholder={settings.adminWallet || '0x…'} className={`${inputCls} font-mono`}/></Field>
                <button onClick={handleWithdraw} disabled={isWithdrawing || !settings.treasuryAddress || parseFloat(treasuryBalance)===0}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-glow-gradient text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {isWithdrawing ? <Loader2 className="w-4 h-4 animate-spin"/> : <ArrowDownToLine className="w-4 h-4"/>}
                  Withdraw All to Admin Wallet
                </button>
              </div>

              {/* Deploy instructions */}
              <div className="bg-glow-surface border border-glow-border rounded-2xl p-5">
                <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider mb-3">Deploy Treasury Contract</p>
                <ol className="space-y-2 text-sm text-glow-muted list-decimal pl-4">
                  <li>Go to <a href="/editor" className="text-glow-cyan underline">Editor</a> and open <code className="text-glow-accent font-mono text-xs">contracts/GlowIDETreasury.sol</code></li>
                  <li>Compile the contract (click Compile button)</li>
                  <li>Enter your admin wallet address as the constructor argument</li>
                  <li>Click Deploy — approve the transaction in your wallet</li>
                  <li>Copy the deployed address and paste it above</li>
                  <li>Set the same address as your Fee Recipient in the Fees tab</li>
                </ol>
              </div>
            </div>
          )}

          {/* USERS */}
          {activeTab === 'users' && (
            <div className="space-y-5 animate-fade-in">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-glow-accent"/></div>
              ) : !usersData ? (
                <div className="text-center py-12 space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto"/>
                  <p className="text-glow-muted text-sm">Failed to load users data</p>
                  <button onClick={()=>setLoadingUsers(true)} className="px-4 py-2 bg-glow-accent text-white text-sm rounded-xl">Retry</button>
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <StatCard icon={Users}     label="Users"         value={usersData.stats.totalUsers}        color="#7c3aed"/>
                    <StatCard icon={CreditCard} label="Pro Users"    value={usersData.stats.proUsers}          color="#10b981"/>
                    <StatCard icon={Rocket}     label="Deployments"  value={usersData.stats.totalDeployments}  color="#06b6d4"/>
                    <StatCard icon={Activity}   label="Connections"  value={usersData.stats.totalConnections||0}  color="#f59e0b"/>
                    <StatCard icon={Activity}   label="Transactions" value={usersData.stats.totalTransactions||0} color="#ec4899"/>
                  </div>

                  {/* User Plans */}
                  <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-glow-border bg-glow-surface/50 flex items-center justify-between">
                      <span className="text-sm font-semibold text-glow-text">User Plans</span>
                      <span className="text-xs text-glow-muted">{usersData.users.length} users</span>
                    </div>
                    {usersData.users.length === 0 ? (
                      <p className="py-8 text-center text-xs text-glow-muted">No users yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-glow-border bg-glow-surface/50">
                            {['Wallet','Plan','Tokens Used','Deploys','Storage','Activity','Since'].map(h=><th key={h} className="text-left px-4 py-2.5 text-xs text-glow-muted font-medium">{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {usersData.users.map((u,i)=>{
                              const act=usersData.activity?.[(u.wallet_address||'')];
                              return (
                                <tr key={u.id||i} className="border-b border-glow-border/50 hover:bg-glow-surface/30">
                                  <td className="px-4 py-2.5 font-mono text-xs text-glow-text">{(u.wallet_address||'—').slice(0,10)}…</td>
                                  <td className="px-4 py-2.5"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${(u.plan||'free')==='free'?'text-gray-400 border-gray-700 bg-gray-800/50':(u.plan||'free')==='pro'?'text-purple-400 border-purple-500/30 bg-purple-500/10':'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>{(u.plan||'free').toUpperCase()}</span></td>
                                  <td className="px-4 py-2.5 text-xs text-glow-muted">{(u.tokens_used||0).toLocaleString()} / {(u.tokens_limit||0).toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-xs text-glow-muted">{u.deployments_used||0} / {u.deployments_limit||0}</td>
                                  <td className="px-4 py-2.5 text-xs text-glow-muted">{((u.storage_used_bytes||0)/1024/1024).toFixed(1)} MB</td>
                                  <td className="px-4 py-2.5 text-xs text-glow-muted">{act?.actions||0} actions</td>
                                  <td className="px-4 py-2.5 text-xs text-glow-muted">{u.created_at?new Date(u.created_at).toLocaleDateString():'—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Wallet Connections */}
                  {(usersData.walletConnections?.length > 0) && (
                    <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-glow-border bg-glow-surface/50 flex items-center justify-between">
                        <span className="text-sm font-semibold text-glow-text">Wallet Connections</span>
                        <span className="text-xs text-glow-muted">{usersData.walletConnections.length} records</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-glow-border bg-glow-surface/50">
                            {['Wallet','Chain ID','Connected At','Last Seen'].map(h=><th key={h} className="text-left px-4 py-2 text-glow-muted font-medium">{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {usersData.walletConnections.slice(0,20).map((c,i)=>{
                              const conn = c as Record<string,unknown>;
                              return (
                                <tr key={i} className="border-b border-glow-border/30 hover:bg-glow-surface/20">
                                  <td className="px-4 py-2 font-mono">{String(conn.wallet_address||conn.address||'—').slice(0,14)}…</td>
                                  <td className="px-4 py-2 text-glow-muted">{String(conn.chain_id||'—')}</td>
                                  <td className="px-4 py-2 text-glow-muted">{conn.connected_at?new Date(String(conn.connected_at)).toLocaleString():'—'}</td>
                                  <td className="px-4 py-2 text-glow-muted">{conn.last_seen?new Date(String(conn.last_seen)).toLocaleString():'—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Wallet Balances */}
                  {(usersData.walletBalances?.length > 0) && (
                    <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-glow-border bg-glow-surface/50 flex items-center justify-between">
                        <span className="text-sm font-semibold text-glow-text">Wallet Balances</span>
                        <span className="text-xs text-glow-muted">{usersData.walletBalances.length} records</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-glow-border bg-glow-surface/50">
                            {['Wallet','USDC','EURC','cirBTC','Updated'].map(h=><th key={h} className="text-left px-4 py-2 text-glow-muted font-medium">{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {usersData.walletBalances.slice(0,20).map((b,i)=>{
                              const bal = b as Record<string,unknown>;
                              return (
                                <tr key={i} className="border-b border-glow-border/30 hover:bg-glow-surface/20">
                                  <td className="px-4 py-2 font-mono">{String(bal.wallet_address||bal.address||'—').slice(0,14)}…</td>
                                  <td className="px-4 py-2 text-glow-cyan">{String(bal.usdc_balance||bal.usdc||'—')}</td>
                                  <td className="px-4 py-2 text-glow-muted">{String(bal.eurc_balance||bal.eurc||'—')}</td>
                                  <td className="px-4 py-2 text-glow-muted">{String(bal.cirbtc_balance||bal.cirbtc||'—')}</td>
                                  <td className="px-4 py-2 text-glow-muted">{bal.updated_at?new Date(String(bal.updated_at)).toLocaleDateString():'—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Transactions */}
                  {(usersData.transactions?.length > 0) && (
                    <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-glow-border bg-glow-surface/50 flex items-center justify-between">
                        <span className="text-sm font-semibold text-glow-text">Transactions</span>
                        <span className="text-xs text-glow-muted">{usersData.transactions.length} records</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-glow-border bg-glow-surface/50">
                            {['Hash','From','To','Amount','Type','Date'].map(h=><th key={h} className="text-left px-4 py-2 text-glow-muted font-medium">{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {usersData.transactions.slice(0,20).map((t,i)=>{
                              const tx = t as Record<string,unknown>;
                              const hash = String(tx.hash||tx.tx_hash||'—');
                              return (
                                <tr key={i} className="border-b border-glow-border/30 hover:bg-glow-surface/20">
                                  <td className="px-4 py-2 font-mono">
                                    {hash !== '—' ? <a href={'https://testnet.arcscan.app/tx/'+hash} target="_blank" rel="noopener noreferrer" className="text-glow-cyan hover:underline">{hash.slice(0,12)}…</a> : '—'}
                                  </td>
                                  <td className="px-4 py-2 font-mono text-glow-muted">{String(tx.from_address||tx.from||'—').slice(0,10)}…</td>
                                  <td className="px-4 py-2 font-mono text-glow-muted">{String(tx.to_address||tx.to||'—').slice(0,10)}…</td>
                                  <td className="px-4 py-2 text-glow-cyan">{String(tx.amount||tx.value||'—')}</td>
                                  <td className="px-4 py-2 text-glow-muted">{String(tx.type||tx.tx_type||'—')}</td>
                                  <td className="px-4 py-2 text-glow-muted">{tx.created_at?new Date(String(tx.created_at)).toLocaleDateString():'—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Show message if extra tables are empty */}
                  {!usersData.walletConnections?.length && !usersData.walletBalances?.length && !usersData.transactions?.length && (
                    <div className="p-4 bg-glow-surface border border-glow-border/50 rounded-xl">
                      <p className="text-xs text-glow-muted">Wallet connections, balances, and transactions will appear here as users interact with GlowIDE.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

                    {activeTab === 'training' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div><h2 className="text-base font-semibold text-glow-text">AI Training Data</h2><p className="text-xs text-glow-muted mt-0.5">{trainingExamples.length} examples · shapes AI behaviour</p></div>
                <div className="flex gap-2">
                  <button onClick={()=>setTrainingExamples(p=>[...p,{id:`new-${Date.now()}`,user_message:'',assistant_response:'',category:'general',enabled:true,created_at:new Date().toISOString()}])} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light rounded-lg hover:bg-glow-accent/25"><Plus className="w-3.5 h-3.5"/>Add</button>
                  <button onClick={async()=>{setSavingTraining(true);try{const res=await fetch('/api/admin/training',{method:'POST',headers:authHeader(),body:JSON.stringify({examples:trainingExamples.filter(e=>e.enabled)})});if(res.ok)toast.success('Training saved');else toast.error('Save failed');}catch{toast.error('Failed');}finally{setSavingTraining(false);}}} disabled={savingTraining} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg disabled:opacity-50">
                    {savingTraining?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Save className="w-3.5 h-3.5"/>}Save
                  </button>
                </div>
              </div>
              {loadingTraining ? <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-glow-accent"/></div>
              : <div className="space-y-3">
                {trainingExamples.map((ex,i)=>(
                  <div key={ex.id} className={`bg-glow-card border rounded-2xl p-4 space-y-3 ${ex.enabled?'border-glow-border':'border-glow-border/30 opacity-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-glow-muted">#{i+1}</span>
                        <select value={ex.category} onChange={e=>setTrainingExamples(p=>p.map((x,j)=>j===i?{...x,category:e.target.value}:x))} className="text-xs bg-glow-bg border border-glow-border rounded-lg px-2 py-1 text-glow-muted focus:outline-none">
                          {['general','solidity','react','nodejs','web3','security','gas-optimization'].map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Toggle value={ex.enabled} onChange={v=>setTrainingExamples(p=>p.map((x,j)=>j===i?{...x,enabled:v}:x))}/>
                        <button onClick={()=>setTrainingExamples(p=>p.filter((_,j)=>j!==i))} className="p-1 text-glow-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div><p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1.5 font-semibold">User Message</p><textarea value={ex.user_message} onChange={e=>setTrainingExamples(p=>p.map((x,j)=>j===i?{...x,user_message:e.target.value}:x))} className="w-full bg-glow-bg border border-glow-border rounded-xl p-3 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50 resize-none font-mono" rows={4}/></div>
                      <div><p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1.5 font-semibold">AI Response</p><textarea value={ex.assistant_response} onChange={e=>setTrainingExamples(p=>p.map((x,j)=>j===i?{...x,assistant_response:e.target.value}:x))} className="w-full bg-glow-bg border border-glow-border rounded-xl p-3 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50 resize-none font-mono" rows={4}/></div>
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          )}

          {/* PLANS */}
          {activeTab === 'plans' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div><h2 className="text-base font-semibold text-glow-text">Subscription Plans</h2><p className="text-xs text-glow-muted mt-0.5">Configure plan tiers and pricing</p></div>
              </div>

              {/* Edit form */}
              {editingPlan && (
                <div className="bg-glow-card border border-glow-accent/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-glow-text">Editing: {editingPlan.name}</span>
                    <button onClick={()=>setEditingPlan(null)} className="p-1 text-glow-muted hover:text-glow-text"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field><Label>Plan Name</Label><input value={editingPlan.name} onChange={e=>setEditingPlan(p=>p?{...p,name:e.target.value}:p)} className={inputCls}/></Field>
                    <Field><Label>Price Display</Label><input value={editingPlan.price} onChange={e=>setEditingPlan(p=>p?{...p,price:e.target.value}:p)} placeholder="10 USDC/mo" className={inputCls}/></Field>
                    <Field><Label>AI Tokens / month</Label><input type="number" value={editingPlan.tokens} onChange={e=>setEditingPlan(p=>p?{...p,tokens:parseInt(e.target.value)||0}:p)} className={inputCls}/></Field>
                    <Field><Label>Storage (MB)</Label><input type="number" value={editingPlan.storage} onChange={e=>setEditingPlan(p=>p?{...p,storage:parseInt(e.target.value)||0}:p)} className={inputCls}/></Field>
                    <Field><Label>Deployments</Label><input type="number" value={editingPlan.deploys} onChange={e=>setEditingPlan(p=>p?{...p,deploys:parseInt(e.target.value)||0}:p)} className={inputCls}/></Field>
                    <Field><Label>AI Requests / day</Label><input type="number" value={editingPlan.ai} onChange={e=>setEditingPlan(p=>p?{...p,ai:parseInt(e.target.value)||0}:p)} className={inputCls}/></Field>
                    <Field className="col-span-2"><Label>Features (one per line)</Label><textarea rows={3} value={editingPlan.features} onChange={e=>setEditingPlan(p=>p?{...p,features:e.target.value}:p)} className={`${inputCls} resize-none`} placeholder="Unlimited deployments&#10;5GB storage&#10;Priority support"/></Field>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={()=>setEditingPlan(null)} className="px-4 py-2 text-sm border border-glow-border text-glow-muted rounded-lg hover:bg-glow-card">Cancel</button>
                    <button onClick={()=>{toast.success('Plan saved — click Save All to persist');setEditingPlan(null);}} className="px-4 py-2 text-sm bg-glow-accent text-white font-medium rounded-lg hover:bg-glow-accent/90">
                      <CheckCircle className="w-3.5 h-3.5 inline mr-1"/>Save Plan
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {id:'free',       name:'Free',       price:'0 USDC',      tokens:'50,000',     storage:'50 MB',  deployments:'3',   color:'#6b7280', desc:'Perfect for exploring'},
                  {id:'pro',        name:'Pro',         price:'10 USDC/mo',  tokens:'500,000',    storage:'500 MB', deployments:'50',  color:'#7c3aed', desc:'For serious developers'},
                  {id:'enterprise', name:'Enterprise',  price:'Custom',      tokens:'5,000,000',  storage:'5 GB',   deployments:'500', color:'#f59e0b', desc:'For teams & businesses'},
                ].map(plan=>(
                  <div key={plan.id} className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-glow-text">{plan.name}</span>
                      <span className="text-sm font-semibold" style={{color:plan.color}}>{plan.price}</span>
                    </div>
                    <p className="text-xs text-glow-muted">{plan.desc}</p>
                    <div className="space-y-2 text-xs flex-1">
                      {[['AI Tokens',plan.tokens],['Storage',plan.storage],['Deploys',plan.deployments]].map(([k,v])=>(
                        <div key={k} className="flex justify-between">
                          <span className="text-glow-muted">{k}</span>
                          <span className="text-glow-text font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-glow-border">
                      <button
                        onClick={()=>setEditingPlan({id:plan.id,name:plan.name,price:plan.price,tokens:parseInt(plan.tokens.replace(/,/g,''))||0,storage:parseInt(plan.storage)||0,deploys:parseInt(plan.deployments)||0,ai:100,features:'',color:plan.color})}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border border-glow-border text-glow-muted rounded-lg hover:bg-glow-surface hover:text-glow-text transition-colors">
                        <Edit2 className="w-3 h-3"/>Edit
                      </button>
                      <button
                        onClick={()=>toast('Default plans are protected. Add custom plans via Save All.', {icon:'ℹ️'})}
                        className="px-3 py-2 border border-red-500/20 text-red-400/60 rounded-lg text-xs hover:border-red-500/40 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-glow-accent/5 border border-glow-accent/15 rounded-2xl space-y-3">
                <p className="text-xs text-glow-text font-medium">Subscription payments go to your treasury or fee recipient address.</p>
                <Field><Label>Fee Recipient / Treasury Address</Label><input value={settings.feeRecipient} onChange={e=>setSettings(p=>({...p,feeRecipient:e.target.value}))} placeholder="0x…" className={`${inputCls} font-mono`}/></Field>
              </div>
            </div>
          )}

          {/* WEBSITE */}
          {activeTab === 'website' && (
            <div className="space-y-5 animate-fade-in">
              <div><h2 className="text-base font-semibold text-glow-text">Website Settings</h2><p className="text-xs text-glow-muted mt-0.5">Customize branding — logos are saved directly to database</p></div>

              {/* Site info */}
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1"><Globe className="w-4 h-4 text-glow-accent"/><span className="text-sm font-semibold text-glow-text">Site Information</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field><Label hint="Shown in browser tab and header">Site Name</Label><input value={siteSettings.siteName} onChange={e=>setSiteSettings(p=>({...p,siteName:e.target.value}))} className={inputCls} placeholder="GlowIDE"/></Field>
                  <Field><Label>Tagline</Label><input value={siteSettings.siteTagline} onChange={e=>setSiteSettings(p=>({...p,siteTagline:e.target.value}))} className={inputCls} placeholder="AI-Powered Web3 IDE"/></Field>
                  <Field className="sm:col-span-2"><Label>Description</Label><textarea rows={2} value={siteSettings.siteDescription} onChange={e=>setSiteSettings(p=>({...p,siteDescription:e.target.value}))} className={`${inputCls} resize-none`} placeholder="Build smarter on Web3"/></Field>
                </div>
              </div>

              {/* Logo uploads */}
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-5">
                <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Logos (click to upload — auto-saved to database)</p>
                {[
                  { key:'logo_url',       label:'Site Logo',         stateKey:'logoUrl'      as const, accept:'image/*' },
                  { key:'usdc_logo_url',  label:'USDC Token Logo',   stateKey:'usdcLogoUrl'  as const, accept:'image/*' },
                  { key:'eurc_logo_url',  label:'EURC Token Logo',   stateKey:'eurcLogoUrl'  as const, accept:'image/*' },
                  { key:'cirbtc_logo_url',label:'cirBTC Token Logo', stateKey:'cirBTCLogoUrl' as const, accept:'image/*' },
                ].map(({key, label, stateKey}) => {
                  const currentUrl = siteSettings[stateKey];
                  return (
                    <div key={key} className="flex items-center gap-4">
                      {/* Preview */}
                      <div className="w-14 h-14 rounded-2xl bg-glow-surface border border-glow-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {currentUrl
                          ? <img src={currentUrl} alt={label} className="w-full h-full object-contain p-1" onError={e=>((e.target as HTMLImageElement).src='')}/>
                          : <ImageIcon className="w-6 h-6 text-glow-muted/30"/>}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <p className="text-xs font-semibold text-glow-text">{label}</p>
                        {/* File upload */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light text-xs font-medium rounded-lg hover:bg-glow-accent/25 transition-colors">
                            <Upload className="w-3.5 h-3.5"/>Upload Image
                          </span>
                          <input type="file" accept="image/*" className="hidden" onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5*1024*1024) { toast.error('File too large (max 5MB)'); return; }
                            const fd = new FormData();
                            fd.append('file', file);
                            fd.append('setting', key);
                            toast.loading('Uploading…', {id:'logo-upload'});
                            try {
                              const res = await fetch('/api/admin/upload', { method:'POST', headers:{authorization:`Wallet ${address}`}, body:fd });
                              const d = await res.json();
                              if (!res.ok) throw new Error(d.error ?? 'Upload failed');
                              setSiteSettings(p => ({...p, [stateKey]: d.url}));
                              toast.success('Logo uploaded + saved!', {id:'logo-upload'});
                            } catch(err) { toast.error((err as Error).message.slice(0,60), {id:'logo-upload'}); }
                          }}/>
                        </label>
                        {/* URL override */}
                        <input value={currentUrl} onChange={e=>setSiteSettings(p=>({...p,[stateKey]:e.target.value}))}
                          placeholder="or paste URL directly"
                          className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs text-glow-text font-mono placeholder-glow-muted/40 focus:outline-none focus:border-glow-accent/40"/>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-glow-accent/5 border border-glow-accent/15 rounded-xl">
                <p className="text-xs text-glow-muted">💡 Click <strong className="text-glow-text">Save All</strong> in the top bar to persist site name, tagline, and description to the database. Logos are saved immediately when uploaded.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
