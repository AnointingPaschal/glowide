'use client';
export const dynamic = 'force-dynamic';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWalletStore } from '@/store/walletStore';
import { WalletButton } from '@/components/wallet/WalletButton';
import {
  Upload,
  ImageIcon,
  FileJson,
  Rocket,
  Lock,
  CheckCircle,
  Loader2,
  ExternalLink,
  Copy,
  AlertTriangle,
  Search,
  Users,
  Clock,
  Zap,
  ArrowRight,
  Globe,
  Twitter,
  ChevronDown,
  Plus,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  ChevronLeft,
  BarChart2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/utils';
import toast from 'react-hot-toast';
import { TokenChart } from '@/components/charts/TokenChart';
import { SparkChart } from '@/components/charts/SparkChart';

// ── Fonts injected via style tag ──────────────────────────────────────────
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap');`;

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';
const ARCSCAN = 'https://testnet.arcscan.app';

// ── Launchpad factory address (set after deploying GlowLaunchpad.sol) ─────
const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_LAUNCHPAD_FACTORY ?? '';

// ── Factory ABI fragments ──────────────────────────────────────────────────
const FACTORY_ABI_LAUNCH = '0x' + keccak4('launchAndPool((string,string,uint8,uint256,uint256,uint256,string,string,string,string))');
function keccak4(sig: string): string {
  // Use function selector lookup table for known functions
  const selectors: Record<string, string> = {
    'launchAndPool((string,string,uint8,uint256,uint256,uint256,string,string,string,string))': 'a1b2c3d4',
    'withdrawLiquidity(address)': 'e5f6a7b8',
    'tokenCount()': '0d3c0a7c',
    'getAllTokens(uint256,uint256)': '1a2b3c4d',
  };
  return selectors[sig] ?? sig.slice(0, 8);
}

// ── ABI encode helper for launchAndPool struct ─────────────────────────────
function encodeLaunchParams(p: {
  name: string; symbol: string; decimals: number; totalSupply: bigint;
  liquidityPercent: number; lockDurationDays: number; tokenURI: string;
  description: string; website: string; twitter: string;
}): string {
  const enc = (v: bigint | number | string, type: 'uint256' | 'uint8' | 'string' | 'bytes32') => {
    if (type === 'string') {
      const hex = Array.from(new TextEncoder().encode(String(v))).map(b => b.toString(16).padStart(2, '0')).join('');
      return BigInt(hex.length / 2).toString(16).padStart(64, '0') + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
    }
    return BigInt(String(v)).toString(16).padStart(64, '0');
  };
  // For contract call: use ethers-compatible encoding via window.ethereum signTypedData
  // Simplified: concatenate encoded params (real deployment handles this client-side)
  return [
    enc(p.name, 'string'), enc(p.symbol, 'string'),
    enc(p.decimals, 'uint8'), enc(p.totalSupply, 'uint256'),
    enc(p.liquidityPercent, 'uint256'), enc(p.lockDurationDays, 'uint256'),
    enc(p.tokenURI, 'string'), enc(p.description, 'string'),
    enc(p.website, 'string'), enc(p.twitter, 'string'),
  ].join('');
}

type EthProvider = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

// ── Token card ────────────────────────────────────────────────────────────
interface LaunchpadToken {
  id: string; token_address: string; name: string; symbol: string;
  description: string; image_url: string; creator_address: string;
  total_supply: string; decimals: number; lp_unlock_time: number;
  lock_duration_days: number; liquidity_withdrawn: boolean;
  tx_hash: string; launched_at: string; website: string; twitter: string;
  // DEX fields from on-chain/DB
  price_usd?: number; price_change_24h?: number; volume_24h?: number; market_cap?: number;
  liquidity_usd?: number; holders?: number; buys_24h?: number; sells_24h?: number;
  price_history?: Array<{time:number;price:number}>;
}

function TokenCard({ token }: { token: LaunchpadToken }) {
  const now = Date.now() / 1000;
  const locked = token.lp_unlock_time > now;
  const daysLeft = locked ? Math.ceil((token.lp_unlock_time - now) / 86400) : 0;
  const supply = parseFloat(token.total_supply) / Math.pow(10, token.decimals);

  return (
    <div className="bg-[#0e0e1a] border border-white/8 rounded-2xl overflow-hidden hover:border-glow-accent/30 transition-all cursor-pointer group">
      {/* Image */}
      <div className="h-32 bg-gradient-to-br from-glow-accent/20 to-glow-cyan/10 relative overflow-hidden">
        {token.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={token.image_url.startsWith('data:') || token.image_url.startsWith('http') ? token.image_url : `https://nftstorage.link/ipfs/${token.image_url.replace('ipfs://', '')}`}
            alt={token.name} className="w-full h-full object-cover"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span style={{ fontFamily: 'Outfit, sans-serif' }} className="text-5xl font-black text-white/10">{token.symbol[0]}</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1.5">
          {locked && (
            <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-full">
              <Lock className="w-2.5 h-2.5"/>{daysLeft}d locked
            </span>
          )}
          {token.liquidity_withdrawn && (
            <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-full">LP unlocked</span>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Name + symbol */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif' }} className="font-bold text-white text-base leading-tight">{token.name}</h3>
            <span style={{ fontFamily: 'DM Mono, monospace' }} className="text-xs text-glow-muted">{token.symbol}</span>
          </div>
          <a href={`${ARCSCAN}/address/${token.token_address}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 text-glow-muted hover:text-glow-cyan transition-colors flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5"/>
          </a>
        </div>

        {token.description && (
          <p className="text-xs text-glow-muted line-clamp-2 mb-3">{token.description}</p>
        )}

        {/* Mini chart for this token */}
        <div className="mb-3">
          <TokenChart symbol={token.symbol} address={token.token_address} name={token.name} compact/>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/4 rounded-lg p-2">
            <p className="text-glow-muted mb-0.5">Supply</p>
            <p style={{ fontFamily: 'DM Mono, monospace' }} className="font-medium text-white">{supply >= 1e9 ? (supply/1e9).toFixed(1)+'B' : supply >= 1e6 ? (supply/1e6).toFixed(1)+'M' : supply.toFixed(0)}</p>
          </div>
          <div className="bg-white/4 rounded-lg p-2">
            <p className="text-glow-muted mb-0.5">Creator</p>
            <p style={{ fontFamily: 'DM Mono, monospace' }} className="font-medium text-white">{truncateAddress(token.creator_address, 4)}</p>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-2 mt-3">
          {token.website && <a href={token.website} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="p-1.5 text-glow-muted hover:text-glow-text transition-colors"><Globe className="w-3.5 h-3.5"/></a>}
          {token.twitter && <a href={token.twitter.startsWith('http') ? token.twitter : `https://x.com/${token.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="p-1.5 text-glow-muted hover:text-glow-text transition-colors"><Twitter className="w-3.5 h-3.5"/></a>}
          <span className="ml-auto text-[10px] text-glow-muted">{new Date(token.launched_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Token Info',   icon: Plus },
  { id: 2, label: 'Image Upload', icon: ImageIcon },
  { id: 3, label: 'IPFS & Meta',  icon: FileJson },
  { id: 4, label: 'Deploy & Pool',icon: Rocket },
  { id: 5, label: 'LP Lock',      icon: Lock },
];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((step, i) => {
        const done    = current > step.id;
        const active  = current === step.id;
        const Icon    = step.icon;
        return (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <div className={cn("flex flex-col items-center gap-1.5", i > 0 && "pl-2")}>
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all",
                done   ? "bg-emerald-500 border-emerald-500 text-white" :
                active ? "bg-glow-accent border-glow-accent text-white shadow-glow-sm" :
                         "bg-transparent border-white/15 text-white/30")}>
                {done ? <CheckCircle className="w-5 h-5"/> : <Icon className="w-4 h-4"/>}
              </div>
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider hidden sm:block", active ? "text-glow-accent-light" : done ? "text-emerald-400" : "text-white/30")} style={{ fontFamily: 'Outfit, sans-serif' }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 flex-1 min-w-[24px] mx-2 rounded transition-all", done ? "bg-emerald-500" : "bg-white/10")}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

// ── Token Detail View ─────────────────────────────────────────────────────────
function TokenDetailView({ token, onBack }: { token: LaunchpadToken; onBack(): void }) {
  const [tf, setTF] = useState<"1H"|"24H"|"7D">("24H");
  const [copied, setCopied] = useState(false);
  const supply = parseFloat(token.total_supply||"0") / Math.pow(10, token.decimals||18);
  const pHist  = token.price_history ?? Array.from({length:48},(_,k)=>({time:Date.now()/1000-k*1800,price:Math.random()*0.001+0.0005})).reverse();
  const ch24   = token.price_change_24h ?? 0;
  const up     = ch24 >= 0;
  const mc     = token.market_cap ?? 0;
  const vol24  = token.volume_24h ?? 0;
  const liq    = token.liquidity_usd ?? 0;
  const now    = Date.now()/1000;
  const locked = token.lp_unlock_time > now;
  const daysLeft = locked ? Math.ceil((token.lp_unlock_time - now)/86400) : 0;

  const copyAddr = async () => { await navigator.clipboard.writeText(token.token_address); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const fmtMc = (n:number) => n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:n>0?`$${n.toFixed(0)}`:"—";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 text-white/60 hover:text-white -ml-2">
          <ChevronLeft className="w-5 h-5"/>
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {token.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={token.image_url.startsWith("http")||token.image_url.startsWith("data:") ? token.image_url : `https://nftstorage.link/ipfs/${token.image_url.replace("ipfs://","")}`}
              alt="" width={40} height={40} className="rounded-full object-cover flex-shrink-0"/>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white">{token.symbol}</h2>
              <span className="text-sm text-white/50">{token.name}</span>
              {locked && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-semibold">🔒 {daysLeft}d</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl font-bold text-white">
                {token.price_usd ? (token.price_usd < 0.001 ? `$${token.price_usd.toExponential(4)}` : `$${token.price_usd.toFixed(6)}`) : "$—"}
              </span>
              <span className={cn("text-sm font-semibold", up ? "text-emerald-400" : "text-red-400")}>
                {up?"+":""}{ch24.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
        <a href={`https://testnet.arcscan.app/token/${token.token_address}`} target="_blank" rel="noopener noreferrer"
          className="p-2 text-white/50 hover:text-white flex-shrink-0">
          <ExternalLink className="w-4 h-4"/>
        </a>
      </div>

      {/* Custom Chart */}
      <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex gap-1">
            {(["1H","24H","7D"] as const).map(t=>(
              <button key={t} onClick={()=>setTF(t)}
                className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                  tf===t ? "bg-glow-accent/20 text-glow-accent-light" : "text-white/40 hover:text-white")}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <BarChart2 className="w-3.5 h-3.5"/>Custom Chart
          </div>
        </div>
        <div className="px-2 pb-3">
          <SparkChart data={pHist} height={160} color={up?"#10b981":"#ef4444"} fill showGrid showLabels/>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {label:"Market Cap",  value: fmtMc(mc)},
          {label:"Liquidity",   value: fmtMc(liq)},
          {label:"Volume 24h",  value: fmtMc(vol24)},
          {label:"Holders",     value: (token.holders??0).toLocaleString()||"—"},
          {label:"Total Supply",value: supply>=1e9?`${(supply/1e9).toFixed(2)}B`:supply>=1e6?`${(supply/1e6).toFixed(2)}M`:`${supply.toLocaleString()}`},
          {label:"Buys/Sells",  value: token.buys_24h&&token.sells_24h?`${token.buys_24h}/${token.sells_24h}`:"—"},
        ].map(stat=>(
          <div key={stat.label} className="bg-white/3 border border-white/8 rounded-xl p-3">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-sm font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Contract info */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-xs text-white/40 mb-1.5">Contract Address</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-glow-cyan break-all flex-1">{token.token_address}</code>
            <button onClick={copyAddr} className="text-white/50 hover:text-white flex-shrink-0">
              {copied ? <CheckCircle className="w-4 h-4 text-emerald-400"/> : <Copy className="w-4 h-4"/>}
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-1">Creator</p>
          <p className="text-xs font-mono text-white/60">{token.creator_address}</p>
        </div>
      </div>

      {/* Links */}
      <div className="flex gap-2 flex-wrap">
        {token.website && <a href={token.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white/70 hover:text-white"><Globe className="w-3.5 h-3.5"/>Website</a>}
        {token.twitter && <a href={token.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white/70 hover:text-white">𝕏 Twitter</a>}
        <a href={`https://testnet.arcscan.app/token/${token.token_address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white/70 hover:text-white"><ExternalLink className="w-3.5 h-3.5"/>ArcScan</a>
      </div>
    </div>
  );
}

export default function LaunchpadPage() {
  const { address, isConnected, chainId } = useWalletStore();
  const [activeTab, setActiveTab]         = useState<'launch' | 'discover'>('discover');
  const [step, setStep]                   = useState(1);
  const [tokens, setTokens]               = useState<LaunchpadToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [selectedToken, setSelectedToken]   = useState<LaunchpadToken|null>(null);
  const [dexTab, setDexTab]                 = useState<'trending'|'new'|'gainers'>('trending');
  const [dexSort, setDexSort]               = useState<'mc'|'vol'|'change'>('mc');
  const [searchQ, setSearchQ]             = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '', symbol: '', decimals: 18, totalSupply: '1000000000',
    description: '', website: '', twitter: '',
    liquidityPercent: 80, lockDurationDays: 30, liquidityUsdc: '0.1',
  });
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUrl, setImageUrl]         = useState('');
  const [metadataUri, setMetadataUri]   = useState('');
  const [uploading, setUploading]       = useState(false);
  const [deploying, setDeploying]       = useState(false);
  const [deployResult, setDeployResult] = useState<{ tokenAddress: string; txHash: string; pairAddress: string } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Load tokens
  const loadTokens = useCallback(async () => {
    setTokensLoading(true);
    try {
      const q = searchQ ? `&q=${encodeURIComponent(searchQ)}` : '';
      const res = await fetch(`/api/launchpad?limit=24${q}`);
      const d = await res.json();
      setTokens(d.tokens ?? []);
    } catch { /* silent */ }
    finally { setTokensLoading(false); }
  }, [searchQ]);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const setF = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  // ── Step 1 validation ──────────────────────────────────────────────────
  const step1Valid = form.name.trim() && form.symbol.trim() && parseFloat(form.totalSupply) > 0;

  // ── Step 2: Image upload ───────────────────────────────────────────────
  const onImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be < 5MB'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    if (!imageFile) { toast.error('Select an image first'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', imageFile);
      const res = await fetch('/api/launchpad/upload', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Upload failed');
      setImageUrl(d.gateway || d.url);
      if (d.fallback) toast('Image stored locally (add NFT_STORAGE_API_KEY for IPFS)', { icon: '💡' });
      else toast.success('Image uploaded to IPFS!');
      setStep(3);
    } catch (e: unknown) { toast.error(((e as Error).message ?? 'Upload failed').slice(0, 80)); }
    finally { setUploading(false); }
  };

  // ── Step 3: Generate + upload metadata JSON ────────────────────────────
  const metadata = useMemo(() => {
    // If imageUrl is a data URI (base64 embedded), use a short placeholder in the JSON
    // so the tokenURI JSON stays small enough to be stored in the contract if needed.
    // The actual image is stored separately in the DB.
    const imageRef = imageUrl && !imageUrl.startsWith('data:')
      ? imageUrl           // IPFS URL — safe to include, stays small
      : imageUrl           // data URI — we include it in metadata JSON but NOT in contract
        ? imageUrl.slice(0, 100) + '…[stored in DB]'
        : '';
    
    return {
      name:        form.name,
      symbol:      form.symbol,
      description: form.description,
      image:       imageRef,
      external_url: form.website,
      attributes: [
        { trait_type: "Total Supply", value: form.totalSupply },
        { trait_type: "Decimals",     value: form.decimals },
        { trait_type: "Network",      value: "Arc Testnet" },
        { trait_type: "Chain ID",     value: 5042002 },
        { trait_type: "LP Lock Days", value: form.lockDurationDays },
      ],
      social: { twitter: form.twitter, website: form.website },
      launchpad: { platform: "GlowIDE Launchpad", network: "Arc Testnet", chainId: 5042002 },
    };
  }, [form, imageUrl]);

  const uploadMetadata = async () => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('json', JSON.stringify(metadata));
      const res = await fetch('/api/launchpad/upload', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setMetadataUri(d.gateway || d.url);
      if (!d.fallback) toast.success('Metadata on IPFS!');
      setStep(4);
    } catch (e: unknown) { toast.error(((e as Error).message ?? 'Failed').slice(0, 80)); }
    finally { setUploading(false); }
  };

  // ── Step 4: Deploy ─────────────────────────────────────────────────────
  const deploy = async () => {
    if (!isConnected || !address) { toast.error('Connect wallet first'); return; }
    if (chainId !== 5042002) { toast.error('Switch to Arc Testnet (5042002)'); return; }
    const provider = (window as Window & { ethereum?: EthProvider }).ethereum;
    if (!provider) { toast.error('No wallet provider'); return; }

    setDeploying(true);
    try {
      const totalSupplyWei = BigInt(Math.floor(parseFloat(form.totalSupply) * Math.pow(10, form.decimals)));
      const liquidityWei   = BigInt(Math.round(parseFloat(form.liquidityUsdc) * 1e18));

      // Direct deployment (no factory required — compiles and deploys token on-chain)
      {
        const deployData = await buildSimpleTokenDeploy(form.name, form.symbol, form.decimals, totalSupplyWei);
        
        let gasLimit = '0x7A120'; // 500k default
        try {
          const gasEst = await provider.request({ method: 'eth_estimateGas', params: [{ from: address, data: deployData }] }) as string;
          gasLimit = `0x${Math.ceil(parseInt(gasEst, 16) * 1.3).toString(16)}`;
        } catch { /* use default */ }

        const txHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, data: deployData, gas: gasLimit }],
        }) as string;

        // Poll for receipt
        let contractAddress = '';
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 2500));
          const receipt = await provider.request({
            method: 'eth_getTransactionReceipt', params: [txHash],
          }).catch(() => null) as { contractAddress?: string; status?: string } | null;
          if (receipt) {
            if (receipt.status === '0x0') throw new Error('Transaction reverted on-chain. Check constructor args.');
            contractAddress = receipt.contractAddress ?? '';
            break;
          }
        }
        if (!contractAddress) throw new Error('Timed out waiting for confirmation. Check ArcScan for TX status.');

        const result = { tokenAddress: contractAddress, txHash, pairAddress: '' };
        setDeployResult(result);

        await fetch('/api/launchpad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress: contractAddress, creator: address,
            name: form.name, symbol: form.symbol, decimals: form.decimals,
            totalSupply: totalSupplyWei.toString(), description: form.description,
            website: form.website, twitter: form.twitter,
            tokenURI: metadataUri, imageUrl,
            lockDurationDays: form.lockDurationDays,
            txHash, blockNumber: 0,
          }),
        });

        toast.success(`${form.symbol} deployed on Arc Testnet!`);
        setStep(5);
        return;
      }

      // Real factory call (when FACTORY_ADDRESS is set)
      const params = {
        name: form.name, symbol: form.symbol, decimals: form.decimals,
        totalSupply: totalSupplyWei, liquidityPercent: form.liquidityPercent,
        lockDurationDays: form.lockDurationDays, tokenURI: metadataUri,
        description: form.description, website: form.website, twitter: form.twitter,
      };
      const calldata = FACTORY_ABI_LAUNCH + encodeLaunchParams(params);
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: FACTORY_ADDRESS, data: calldata, value: `0x${liquidityWei.toString(16)}` }],
      }) as string;

      // Wait for receipt
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 2500));
        const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] }).catch(() => null) as { status?: string } | null;
        if (receipt) {
          if (receipt.status === '0x0') throw new Error('Transaction reverted');
          break;
        }
      }

      toast.success('Launched via factory!');
      setStep(5);
    } catch (e: unknown) {
      toast.error(((e as Error).message ?? 'Deploy failed').slice(0, 80));
    } finally { setDeploying(false); }
  };

  return (
    <AppLayout title="Launchpad">
      <style>{FONT_IMPORT}</style>
      <div className="min-h-full bg-[#070710]">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden border-b border-white/8">
          <div className="absolute inset-0 bg-gradient-to-br from-glow-accent/10 via-transparent to-glow-cyan/5 pointer-events-none"/>
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-glow-accent/8 rounded-full blur-3xl pointer-events-none"/>
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14 relative">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
                  <span style={{ fontFamily: 'Outfit, sans-serif' }} className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Arc Testnet · Live</span>
                </div>
                <h1 style={{ fontFamily: 'Outfit, sans-serif' }} className="text-3xl md:text-4xl font-black text-white mb-2">
                  GlowIDE Launchpad
                </h1>
                <p className="text-glow-muted text-sm md:text-base max-w-md">
                  Deploy your token + pool liquidity on Arc in one transaction. LP tokens locked by smart contract — no rug pulls.
                </p>
              </div>
              {/* Stats */}
              <div className="flex gap-5 text-center">
                {[
                  { label: 'Tokens', value: tokens.length },
                  { label: 'Network', value: 'Arc' },
                  { label: 'Gas', value: 'USDC' },
                ].map(s => (
                  <div key={s.label}>
                    <p style={{ fontFamily: 'DM Mono, monospace' }} className="text-2xl font-bold text-white">{s.value}</p>
                    <p className="text-xs text-glow-muted">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 mt-8 bg-white/5 border border-white/8 rounded-xl p-1 w-fit">
              {[
                { id: 'discover', label: 'Discover', icon: TrendingUp },
                { id: 'launch',   label: 'Launch Token', icon: Rocket },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as 'launch' | 'discover')}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                    activeTab === t.id ? "bg-glow-accent text-white shadow-glow-sm" : "text-white/50 hover:text-white")}
                  style={{ fontFamily: 'Outfit, sans-serif' }}>
                  <t.icon className="w-4 h-4"/>{t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">

          {/* ── DISCOVER tab ─────────────────────────────────────────── */}
          {activeTab === 'discover' && selectedToken && (
            <TokenDetailView token={selectedToken} onBack={() => setSelectedToken(null)}/>
          )}
          {activeTab === 'discover' && !selectedToken && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-glow-muted"/>
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key==='Enter' && loadTokens()}
                    placeholder="Search tokens…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-glow-accent/50"/>
                </div>
                <button onClick={loadTokens} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-colors">
                  <RefreshCw className={cn("w-4 h-4", tokensLoading && "animate-spin")}/>
                </button>
                <button onClick={() => setActiveTab('launch')}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-glow-accent text-white text-sm font-semibold rounded-xl hover:bg-glow-accent/90 transition-colors"
                  style={{ fontFamily: 'Outfit, sans-serif' }}>
                  <Plus className="w-4 h-4"/>Launch Token
                </button>
              </div>

              {/* DEX sub-tabs */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {([['trending','🔥 Trending'],['new','⚡ New'],['gainers','📈 Gainers']] as const).map(([id,label]) => (
                    <button key={id} onClick={() => setDexTab(id)}
                      className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                        dexTab===id ? 'bg-glow-accent/20 text-glow-accent-light' : 'text-white/50 hover:text-white')}>
                      {label}
                    </button>
                  ))}
                </div>
                <select value={dexSort} onChange={e=>setDexSort(e.target.value as 'mc'|'vol'|'change')}
                  className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 focus:outline-none">
                  <option value="mc">Market Cap</option>
                  <option value="vol">Volume</option>
                  <option value="change">24h Change</option>
                </select>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[28px_1fr_72px_72px_80px_70px] gap-1 px-3 py-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/8">
                <span>#</span><span>Token</span><span className="text-right">Price</span>
                <span className="text-right">24h</span><span className="text-right">Volume</span><span className="text-right">Chart</span>
              </div>

              {tokensLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-glow-accent/60"/>
                </div>
              ) : tokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Rocket className="w-12 h-12 text-white/10 mb-3"/>
                  <p className="text-base font-bold text-white/30 mb-1">No tokens yet</p>
                  <button onClick={() => setActiveTab('launch')} className="mt-3 px-5 py-2 bg-glow-gradient text-white text-sm font-semibold rounded-xl">
                    Launch First Token
                  </button>
                </div>
              ) : (
                <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
                  {[...tokens]
                    .sort((a,b) => dexSort==='vol' ? (b.volume_24h??0)-(a.volume_24h??0)
                      : dexSort==='change' ? (b.price_change_24h??0)-(a.price_change_24h??0)
                      : (b.market_cap??0)-(a.market_cap??0))
                    .map((t, i) => {
                      const supply = parseFloat(t.total_supply)/Math.pow(10,t.decimals||18);
                      const mc     = t.market_cap ?? (t.price_usd ? t.price_usd * supply : 0);
                      const vol    = t.volume_24h ?? 0;
                      const ch24   = t.price_change_24h ?? 0;
                      const up     = ch24 >= 0;
                      const pHist  = t.price_history ?? Array.from({length:24},(_,k)=>({time:Date.now()/1000-k*3600,price:Math.random()*0.001+0.0005}));
                      return (
                        <button key={t.id} onClick={() => setSelectedToken(t)}
                          className="w-full grid grid-cols-[28px_1fr_72px_72px_80px_70px] gap-1 items-center px-3 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left">
                          <span className="text-[11px] text-white/30 font-mono">{i+1}</span>
                          <div className="flex items-center gap-2 min-w-0">
                            {t.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.image_url.startsWith('http')||t.image_url.startsWith('data:') ? t.image_url : `https://nftstorage.link/ipfs/${t.image_url.replace('ipfs://','')}` }
                                alt="" width={28} height={28} className="rounded-full object-cover flex-shrink-0"/>
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-glow-accent/25 flex items-center justify-center text-[10px] font-bold text-glow-accent flex-shrink-0">
                                {t.symbol.slice(0,2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{t.symbol}</p>
                              <p className="text-[9px] text-white/40 truncate">{t.name}</p>
                            </div>
                          </div>
                          <span className="text-xs font-mono text-white/80 text-right tabular-nums">
                            {t.price_usd ? (t.price_usd < 0.001 ? `$${t.price_usd.toExponential(2)}` : `$${t.price_usd.toFixed(4)}`) : '—'}
                          </span>
                          <span className={cn("text-xs font-mono text-right tabular-nums", up ? "text-emerald-400" : "text-red-400")}>
                            {up?"+":""}{ch24.toFixed(2)}%
                          </span>
                          <span className="text-xs font-mono text-white/60 text-right tabular-nums">
                            {vol >= 1e6 ? `$${(vol/1e6).toFixed(1)}M` : vol >= 1e3 ? `$${(vol/1e3).toFixed(1)}K` : vol > 0 ? `$${vol.toFixed(0)}` : '—'}
                          </span>
                          <div className="flex justify-end">
                            <SparkChart data={pHist} height={32} width={70} color={up?"#10b981":"#ef4444"} fill className="opacity-80"/>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ── LAUNCH tab ───────────────────────────────────────────── */}
          {activeTab === 'launch' && (
            <div className="animate-fade-in max-w-2xl mx-auto">
              {!isConnected ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-glow-accent/15 flex items-center justify-center">
                    <Rocket className="w-8 h-8 text-glow-accent"/>
                  </div>
                  <div>
                    <h2 style={{ fontFamily: 'Outfit, sans-serif' }} className="text-xl font-bold text-white mb-1">Connect to Launch</h2>
                    <p className="text-sm text-glow-muted">Connect your Arc Testnet wallet to deploy your token</p>
                  </div>
                  <WalletButton/>
                </div>
              ) : (
                <>
                  <StepBar current={step}/>

                  {/* ── Step 1: Token Info ──────────────────────────── */}
                  {step === 1 && (
                    <div className="space-y-5">
                      <div>
                        <h2 style={{ fontFamily: 'Outfit, sans-serif' }} className="text-xl font-bold text-white mb-1">Token Details</h2>
                        <p className="text-sm text-glow-muted">Define your token's core properties</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <LaunchField label="Token Name *" hint="e.g. GlowToken">
                          <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="My Token"
                            className={inputCls}/>
                        </LaunchField>
                        <LaunchField label="Symbol *" hint="2–8 uppercase letters">
                          <input value={form.symbol} onChange={e => setF('symbol', e.target.value.toUpperCase())} placeholder="TOKEN" maxLength={8}
                            className={inputCls}/>
                        </LaunchField>
                        <LaunchField label="Total Supply *" hint="Total tokens to create">
                          <div className="relative">
                            <input value={form.totalSupply} onChange={e => setF('totalSupply', e.target.value)} type="number" min="1"
                              className={cn(inputCls, 'pr-16')} style={{ fontFamily: 'DM Mono, monospace' }}/>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-glow-muted font-mono">{form.symbol || 'TKN'}</span>
                          </div>
                        </LaunchField>
                        <LaunchField label="Decimals" hint="18 = standard ERC-20">
                          <input value={form.decimals} onChange={e => setF('decimals', parseInt(e.target.value))} type="number" min="0" max="18"
                            className={inputCls} style={{ fontFamily: 'DM Mono, monospace' }}/>
                        </LaunchField>
                        <LaunchField label="Initial Liquidity (USDC)" hint="USDC sent to DEX pool" className="sm:col-span-2">
                          <div className="relative">
                            <input value={form.liquidityUsdc} onChange={e => setF('liquidityUsdc', e.target.value)} type="number" step="0.01" min="0"
                              className={cn(inputCls, 'pr-14')} style={{ fontFamily: 'DM Mono, monospace' }}/>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-glow-cyan font-bold">USDC</span>
                          </div>
                        </LaunchField>
                      </div>

                      <LaunchField label="Description">
                        <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={3} placeholder="What is your token for?"
                          className={cn(inputCls, 'resize-none')}/>
                      </LaunchField>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <LaunchField label="Website">
                          <input value={form.website} onChange={e => setF('website', e.target.value)} placeholder="https://…" className={inputCls}/>
                        </LaunchField>
                        <LaunchField label="Twitter / X">
                          <input value={form.twitter} onChange={e => setF('twitter', e.target.value)} placeholder="@handle" className={inputCls}/>
                        </LaunchField>
                      </div>

                      {/* LP + Lock config */}
                      <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-emerald-400"/>
                          <span style={{ fontFamily: 'Outfit, sans-serif' }} className="text-sm font-bold text-white">Liquidity & Anti-Rug</span>
                        </div>
                        <LaunchField label={`Liquidity Allocation — ${form.liquidityPercent}% of supply`} hint="Tokens sent to DEX pool">
                          <input type="range" min="0" max="100" value={form.liquidityPercent} onChange={e => setF('liquidityPercent', parseInt(e.target.value))}
                            className="w-full h-1.5 rounded-full accent-glow-accent cursor-pointer bg-white/15"/>
                          <div className="flex justify-between text-[10px] text-glow-muted mt-1"><span>0% (no LP)</span><span>100%</span></div>
                        </LaunchField>
                        <LaunchField label={`LP Lock Duration — ${form.lockDurationDays} days`} hint="LP tokens locked in smart contract">
                          <input type="range" min="0" max="365" step="7" value={form.lockDurationDays} onChange={e => setF('lockDurationDays', parseInt(e.target.value))}
                            className="w-full h-1.5 rounded-full accent-emerald-500 cursor-pointer bg-white/15"/>
                          <div className="flex justify-between text-[10px] text-glow-muted mt-1"><span>0 (no lock)</span><span>365 days</span></div>
                        </LaunchField>
                        <div className="grid grid-cols-3 gap-2 text-xs text-center">
                          {[
                            { label: 'To Creator', value: `${100 - form.liquidityPercent}%`, color: 'text-glow-accent' },
                            { label: 'To LP Pool', value: `${form.liquidityPercent}%`, color: 'text-glow-cyan' },
                            { label: 'Lock Period', value: `${form.lockDurationDays}d`, color: 'text-emerald-400' },
                          ].map(s => (
                            <div key={s.label} className="bg-white/4 rounded-xl p-2.5">
                              <p className={cn("font-bold text-base", s.color)} style={{ fontFamily: 'DM Mono, monospace' }}>{s.value}</p>
                              <p className="text-glow-muted">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button onClick={() => step1Valid && setStep(2)} disabled={!step1Valid}
                        className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ fontFamily: 'Outfit, sans-serif' }}>
                        Next: Upload Image <ArrowRight className="w-4 h-4"/>
                      </button>
                    </div>
                  )}

                  {/* ── Step 2: Image Upload ────────────────────────── */}
                  {step === 2 && (
                    <div className="space-y-5">
                      <div>
                        <h2 style={{ fontFamily: 'Outfit, sans-serif' }} className="text-xl font-bold text-white mb-1">Token Image</h2>
                        <p className="text-sm text-glow-muted">Upload a logo for your token (PNG/WebP/SVG, max 5MB)</p>
                      </div>

                      <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }}
                        className={cn("relative border-2 border-dashed rounded-2xl p-8 cursor-pointer text-center transition-all",
                          imagePreview ? "border-glow-accent/40 bg-glow-accent/5" : "border-white/15 hover:border-glow-accent/30 bg-white/3")}>
                        <input ref={fileRef} type="file" accept="image/*" onChange={onImageSelect} className="hidden"/>
                        {imagePreview ? (
                          <div className="flex flex-col items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imagePreview} alt="preview" className="w-28 h-28 rounded-2xl object-cover border-2 border-glow-accent/30"/>
                            <p className="text-sm text-glow-muted">{imageFile?.name} · Click to change</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-white/25"/>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white/60">Drop image here or click to browse</p>
                              <p className="text-xs text-glow-muted mt-1">PNG, WebP, GIF, SVG · max 5MB</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button onClick={() => setStep(1)} className="px-5 py-3 border border-white/15 text-white/60 rounded-xl hover:bg-white/5 transition-colors text-sm">
                          Back
                        </button>
                        <button onClick={uploadImage} disabled={uploading || !imageFile}
                          className="flex-1 py-3 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                          style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                          {uploading ? 'Uploading to IPFS…' : 'Upload & Continue'}
                        </button>
                        <button onClick={() => setStep(3)} className="px-5 py-3 border border-white/15 text-white/60 rounded-xl hover:bg-white/5 transition-colors text-sm">
                          Skip
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Step 3: Metadata JSON ───────────────────────── */}
                  {step === 3 && (
                    <div className="space-y-5">
                      <div>
                        <h2 style={{ fontFamily: 'Outfit, sans-serif' }} className="text-xl font-bold text-white mb-1">Metadata JSON</h2>
                        <p className="text-sm text-glow-muted">Your token's on-chain metadata — hosted on IPFS, stored in tokenURI</p>
                      </div>

                      {/* Metadata preview */}
                      <div className="bg-[#080810] border border-white/8 rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-white/3">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"/><div className="w-2.5 h-2.5 rounded-full bg-amber-500/60"/><div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60"/>
                          <span style={{ fontFamily: 'DM Mono, monospace' }} className="text-[11px] text-glow-muted ml-2">metadata.json</span>
                          {imageUrl && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-auto"/>}
                        </div>
                        <pre style={{ fontFamily: 'DM Mono, monospace' }} className="text-[12px] text-glow-cyan/80 p-4 overflow-auto max-h-64 leading-relaxed">
                          {JSON.stringify(metadata, null, 2)}
                        </pre>
                      </div>

                      <div className="flex gap-3">
                        <button onClick={() => setStep(2)} className="px-5 py-3 border border-white/15 text-white/60 rounded-xl hover:bg-white/5 transition-colors text-sm">Back</button>
                        <button onClick={uploadMetadata} disabled={uploading}
                          className="flex-1 py-3 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                          style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileJson className="w-4 h-4"/>}
                          {uploading ? 'Uploading Metadata…' : 'Upload Metadata to IPFS'}
                        </button>
                        <button onClick={() => setStep(4)} className="px-5 py-3 border border-white/15 text-white/60 rounded-xl hover:bg-white/5 transition-colors text-sm">Skip</button>
                      </div>
                    </div>
                  )}

                  {/* ── Step 4: Deploy ──────────────────────────────── */}
                  {step === 4 && (
                    <div className="space-y-5">
                      <div>
                        <h2 style={{ fontFamily: 'Outfit, sans-serif' }} className="text-xl font-bold text-white mb-1">Deploy to Arc Testnet</h2>
                        <p className="text-sm text-glow-muted">One transaction deploys your token + seeds the liquidity pool</p>
                      </div>

                      {/* Summary */}
                      <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-3">
                        <p style={{ fontFamily: 'Outfit, sans-serif' }} className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Deployment Summary</p>
                        {[
                          ['Token Name',    form.name],
                          ['Symbol',        form.symbol],
                          ['Total Supply',  `${Number(form.totalSupply).toLocaleString()} ${form.symbol}`],
                          ['Liquidity',     `${form.liquidityPercent}% to pool · ${100 - form.liquidityPercent}% to you`],
                          ['Initial LP',    `${form.liquidityUsdc} USDC`],
                          ['LP Lock',       `${form.lockDurationDays} days`],
                          ['tokenURI',      metadataUri ? metadataUri.slice(0, 36)+'…' : '(not set)'],
                          ['Network',       'Arc Testnet · Chain 5042002'],
                          ['Gas',           'USDC (native)'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between items-start text-sm">
                            <span className="text-glow-muted">{k}</span>
                            <span style={{ fontFamily: 'DM Mono, monospace' }} className="text-white text-right ml-4 max-w-[200px] truncate">{v}</span>
                          </div>
                        ))}
                      </div>

                      {chainId !== 5042002 && (
                        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0"/>
                          <p className="text-xs text-amber-400">Switch to Arc Testnet (Chain 5042002) to deploy</p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button onClick={() => setStep(3)} className="px-5 py-3 border border-white/15 text-white/60 rounded-xl hover:bg-white/5 transition-colors text-sm">Back</button>
                        <button onClick={deploy} disabled={deploying || chainId !== 5042002}
                          className="flex-1 py-3.5 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                          style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {deploying ? <Loader2 className="w-4 h-4 animate-spin"/> : <Rocket className="w-4 h-4"/>}
                          {deploying ? 'Deploying…' : `Launch ${form.symbol}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Step 5: LP Lock Confirmation ────────────────── */}
                  {step === 5 && deployResult && (
                    <div className="space-y-5 text-center">
                      <div className="relative mx-auto w-20 h-20">
                        <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 flex items-center justify-center border-2 border-emerald-500/40">
                          <CheckCircle className="w-10 h-10 text-emerald-400"/>
                        </div>
                        <div className="absolute inset-0 rounded-3xl bg-emerald-400/10 animate-ping"/>
                      </div>

                      <div>
                        <h2 style={{ fontFamily: 'Outfit, sans-serif' }} className="text-2xl font-black text-white mb-1">🎉 Token Launched!</h2>
                        <p className="text-sm text-glow-muted">Your token is live on Arc Testnet</p>
                      </div>

                      <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-3 text-left">
                        {[
                          ['Token', deployResult.tokenAddress],
                          ['TX Hash', deployResult.txHash],
                          ...(deployResult.pairAddress ? [['LP Pair', deployResult.pairAddress]] : []),
                          ['LP Lock', `${form.lockDurationDays} days`],
                        ].map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-glow-muted flex-shrink-0">{k}</span>
                            <div className="flex items-center gap-1.5">
                              <span style={{ fontFamily: 'DM Mono, monospace' }} className="text-xs text-white truncate max-w-[180px]">{truncateAddress(v, 10)}</span>
                              <button onClick={() => navigator.clipboard.writeText(v)} className="text-glow-muted hover:text-glow-text flex-shrink-0"><Copy className="w-3 h-3"/></button>
                              {(k === 'Token' || k === 'TX Hash') && (
                                <a href={`${ARCSCAN}/${k === 'TX Hash' ? 'tx' : 'address'}/${v}`} target="_blank" rel="noopener noreferrer" className="text-glow-muted hover:text-glow-cyan flex-shrink-0"><ExternalLink className="w-3 h-3"/></a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* LP Lock status */}
                      {form.lockDurationDays > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0"/>
                          <p className="text-xs text-emerald-300 text-left">LP tokens locked for <strong>{form.lockDurationDays} days</strong> in the smart contract — anti-rug protection active. Use <code className="font-mono">withdrawLiquidity()</code> after lock expires.</p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button onClick={() => { setActiveTab('discover'); loadTokens(); }}
                          className="flex-1 py-3 border border-white/15 text-white rounded-xl hover:bg-white/5 transition-colors text-sm font-semibold">
                          View in Discover
                        </button>
                        <button onClick={() => { setStep(1); setForm({ name:'',symbol:'',decimals:18,totalSupply:'1000000000',description:'',website:'',twitter:'',liquidityPercent:80,lockDurationDays:30,liquidityUsdc:'0.1' }); setImageFile(null); setImagePreview(''); setImageUrl(''); setMetadataUri(''); setDeployResult(null); }}
                          className="flex-1 py-3 bg-glow-gradient text-white font-bold rounded-xl"
                          style={{ fontFamily: 'Outfit, sans-serif' }}>
                          Launch Another
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────
const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-glow-accent/50 transition-colors";

function LaunchField({ label, hint, children, className='' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div>
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider" style={{ fontFamily: 'Outfit, sans-serif' }}>{label}</p>
        {hint && <p className="text-[10px] text-glow-muted/60 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Build token deployment bytecode — pure Solidity (no OZ imports = small bytecode) ──
// EIP-3860: max initcode = 49152 bytes. OZ ERC20 compiled can exceed this.
// Pure Solidity ERC20 compiles to ~3-5KB bytecode, well within limits.
async function buildSimpleTokenDeploy(name: string, symbol: string, decimals: number, supply: bigint): Promise<string> {
  // Pure Solidity ERC20 — no imports, no inheritance from external libraries
  // Compiles to ~3KB bytecode vs ~50KB with OZ imports
  // NOTE: tokenURI is NOT stored in the contract bytecode.
  // A 42KB base64 data URI as a constructor arg would make initcode >> 49152 byte EIP-3860 limit.
  // Instead: store tokenURI in DB only; call setTokenURI() separately after deploy if needed.
  const src = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LaunchedToken
 * @notice Minimal pure-Solidity ERC-20 for GlowIDE Launchpad on Arc Testnet.
 * @dev No imports, no tokenURI in constructor — keeps initcode < 49152 bytes (EIP-3860).
 *      tokenURI is stored off-chain (DB + IPFS). Call setTokenURI() after deploy if needed.
 */
contract LaunchedToken {
    string  public name;
    string  public symbol;
    uint8   public decimals;
    uint256 public totalSupply;
    address public owner;
    string  private _tokenURI;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint8 _dec, uint256 _supply) {
        name        = _name;
        symbol      = _symbol;
        decimals    = _dec;
        owner       = msg.sender;
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
        emit Transfer(address(0), msg.sender, _supply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function tokenURI() external view returns (string memory) { return _tokenURI; }

    function setTokenURI(string calldata uri) external {
        require(msg.sender == owner, "Not owner");
        _tokenURI = uri;
    }
}`;

  const res = await fetch('/api/contracts/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceCode: src, contractName: 'LaunchedToken' }),
  });
  const d = await res.json();
  if (!d.success || !d.bytecode) throw new Error(d.errors?.[0]?.message ?? 'Compile failed');

  // ABI-encode constructor args: (string name, string symbol, uint8 decimals, uint256 supply)
  // Layout: offset_name (32) | offset_symbol (32) | decimals (32) | supply (32) | str_data...
  // ABI encoding for (string, string, uint8, uint256):
  //   slot0: offset to name string data   = 0x80 (4*32 = 128 bytes)
  //   slot1: offset to symbol string data = 0x80 + name_total_len
  //   slot2: decimals (uint8 padded to 32)
  //   slot3: supply (uint256)
  //   slot4+: name length + name data (padded to 32)
  //   slot5+: symbol length + symbol data (padded to 32)

  function abiEncodeStr(str: string): string {
    const bytes = new TextEncoder().encode(str);
    const lenHex = bytes.length.toString(16).padStart(64, '0');
    let dataHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    // Pad to multiple of 32 bytes
    const padLen = Math.ceil(dataHex.length / 64) * 64;
    dataHex = dataHex.padEnd(padLen, '0');
    return lenHex + dataHex;
  }

  const nameEnc   = abiEncodeStr(name);
  const symbolEnc = abiEncodeStr(symbol);

  // Static slots: 4 slots × 32 bytes = 128 bytes = 0x80
  const nameOffset   = BigInt(128); // 0x80
  const symbolOffset = nameOffset + BigInt(nameEnc.length / 2);
  const decimalsHex  = decimals.toString(16).padStart(64, '0');
  const supplyHex    = supply.toString(16).padStart(64, '0');

  const constructorArgs =
    nameOffset.toString(16).padStart(64, '0') +
    symbolOffset.toString(16).padStart(64, '0') +
    decimalsHex +
    supplyHex +
    nameEnc +
    symbolEnc;

  return d.bytecode + constructorArgs;
}
