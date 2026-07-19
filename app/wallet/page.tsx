"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWalletStore } from "@/store/walletStore";
import { useCircleStore } from "@/store/circleStore";
import type { CircleTx } from "@/store/circleStore";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  Send, ArrowDownLeft, RefreshCw, Copy, CheckCircle, Check, Eye, EyeOff,
  ChevronRight, Plus, X, Loader2, Shield, Zap, ArrowLeftRight,
  Globe, AlertTriangle, Settings, ArrowUpRight, TrendingUp, TrendingDown,
  Coins, KeyRound, Fingerprint, Clock, Home, ExternalLink, ChevronDown,
  Wallet, Lock, ChevronLeft,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
// ── QR Code canvas component ───────────────────────────────────────────────────
function QRCanvas({ address }: { address: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !address) return;
    // Dynamic import of qrcode to avoid SSR issues
    import("qrcode").then(QRCode => {
      QRCode.toCanvas(canvas, address, {
        width: 192, margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      }).catch(() => {
        // Fallback: draw simple grid pattern
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = 192; canvas.height = 192;
        ctx.fillStyle = "#fff"; ctx.fillRect(0,0,192,192);
        ctx.fillStyle = "#000";
        let s = 0;
        for(let i=2;i<address.length;i++) s=(s*31+address.charCodeAt(i))>>>0;
        const rng=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
        const sz=8, cols=24, rows=24;
        const pat=(x:number,y:number)=>{
          ctx.fillRect(x*sz,y*sz,7*sz,sz);ctx.fillRect(x*sz,(y+6)*sz,7*sz,sz);
          ctx.fillRect(x*sz,y*sz,sz,7*sz);ctx.fillRect((x+6)*sz,y*sz,sz,7*sz);
          ctx.clearRect((x+1)*sz,(y+1)*sz,5*sz,5*sz);
          ctx.fillRect((x+2)*sz,(y+2)*sz,3*sz,3*sz);
        };
        pat(0,0);pat(cols-7,0);pat(0,rows-7);
        for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
          if((r<8&&c<8)||(r<8&&c>cols-9)||(r>rows-9&&c<8)) continue;
          if(rng()>0.45) ctx.fillRect(c*sz,r*sz,sz,sz);
        }
      });
    }).catch(() => {});
  }, [address]);
  return <canvas ref={ref} width={192} height={192} className="rounded-lg"/>;
}

// Default prices — overwritten by live /api/prices fetch on mount
const PRICE_DEFAULTS: Record<string,number> = {
  USDC:1, EURC:1.09, cirBTC:97000, USYC:1.002,
  ETH:3200, MATIC:0.55, AVAX:38, ARB:0.95, OP:1.80, BNB:600, SOL:165,
};
const CHANGE_DEFAULTS: Record<string,number> = {
  USDC:-0.01, EURC:0.05, cirBTC:2.31, USYC:0.08,
  ETH:-1.24, MATIC:0.87, AVAX:-0.55, ARB:1.42,
};
const CHAIN_BG: Record<string,string> = {
  ETH:"#627eea", USDC:"#2775CA", EURC:"#2775CA", cirBTC:"#f7931a",
  USYC:"#16a34a", MATIC:"#8247e5", AVAX:"#e84142", ARB:"#12aaff",
  BASE:"#0052ff", OP:"#ff0420", BNB:"#f3ba2f",
};
const ARC_RPC  = "https://rpc.testnet.arc.network";
const ARC_USDC = "0x3600000000000000000000000000000000000000";

