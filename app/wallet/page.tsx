'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWalletStore } from '@/store/walletStore';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { CIRCLE_CHAINS, CCTP_CHAINS, CIRCLE_ASSETS, ARC_CONTRACTS, LOGOS, NETWORKS } from '@/lib/circle-chains';
import { useCryptoLogo, useNetworkLogo, getCryptoLogos } from '@/lib/crypto-logos';
import { CryptoLogo, NetworkLogo } from '@/components/wallet/CryptoLogo';
import { SwapPanel } from '@/components/wallet/SwapPanel';
import { WalletSwitcher, type StoredWallet as SW, loadWallets, saveWallets, getActiveId, setActiveId } from '@/components/wallet/WalletSwitcher';
import { useCircleLogos } from '@/hooks/useCircleLogos';

// Helper: use LOGOS inline SVG as fallback (never fails)
function circleLogo(sym: string, _color: string): string {
  return LOGOS[sym.toLowerCase()] ?? '';
}
import {
  Send, QrCode, ArrowLeftRight, History, Zap, RefreshCw, Copy,
  CheckCircle, ExternalLink, Loader2, ChevronDown, ArrowRight,
  Search, Plus, Trash2, Globe, AlertTriangle, ArrowLeft, Eye, EyeOff,
  Wallet, Key, Shield, Download, Upload as UploadIcon, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/utils';
import toast from 'react-hot-toast';
import QRCodeLib from 'qrcode';
import { ethers } from 'ethers';

const ARCSCAN = 'https://testnet.arcscan.app';
const ARC_RPC  = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';

// ── balanceOf(address) selector ───────────────────────────────────────────────
function balanceOfData(addr: string) {
  return '0x70a08231' + addr.replace(/^0x/i,'').toLowerCase().padStart(64,'0');
}

type EthProvider = { request:(a:{method:string;params?:unknown[]})=>Promise<unknown> };

// ── Multi-wallet store ─────────────────────────────────────────────────────────
interface StoredWallet {
  id: string; label: string; address: string;
  encryptedKey?: string; // base64 encrypted private key (hex)
  source: 'injected' | 'imported' | 'generated';
  createdAt: number;
}
function useWalletStore2() {
  const SKEY = 'glowide_wallets_v2';
  const load = (): StoredWallet[] => { try { return JSON.parse(localStorage.getItem(SKEY) ?? '[]'); } catch { return []; } };
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [activeId, setActiveIdState] = useState<string>('injected');
  useEffect(() => { setWallets(load()); const aid = localStorage.getItem('glowide_active_wallet') ?? 'injected'; setActiveIdState(aid); }, []);
  const save = (ws: StoredWallet[]) => { localStorage.setItem(SKEY, JSON.stringify(ws)); setWallets(ws); };
  const setActiveId = (id: string) => { localStorage.setItem('glowide_active_wallet', id); setActiveIdState(id); };
  const addWallet = (w: StoredWallet) => save([...wallets.filter(x=>x.id!==w.id), w]);
  const removeWallet = (id: string) => save(wallets.filter(w=>w.id!==id));
  return { wallets, activeId, setActiveId, addWallet, removeWallet };
}

// ── Custom token store ─────────────────────────────────────────────────────────
interface Token { symbol:string; name:string; address:string; decimals:number; logo?:string; color:string; networkId:string; balance?:string; }
function useTokenStore(walletAddress?: string) {
  // Tokens keyed per wallet address so each wallet has its own token list
  const KEY = walletAddress ? `glowide_tokens_${walletAddress.toLowerCase()}` : 'glowide_tokens';
  const load = (): Token[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
  const [tokens, setTokens] = useState<Token[]>([]);
  useEffect(() => setTokens(load()), [KEY]);
  const save2 = (t: Token[]) => { localStorage.setItem(KEY, JSON.stringify(t)); setTokens(t); };
  return {
    tokens,
    addToken: (t: Token) => save2([...tokens.filter(x=>x.address!==t.address), t]),
    removeToken: (addr: string) => save2(tokens.filter(t=>t.address!==addr)),
  };
}

// ── QR code (real, using qrcode library) ─────────────────────────────────────
function QRCode({ address }: { address: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !address) return;
    QRCodeLib.toCanvas(canvasRef.current, address, {
      width: 200, margin: 2,
      color: { dark: '#0f0f1e', light: '#ffffff' },
    }).catch(console.error);
  }, [address]);
  return (
    <div className="bg-white rounded-2xl p-3 inline-block shadow-lg">
      <canvas ref={canvasRef}/>
    </div>
  );
}

// ── Network logo img ──────────────────────────────────────────────────────────
function NetLogo({ src, name, networkId, size=24 }: { src:string; name:string; networkId?:string; size?:number }) {
  // If src is an admin-uploaded logo (data URI or https URL), use it as resolvedLogo
  // so it takes priority over CryptoCompare and never gets overridden
  const isAdminLogo = src && (src.startsWith('data:') || src.startsWith('https://'));
  if (networkId) return <NetworkLogo networkId={networkId} fallbackLogo={src} resolvedLogo={isAdminLogo ? src : undefined} size={size}/>;
  return <CryptoLogo symbol={name.split(' ')[0]} fallbackLogo={src} resolvedLogo={isAdminLogo ? src : undefined} size={size}/>;
}

// ── CCTP Destination Dropdown ─────────────────────────────────────────────────
function CCTPNetworkDropdown({ value, onChange, arcLogoUrl='' }: { value:string; onChange:(id:string)=>void; arcLogoUrl?:string }) {
  const [open, setOpen] = useState(false);
  const chains = CCTP_CHAINS.map(c => c.id==='arc-testnet' && arcLogoUrl ? {...c,logo:arcLogoUrl} : c);
  const selected = chains.find(c=>c.id===value) ?? chains[1];
  return (
    <div className="relative">
      <button onClick={()=>setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-glow-bg border border-glow-border rounded-xl hover:border-glow-accent/40 transition-colors text-left">
        <NetLogo src={selected.logo} name={selected.name} networkId={selected.id} size={28}/>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-glow-text">{selected.shortName}</p>
          <p className="text-[10px] text-glow-muted">{selected.name}</p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-glow-muted transition-transform flex-shrink-0", open && "rotate-180")}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={()=>setOpen(false)}/>
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#0e0e1a] border border-glow-border rounded-2xl shadow-2xl z-40 max-h-72 overflow-y-auto animate-fade-in">
            <p className="text-[10px] font-semibold text-glow-muted uppercase tracking-widest px-4 py-2.5 border-b border-glow-border/50">Select Destination Network</p>
            {chains.filter(c=>c.id!=='arc-testnet').map(c=>(
              <button key={c.id} onClick={()=>{onChange(c.id);setOpen(false);}}
                className={cn("w-full flex items-center gap-3 px-4 py-3 hover:bg-glow-card/60 transition-colors",
                  value===c.id && "bg-glow-accent/10")}>
                <NetLogo src={c.logo} name={c.name} networkId={c.id} size={36}/>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-glow-text">{c.name}</p>
                  <p className="text-[10px] text-glow-muted">{c.ecosystem}</p>
                </div>
                {value===c.id && <CheckCircle className="w-4 h-4 text-glow-accent flex-shrink-0"/>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Network selection dropdown (MetaMask-style) ───────────────────────────────
function NetworkDropdown({ selected, onChange, arcLogoUrl='' }: { selected:string; onChange:(id:string)=>void; arcLogoUrl?:string }) {
  const [open, setOpen] = useState(false);
  const chains = CIRCLE_CHAINS.map(c => c.id==='arc-testnet' && arcLogoUrl ? {...c,logo:arcLogoUrl} : c);
  const chain = chains.find(c=>c.id===selected) ?? chains[0];
  return (
    <div className="relative">
      <button onClick={()=>setOpen(!open)}
        className="flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 bg-glow-card/80 border border-glow-border rounded-xl text-xs text-glow-text hover:border-glow-accent/40 transition-colors">
        <NetLogo src={chain.logo} name={chain.name} networkId={chain.id} size={20}/>
        <span className="hidden sm:block truncate max-w-[90px] font-medium">{chain.shortName}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-glow-muted flex-shrink-0 transition-transform", open && "rotate-180")}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={()=>setOpen(false)}/>
          <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#0e0e1a] border border-glow-border rounded-2xl shadow-2xl z-40 overflow-hidden animate-fade-in max-h-80 overflow-y-auto">
            <div className="sticky top-0 bg-[#0e0e1a] px-3 py-2 border-b border-glow-border">
              <p className="text-[10px] font-semibold text-glow-muted uppercase tracking-wider">Select Network</p>
            </div>
            {chains.map(c=>(
              <button key={c.id} onClick={()=>{onChange(c.id);setOpen(false);}}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 hover:bg-glow-card/60 transition-colors text-left", selected===c.id && "bg-glow-accent/10")}>
                <NetLogo src={c.logo} name={c.name} networkId={c.id} size={32}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-glow-text truncate">{c.name}</p>
                  <p className="text-[10px] text-glow-muted">{c.ecosystem}{c.cctpSupported?' · CCTP':''}</p>
                </div>
                {selected===c.id && <CheckCircle className="w-4 h-4 text-glow-accent flex-shrink-0"/>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Token Logo ────────────────────────────────────────────────────────────────
function TokenLogo({ src, symbol, color, size=48 }: { src?:string; symbol:string; color:string; size?:number }) {
  const [err, setErr] = useState(false);
  const isData = src?.startsWith('data:');
  if (!src || (err && !isData)) return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{width:size, height:size, background:color, fontSize:size*0.28}}>
      {symbol.slice(0,2)}
    </div>
  );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={symbol} width={size} height={size} className="rounded-full object-contain flex-shrink-0"
    onError={()=>!isData && setErr(true)}/>;
}

// ── History item ──────────────────────────────────────────────────────────────
interface HistoryItem { hash:string; type:'send'|'receive'|'swap'|'cctp'; amount:string; symbol:string; timestamp:number; to?:string; from?:string; status:'success'|'pending'|'failed'; }

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function WalletPage() {
  const { address, isConnected, chainId } = useWalletStore();
  const siteSettings = useSiteSettings();
  const [wallets, setWallets] = useState<SW[]>([]);
  const [activeWalletId, setActiveWalletId] = useState('injected');
  const [activePrivKey, setActivePrivKey] = useState<string|null>(null); // null = use injected
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);

  useEffect(()=>{
    setWallets(loadWallets());
    setActiveWalletId(getActiveId());
  }, []);

  const addWallet = (w: SW) => { const next=[...wallets.filter(x=>x.id!==w.id),w]; setWallets(next); saveWallets(next); };
  const removeWallet = (id: string) => { const next=wallets.filter(w=>w.id!==id); setWallets(next); saveWallets(next); if(activeWalletId===id){setActiveWalletId('injected');setActiveId('injected');setActivePrivKey(null);} };
  const switchWallet = (id: string, addr: string, pk: string|null) => {
    setActiveWalletId(id); setActiveId(id); setActivePrivKey(pk);
    setShowSwitcher(false);
    toast.success('Switched to '+(id==='injected'?'Browser Wallet':wallets.find(w=>w.id===id)?.label??addr.slice(0,10)));
  };
  const activeAddress = activeWalletId==='injected' ? address : (wallets.find(w=>w.id===activeWalletId)?.address ?? address);
  const { tokens, addToken, removeToken } = useTokenStore(activeAddress ?? address ?? undefined);

  type Panel = 'assets'|'send'|'receive'|'swap'|'cctp'|'history'|'addToken'|'asset'|'manageWallets'|'importWallet'|'newWallet';
  const [panel, setPanel]       = useState<Panel>('assets');
  const [activeAsset, setActiveAsset] = useState('');
  const [networkId, setNetworkId]     = useState('arc-testnet');
  const [loading, setLoading]         = useState(false);
  const [copied, setCopied]           = useState(false);
  const [history, setHistory]         = useState<HistoryItem[]>([]);

  const [balances, setBalances] = useState<Record<string,string>>({});

  // Send form
  const [sendTo, setSendTo]   = useState('');
  const [sendAmt, setSendAmt] = useState('');
  const [sending, setSending] = useState(false);

  // Swap
  const [swapFrom, setSwapFrom]     = useState('USDC');
  const [swapTo2, setSwapTo2]       = useState('EURC');
  const [swapAmt, setSwapAmt]       = useState('');
  const [crossChain, setCrossChain] = useState(false);
  const [destChainId, setDestChainId] = useState('eth-sepolia');

  // CCTP
  const [cctpAmt, setCctpAmt]   = useState('');
  const [cctpTo, setCctpTo]     = useState('');
  const [cctpDest, setCctpDest] = useState('eth-sepolia');
  const [cctping, setCctping]   = useState(false);

  // Add token
  const [newTokenAddr, setNewTokenAddr]   = useState('');
  const [tokenLoading, setTokenLoading]   = useState(false);
  const [newTokenInfo, setNewTokenInfo]   = useState<{symbol:string;name:string;decimals:number}|null>(null);

  // Wallet management
  const [importKey, setImportKey]         = useState('');
  const [showImportKey, setShowImportKey] = useState(false);
  const [importLabel, setImportLabel]     = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [generatedWallet, setGeneratedWallet] = useState<{address:string;mnemonic:string;privateKey:string}|null>(null);
  const [showPrivKey, setShowPrivKey]     = useState(false);

  const provider = isConnected ? (window as Window & {ethereum?:EthProvider}).ethereum : undefined;

  // ── Fetch balances ──────────────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    const walAddr = activeAddress ?? address;
    if (!walAddr) return;
    setLoading(true);
    try {
      // USDC native balance (18 decimal wei → display with 6 sig figs)
      const hexBal = await fetch(ARC_RPC, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getBalance',params:[walAddr,'latest']}),
        cache:'no-store',
      }).then(r=>r.json()).then(d=>d.result??'0x0');

      let usdcBal = '0.000000';
      try {
        const hex = hexBal;
        if (hex && hex !== '0x' && hex.length > 2) {
          const raw = BigInt(hex.startsWith('0x')?hex:'0x'+hex);
          const whole = raw / 1000000000000000000n;
          const rem   = (raw % 1000000000000000000n) / 1000000000000n; // 6 dp
          usdcBal = whole.toString() + '.' + rem.toString().padStart(6,'0');
        }
      } catch { usdcBal='0.000000'; }

      // ERC-20 tokens: EURC + cirBTC (real Arc addresses) + USYC + custom tokens
      const erc20s = [
        { key:'EURC',   addr: CIRCLE_ASSETS.EURC.address!,   dec: CIRCLE_ASSETS.EURC.decimals   },
        { key:'cirBTC', addr: CIRCLE_ASSETS.cirBTC.address!,  dec: CIRCLE_ASSETS.cirBTC.decimals  },
        { key:'USYC',   addr: ARC_CONTRACTS.USYC,             dec: 6                              },
        ...tokens.filter(t=>t.networkId===networkId).map(t=>({key:t.symbol,addr:t.address,dec:t.decimals})),
      ];

      const results = await Promise.allSettled(erc20s.map(async ({addr,dec})=>{
        try {
          const res = await fetch(ARC_RPC,{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:addr,data:balanceOfData(walAddr)},'latest']}),
            cache:'no-store',
          });
          const d = await res.json();
          const hex = d.result ?? '0x0';
          if (!hex || hex === '0x' || hex.length <= 2) return '0.000000';
          const raw = BigInt(hex.startsWith('0x')?hex:'0x'+hex);
          if (raw === 0n) return '0.000000';
          const pow = BigInt(10)**BigInt(dec);
          const w = raw/pow;
          const r = raw%pow;
          return w.toString() + '.' + r.toString().padStart(dec,'0').slice(0,6);
        } catch { return '0.000000'; }
      }));

      const next: Record<string,string> = { USDC: usdcBal };
      erc20s.forEach(({key},i)=>{
        const r = results[i];
        next[key] = r.status==='fulfilled' ? r.value : '0.000000';
      });
      // balances already populated above for cirBTC, EURC, USYC
      setBalances(next);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [address, activeAddress, networkId, tokens]);

  useEffect(()=>{ if(isConnected && (address||activeAddress)) fetchBalances(); },[isConnected,address,activeAddress,fetchBalances]);

  // ── USD prices ──────────────────────────────────────────────────────────────
  const USD: Record<string,number> = { USDC:1, EURC:1.12, cirBTC:108000 };
  const getUSD = (sym:string, bal:string) => ((parseFloat(bal||'0')||0) * (USD[sym]??0)).toFixed(2);
  const totalUSD = ['USDC','EURC','cirBTC',...tokens.map(t=>t.symbol)]
    .reduce((s,sym)=> s + (parseFloat(balances[sym]||'0')||0)*(USD[sym]??0), 0);

  // ── Assets list ─────────────────────────────────────────────────────────────
  const cl = useCircleLogos();
  const nativeAssets = [
    { symbol:'USDC',   name:'USD Coin',      logo:cl.USDC,   color:CIRCLE_ASSETS.USDC.color,   isGas:true  },
    { symbol:'EURC',   name:'Euro Coin',     logo:cl.EURC,   color:CIRCLE_ASSETS.EURC.color,   isGas:false },
    { symbol:'cirBTC', name:'Circle Bitcoin', logo:cl.cirBTC, color:CIRCLE_ASSETS.cirBTC.color, isGas:false },
    { symbol:'USYC',   name:'USYC (Hashnote)', logo:cl.USYC,  color:'#047857', isGas:false },
  ];
  const customAssets = tokens.filter(t=>t.networkId===networkId);
  const allAssets = [...nativeAssets, ...customAssets.map(t=>({symbol:t.symbol,name:t.name,logo:t.logo,color:t.color,isGas:false}))];
  const currentAsset = allAssets.find(a=>a.symbol===activeAsset);

  // ── Send ────────────────────────────────────────────────────────────────────
  const executeSend = async () => {
    if (!sendTo || !sendAmt || !address || !provider) { toast.error('Fill all fields'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(sendTo)) { toast.error('Invalid address'); return; }
    setSending(true);
    try {
      const sym = activeAsset || 'USDC';
      const dec = sym === 'EURC' ? 6 : sym === 'cirBTC' ? 8 : 18;
      const amtWei = BigInt(Math.round(parseFloat(sendAmt) * 10**dec));
      let txHash: string;

      if (sym === 'EURC') {
        // ERC-20 transfer: transfer(address,uint256)
        const sel = '0xa9059cbb';
        const toHex = sendTo.replace(/^0x/i,'').padStart(64,'0');
        const amtHex = amtWei.toString(16).padStart(64,'0');
        txHash = await provider.request({ method:'eth_sendTransaction', params:[{from:address, to:CIRCLE_ASSETS.EURC.address, data:'0x'+sel+toHex+amtHex}] }) as string;
      } else {
        // Native USDC
        txHash = await provider.request({ method:'eth_sendTransaction', params:[{from:address, to:sendTo, value:'0x'+amtWei.toString(16)}] }) as string;
      }
      toast.success('Transaction sent!');
      setHistory(h=>[{hash:txHash,type:'send',amount:sendAmt,symbol:sym,timestamp:Date.now(),to:sendTo,status:'success'},...h]);
      setSendTo(''); setSendAmt(''); setPanel('assets');
      setTimeout(fetchBalances, 5000);
    } catch(e:unknown){ toast.error(((e as Error).message??'Failed').slice(0,80)); }
    finally { setSending(false); }
  };

  // ── CCTP ────────────────────────────────────────────────────────────────────
  const executeCCTP = async () => {
    if (!cctpTo||!cctpAmt||!address||!provider){toast.error('Fill all fields');return;}
    if(!/^0x[0-9a-fA-F]{40}$/.test(cctpTo)){toast.error('Invalid address');return;}
    setCctping(true);
    try {
      const amtWei = BigInt(Math.round(parseFloat(cctpAmt)*1e6)); // USDC 6 dec
      const destChain = CIRCLE_CHAINS.find(c=>c.id===cctpDest)!;
      // TokenMessengerV2.depositForBurn(amount, destinationDomain, mintRecipient, burnToken)
      // selector: keccak4("depositForBurn(uint256,uint32,bytes32,address)") 
      const sel = '0x6fd3504e';
      const amtHex   = amtWei.toString(16).padStart(64,'0');
      const domHex   = destChain.cctpDomain.toString(16).padStart(64,'0');
      const recipHex = cctpTo.replace(/^0x/i,'').toLowerCase().padStart(64,'0');
      const burnTok  = CIRCLE_ASSETS.EURC.address!.replace(/^0x/i,'').toLowerCase().padStart(64,'0'); // USDC ERC-20
      const data = '0x'+sel+amtHex+domHex+recipHex+burnTok;
      const txHash = await provider.request({ method:'eth_sendTransaction', params:[{from:address, to:ARC_CONTRACTS.TOKEN_MESSENGER_V2, data}] }) as string;
      toast.success('CCTP transfer sent!');
      setHistory(h=>[{hash:txHash,type:'cctp',amount:cctpAmt,symbol:'USDC',timestamp:Date.now(),to:destChain.name,status:'success'},...h]);
      setCctpTo(''); setCctpAmt(''); setPanel('assets');
    } catch(e:unknown){ toast.error(((e as Error).message??'Failed').slice(0,80)); }
    finally { setCctping(false); }
  };

  // ── Add token ───────────────────────────────────────────────────────────────
  const lookupToken = async () => {
    const addr = newTokenAddr.trim();
    if(!/^0x[0-9a-fA-F]{40}$/.test(addr)){toast.error('Invalid EVM contract address (0x…)');return;}
    setTokenLoading(true);
    setNewTokenInfo(null);
    try {
      const selectedNet = NETWORKS.find(n => n.id === networkId);
      const apiBase = selectedNet?.explorerApi ?? 'https://testnet.arcscan.app/api/v2';

      // 1. Try the selected network's Blockscout API
      let found = false;
      try {
        const res = await fetch(`${apiBase}/tokens/${addr}`, {signal: AbortSignal.timeout(5000)});
        if(res.ok){
          const d = await res.json() as Record<string,unknown>;
          if(d.symbol){
            setNewTokenInfo({symbol:String(d.symbol),name:String(d.name??d.symbol),decimals:parseInt(String(d.decimals??'18'))});
            found = true;
          }
        }
      } catch { /* try next */ }

      // 2. Try DexScreener (works for most EVM tokens)
      if (!found) {
        try {
          const ds = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, {signal: AbortSignal.timeout(5000)});
          if(ds.ok){
            const d = await ds.json() as {pairs?:Array<{baseToken?:{symbol?:string;name?:string};quoteToken?:{symbol?:string;name?:string}}>};
            const pair = d.pairs?.[0];
            if(pair?.baseToken?.symbol){
              // baseToken is likely the one we searched
              const tok = pair.baseToken.symbol?.toLowerCase() === addr.slice(-4).toLowerCase() ? pair.quoteToken : pair.baseToken;
              setNewTokenInfo({
                symbol: tok?.symbol ?? addr.slice(2,8).toUpperCase(),
                name:   tok?.name   ?? 'Unknown Token',
                decimals: 18,
              });
              found = true;
            }
          }
        } catch { /* try next */ }
      }

      // 3. Try eth_call to read EVM name/symbol/decimals directly from RPC
      if (!found) {
        const rpc = selectedNet?.rpc ?? ARC_RPC;
        async function rpcCall(data: string): Promise<string> {
          const r = await fetch(rpc, {method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:addr,data},'latest']}),cache:'no-store'});
          const d = await r.json() as {result?:string};
          return d.result ?? '0x';
        }
        try {
          // symbol() = 0x95d89b41, name() = 0x06fdde03, decimals() = 0x313ce567
          const [symHex, nameHex, decHex] = await Promise.all([
            rpcCall('0x95d89b41'), rpcCall('0x06fdde03'), rpcCall('0x313ce567'),
          ]);
          function decodeString(hex: string): string {
            if(!hex || hex==='0x') return '';
            // ABI string: offset(32) + length(32) + data
            const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
            if(clean.length < 128) return '';
            const len = parseInt(clean.slice(64,128), 16);
            const str = clean.slice(128, 128 + len*2);
            return decodeURIComponent(str.match(/.{1,2}/g)?.map(b=>'%'+b).join('')??'');
          }
          const sym = decodeString(symHex) || addr.slice(2,8).toUpperCase();
          const nm  = decodeString(nameHex) || sym;
          const dec = decHex && decHex!=='0x' ? parseInt(decHex,16) : 18;
          setNewTokenInfo({symbol:sym, name:nm, decimals:isNaN(dec)?18:dec});
          found = true;
        } catch { /* use fallback */ }
      }

      if (!found) {
        // Fallback: create entry with address-derived values
        setNewTokenInfo({symbol:addr.slice(2,8).toUpperCase(), name:'Custom Token', decimals:18});
        toast('Token found by address — name/symbol fetched from contract', {icon:'ℹ️'});
      }
    } catch(e){
      toast.error('Lookup failed: ' + ((e as Error).message ?? '').slice(0,60));
    }
    finally { setTokenLoading(false); }
  };
  const confirmAddToken = () => {
    if(!newTokenInfo) return;
    const colors=['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444'];
    addToken({symbol:newTokenInfo.symbol,name:newTokenInfo.name,address:newTokenAddr,decimals:newTokenInfo.decimals,color:colors[Math.floor(Math.random()*colors.length)],networkId});
    toast.success(newTokenInfo.symbol+' added!');
    setNewTokenAddr(''); setNewTokenInfo(null); setPanel('assets');
  };

  // ── Wallet: generate new ─────────────────────────────────────────────────────
  const generateWallet = () => {
    const wallet = ethers.Wallet.createRandom();
    setGeneratedWallet({ address:wallet.address, mnemonic:wallet.mnemonic!.phrase, privateKey:wallet.privateKey });
  };
  const saveGeneratedWallet = () => {
    if(!generatedWallet) return;
    addWallet({ id:generatedWallet.address, label:importLabel||'Wallet '+Date.now(), address:generatedWallet.address, encryptedKey:btoa(generatedWallet.privateKey), source:'generated', createdAt:Date.now() });
    toast.success('Wallet saved!');
    setGeneratedWallet(null); setImportLabel(''); setPanel('manageWallets');
  };

  // ── Wallet: import ──────────────────────────────────────────────────────────
  const importWallet = async () => {
    if(!importKey.trim()){toast.error('Enter private key or seed phrase');return;}
    setImportLoading(true);
    try {
      let wallet: ethers.Wallet | ethers.HDNodeWallet;
      const k = importKey.trim();
      // Check if it's a mnemonic (12/24 words) or private key
      if (k.split(' ').length >= 12) {
        wallet = ethers.Wallet.fromPhrase(k);
      } else {
        const pk = k.startsWith('0x') ? k : '0x'+k;
        wallet = new ethers.Wallet(pk);
      }
      addWallet({ id:wallet.address, label:importLabel||'Imported Wallet', address:wallet.address, encryptedKey:btoa(wallet.privateKey), source:'imported', createdAt:Date.now() });
      setActiveId(wallet.address);
      toast.success('Wallet imported: '+wallet.address.slice(0,10)+'…');
      setImportKey(''); setImportLabel(''); setPanel('manageWallets');
    } catch(e:unknown){ toast.error('Invalid key or mnemonic'); }
    finally { setImportLoading(false); }
  };

  // ── Not connected ───────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <AppLayout title="Wallet">
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-glow-gradient flex items-center justify-center shadow-glow-lg">
              <Wallet className="w-10 h-10 text-white"/>
            </div>
            <div className="absolute inset-0 rounded-3xl bg-glow-accent/15 animate-ping"/>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-glow-text">{siteSettings.siteName} Wallet</h2>
            <p className="text-sm text-glow-muted mt-1.5">USDC · EURC · cirBTC · CCTP Cross-Chain</p>
          </div>
          <WalletButton/>
        </div>
      </AppLayout>
    );
  }

  const inputCls = "w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/60 transition-colors";

  return (
    <AppLayout title="Wallet">
      <div className="flex h-[calc(100dvh-56px)] overflow-hidden">

        {/* ── Desktop Left Sidebar ─────────────────────────────────── */}
        <div className="hidden md:flex flex-col w-80 flex-shrink-0 border-r border-glow-border bg-[#080812]">
          <div className="px-4 pt-5 pb-4 border-b border-glow-border/50">
            <div className="flex items-center justify-between mb-3">
              <button onClick={()=>setShowSwitcher(true)} className="flex-1 text-left hover:opacity-80 transition-opacity">
                <p className="text-[10px] text-glow-muted font-semibold uppercase tracking-widest">{siteSettings.siteName} Wallet</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs font-mono text-glow-text/70">{truncateAddress(activeAddress??address??'',8)}</p>
                  {activeWalletId!=='injected' && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">{wallets.find(w=>w.id===activeWalletId)?.label?.slice(0,10)}</span>}
                </div>
              </button>
              <div className="flex items-center gap-1.5">
                <button onClick={()=>setPanel('manageWallets')} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center border border-white/10 text-white/60 hover:text-white transition-colors" title="Wallet Settings">
                  <Key className="w-3.5 h-3.5"/>
                </button>
                <button onClick={fetchBalances} className={cn("w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center border border-white/10",loading&&"opacity-60")}>
                  <RefreshCw className={cn("w-3.5 h-3.5 text-white/70",loading&&"animate-spin")}/>
                </button>
              </div>
            </div>
            <NetworkDropdown selected={networkId} onChange={setNetworkId} arcLogoUrl={siteSettings.arcLogoUrl}/>
          </div>
          <div className="px-4 py-4 border-b border-glow-border/30">
            <p className="text-[11px] text-glow-muted mb-1">Total Portfolio</p>
            <p className="text-3xl font-bold text-white">${totalUSD.toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-glow-border/30">
            {[{icon:Send,label:'Send',p:'send'},{icon:QrCode,label:'Receive',p:'receive'},{icon:Zap,label:'CCTP',p:'cctp'},{icon:History,label:'History',p:'history'}].map(({icon:Icon,label,p})=>(
              <button key={label} onClick={()=>setPanel(panel===p?'assets':p as Panel)}
                className={cn("flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",panel===p?"bg-glow-accent/20 border-glow-accent/40 text-glow-accent-light":"bg-white/5 border-white/8 text-white/70 hover:bg-white/10")}>
                <Icon className="w-4 h-4"/><span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            <div className="flex items-center justify-between px-4 py-1.5">
              <p className="text-[10px] font-semibold text-glow-muted uppercase tracking-wider">Assets</p>
              <button onClick={()=>setPanel('addToken')} className="p-1 text-glow-muted hover:text-glow-accent"><Plus className="w-3.5 h-3.5"/></button>
            </div>
            {allAssets.map(asset=>(
              <button key={asset.symbol} onClick={()=>{setActiveAsset(asset.symbol);setPanel('asset');}}
                className={cn("w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors",panel==='asset'&&activeAsset===asset.symbol&&"bg-glow-accent/10")}>
                <TokenLogo src={asset.logo} symbol={asset.symbol} color={asset.color} size={36}/>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-white">{asset.symbol}</p>
                  <p className="text-[11px] text-glow-muted truncate">{asset.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{parseFloat(balances[asset.symbol]||'0').toFixed(asset.symbol==='cirBTC'?6:2)}</p>
                  <p className="text-[11px] text-glow-muted">${getUSD(asset.symbol,balances[asset.symbol]||'0')}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-glow-surface">
          {/* Mobile header */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-glow-border bg-[#080812] flex-shrink-0">
            <button onClick={()=>setShowSwitcher(true)} className="flex-1 text-left">
              <p className="text-[10px] text-glow-muted uppercase tracking-widest">{siteSettings.siteName}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-mono text-glow-text/70">{truncateAddress(activeAddress??address??'',6)}</p>
                {activeWalletId!=='injected' && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">{wallets.find(w=>w.id===activeWalletId)?.label?.slice(0,8)}</span>}
              </div>
            </button>
            <NetworkDropdown selected={networkId} onChange={setNetworkId} arcLogoUrl={siteSettings.arcLogoUrl}/>
            <button onClick={()=>setPanel('manageWallets')} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center border border-white/10 text-white/60"><Key className="w-3.5 h-3.5"/></button>
            <button onClick={fetchBalances} className={cn("w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center border border-white/10",loading&&"opacity-60")}>
              <RefreshCw className={cn("w-4 h-4 text-white/70",loading&&"animate-spin")}/>
            </button>
          </div>
          <div className="md:hidden bg-[#080812] px-4 pb-3">
            <p className="text-[10px] text-glow-muted mb-0.5">Total Portfolio</p>
            <p className="text-2xl font-bold text-white">${totalUSD.toFixed(2)}</p>
          </div>
          <div className="md:hidden grid grid-cols-4 gap-1.5 px-3 py-2.5 bg-[#080812] border-b border-glow-border flex-shrink-0">
            {[{icon:Send,label:'Send',p:'send'},{icon:QrCode,label:'Receive',p:'receive'},{icon:Zap,label:'CCTP',p:'cctp'},{icon:History,label:'History',p:'history'}].map(({icon:Icon,label,p})=>(
              <button key={label} onClick={()=>setPanel(panel===p?'assets':p as Panel)}
                className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border text-center transition-all",panel===p?"bg-glow-accent/20 border-glow-accent/40 text-glow-accent-light":"bg-white/5 border-white/8 text-white/60")}>
                <Icon className="w-4 h-4"/><span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ASSETS panel */}
            {panel==='assets' && (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-glow-text">Assets</h2>
                  <button onClick={()=>setPanel('addToken')} className="flex items-center gap-1 text-xs text-glow-accent hover:text-glow-accent-light">
                    <Plus className="w-3.5 h-3.5"/>Add Token
                  </button>
                </div>
                {allAssets.map(asset=>(
                  <button key={asset.symbol} onClick={()=>{setActiveAsset(asset.symbol);setPanel('asset');}}
                    className="w-full flex items-center gap-3 p-3.5 bg-glow-card border border-glow-border rounded-2xl hover:border-glow-accent/30 transition-all text-left">
                    <TokenLogo src={asset.logo} symbol={asset.symbol} color={asset.color} size={48}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-base font-bold text-glow-text">{asset.symbol}</p>
                        {asset.isGas && <span className="text-[9px] bg-glow-accent/15 text-glow-accent-light border border-glow-accent/25 px-1.5 py-0.5 rounded-full">GAS</span>}
                        {asset.symbol==='cirBTC' && <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded-full">Soon</span>}
                      </div>
                      <p className="text-xs text-glow-muted">{asset.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-glow-text">{parseFloat(balances[asset.symbol]||'0').toFixed(asset.symbol==='cirBTC'?6:4)}</p>
                      <p className="text-xs text-glow-muted">${getUSD(asset.symbol,balances[asset.symbol]||'0')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ASSET detail */}
            {panel==='asset' && currentAsset && (
              <div className="p-4 space-y-4">
                <button onClick={()=>setPanel('assets')} className="flex items-center gap-1.5 text-sm text-glow-muted hover:text-glow-text"><ArrowLeft className="w-4 h-4"/>Back</button>
                <div className="flex items-center gap-4 p-4 bg-glow-card border border-glow-border rounded-2xl">
                  <TokenLogo src={currentAsset.logo} symbol={currentAsset.symbol} color={currentAsset.color} size={56}/>
                  <div>
                    <p className="text-xl font-bold text-glow-text">{parseFloat(balances[currentAsset.symbol]||'0').toFixed(currentAsset.symbol==='cirBTC'?8:4)}</p>
                    <p className="text-sm text-glow-muted">{currentAsset.name}</p>
                    <p className="text-sm text-glow-cyan font-semibold">${getUSD(currentAsset.symbol,balances[currentAsset.symbol]||'0')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[{icon:Send,label:'Send',fn:()=>{setSendAmt('');setSendTo('');setPanel('send');}},{icon:QrCode,label:'Receive',fn:()=>setPanel('receive')},{icon:ArrowLeftRight,label:'Swap',fn:()=>{setSwapFrom(currentAsset.symbol);setPanel('swap');}},{icon:Zap,label:'CCTP Transfer',fn:()=>setPanel('cctp')}].map(({icon:Icon,label,fn})=>(
                    <button key={label} onClick={fn} className="flex items-center gap-2 p-3 bg-glow-card border border-glow-border rounded-xl hover:border-glow-accent/40 hover:bg-glow-accent/5 transition-all text-sm text-glow-muted hover:text-glow-text">
                      <Icon className="w-4 h-4 text-glow-accent flex-shrink-0"/>{label}
                    </button>
                  ))}
                </div>
                {customAssets.find(t=>t.symbol===currentAsset.symbol) && (
                  <button onClick={()=>{removeToken(customAssets.find(t=>t.symbol===currentAsset.symbol)!.address);setPanel('assets');}} className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300">
                    <Trash2 className="w-3.5 h-3.5"/>Remove token
                  </button>
                )}
              </div>
            )}

            {/* SEND — advanced with summary */}
            {panel==='send' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPanel(activeAsset?'asset':'assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">Send</h2>
                </div>
                {/* Asset selector pills */}
                <div className="flex gap-2 flex-wrap">
                  {allAssets.filter(a=>a.symbol!=='cirBTC').map(a=>(
                    <button key={a.symbol} onClick={()=>setActiveAsset(a.symbol)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",activeAsset===a.symbol?"bg-glow-accent/20 border-glow-accent/40 text-glow-accent-light":"bg-glow-card border-glow-border text-glow-muted hover:text-glow-text")}>
                      <TokenLogo src={a.logo} symbol={a.symbol} color={a.color} size={16}/>{a.symbol}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Recipient</label>
                    <input value={sendTo} onChange={e=>setSendTo(e.target.value)} placeholder="0x… address" className={cn(inputCls,'font-mono text-xs')}/>
                    {sendTo && !/^0x[0-9a-fA-F]{40}$/.test(sendTo) && <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Invalid address</p>}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Amount</label>
                    <div className="relative">
                      <input value={sendAmt} onChange={e=>setSendAmt(e.target.value)} type="number" placeholder="0.00" min="0" className={cn(inputCls,'text-lg font-bold pr-20')}/>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-glow-cyan font-bold">{activeAsset||'USDC'}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-glow-muted">Balance: <span className="text-glow-text font-semibold">{parseFloat(balances[activeAsset||'USDC']||'0').toFixed(4)} {activeAsset||'USDC'}</span></p>
                      <button onClick={()=>setSendAmt(balances[activeAsset||'USDC']||'0')} className="text-xs text-glow-accent hover:text-glow-accent-light">MAX</button>
                    </div>
                  </div>
                </div>
                {/* Summary */}
                {sendTo && sendAmt && parseFloat(sendAmt) > 0 && /^0x[0-9a-fA-F]{40}$/.test(sendTo) && (
                  <div className="bg-glow-card border border-glow-accent/20 rounded-2xl p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Transaction Summary</p>
                    {[
                      ['Sending', `${sendAmt} ${activeAsset||'USDC'}`],
                      ['To',       truncateAddress(sendTo,10)],
                      ['Network', 'Arc Testnet'],
                      ['USD Value', `≈ $${getUSD(activeAsset||'USDC',sendAmt)}`],
                      ['Gas', 'Paid in USDC (Arc Testnet)'],
                    ].map(([k,v])=>(
                      <div key={k} className="flex justify-between items-center text-sm">
                        <span className="text-glow-muted">{k}</span>
                        <span className="text-glow-text font-semibold font-mono text-xs">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={executeSend} disabled={sending||!sendTo||!sendAmt||!/^0x[0-9a-fA-F]{40}$/.test(sendTo)}
                  className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {sending?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}
                  {sending?'Sending…':`Send ${activeAsset||'USDC'}`}
                </button>
              </div>
            )}

            {/* RECEIVE — with real QR code */}
            {panel==='receive' && (
              <div className="p-4 space-y-4 max-w-md mx-auto text-center">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">Receive</h2>
                </div>
                <div className="flex justify-center"><QRCode address={address!}/></div>
                <div>
                  <p className="text-xs text-glow-muted mb-2">Your Arc Testnet Address</p>
                  <p className="text-xs font-mono text-glow-text bg-glow-card rounded-xl px-4 py-3 break-all border border-glow-border">{address}</p>
                </div>
                <button onClick={async()=>{await navigator.clipboard.writeText(address!);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                  className="w-full py-3 bg-glow-gradient text-white font-bold rounded-xl flex items-center justify-center gap-2">
                  {copied?<CheckCircle className="w-4 h-4"/>:<Copy className="w-4 h-4"/>}
                  {copied?'Copied!':'Copy Address'}
                </button>
                <p className="text-xs text-glow-muted">Only send Arc Testnet assets to this address. USDC, EURC supported.</p>
              </div>
            )}

            {/* SWAP — Arc native currency swap using ERC-20 transfers + price oracle */}
            {panel==='swap' && (
              <SwapPanel
                allAssets={allAssets}
                balances={balances}
                address={address!}
                swapFrom={swapFrom} setSwapFrom={setSwapFrom}
                swapTo={swapTo2}   setSwapTo={setSwapTo2}
                onBack={()=>setPanel(activeAsset?'asset':'assets')}
                onSuccess={(hash,fromSym,toSym,amt)=>{
                  setHistory(h=>[{hash,type:'swap',amount:amt,symbol:fromSym+' → '+toSym,timestamp:Date.now(),status:'success'},...h]);
                  setTimeout(fetchBalances,4000);
                  setPanel('assets');
                }}
              />
            )}

            {/* CCTP — with dropdown */}
            {panel==='cctp' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card"><ArrowLeft className="w-4 h-4"/></button>
                  <div>
                    <h2 className="text-base font-bold text-glow-text">CCTP Transfer</h2>
                    <p className="text-xs text-glow-muted">Burn on Arc → Mint on destination</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-glow-accent/8 border border-glow-accent/20 rounded-xl">
                  <Zap className="w-4 h-4 text-glow-accent flex-shrink-0 mt-0.5"/>
                  <p className="text-xs text-glow-muted">Circle's Cross-Chain Transfer Protocol burns USDC on Arc and natively mints it on the destination — no bridges, no wrapping. Powered by TokenMessengerV2 (Domain 26).</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-2">Destination Network</label>
                    <CCTPNetworkDropdown value={cctpDest} onChange={setCctpDest} arcLogoUrl={siteSettings.arcLogoUrl}/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Recipient Address</label>
                    <input value={cctpTo} onChange={e=>setCctpTo(e.target.value)} placeholder="0x…" className={cn(inputCls,'font-mono text-xs')}/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Amount (USDC)</label>
                    <div className="relative">
                      <input value={cctpAmt} onChange={e=>setCctpAmt(e.target.value)} type="number" placeholder="0.00" min="0" className={cn(inputCls,'text-lg font-bold pr-16')}/>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-glow-cyan font-bold">USDC</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-glow-muted">Balance: {parseFloat(balances.USDC||'0').toFixed(4)} USDC</p>
                      <button onClick={()=>setCctpAmt(balances.USDC||'0')} className="text-xs text-glow-accent">MAX</button>
                    </div>
                  </div>
                </div>
                {/* Route summary */}
                {cctpAmt && parseFloat(cctpAmt)>0 && (
                  <div className="bg-glow-card border border-glow-border rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Route</p>
                    <div className="flex items-center gap-2">
                      <NetLogo src={siteSettings.arcLogoUrl||CIRCLE_CHAINS[0].logo} name="Arc" networkId="arc-testnet" size={20}/>
                      <span className="text-xs text-glow-text font-semibold">Arc Testnet</span>
                      <span className="text-glow-muted/40 text-xs flex-1 text-center">·····→</span>
                      <NetLogo src={CCTP_CHAINS.find(c=>c.id===cctpDest)?.logo||''} name={cctpDest} networkId={cctpDest} size={20}/>
                      <span className="text-xs text-glow-text font-semibold">{CCTP_CHAINS.find(c=>c.id===cctpDest)?.shortName}</span>
                    </div>
                    <div className="flex justify-between text-xs"><span className="text-glow-muted">Amount</span><span className="text-glow-cyan font-bold">{cctpAmt} USDC</span></div>
                  </div>
                )}
                <button onClick={executeCCTP} disabled={cctping||!cctpTo||!cctpAmt}
                  className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {cctping?<Loader2 className="w-4 h-4 animate-spin"/>:<Zap className="w-4 h-4"/>}
                  {cctping?'Initiating…':'Start CCTP Transfer'}
                </button>
              </div>
            )}

            {/* HISTORY */}
            {panel==='history' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">History</h2>
                </div>
                {history.length===0 ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <History className="w-12 h-12 text-glow-muted/30"/>
                    <p className="text-glow-muted text-sm">No transactions yet</p>
                    <a href={`${ARCSCAN}/address/${address}`} target="_blank" rel="noopener noreferrer" className="text-xs text-glow-cyan flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5"/>Full history on ArcScan</a>
                  </div>
                ) : (
                  <>
                    {history.map((tx,i)=>(
                      <div key={i} className="flex items-center gap-3 p-3.5 bg-glow-card border border-glow-border rounded-2xl">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",tx.type==='send'?"bg-red-500/15":tx.type==='cctp'?"bg-glow-accent/15":"bg-glow-cyan/15")}>
                          {tx.type==='send'?<Send className="w-5 h-5 text-red-400"/>:tx.type==='cctp'?<Zap className="w-5 h-5 text-glow-accent"/>:<ArrowRight className="w-5 h-5 text-glow-cyan"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-glow-text capitalize">{tx.type==='cctp'?'CCTP Transfer':tx.type}</p>
                          <p className="text-xs text-glow-muted font-mono truncate">{truncateAddress(tx.hash,10)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-glow-text">{tx.amount} {tx.symbol}</p>
                          <a href={`${ARCSCAN}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-glow-cyan">View ↗</a>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ADD TOKEN */}
            {panel==='addToken' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">Add Token</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Contract Address</label>
                    <div className="flex gap-2">
                      <input value={newTokenAddr} onChange={e=>{setNewTokenAddr(e.target.value);setNewTokenInfo(null);}} placeholder="0x…" className={cn(inputCls,'font-mono text-xs flex-1')}/>
                      <button onClick={lookupToken} disabled={tokenLoading} className="px-4 py-2.5 bg-glow-accent/20 border border-glow-accent/30 text-glow-accent-light text-xs font-semibold rounded-xl disabled:opacity-50 flex items-center gap-1">
                        {tokenLoading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Search className="w-3.5 h-3.5"/>}Lookup
                      </button>
                    </div>
                  </div>
                  {newTokenInfo && (
                    <div className="p-4 bg-glow-card border border-emerald-500/25 rounded-xl space-y-2">
                      <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400"/><p className="text-sm font-semibold text-emerald-400">Token found</p></div>
                      {[['Name',newTokenInfo.name],['Symbol',newTokenInfo.symbol],['Decimals',String(newTokenInfo.decimals)]].map(([k,v])=>(
                        <div key={k} className="flex justify-between text-sm"><span className="text-glow-muted">{k}</span><span className="text-glow-text font-mono">{v}</span></div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={confirmAddToken} disabled={!newTokenInfo} className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4"/>Add {newTokenInfo?.symbol??'Token'}
                </button>
              </div>
            )}

            {/* MANAGE WALLETS */}
            {panel==='manageWallets' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">Wallets</h2>
                </div>
                {/* Connected injected wallet */}
                <div className={cn("flex items-center gap-3 p-4 bg-glow-card border rounded-2xl",activeWalletId==='injected'?"border-glow-accent/40 bg-glow-accent/5":"border-glow-border")}>
                  <div className="w-10 h-10 rounded-xl bg-glow-accent/20 flex items-center justify-center flex-shrink-0"><Wallet className="w-5 h-5 text-glow-accent"/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-glow-text">Connected Wallet</p>
                    <p className="text-xs font-mono text-glow-muted truncate">{address}</p>
                    <p className="text-[10px] text-glow-muted">MetaMask / Browser Wallet</p>
                  </div>
                  {activeWalletId==='injected' && <span className="text-[10px] text-glow-accent bg-glow-accent/15 border border-glow-accent/30 px-2 py-0.5 rounded-full">Active</span>}
                </div>
                {/* Stored wallets */}
                {wallets.map(w=>(
                  <div key={w.id} className={cn("flex items-center gap-3 p-4 bg-glow-card border rounded-2xl",activeWalletId===w.id?"border-glow-accent/40 bg-glow-accent/5":"border-glow-border")}>
                    <div className="w-10 h-10 rounded-xl bg-glow-surface flex items-center justify-center flex-shrink-0">
                      {w.source==='generated'?<Shield className="w-5 h-5 text-emerald-400"/>:<Key className="w-5 h-5 text-amber-400"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-glow-text">{w.label}</p>
                      <p className="text-xs font-mono text-glow-muted truncate">{truncateAddress(w.address,12)}</p>
                      <p className="text-[10px] text-glow-muted capitalize">{w.source}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {activeWalletId===w.id && <span className="text-[10px] text-glow-accent bg-glow-accent/15 border border-glow-accent/30 px-2 py-0.5 rounded-full">Active</span>}
                      <button onClick={()=>navigator.clipboard.writeText(w.address)} className="p-1.5 text-glow-muted hover:text-glow-text"><Copy className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>removeWallet(w.id)} className="p-1.5 text-glow-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={()=>setPanel('importWallet')} className="flex items-center justify-center gap-2 py-3 bg-glow-card border border-glow-border rounded-xl text-sm text-glow-muted hover:text-glow-text hover:border-glow-accent/30 transition-all">
                    <UploadIcon className="w-4 h-4 text-glow-accent"/>Import Wallet
                  </button>
                  <button onClick={()=>{setPanel('newWallet');generateWallet();}} className="flex items-center justify-center gap-2 py-3 bg-glow-gradient text-white text-sm font-semibold rounded-xl">
                    <Plus className="w-4 h-4"/>New Wallet
                  </button>
                </div>
              </div>
            )}

            {/* IMPORT WALLET */}
            {panel==='importWallet' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPanel('manageWallets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">Import Wallet</h2>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
                  <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"/>
                  <p className="text-xs text-amber-300">Your key is stored encrypted in browser localStorage only. Never shared or sent to any server.</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Label</label>
                    <input value={importLabel} onChange={e=>setImportLabel(e.target.value)} placeholder="My Wallet" className={inputCls}/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Private Key or Seed Phrase</label>
                    <div className="relative">
                      <textarea value={importKey} onChange={e=>setImportKey(e.target.value)} rows={3}
                        placeholder="0x private key or 12/24 word seed phrase…"
                        className={cn(inputCls,'resize-none font-mono text-xs pr-10')}
                        style={{type:showImportKey?'text':'password'} as React.CSSProperties}/>
                      <button onClick={()=>setShowImportKey(!showImportKey)} className="absolute right-3 top-3 text-glow-muted hover:text-glow-text">
                        {showImportKey?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={importWallet} disabled={importLoading||!importKey.trim()} className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {importLoading?<Loader2 className="w-4 h-4 animate-spin"/>:<UploadIcon className="w-4 h-4"/>}Import Wallet
                </button>
              </div>
            )}

            {/* NEW WALLET */}
            {panel==='newWallet' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPanel('manageWallets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">New Wallet</h2>
                  <button onClick={generateWallet} className="ml-auto p-2 text-glow-muted hover:text-glow-text"><RefreshCw className="w-4 h-4"/></button>
                </div>
                {generatedWallet && (
                  <>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0"/>
                      <p className="text-xs text-emerald-300 font-mono truncate">{generatedWallet.address}</p>
                    </div>
                    <div className="bg-glow-card border border-glow-border rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Seed Phrase</p>
                        <button onClick={()=>navigator.clipboard.writeText(generatedWallet.mnemonic)} className="text-xs text-glow-accent flex items-center gap-1"><Copy className="w-3 h-3"/>Copy</button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {generatedWallet.mnemonic.split(' ').map((w,i)=>(
                          <div key={i} className="bg-glow-surface border border-glow-border rounded-lg px-2 py-1 text-xs font-mono text-glow-text flex items-center gap-1">
                            <span className="text-glow-muted text-[9px] w-4">{i+1}.</span>{w}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Private Key</p>
                        <button onClick={()=>setShowPrivKey(!showPrivKey)} className="text-xs text-glow-muted flex items-center gap-1">
                          {showPrivKey?<><EyeOff className="w-3 h-3"/>Hide</>:<><Eye className="w-3 h-3"/>Show</>}
                        </button>
                      </div>
                      {showPrivKey && (
                        <div className="bg-glow-surface border border-glow-border rounded-lg p-2 flex items-center gap-2">
                          <code className="text-xs font-mono text-amber-400 flex-1 break-all">{generatedWallet.privateKey}</code>
                          <button onClick={()=>navigator.clipboard.writeText(generatedWallet.privateKey)} className="text-glow-muted hover:text-glow-text flex-shrink-0"><Copy className="w-3.5 h-3.5"/></button>
                        </div>
                      )}
                      <p className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Write down the seed phrase and store it safely. It cannot be recovered if lost.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Label</label>
                      <input value={importLabel} onChange={e=>setImportLabel(e.target.value)} placeholder="My New Wallet" className={inputCls}/>
                    </div>
                    <button onClick={saveGeneratedWallet} className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl flex items-center justify-center gap-2">
                      <Download className="w-4 h-4"/>Save Wallet
                    </button>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    {/* Wallet Switcher Modal */}
    {showSwitcher && (
      <WalletSwitcher
        injectedAddress={address}
        wallets={wallets}
        activeId={activeWalletId}
        onSwitch={switchWallet}
        onAdd={()=>{setShowSwitcher(false);setPanel('manageWallets');setShowAddWallet(true);}}
        onDelete={removeWallet}
        onClose={()=>setShowSwitcher(false)}
      />
    )}
    </AppLayout>
  );
}