function shortAddr(a:string) { return a ? `${a.slice(0,6)}…${a.slice(-4)}` : "—"; }
function fmtUSD(n:number) { return n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(2)}`; }

// ── Mini Sparkline SVG ─────────────────────────────────────────────────────────
function Sparkline({ prices, color="var(--glow-accent)", h=48, w=160 }: { prices:number[]; color?:string; h?:number; w?:number }) {
  if (!prices.length) return null;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const pts = prices.map((p,i) => {
    const x = (i / (prices.length-1)) * w;
    const y = h - ((p-min)/range) * (h-4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sg)"/>
    </svg>
  );
}

// ── Asset Detail Sheet ─────────────────────────────────────────────────────────
type AssetDetailProps = {
  symbol: string; name: string; amount: string;
  price: number; change: number; logoUrl?: string;
  onClose(): void;
  onSend(): void; onReceive(): void;
  walletAddr: string;
};
function AssetDetailSheet({ symbol, name, amount, price, change, logoUrl, onClose, onSend, onReceive, walletAddr }: AssetDetailProps) {
  const [txns, setTxns] = useState<Array<{hash:string;from:string;to:string;value:string;isIn:boolean}>>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const value = parseFloat(amount||"0") * price;
  const up = change >= 0;

  // Generate demo sparkline from price + change
  const sparkPrices = useMemo(() => {
    const base = price / (1 + change/100);
    return Array.from({length:24},(_,i) => {
      const t = i/23;
      const noise = (Math.sin(i*2.7)*0.3 + Math.sin(i*1.3)*0.2) * base * 0.02;
      return base + (price-base)*t + noise;
    });
  }, [price, change]);

  // Load on-chain transfer history
  useEffect(() => {
    if (!walletAddr) return;
    setLoadingTxns(true);
    const TOKEN_ADDRS: Record<string,string> = {
      USDC:"0x3600000000000000000000000000000000000000",
      EURC:"0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
      cirBTC:"0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
      USYC:"0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
    };
    const tokenAddr = TOKEN_ADDRS[symbol];
    if (!tokenAddr) { setLoadingTxns(false); return; }
    const paddedAddr = "000000000000000000000000" + walletAddr.replace("0x","").toLowerCase();
    Promise.all([
      // Incoming transfers
      fetch(ARC_RPC, {method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_getLogs",params:[{
          address:tokenAddr, fromBlock:"earliest", toBlock:"latest",
          topics:["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",null,"0x"+paddedAddr]
        }]})}).then(r=>r.json()).catch(()=>({result:[]})),
      // Outgoing transfers
      fetch(ARC_RPC, {method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({jsonrpc:"2.0",id:2,method:"eth_getLogs",params:[{
          address:tokenAddr, fromBlock:"earliest", toBlock:"latest",
          topics:["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x"+paddedAddr,null]
        }]})}).then(r=>r.json()).catch(()=>({result:[]})),
    ]).then(([inbound,outbound]) => {
      const DECIMALS: Record<string,number> = {USDC:18,EURC:6,cirBTC:8,USYC:6};
      const dec = DECIMALS[symbol]||6;
      const fmt = (hex:string) => {
        try { return (Number(BigInt(hex))/Math.pow(10,dec)).toFixed(4); } catch { return "0"; }
      };
      type LogEntry = { transactionHash: string; topics: string[]; data: string };
      const ins = ((inbound as {result?:LogEntry[]}).result||[]).slice(-5).map((l:LogEntry) => ({
        hash:l.transactionHash, isIn:true,
        from:"0x"+l.topics[1]?.slice(26), to:walletAddr,
        value:fmt(l.data)
      }));
      const outs = ((outbound as {result?:LogEntry[]}).result||[]).slice(-5).map((l:LogEntry) => ({
        hash:l.transactionHash, isIn:false,
        from:walletAddr, to:"0x"+l.topics[2]?.slice(26),
        value:fmt(l.data)
      }));
      setTxns([...ins,...outs].slice(0,8));
    }).finally(()=>setLoadingTxns(false));
  }, [symbol, walletAddr]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="w-full max-h-[92dvh] bg-glow-card rounded-t-3xl flex flex-col overflow-hidden">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-glow-border rounded-full mx-auto mt-3 mb-1 flex-shrink-0"/>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden shadow"
              style={{background: logoUrl ? "transparent" : (CHAIN_BG[symbol]??"#7c3aed")}}>
              {logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoUrl} alt={symbol} className="w-10 h-10 object-cover rounded-full"/>
                : symbol.slice(0,2)}
            </div>
            <div>
              <p className="text-base font-bold text-glow-text">{symbol}</p>
              <p className="text-xs text-glow-muted">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-glow-muted hover:text-glow-text"><X className="w-5 h-5"/></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-8 space-y-5">
          {/* Price + change */}
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-glow-text">${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:symbol==="cirBTC"?0:4})}</p>
            <span className={cn("inline-flex items-center gap-1 text-sm font-semibold mt-1 px-2.5 py-1 rounded-full",
              up?"bg-emerald-500/15 text-emerald-500":"bg-red-500/15 text-red-500")}>
              {up?<TrendingUp className="w-3.5 h-3.5"/>:<TrendingDown className="w-3.5 h-3.5"/>}
              {up?"+":""}{change.toFixed(2)}% 24h
            </span>
          </div>

          {/* Sparkline chart */}
          <div className="bg-glow-surface border border-glow-border rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">24H Price</p>
              <p className="text-xs text-glow-muted">Arc Testnet</p>
            </div>
            <Sparkline prices={sparkPrices} color={up?"#10b981":"#ef4444"} h={64} w={300}/>
          </div>

          {/* Balance stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-glow-surface border border-glow-border rounded-2xl p-4">
              <p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1">Balance</p>
              <p className="text-lg font-bold text-glow-text">{parseFloat(amount||"0").toFixed(4)}</p>
              <p className="text-xs text-glow-muted">{symbol}</p>
            </div>
            <div className="bg-glow-surface border border-glow-border rounded-2xl p-4">
              <p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1">Value</p>
              <p className="text-lg font-bold text-glow-text">{fmtUSD(value)}</p>
              <p className="text-xs text-glow-muted">USD</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3">
            <button onClick={onSend} className="flex flex-col items-center gap-2 py-3 bg-glow-surface border border-glow-border rounded-2xl hover:border-glow-accent/40 hover:bg-glow-accent/5 transition-colors">
              <Send className="w-5 h-5 text-glow-accent"/><span className="text-xs font-medium text-glow-text">Send</span>
            </button>
            <button onClick={onReceive} className="flex flex-col items-center gap-2 py-3 bg-glow-surface border border-glow-border rounded-2xl hover:border-glow-accent/40 hover:bg-glow-accent/5 transition-colors">
              <ArrowDownLeft className="w-5 h-5 text-glow-accent"/><span className="text-xs font-medium text-glow-text">Receive</span>
            </button>
            <a href="/defi" className="flex flex-col items-center gap-2 py-3 bg-glow-surface border border-glow-border rounded-2xl hover:border-glow-accent/40 hover:bg-glow-accent/5 transition-colors">
              <ArrowLeftRight className="w-5 h-5 text-glow-accent"/><span className="text-xs font-medium text-glow-text">Swap</span>
            </a>
          </div>

          {/* On-chain transactions */}
          <div className="bg-glow-surface border border-glow-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-glow-border">
              <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">On-Chain Activity</p>
              <a href={`https://testnet.arcscan.app/token/0x3600000000000000000000000000000000000000`}
                target="_blank" rel="noopener noreferrer" className="text-[10px] text-glow-accent">ArcScan ↗</a>
            </div>
            {loadingTxns && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-glow-muted animate-spin"/>
              </div>
            )}
            {!loadingTxns && txns.length === 0 && (
              <p className="text-xs text-glow-muted text-center py-6">No transactions yet</p>
            )}
            {txns.map((tx,i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-glow-border last:border-0">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  tx.isIn?"bg-emerald-500/15":"bg-red-500/15")}>
                  {tx.isIn
                    ? <ArrowDownLeft className="w-4 h-4 text-emerald-500"/>
                    : <Send className="w-4 h-4 text-red-500"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-glow-text">{tx.isIn?"Received":"Sent"}</p>
                  <p className="text-[10px] text-glow-muted font-mono truncate">
                    {tx.isIn ? shortAddr(tx.from) : shortAddr(tx.to)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-bold", tx.isIn?"text-emerald-500":"text-red-500")}>
                    {tx.isIn?"+":"-"}{tx.value} {symbol}
                  </p>
                  <a href={`https://testnet.arcscan.app/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] text-glow-accent">view →</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Circle SDK window type ────────────────────────────────────────────────────
declare global {
  interface Window {
    CircleW3s?: { W3SSdk: new(cfg:{appId:string})=>{ setAuthentication(a:{userToken:string;encryptionKey:string}):void; execute(id:string,cb:(e:unknown,r:unknown)=>void):void } };
  }
}

// ── Token row — Trust Wallet style ────────────────────────────────────────────
function AssetRow({ symbol, name, amount, livePrice, liveChange, logoUrl, onClick }:
  { symbol:string; name:string; amount:string; livePrice?:number; liveChange?:number; logoUrl?:string; onClick?():void }) {
  const price  = livePrice  ?? PRICE_DEFAULTS[symbol]  ?? 1;
  const change = liveChange ?? CHANGE_DEFAULTS[symbol]  ?? 0;
  const value  = parseFloat(amount||"0") * price;
  const up     = change >= 0;
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/3 transition-colors active:bg-black/10 border-b border-black/5 dark:border-white/5 last:border-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-lg overflow-hidden"
        style={{ background: logoUrl ? "transparent" : (CHAIN_BG[symbol] ?? "#7c3aed") }}>
        {logoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logoUrl} alt={symbol} className="w-10 h-10 rounded-full object-cover"/>
          : <span>{symbol.slice(0,2)}</span>
        }
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-glow-text">{symbol}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-glow-muted">${(price).toFixed(symbol==="USDC"||symbol==="EURC"||symbol==="USYC"?3:2)}</span>
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            up?"bg-emerald-500/15 text-emerald-500":"bg-red-500/15 text-red-500")}>
            {up?"+":""}{change.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-glow-text">{fmtUSD(value)}</p>
        <p className="text-xs text-glow-muted mt-0.5">{parseFloat(amount||"0").toFixed(6)} {symbol}</p>
      </div>
    </button>
  );
}
// ── Action button ──────────────────────────────────────────────────────────────

// ── Action button ─────────────────────────────────────────────────────────────
function ActionBtn({ icon:Icon, label, onClick, disabled=false }:
  { icon:React.ElementType; label:string; onClick():void; disabled?:boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex flex-col items-center gap-1.5 disabled:opacity-40">
      <div className="w-12 h-12 rounded-2xl bg-glow-card border border-glow-border flex items-center justify-center hover:border-glow-accent/50 hover:bg-glow-accent/10 active:scale-95 transition-all shadow-sm">
        <Icon className="w-5 h-5 text-glow-accent"/>
      </div>
      <span className="text-[11px] text-glow-muted font-medium">{label}</span>
    </button>
  );
}

// ── TX Row ─────────────────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: CircleTx }) {
  const isIn  = tx.transactionType === "INBOUND";
  const ok    = tx.state === "COMPLETE" || tx.state === "CONFIRMED";
  const fail  = tx.state === "FAILED";
  const d     = new Date(tx.createDate);
  const ago   = Date.now()-d.getTime();
  const label = ago<3600000?`${Math.floor(ago/60000)}m ago`:ago<86400000?`${Math.floor(ago/3600000)}h ago`:d.toLocaleDateString();
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0">
      <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0",
        isIn?"bg-emerald-500/15":"bg-white/8")}>
        {isIn?<ArrowDownLeft className="w-4 h-4 text-emerald-400"/>:<Send className="w-4 h-4 text-glow-muted"/>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-glow-text">{isIn?"Received":"Sent"}</p>
        <p className="text-xs text-glow-muted font-mono truncate">
          {tx.destinationAddress ? shortAddr(tx.destinationAddress) : tx.id.slice(0,10)}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn("text-sm font-semibold",isIn?"text-emerald-400":"text-glow-text")}>
          {isIn?"+":"-"}{tx.amounts?.[0]??"—"} USDC
        </p>
        <div className="flex items-center gap-1.5 justify-end mt-0.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", ok?"bg-emerald-400":fail?"bg-red-400":"bg-amber-400")}/>
          <span className="text-[10px] text-glow-muted">{label}</span>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const { address: mmAddr, isConnected, chainId } = useWalletStore();
  const circle = useCircleStore();

  const [tab,         setTab]         = useState<"home"|"swap"|"history"|"settings">("home");
  const [modal,       setModal]       = useState<null|"send"|"receive"|"cctp"|"gateway"|"nanopay"|"setup"|"wallets"|"import">(null);
  const [settingsScreen, setSettingsScreen] = useState<null|"security"|"networks"|"tokens"|"defi">(null);
  const [hideBalance, setHideBalance] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [loadingBal,  setLoadingBal]  = useState(false);
  const [importKey,   setImportKey]   = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [livePrices,  setLivePrices]  = useState<Record<string,{price:number;change:number}>>({});
  const [tokenLogos,  setTokenLogos]  = useState<Record<string,string>>({});
  const [onChainBals, setOnChainBals] = useState<Record<string,string>>({});
  const [selectedAsset, setSelectedAsset] = useState<{symbol:string;name:string;amount:string}|null>(null);
  const [balRefreshTick, setBalRefreshTick] = useState(0);

  const [sendTo,      setSendTo]      = useState("");
  const [sendAmt,     setSendAmt]     = useState("");
  const [cctpDest,    setCctpDest]    = useState("ETH-SEPOLIA");
  const [cctpAmt,     setCctpAmt]     = useState("");
  const [gwDest,      setGwDest]      = useState("");
  const [gwAmt,       setGwAmt]       = useState("");
  const [gwChain,     setGwChain]     = useState("ETH");
  const [npTo,        setNpTo]        = useState("");
  const [npAmt,       setNpAmt]       = useState("0.001");
  const [setupStep,   setSetupStep]   = useState<"welcome"|"loading"|"done">("welcome");
  const [swapFrom,    setSwapFrom]    = useState("USDC");
  const [swapTo,      setSwapTo]      = useState("ETH");
  const [swapAmt,     setSwapAmt]     = useState("");

  const sdkRef = useRef<{setAuthentication(a:{userToken:string;encryptionKey:string}):void;execute(id:string,cb:(e:unknown,r:unknown)=>void):void}|null>(null);

  // Fetch live prices from /api/prices (CoinGecko, 60s cache)
  useEffect(() => {
    fetch("/api/prices")
      .then(r => r.json())
      .then(d => { if (d.prices) setLivePrices(d.prices); })
      .catch(() => {}); // silent — defaults already set
  }, []);

  // Fetch token logos from admin settings
  useEffect(() => {
    fetch("/api/admin/public-settings")
      .then(r => r.json())
      .then(d => {
        const logos: Record<string,string> = {};
        if (d.usdc_logo_url)   logos.USDC   = d.usdc_logo_url;
        if (d.eurc_logo_url)   logos.EURC   = d.eurc_logo_url;
        if (d.cirbtc_logo_url) logos.cirBTC = d.cirbtc_logo_url;
        if (d.usyc_logo_url)   logos.USYC   = d.usyc_logo_url;
        if (d.arc_logo_url)    logos.ARC    = d.arc_logo_url;
        if (Object.keys(logos).length) setTokenLogos(logos);
      })
      .catch(() => {});
  }, []);

  // Read on-chain ERC-20 balances via server-side Arc RPC (avoids CORS/timeout issues)
  useEffect(() => {
    const circleAddr = circle.wallets.find(w => w.id === circle.activeWalletId)?.address;
    const addr = circleAddr ?? mmAddr;
    if (!addr || addr.length < 10) return;

    const fetchBalances = async () => {
      try {
        setLoadingBal(true);
        const res = await fetch(`/api/wallet/arc-balances?address=${encodeURIComponent(addr)}`);
        if (!res.ok) return;
        const d = await res.json() as { balances?: Record<string, { amount: string }> };
        if (d.balances) {
          const bals: Record<string, string> = {};
          Object.entries(d.balances).forEach(([sym, b]) => { bals[sym] = b.amount; });
          setOnChainBals(bals);
        }
      } catch { /* silent */ }
      finally { setLoadingBal(false); }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mmAddr, circle.activeWalletId, circle.wallets.length, balRefreshTick]);

  // Load Circle SDK
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@circle-fin/w3s-pw-web-sdk/dist/app.js";
    s.async = true;
    s.onload = () => {
      if (window.CircleW3s) {
        const sdk = new window.CircleW3s.W3SSdk({ appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? "test" });
        sdkRef.current = sdk as unknown as typeof sdkRef.current;
      }
    };
    document.head.appendChild(s);
    return () => { try{document.head.removeChild(s);}catch{} };
  }, []);

  // Fetch balances
  const loadBalances = useCallback(async () => {
    if (!circle.userToken || !circle.activeWalletId) return;
    setLoadingBal(true);
    try {
      const r = await fetch(`/api/circle/wallets?userToken=${circle.userToken}&action=balances&walletId=${circle.activeWalletId}`);
      const d = await r.json() as { tokenBalances?: Array<{token:{symbol:string;name:string;decimals:number};amount:string}> };
      if (d.tokenBalances) {
        const w = circle.wallets[0];
        if (w) circle.setWallets([{...w, balances: d.tokenBalances}, ...circle.wallets.slice(1)]);
      }
    } finally { setLoadingBal(false); }
  }, [circle]);

  useEffect(() => {
    if (circle.userToken && circle.isInitialized) loadBalances();
  }, [circle.userToken, circle.isInitialized, loadBalances]);

  // Circle setup
  const setupCircle = async () => {
    setSetupStep("loading");
    try {
      // Use Developer-Controlled Wallets — no PIN, no SDK, works on all testnets
      const res = await fetch("/api/circle/dev-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const d = await res.json() as { wallet?: { id: string; address: string; blockchain: string }; error?: string };
      if (d.error) throw new Error(d.error);
      if (d.wallet) {
        circle.setWallets([{
          id: d.wallet.id,
          address: d.wallet.address,
          blockchain: d.wallet.blockchain,
          accountType: "EOA",
          name: "Circle Dev Wallet",
          balances: [],
        }]);
        circle.setActive(d.wallet.id);
        circle.setInit(true);
        setSetupStep("done");
        setModal(null);
        toast.success(`✓ Developer wallet created: ${d.wallet.address.slice(0,10)}…`);
        setBalRefreshTick(t => t + 1);
      }
    } catch (e) {
      toast.error(String(e));
      setSetupStep("welcome");
    }
  };
  // Send
  const handleSend = async () => {
    if (!sendTo||!sendAmt){toast.error("Fill all fields");return;}
    setLoading(true);
    try {
      if (circle.userToken && circle.activeWalletId) {
        const r = await fetch("/api/circle/transactions",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"transfer",userToken:circle.userToken,walletId:circle.activeWalletId,destinationAddress:sendTo,amounts:[sendAmt],blockchain:"ETH-SEPOLIA"})});
        const d = await r.json() as {challengeId?:string;error?:string};
        if(!d.challengeId) throw new Error(d.error??"No challenge");
        if(sdkRef.current&&circle.encryptionKey){
          sdkRef.current.setAuthentication({userToken:circle.userToken,encryptionKey:circle.encryptionKey});
          sdkRef.current.execute(d.challengeId,(err)=>{ if(err){toast.error("PIN rejected");return;} toast.success("✓ Sent!"); setModal(null); setSendTo(""); setSendAmt(""); loadBalances(); });
        } else toast("Challenge: "+d.challengeId,{icon:"🔑"});
      } else {
        toast("Connect Circle Wallet to send onchain",{icon:"ℹ️"});
      }
    } catch(e){ toast.error(String(e)); }
    finally { setLoading(false); }
  };

  const copyAddr = async () => { await navigator.clipboard.writeText(displayAddr); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  const activeWallet = circle.wallets.find(w=>w.id===circle.activeWalletId);
  const displayAddr  = activeWallet?.address ?? mmAddr ?? "";
  const hasCircle    = circle.isInitialized && circle.wallets.length > 0;
  const liveP = (sym: string) => livePrices[sym]?.price ?? PRICE_DEFAULTS[sym] ?? 1;
  const liveC = (sym: string) => livePrices[sym]?.change ?? CHANGE_DEFAULTS[sym] ?? 0;

  // Merge Circle balances with on-chain balances — prefer Circle if available
  const BASE_TOKENS = [
    {token:{symbol:"USDC",  name:"USD Coin",      decimals:18}, amount:"0"},
    {token:{symbol:"EURC",  name:"Euro Coin",      decimals:6},  amount:"0"},
    {token:{symbol:"cirBTC",name:"Circle Bitcoin", decimals:8},  amount:"0"},
    {token:{symbol:"USYC",  name:"US Yield Coin",  decimals:6},  amount:"0"},
  ];
  const balances = (activeWallet?.balances?.length ? activeWallet.balances : BASE_TOKENS)
    .map(b => ({
      ...b,
      amount: onChainBals[b.token.symbol] ?? b.amount,
    }));
  const totalUSD = balances.reduce((a,b) => a + parseFloat(b.amount||"0") * liveP(b.token.symbol), 0);

  const CHAINS = ["ETH-SEPOLIA","ETH","MATIC","AVAX","ARB","BASE","OP"];

  // ── Setup Modal ──────────────────────────────────────────────────────────────
  const SetupModal = (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full bg-glow-card border-t border-glow-border rounded-t-3xl p-6 space-y-5 pb-10" onClick={e=>e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4"/>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-glow-gradient flex items-center justify-center"><Shield className="w-6 h-6 text-glow-text"/></div>
          <div><h3 className="text-base font-bold text-glow-text">Circle Developer Wallet</h3><p className="text-xs text-glow-muted">Server-signed · No PIN · Testnet</p></div>
        </div>
        {[
          {icon:Shield,    text:"Developer-controlled — server signs transactions"},
          {icon:Zap,       text:"No PIN required — works instantly on testnet"},
          {icon:Globe,     text:"ETH Sepolia — USDC + ERC-20 support"},
          {icon:Coins,     text:"Arc Testnet balances auto-refresh every 30s"},
        ].map(f=>(
          <div key={f.text} className="flex items-center gap-3 text-sm text-glow-muted">
            <f.icon className="w-4 h-4 text-glow-accent flex-shrink-0"/>{f.text}
          </div>
        ))}
        {setupStep==="welcome" && (
          <div className="space-y-3">
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"/>Circle API Key Format</p>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">Your <code className="bg-black/20 px-1 rounded">CIRCLE_API_KEY</code> in Vercel must have 3 parts:</p>
              <code className="text-[10px] text-amber-200/70 bg-black/20 px-2 py-1 rounded block">TEST_API_KEY:your-id:your-secret</code>
              <p className="text-[11px] text-amber-300/80">Get it at <a href="https://console.circle.com" target="_blank" rel="noopener noreferrer" className="underline">console.circle.com</a> → API Keys</p>
            </div>
            <button onClick={setupCircle} className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2">
              <Plus className="w-5 h-5"/>Create MPC Wallet
            </button>
          </div>
        )}
        {setupStep==="loading" && (
          <div className="text-center py-3 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-glow-accent mx-auto"/>
            <p className="text-sm text-glow-muted">Setting up secure wallet…</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Send Modal ───────────────────────────────────────────────────────────────
  const SendModal = (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full bg-glow-card border-t border-glow-border rounded-t-3xl" onClick={e=>e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-glow-border rounded-full mx-auto mt-3 mb-4"/>
        <div className="px-5 pb-10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-glow-text">Send USDC</h3>
            <button onClick={()=>setModal(null)} className="p-2 text-glow-muted rounded-xl hover:bg-glow-surface"><X className="w-5 h-5"/></button>
          </div>
          {/* Recipient */}
          <div className="bg-glow-surface border-2 border-glow-border rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-glow-muted uppercase tracking-wider mb-2">Recipient</p>
            <input value={sendTo} onChange={e=>setSendTo(e.target.value)} placeholder="0x wallet address…"
              className="w-full bg-transparent text-sm font-mono text-glow-text focus:outline-none placeholder-glow-muted/40"/>
          </div>
          {/* Amount */}
          <div className="bg-glow-surface border-2 border-glow-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-glow-muted uppercase tracking-wider">Amount</p>
              <button className="text-xs text-glow-accent font-semibold bg-glow-accent/10 px-2.5 py-1 rounded-lg">Max</button>
            </div>
            <div className="flex items-center gap-3">
              <input value={sendAmt} onChange={e=>setSendAmt(e.target.value)} type="number" min="0" placeholder="0.00"
                className="flex-1 min-w-0 text-3xl font-bold bg-transparent text-glow-text focus:outline-none placeholder-glow-muted/30"/>
              <div className="flex-shrink-0 flex items-center gap-1.5 bg-glow-accent/10 border border-glow-accent/25 px-3 py-2 rounded-xl">
                <div className="w-5 h-5 rounded-full bg-[#2775CA] flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">$</div>
                <span className="text-sm font-bold text-glow-accent">USDC</span>
              </div>
            </div>
          </div>
          {!hasCircle && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0"/>
              <p className="text-xs text-amber-400/90">Set up Circle Dev Wallet for non-custodial sends</p>
            </div>
          )}
          <button onClick={handleSend} disabled={loading||!sendTo||!sendAmt}
            className="w-full py-4 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 text-base">
            {loading?<Loader2 className="w-5 h-5 animate-spin"/>:<Send className="w-5 h-5"/>}
            Send {sendAmt||"0"} USDC
          </button>
        </div>
      </div>
    </div>
  );

  // ── CCTP Modal ───────────────────────────────────────────────────────────────
  const CCTPModal = (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full bg-glow-card border-t border-glow-border rounded-t-3xl p-5 pb-10 space-y-4" onClick={e=>e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2"/>
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-bold text-glow-text">CCTP Bridge</h3><p className="text-xs text-glow-muted">Native USDC burn+mint — no wrapped tokens</p></div>
          <button onClick={()=>setModal(null)} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
        </div>
        <div className="space-y-3">
          <div className="bg-glow-surface border border-glow-border rounded-2xl p-3"><p className="text-xs text-glow-muted mb-1">From</p><p className="text-sm font-semibold text-glow-text">Arc Testnet (Domain 26)</p></div>
          <div className="bg-glow-surface border border-glow-border rounded-2xl p-3 space-y-1">
            <p className="text-xs text-glow-muted">To</p>
            <select value={cctpDest} onChange={e=>setCctpDest(e.target.value)} className="w-full bg-transparent text-sm text-glow-text focus:outline-none">
              {CHAINS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="bg-glow-surface border border-glow-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-glow-muted">Amount</p><button className="text-xs text-glow-accent">Max</button></div>
            <div className="flex items-center gap-2">
              <input value={cctpAmt} onChange={e=>setCctpAmt(e.target.value)} type="number" min="0" placeholder="0.00" className="flex-1 text-xl font-bold bg-transparent text-glow-text focus:outline-none placeholder-white/20"/>
              <span className="text-sm font-semibold text-glow-muted">USDC</span>
            </div>
          </div>
        </div>
        <button disabled={loading||!cctpAmt} onClick={async()=>{
          setLoading(true);
          try{
            if(!circle.userToken||!circle.activeWalletId){toast.error("Connect Circle Wallet");return;}
            const r=await fetch("/api/circle/transactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"contract",userToken:circle.userToken,walletId:circle.activeWalletId,blockchain:"ETH-SEPOLIA",contractAddress:"0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",abiFunctionSignature:"depositForBurn(uint256,uint32,bytes32,address)",abiParameters:[cctpAmt,0,displayAddr,displayAddr]})});
            const d=await r.json() as {challengeId?:string;error?:string};
            if(d.challengeId&&sdkRef.current&&circle.encryptionKey){
              sdkRef.current.setAuthentication({userToken:circle.userToken,encryptionKey:circle.encryptionKey});
              sdkRef.current.execute(d.challengeId,(err)=>{if(err){toast.error("PIN rejected");return;}toast.success(`✓ Bridging ${cctpAmt} USDC via CCTP!`);setModal(null);});
            }else toast.success("CCTP initiated");
          }catch(e){toast.error(String(e));}finally{setLoading(false);}
        }} className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
          {loading?<Loader2 className="w-5 h-5 animate-spin"/>:<ArrowLeftRight className="w-5 h-5"/>}Bridge {cctpAmt||"0"} USDC
        </button>
      </div>
    </div>
  );

  // ── Gateway Modal ─────────────────────────────────────────────────────────────
  const GatewayModal = (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full bg-glow-card border-t border-glow-border rounded-t-3xl p-5 pb-10 space-y-4" onClick={e=>e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2"/>
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-bold text-glow-text">Gateway Transfer</h3><p className="text-xs text-glow-muted">&lt;500ms · Unified balance</p></div>
          <button onClick={()=>setModal(null)} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
        </div>
        <div className="space-y-3">
          <div className="bg-glow-surface border border-glow-border rounded-2xl p-3 space-y-1">
            <p className="text-xs text-glow-muted">Destination Chain</p>
            <select value={gwChain} onChange={e=>setGwChain(e.target.value)} className="w-full bg-transparent text-sm text-glow-text focus:outline-none">
              {["ETH","MATIC","AVAX","ARB","BASE","OP"].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="bg-glow-surface border border-glow-border rounded-2xl p-3 space-y-1">
            <p className="text-xs text-glow-muted">Recipient Address</p>
            <input value={gwDest} onChange={e=>setGwDest(e.target.value)} placeholder="0x…" className="w-full bg-transparent text-sm font-mono text-glow-text focus:outline-none placeholder-white/30"/>
          </div>
          <div className="bg-glow-surface border border-glow-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-glow-muted">Amount</p><button className="text-xs text-glow-accent">Max</button></div>
            <div className="flex items-center gap-2">
              <input value={gwAmt} onChange={e=>setGwAmt(e.target.value)} type="number" min="0" placeholder="0.00" className="flex-1 text-xl font-bold bg-transparent text-glow-text focus:outline-none placeholder-white/20"/>
              <span className="text-sm font-semibold text-glow-muted">USDC</span>
            </div>
          </div>
        </div>
        <button disabled={loading||!gwDest||!gwAmt} onClick={async()=>{
          setLoading(true);
          try{
            const r=await fetch("/api/circle/gateway",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"transfer",sourceAddress:displayAddr,destinationAddress:gwDest,amount:gwAmt,sourceBlockchain:"ETH-SEPOLIA",destinationBlockchain:gwChain})});
            const d=await r.json() as {transactionId?:string;error?:string};
            if(d.error) throw new Error(d.error);
            toast.success(`✓ Gateway transfer initiated!`); setModal(null); setGwDest(""); setGwAmt("");
          }catch(e){toast.error(String(e));}finally{setLoading(false);}
        }} className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
          {loading?<Loader2 className="w-5 h-5 animate-spin"/>:<Globe className="w-5 h-5"/>}Transfer {gwAmt||"0"} USDC
        </button>
      </div>
    </div>
  );

  // ── Nanopay Modal ──────────────────────────────────────────────────────────
  const NanopayModal = (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full bg-glow-card border-t border-glow-border rounded-t-3xl p-5 pb-10 space-y-4" onClick={e=>e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2"/>
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-bold text-glow-text">Nanopayment</h3><p className="text-xs text-glow-muted">Gas-free · x402 · from $0.000001</p></div>
          <button onClick={()=>setModal(null)} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
        </div>
        <div className="space-y-3">
          <div className="bg-glow-surface border border-glow-border rounded-2xl p-3 space-y-1"><p className="text-xs text-glow-muted">Recipient</p><input value={npTo} onChange={e=>setNpTo(e.target.value)} placeholder="0x…" className="w-full bg-transparent text-sm font-mono text-glow-text focus:outline-none placeholder-white/30"/></div>
          <div className="bg-glow-surface border border-glow-border rounded-2xl p-4">
            <p className="text-xs text-glow-muted mb-1.5">Amount USDC</p>
            <div className="flex items-center gap-2">
              <input value={npAmt} onChange={e=>setNpAmt(e.target.value)} type="number" min="0.000001" step="0.000001" className="flex-1 text-xl font-bold bg-transparent text-glow-text focus:outline-none"/>
              <span className="text-sm font-semibold text-glow-muted">USDC</span>
            </div>
          </div>
        </div>
        <button disabled={loading||!npTo||!npAmt} onClick={async()=>{
          setLoading(true);
          try{
            const now=Math.floor(Date.now()/1000);
            const r=await fetch("/api/circle/nanopay",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"settle",payerAddress:displayAddr,payeeAddress:npTo,amount:npAmt,validAfter:now-60,validBefore:now+3600,nonce:"0x"+Math.random().toString(16).slice(2).padEnd(64,"0")})});
            const d=await r.json() as {settlementId?:string;error?:string};
            if(d.error) throw new Error(d.error);
            toast.success(`✓ Sent $${npAmt} USDC (gas-free!)`); setModal(null);
          }catch(e){toast.error(String(e));}finally{setLoading(false);}
        }} className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
          {loading?<Loader2 className="w-5 h-5 animate-spin"/>:<Zap className="w-5 h-5"/>}Send ${npAmt} USDC Gas-Free
        </button>
      </div>
    </div>
  );

  // ── Receive Modal ───────────────────────────────────────────────────────────
  const ReceiveModal = (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full bg-glow-card border-t border-glow-border rounded-t-3xl p-5 pb-10" onClick={e=>e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4"/>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-glow-text">Receive USDC</h3>
          <button onClick={()=>setModal(null)} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-52 h-52 bg-white rounded-2xl p-2 flex items-center justify-center shadow-lg">
            <QRCanvas address={displayAddr}/>
          </div>
          <p className="text-xs text-glow-muted text-center max-w-[240px]">Send only USDC and supported tokens to this address</p>
          <div className="w-full bg-glow-surface border border-glow-border rounded-2xl p-3 flex items-center gap-2">
            <span className="text-xs font-mono text-glow-muted break-all flex-1">{displayAddr}</span>
            <button onClick={copyAddr} className="text-glow-muted hover:text-glow-text flex-shrink-0">
              {copied?<CheckCircle className="w-4 h-4 text-emerald-400"/>:<Copy className="w-4 h-4"/>}
            </button>
          </div>
          <button onClick={copyAddr} className="w-full py-3 bg-glow-surface border border-glow-border text-glow-text font-medium rounded-2xl text-sm">
            Copy Address
          </button>
        </div>
      </div>
    </div>
  );

  // ── Swap Tab ─────────────────────────────────────────────────────────────────
  const SwapTab = (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-glow-text px-1">Swap</h2>
      <div className="bg-glow-surface border border-glow-border rounded-2xl p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-xs text-glow-muted">From</p>
          <div className="flex items-center gap-3">
            <select value={swapFrom} onChange={e=>setSwapFrom(e.target.value)} className="bg-glow-surface border border-glow-border rounded-xl px-3 py-2 text-sm text-glow-text font-semibold focus:outline-none">
              {Object.keys(PRICE_DEFAULTS).map(k=><option key={k}>{k}</option>)}
            </select>
            <input value={swapAmt} onChange={e=>setSwapAmt(e.target.value)} type="number" min="0" placeholder="0.00"
              className="flex-1 text-xl font-bold bg-transparent text-glow-text focus:outline-none placeholder-white/20 text-right"/>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <button onClick={()=>{const tmp=swapFrom;setSwapFrom(swapTo);setSwapTo(tmp);}} className="w-9 h-9 rounded-xl bg-glow-surface border border-glow-border flex items-center justify-center">
            <ArrowLeftRight className="w-4 h-4 text-glow-muted"/>
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-glow-muted">To</p>
          <div className="flex items-center gap-3">
            <select value={swapTo} onChange={e=>setSwapTo(e.target.value)} className="bg-glow-surface border border-glow-border rounded-xl px-3 py-2 text-sm text-glow-text font-semibold focus:outline-none">
              {Object.keys(PRICE_DEFAULTS).map(k=><option key={k}>{k}</option>)}
            </select>
            <div className="flex-1 text-right">
              <p className="text-xl font-bold text-glow-muted">
                {swapAmt&&swapFrom&&swapTo ? ((parseFloat(swapAmt)||0)*liveP(swapFrom)/liveP(swapTo)).toFixed(6) : "0.000000"}
              </p>
              <p className="text-xs text-glow-muted/70 mt-0.5">≈ ${swapAmt?((parseFloat(swapAmt)||0)*liveP(swapFrom)).toFixed(2):"0.00"}</p>
            </div>
          </div>
        </div>
      </div>
      {swapAmt && (
        <div className="bg-white/3 border border-glow-border rounded-xl p-3 text-xs text-glow-muted space-y-1">
          <div className="flex justify-between"><span>Rate</span><span>1 {swapFrom} = {(liveP(swapFrom)/liveP(swapTo)).toFixed(6)} {swapTo}</span></div>
          <div className="flex justify-between"><span>Fee (0.3%)</span><span>{((parseFloat(swapAmt)||0)*0.003).toFixed(4)} {swapFrom}</span></div>
          <div className="flex justify-between"><span>Gas</span><span className="text-emerald-400">Free via Paymaster</span></div>
        </div>
      )}
      <button disabled={!swapAmt||!swapFrom||!swapTo||swapFrom===swapTo}
        onClick={()=>toast("Swap via Arc DEX — connect wallet and approve",{icon:"🔄"})}
        className="w-full py-4 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-base disabled:opacity-50">
        <ArrowLeftRight className="w-5 h-5"/>Swap {swapFrom} → {swapTo}
      </button>
      <div className="grid grid-cols-3 gap-2 pt-2">
        {[
          {icon:Zap,label:"Gas-free",desc:"via Paymaster"},
          {icon:Globe,label:"Cross-chain",desc:"CCTP native"},
          {icon:Lock,label:"No slippage",desc:"USDC stable"},
        ].map(f=>(
          <div key={f.label} className="bg-glow-surface border border-glow-border rounded-xl p-3 text-center">
            <f.icon className="w-4 h-4 text-glow-accent mx-auto mb-1"/>
            <p className="text-xs font-semibold text-glow-text">{f.label}</p>
            <p className="text-[10px] text-glow-muted">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // ── History Tab ───────────────────────────────────────────────────────────
  const HistoryTab = (
    <div className="space-y-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-glow-border">
        <span className="text-sm font-semibold text-glow-text">Transaction History</span>
        <button onClick={async()=>{
          if(!circle.userToken||!circle.activeWalletId)return;
          const r=await fetch(`/api/circle/transactions?userToken=${circle.userToken}&walletId=${circle.activeWalletId}`);
          const d=await r.json() as {transactions?:CircleTx[]};
          if(d.transactions) d.transactions.forEach(tx=>circle.appendTx(tx));
        }} className="text-glow-muted hover:text-glow-text"><RefreshCw className="w-4 h-4"/></button>
      </div>
      <div className="bg-glow-card">
        {circle.txHistory.length===0
          ? <div className="text-center py-16 text-glow-muted/70 text-sm">No transactions yet</div>
          : circle.txHistory.map(tx=><TxRow key={tx.id} tx={tx}/>)
        }
      </div>
    </div>
  );

  return (
    <AppLayout title="Wallet">
      {/* Modals */}
      {modal==="setup"   && SetupModal}
      {modal==="send"    && SendModal}
      {modal==="receive" && ReceiveModal}
      {modal==="cctp"    && CCTPModal}
      {modal==="gateway" && GatewayModal}
      {modal==="nanopay" && NanopayModal}

      {/* ── Wallet Switcher Modal ──────────────────────────────────────── */}
      {modal==="wallets" && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div className="w-full bg-glow-card border border-glow-border rounded-t-3xl pb-10">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-4 mb-5"/>
            <div className="flex items-center justify-between px-5 mb-4">
              <h3 className="text-base font-bold text-glow-text">My Wallets</h3>
              <div className="flex gap-2">
                <button onClick={()=>setModal("import")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-surface border border-glow-border rounded-xl text-xs text-glow-muted hover:text-glow-text transition-colors">
                  <ArrowDownLeft className="w-3.5 h-3.5"/>Import
                </button>
                <button onClick={()=>{setModal("setup");}}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-gradient rounded-xl text-xs text-glow-text font-semibold">
                  <Plus className="w-3.5 h-3.5"/>New
                </button>
              </div>
            </div>
            <div className="space-y-2 px-4">
              {/* MetaMask wallet if connected */}
              {mmAddr && (
                <div className={cn("flex items-center gap-3 p-4 rounded-2xl border transition-colors",
                  !hasCircle ? "bg-glow-accent/10 border-glow-accent/30" : "bg-white/4 border-glow-border hover:bg-black/5 dark:hover:bg-white/6")}>
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-sm font-bold text-orange-400 flex-shrink-0">
                    {mmAddr.slice(2,4).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-glow-text">MetaMask</p>
                    <p className="text-xs font-mono text-glow-muted truncate">{mmAddr}</p>
                  </div>
                  {!hasCircle && <span className="text-[10px] text-glow-accent bg-glow-accent/10 border border-glow-accent/20 px-2 py-0.5 rounded-full font-semibold">Active</span>}
                </div>
              )}
              {/* Circle wallets */}
              {circle.wallets.map((w,i)=>(
                <button key={w.id} onClick={()=>{circle.setActive(w.id); setModal(null); toast(`Switched to Circle Wallet ${i+1}`,{icon:"🔐"});}}
                  className={cn("w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors text-left",
                    w.id===circle.activeWalletId ? "bg-glow-accent/10 border-glow-accent/30" : "bg-white/4 border-glow-border hover:bg-black/5 dark:hover:bg-white/6")}>
                  <div className="w-10 h-10 rounded-full bg-glow-gradient flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {(w.address??'').slice(2,4).toUpperCase()||"W"+(i+1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-glow-text">Circle MPC Wallet {circle.wallets.length > 1 ? i+1 : ""}</p>
                      <span className="text-[9px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">MPC</span>
                    </div>
                    <p className="text-xs font-mono text-glow-muted truncate">{w.address??shortAddr(w.id)}</p>
                  </div>
                  {w.id===circle.activeWalletId && <Check className="w-4 h-4 text-glow-accent flex-shrink-0"/>}
                </button>
              ))}
              {!mmAddr && circle.wallets.length===0 && (
                <div className="text-center py-8 text-glow-muted/70">
                  <Wallet className="w-10 h-10 mx-auto mb-3 opacity-40"/>
                  <p className="text-sm">No wallets yet</p>
                  <p className="text-xs mt-1">Create a Circle MPC wallet or connect MetaMask</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Import Wallet Modal ─────────────────────────────────────────── */}
      {modal==="import" && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div className="w-full bg-glow-card border border-glow-border rounded-t-3xl p-5 pb-10 space-y-4">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2"/>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-glow-text">Import Wallet</h3>
                <p className="text-xs text-glow-muted mt-0.5">Watch address or enter private key</p>
              </div>
              <button onClick={()=>setModal(null)} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300/80 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
              Never share your private key. GlowIDE is open source — always verify.
            </div>
            <div className="bg-glow-surface border border-glow-border rounded-2xl p-4 space-y-3">
              <p className="text-xs text-glow-muted uppercase tracking-wider">Address or Private Key</p>
              <textarea value={importKey} onChange={e=>setImportKey(e.target.value)}
                placeholder="0x... wallet address (watch-only) or private key"
                rows={3} className="w-full bg-transparent text-sm font-mono text-glow-text focus:outline-none placeholder-white/25 resize-none"/>
            </div>
            <button disabled={!importKey||importLoading} onClick={async()=>{
              setImportLoading(true);
              await new Promise(r=>setTimeout(r,800));
              if(importKey.startsWith("0x")&&importKey.length===42){
                toast.success("Watch-only wallet added!"); setModal(null); setImportKey("");
              } else {
                toast.error("Full key import requires Circle MPC setup for security");
              }
              setImportLoading(false);
            }} className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              {importLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <ArrowDownLeft className="w-5 h-5"/>}
              Import Wallet
            </button>
          </div>
        </div>
      )}

      <div className="w-full flex flex-col h-[calc(100dvh-56px)] bg-glow-bg relative">

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
          <button onClick={()=>setModal("wallets")} className="flex items-center gap-2 bg-glow-surface border border-glow-border rounded-xl px-3 py-2 hover:bg-glow-accent/5 hover:border-glow-accent/30 transition-colors active:scale-95">
            <div className="w-6 h-6 rounded-full bg-glow-gradient flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              {displayAddr.slice(2,4).toUpperCase()||"CC"}
            </div>
            <span className="text-xs font-medium text-glow-text">{shortAddr(displayAddr)||"Connect"}</span>
            <ChevronDown className="w-3.5 h-3.5 text-glow-muted"/>
          </button>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 bg-glow-surface border border-glow-border rounded-xl px-3 py-2 hover:bg-glow-accent/5 hover:border-glow-accent/30 transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"/>
              <span className="text-xs font-medium text-glow-text">Arc Testnet</span>
              <ChevronDown className="w-3.5 h-3.5 text-glow-muted"/>
            </button>
          </div>
        </div>

        {/* ── Content based on tab ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === "home" && (
            <div className="space-y-3 pb-4">
              {/* Portfolio balance card */}
              <div className="mx-3 bg-gradient-to-br from-glow-card to-glow-bg border border-glow-border rounded-3xl p-5 shadow-xl dark:shadow-2xl dark:from-[#1e2240] dark:to-[#161825]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs text-glow-muted">
                    <div className="w-5 h-5 rounded-md bg-white/8 flex items-center justify-center"><Wallet className="w-3 h-3"/></div>
                    Portfolio Balance
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>setBalRefreshTick(t=>t+1)}
                      className="text-glow-muted hover:text-glow-accent transition-colors">
                      <RefreshCw className={cn("w-3.5 h-3.5", loadingBal && "animate-spin")}/>
                    </button>
                    <button onClick={()=>setHideBalance(!hideBalance)} className="text-glow-muted hover:text-glow-text">
                      {hideBalance?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>
                <p className="text-3xl font-bold text-glow-text mb-2">
                  {hideBalance ? "••••••" : `$${totalUSD.toFixed(2)}`}
                </p>
                <div className="flex items-center gap-2 mb-5">
                  <span className="flex items-center gap-1 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3"/>+0.00% 24h
                  </span>
                  <span className="text-xs font-medium text-glow-muted bg-glow-surface border border-glow-border px-2 py-0.5 rounded-full">USDC</span>
                  {hasCircle && <span className="text-xs font-medium text-glow-accent bg-glow-accent/10 border border-glow-accent/20 px-2 py-0.5 rounded-full flex items-center gap-1"><Shield className="w-3 h-3"/>MPC</span>}
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 border-t border-glow-border pt-4">
                  {[
                    {label:"USDC",    value: hideBalance?"••":balances.find(b=>b.token.symbol==="USDC")?.amount??"0", sub:"Native gas"},
                    {label:"Assets",  value: balances.length.toString(),                                               sub:"tokens"},
                    {label:"Network", value:"Arc",                                                                     sub:"Testnet"},
                  ].map(s=>(
                    <div key={s.label} className="bg-white/4 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1">{s.label}</p>
                      <p className="text-sm font-bold text-glow-text">{s.value}</p>
                      <p className="text-[10px] text-glow-muted mt-0.5">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-around px-4 py-2">
                <ActionBtn icon={Send}           label="Send"    onClick={()=>setModal("send")}/>
                <ActionBtn icon={ArrowDownLeft}  label="Receive" onClick={()=>setModal("receive")}/>
                <ActionBtn icon={ArrowLeftRight} label="CCTP"    onClick={()=>setModal("cctp")}/>
                <ActionBtn icon={Globe}          label="Gateway" onClick={()=>setModal("gateway")}/>
                <ActionBtn icon={Zap}            label="Nanopay" onClick={()=>setModal("nanopay")}/>
              </div>

              {/* Setup Circle CTA if not yet set up */}
              {!hasCircle && (
                <button onClick={()=>setModal("setup")}
                  className="mx-4 flex items-center gap-3 p-3.5 bg-glow-accent/10 border border-glow-accent/20 rounded-2xl hover:bg-glow-accent/15 transition-colors">
                  <Shield className="w-5 h-5 text-glow-accent flex-shrink-0"/>
                  <div className="text-left min-w-0 flex-1">
                    <p className="text-sm font-semibold text-glow-text">Set up Circle Dev Wallet</p>
                    <p className="text-xs text-glow-muted">Server-signed · No PIN · Testnet ready</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-glow-muted"/>
                </button>
              )}

              {/* My Assets */}
              <div className="mx-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-base font-bold text-glow-text">My Assets</span>
                  <button onClick={()=>{setTab("settings"); setSettingsScreen("tokens");}}
                    className="flex items-center gap-1.5 text-xs text-glow-accent bg-glow-accent/10 border border-glow-accent/20 px-3 py-1.5 rounded-xl hover:bg-glow-accent/20 transition-colors">
                    <Plus className="w-3.5 h-3.5"/>Import
                  </button>
                </div>
                <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
                  {balances.map(b=>(
                    <AssetRow key={b.token.symbol} symbol={b.token.symbol} name={b.token.name} amount={b.amount}
                      livePrice={liveP(b.token.symbol)} liveChange={liveC(b.token.symbol)}
                      logoUrl={tokenLogos[b.token.symbol]}
                      onClick={()=>setSelectedAsset({symbol:b.token.symbol,name:b.token.name,amount:b.amount})}/>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "swap"    && SwapTab}
          {tab === "history" && HistoryTab}
          {tab === "settings" && !settingsScreen && (
            <div className="p-4 space-y-3">
              <h2 className="text-lg font-bold text-glow-text px-1">Settings</h2>
              {[
                {icon:Shield,    label:"Security", desc:"PIN · Biometrics · Recovery",   key:"security" as const},
                {icon:Globe,     label:"Networks", desc:"Manage connected networks",      key:"networks" as const},
                {icon:Coins,     label:"Tokens",   desc:"Manage custom tokens",           key:"tokens"   as const},
                {icon:Zap,       label:"DeFi",     desc:"Lending · Yield · LP positions", key:"defi"     as const},
              ].map(item=>(
                <button key={item.label} onClick={()=>setSettingsScreen(item.key)}
                  className="w-full flex items-center gap-3 p-4 bg-glow-card border border-glow-border rounded-2xl hover:bg-black/5 dark:hover:bg-white/4 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-glow-accent/15 flex items-center justify-center"><item.icon className="w-5 h-5 text-glow-accent"/></div>
                  <div className="text-left flex-1"><p className="text-sm font-semibold text-glow-text">{item.label}</p><p className="text-xs text-glow-muted">{item.desc}</p></div>
                  <ChevronRight className="w-4 h-4 text-glow-muted/70"/>
                </button>
              ))}
            </div>
          )}

          {/* ── Security sub-screen ─────────────────────────────────────── */}
          {tab === "settings" && settingsScreen === "security" && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={()=>setSettingsScreen(null)} className="p-2 -ml-2 text-glow-muted hover:text-glow-text"><ChevronDown className="w-5 h-5 rotate-90"/></button>
                <h2 className="text-base font-bold text-glow-text">Security</h2>
              </div>
              {[
                {icon:KeyRound,      label:"Change PIN",         desc:"Update your wallet PIN", action:()=>toast("Set NEXT_PUBLIC_CIRCLE_APP_ID to enable PIN management",{icon:"🔑"})},
                {icon:Fingerprint,   label:"Biometrics",         desc:"Enable Face/Touch ID",   action:()=>toast("Biometrics requires native app",{icon:"👆"})},
                {icon:Shield,        label:"Recovery Phrase",    desc:"Backup your wallet",     action:()=>toast("Circle MPC wallets use PIN recovery — no seed phrase",{icon:"🛡"})},
                {icon:Lock,          label:"Auto-lock Timer",    desc:"Lock after 5 minutes",   action:()=>toast("Auto-lock: 5 min",{icon:"⏱"})},
              ].map(item=>(
                <button key={item.label} onClick={item.action}
                  className="w-full flex items-center gap-3 p-4 bg-glow-card border border-glow-border rounded-2xl hover:bg-black/5 dark:hover:bg-white/4 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-glow-accent/15 flex items-center justify-center"><item.icon className="w-5 h-5 text-glow-accent"/></div>
                  <div className="text-left flex-1"><p className="text-sm font-semibold text-glow-text">{item.label}</p><p className="text-xs text-glow-muted">{item.desc}</p></div>
                  <ChevronRight className="w-4 h-4 text-glow-muted/70"/>
                </button>
              ))}
            </div>
          )}

          {/* ── Networks sub-screen ─────────────────────────────────────── */}
          {tab === "settings" && settingsScreen === "networks" && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={()=>setSettingsScreen(null)} className="p-2 -ml-2 text-glow-muted hover:text-glow-text"><ChevronDown className="w-5 h-5 rotate-90"/></button>
                <h2 className="text-base font-bold text-glow-text">Networks</h2>
              </div>
              {[
                {name:"Arc Testnet",   id:5042002, rpc:"https://rpc.testnet.arc.network",          active:true},
                {name:"Ethereum",      id:1,        rpc:"https://eth.llamarpc.com",                  active:false},
                {name:"Base",          id:8453,     rpc:"https://mainnet.base.org",                  active:false},
                {name:"Polygon",       id:137,      rpc:"https://polygon-rpc.com",                   active:false},
                {name:"Arbitrum One",  id:42161,    rpc:"https://arb1.arbitrum.io/rpc",              active:false},
                {name:"Optimism",      id:10,       rpc:"https://mainnet.optimism.io",               active:false},
              ].map(n=>(
                <div key={n.id} className="flex items-center gap-3 p-4 bg-glow-card border border-glow-border rounded-2xl">
                  <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", n.active?"bg-emerald-400":"bg-white/20")}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-glow-text">{n.name}</p>
                    <p className="text-[10px] text-glow-muted/70 font-mono truncate">Chain {n.id}</p>
                  </div>
                  {n.active ? (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-semibold">Active</span>
                  ) : (
                    <button onClick={()=>toast(`Switch to ${n.name} via your browser wallet`,{icon:"🔗"})}
                      className="text-[10px] text-glow-muted hover:text-glow-text border border-glow-border px-2 py-0.5 rounded-full transition-colors">Switch</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Tokens sub-screen ──────────────────────────────────────── */}
          {tab === "settings" && settingsScreen === "tokens" && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={()=>setSettingsScreen(null)} className="p-2 -ml-2 text-glow-muted hover:text-glow-text"><ChevronDown className="w-5 h-5 rotate-90"/></button>
                <h2 className="text-base font-bold text-glow-text">Custom Tokens</h2>
              </div>
              <div className="bg-glow-card border border-glow-border rounded-2xl p-4 space-y-3">
                <p className="text-xs text-glow-muted">Add a custom ERC-20 token by contract address</p>
                <input placeholder="0x Contract address…" className="w-full bg-glow-surface border border-glow-border rounded-xl px-4 py-3 text-sm font-mono text-glow-text focus:outline-none focus:border-glow-accent/50 placeholder-white/25"/>
                <input placeholder="Symbol (e.g. TOKEN)" className="w-full bg-glow-surface border border-glow-border rounded-xl px-4 py-3 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50 placeholder-white/25"/>
                <input placeholder="Decimals (e.g. 18)" type="number" className="w-full bg-glow-surface border border-glow-border rounded-xl px-4 py-3 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50 placeholder-white/25"/>
                <button onClick={()=>toast("Custom token import — connect Circle wallet first",{icon:"🪙"})}
                  className="w-full py-3 bg-glow-gradient text-white font-bold rounded-xl text-sm">+ Import Token</button>
              </div>
              <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
                <p className="px-4 py-3 text-xs font-semibold text-glow-muted uppercase tracking-wider border-b border-glow-border">Arc Testnet Tokens</p>
                {[
                  {symbol:"USDC",  addr:"0x3600000000000000000000000000000000000000", decimals:18},
                  {symbol:"EURC",  addr:"0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals:6},
                  {symbol:"cirBTC",addr:"0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", decimals:8},
                  {symbol:"USYC",  addr:"0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", decimals:6},
                ].map(t=>(
                  <div key={t.symbol} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-glow-text flex-shrink-0" style={{background:CHAIN_BG[t.symbol]??"#7c3aed"}}>{t.symbol.slice(0,2)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-glow-text">{t.symbol}</p>
                      <p className="text-[10px] font-mono text-glow-muted/70 truncate">{t.addr.slice(0,18)}…</p>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-full">Added</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DeFi sub-screen ────────────────────────────────────────── */}
          {tab === "settings" && settingsScreen === "defi" && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={()=>setSettingsScreen(null)} className="p-2 -ml-2 text-glow-muted hover:text-glow-text"><ChevronDown className="w-5 h-5 rotate-90"/></button>
                <h2 className="text-base font-bold text-glow-text">DeFi Positions</h2>
              </div>
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 text-center space-y-3">
                <Zap className="w-10 h-10 text-glow-accent/40 mx-auto"/>
                <p className="text-sm font-semibold text-glow-text">No active positions</p>
                <p className="text-xs text-glow-muted">Lend, borrow, or provide liquidity on Arc Testnet to see positions here.</p>
                <a href="/defi" className="inline-block px-5 py-2.5 bg-glow-gradient text-white font-bold rounded-xl text-sm mt-2">Go to DeFi →</a>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom nav (Trust Wallet style) ──────────────────────── */}
        <div className="flex-shrink-0 bg-glow-card border-t border-glow-border flex items-center">
          {([
            {id:"home",    icon:Home,     label:"Home"},
            {id:"swap",    icon:ArrowLeftRight, label:"Swap"},
            {id:"history", icon:Clock,    label:"History"},
            {id:"settings",icon:Settings, label:"Settings"},
          ] as const).map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)}
              className={cn("flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
                tab===item.id?"text-glow-accent":"text-glow-muted/70 hover:text-glow-muted")}>
              <item.icon className="w-5 h-5"/>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Asset Detail Sheet */}
      {selectedAsset && (
        <AssetDetailSheet
          symbol={selectedAsset.symbol}
          name={selectedAsset.name}
          amount={selectedAsset.amount}
          price={liveP(selectedAsset.symbol)}
          change={liveC(selectedAsset.symbol)}
          logoUrl={tokenLogos[selectedAsset.symbol]}
          walletAddr={displayAddr}
          onClose={()=>setSelectedAsset(null)}
          onSend={()=>{ setSelectedAsset(null); setModal("send"); }}
          onReceive={()=>{ setSelectedAsset(null); setModal("receive"); }}
        />
      )}
    </AppLayout>
  );
}
