"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWalletStore } from "@/store/walletStore";
import { useCircleStore } from "@/store/circleStore";
import type { CircleTx } from "@/store/circleStore";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  Send, ArrowDownLeft, RefreshCw, Copy, CheckCircle, Eye, EyeOff,
  ChevronRight, Plus, X, Loader2, Shield, Zap, ArrowLeftRight,
  Globe, AlertTriangle, Settings, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Coins, KeyRound, Fingerprint,
  Clock, Home, BarChart2, ExternalLink, Search, ChevronDown,
  Wallet, Check, Lock,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const TOKEN_PRICES: Record<string,number> = {
  USDC:1, EURC:1.09, cirBTC:97000, USYC:1.002,
  ETH:3500, MATIC:0.92, AVAX:40, ARB:1.2, OP:2.1, BNB:620, SOL:170,
};
const TOKEN_CHANGE: Record<string,number> = {
  USDC:-0.01, EURC:0.05, cirBTC:2.31, USYC:0.08,
  ETH:-1.24, MATIC:0.87, AVAX:-0.55, ARB:1.42,
};
const CHAIN_BG: Record<string,string> = {
  ETH:"#627eea", USDC:"#2775CA", EURC:"#2775CA", cirBTC:"#f7931a",
  USYC:"#16a34a", MATIC:"#8247e5", AVAX:"#e84142", ARB:"#12aaff",
  BASE:"#0052ff", OP:"#ff0420", BNB:"#f3ba2f",
};
const ARC_RPC = "https://rpc.testnet.arc.network";
const ARC_USDC = "0x3600000000000000000000000000000000000000";

function shortAddr(a:string) { return a ? `${a.slice(0,6)}…${a.slice(-4)}` : "—"; }
function fmtUSD(n:number) { return n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(2)}`; }

// ── Circle SDK window type ────────────────────────────────────────────────────
declare global {
  interface Window {
    CircleW3s?: { W3SSdk: new(cfg:{appId:string})=>{ setAuthentication(a:{userToken:string;encryptionKey:string}):void; execute(id:string,cb:(e:unknown,r:unknown)=>void):void } };
  }
}

// ── Token row — Trust Wallet style ────────────────────────────────────────────
function AssetRow({ symbol, name, amount, chainId, onClick }:
  { symbol:string; name:string; amount:string; chainId?:string; onClick?():void }) {
  const price  = TOKEN_PRICES[symbol] ?? 1;
  const change = TOKEN_CHANGE[symbol] ?? 0;
  const value  = parseFloat(amount||"0") * price;
  const up     = change >= 0;
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-4 hover:bg-white/3 transition-colors active:bg-white/5 border-b border-white/5 last:border-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-lg"
        style={{ background: CHAIN_BG[symbol] ?? "#7c3aed" }}>
        {symbol.slice(0,2)}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-white">{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-white/40">${(TOKEN_PRICES[symbol]??1).toFixed(symbol==="USDC"||symbol==="EURC"||symbol==="USYC"?3:2)}</span>
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            up?"bg-emerald-500/15 text-emerald-400":"bg-red-500/15 text-red-400")}>
            {up?"+":""}{change.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-white">{fmtUSD(value)}</p>
        <p className="text-xs text-white/40 mt-0.5">{parseFloat(amount||"0").toFixed(4)} {symbol}</p>
      </div>
    </button>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────
function ActionBtn({ icon:Icon, label, onClick, disabled=false }:
  { icon:React.ElementType; label:string; onClick():void; disabled?:boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex flex-col items-center gap-1.5 disabled:opacity-40">
      <div className="w-12 h-12 rounded-2xl bg-white/8 border border-white/8 flex items-center justify-center hover:bg-white/12 active:scale-95 transition-all">
        <Icon className="w-5 h-5 text-white"/>
      </div>
      <span className="text-[11px] text-white/60 font-medium">{label}</span>
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
        {isIn?<ArrowDownLeft className="w-4 h-4 text-emerald-400"/>:<Send className="w-4 h-4 text-white/70"/>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{isIn?"Received":"Sent"}</p>
        <p className="text-xs text-white/40 font-mono truncate">
          {tx.destinationAddress ? shortAddr(tx.destinationAddress) : tx.id.slice(0,10)}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn("text-sm font-semibold",isIn?"text-emerald-400":"text-white")}>
          {isIn?"+":"-"}{tx.amounts?.[0]??"—"} USDC
        </p>
        <div className="flex items-center gap-1.5 justify-end mt-0.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", ok?"bg-emerald-400":fail?"bg-red-400":"bg-amber-400")}/>
          <span className="text-[10px] text-white/40">{label}</span>
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
  const [modal,       setModal]       = useState<null|"send"|"receive"|"cctp"|"gateway"|"nanopay"|"setup">(null);
  const [hideBalance, setHideBalance] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [loadingBal,  setLoadingBal]  = useState(false);

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
    setSetupStep("loading"); setLoading(true);
    try {
      const uid = `glow-${mmAddr?.toLowerCase() ?? Date.now()}`;
      const cR = await fetch("/api/circle/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",userId:uid})});
      const cD = await cR.json() as {user?:{id:string};error?:string};
      const userId = cD.user?.id ?? uid;
      const tR = await fetch("/api/circle/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"token",userId})});
      const tD = await tR.json() as {userToken?:string;encryptionKey?:string;error?:string};
      if (!tD.userToken) throw new Error(tD.error ?? "Token failed");
      circle.setSession(userId, tD.userToken, tD.encryptionKey ?? "", Date.now()+3600000);
      const iR = await fetch("/api/circle/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"initialize",userToken:tD.userToken})});
      const iD = await iR.json() as {challengeId?:string;error?:string};
      if (!iD.challengeId) throw new Error(iD.error ?? "Init failed");
      if (sdkRef.current) {
        sdkRef.current.setAuthentication({userToken:tD.userToken,encryptionKey:tD.encryptionKey??""});
        sdkRef.current.execute(iD.challengeId,(err)=>{
          if(err){toast.error(`Setup failed: ${(err as Error).message}`);return;}
          circle.setInit(true); circle.setPinSet(true);
          setSetupStep("done"); setModal(null);
          toast.success("✓ Circle Wallet created!"); loadBalances();
        });
      } else {
        circle.setInit(true); setSetupStep("done"); setModal(null); loadBalances();
      }
    } catch(e){ toast.error(String(e)); setSetupStep("welcome"); }
    finally { setLoading(false); }
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
  const totalUSD     = activeWallet?.balances?.reduce((a,b)=>a+parseFloat(b.amount||"0")*(TOKEN_PRICES[b.token.symbol]??1),0) ?? 0;
  const balances     = activeWallet?.balances ?? [
    {token:{symbol:"USDC",name:"USD Coin",decimals:6},amount:"0"},
    {token:{symbol:"EURC",name:"Euro Coin",decimals:6},amount:"0"},
    {token:{symbol:"cirBTC",name:"Circle Bitcoin",decimals:8},amount:"0"},
  ];

  const CHAINS = ["ETH-SEPOLIA","ETH","MATIC","AVAX","ARB","BASE","OP"];

  // ── Setup Modal ──────────────────────────────────────────────────────────────
  const SetupModal = (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full max-w-sm bg-[#1a1b23] border border-white/10 rounded-t-3xl p-6 space-y-5 pb-10">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4"/>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-glow-gradient flex items-center justify-center"><Shield className="w-6 h-6 text-white"/></div>
          <div><h3 className="text-base font-bold text-white">Circle MPC Wallet</h3><p className="text-xs text-white/50">Non-custodial · PIN protected</p></div>
        </div>
        {[
          {icon:KeyRound,  text:"2-of-2 MPC — Circle never holds your full key"},
          {icon:Zap,       text:"Gasless: pay fees in USDC via Circle Paymaster"},
          {icon:Globe,     text:"Cross-chain in <500ms via Circle Gateway"},
          {icon:Coins,     text:"Nanopayments from $0.000001 — zero gas"},
        ].map(f=>(
          <div key={f.text} className="flex items-center gap-3 text-sm text-white/70">
            <f.icon className="w-4 h-4 text-glow-accent flex-shrink-0"/>{f.text}
          </div>
        ))}
        {setupStep==="welcome" && (
          <button onClick={setupCircle} className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2">
            <Plus className="w-5 h-5"/>Create MPC Wallet
          </button>
        )}
        {setupStep==="loading" && (
          <div className="text-center py-3 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-glow-accent mx-auto"/>
            <p className="text-sm text-white/60">Setting up secure wallet…</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Send Modal ───────────────────────────────────────────────────────────────
  const SendModal = (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full max-w-sm bg-[#1a1b23] border border-white/10 rounded-t-3xl p-5 pb-10 space-y-4">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2"/>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Send USDC</h3>
          <button onClick={()=>setModal(null)} className="p-2 text-white/50"><X className="w-5 h-5"/></button>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-xs text-white/50 mb-1.5">Recipient</p>
            <input value={sendTo} onChange={e=>setSendTo(e.target.value)} placeholder="0x…"
              className="w-full bg-transparent text-sm font-mono text-white focus:outline-none placeholder-white/30"/>
          </div>
          <div className="h-px bg-white/8"/>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-white/50">Amount</p>
              <button className="text-xs text-glow-accent">Max</button>
            </div>
            <div className="flex items-center gap-2">
              <input value={sendAmt} onChange={e=>setSendAmt(e.target.value)} type="number" min="0" placeholder="0.00"
                className="flex-1 text-xl font-bold bg-transparent text-white focus:outline-none placeholder-white/20"/>
              <span className="text-sm font-semibold text-white/60">USDC</span>
            </div>
          </div>
        </div>
        {!hasCircle && <p className="text-xs text-amber-400/80 text-center flex items-center justify-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/>Create a Circle Wallet first for MPC security</p>}
        <button onClick={handleSend} disabled={loading||!sendTo||!sendAmt}
          className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
          {loading?<Loader2 className="w-5 h-5 animate-spin"/>:<Send className="w-5 h-5"/>}
          Send {sendAmt||"0"} USDC
        </button>
      </div>
    </div>
  );

  // ── CCTP Modal ───────────────────────────────────────────────────────────────
  const CCTPModal = (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full max-w-sm bg-[#1a1b23] border border-white/10 rounded-t-3xl p-5 pb-10 space-y-4">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2"/>
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-bold text-white">CCTP Bridge</h3><p className="text-xs text-white/40">Native USDC burn+mint — no wrapped tokens</p></div>
          <button onClick={()=>setModal(null)} className="p-2 text-white/50"><X className="w-5 h-5"/></button>
        </div>
        <div className="space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3"><p className="text-xs text-white/50 mb-1">From</p><p className="text-sm font-semibold text-white">Arc Testnet (Domain 26)</p></div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
            <p className="text-xs text-white/50">To</p>
            <select value={cctpDest} onChange={e=>setCctpDest(e.target.value)} className="w-full bg-transparent text-sm text-white focus:outline-none">
              {CHAINS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-white/50">Amount</p><button className="text-xs text-glow-accent">Max</button></div>
            <div className="flex items-center gap-2">
              <input value={cctpAmt} onChange={e=>setCctpAmt(e.target.value)} type="number" min="0" placeholder="0.00" className="flex-1 text-xl font-bold bg-transparent text-white focus:outline-none placeholder-white/20"/>
              <span className="text-sm font-semibold text-white/60">USDC</span>
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full max-w-sm bg-[#1a1b23] border border-white/10 rounded-t-3xl p-5 pb-10 space-y-4">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2"/>
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-bold text-white">Gateway Transfer</h3><p className="text-xs text-white/40">&lt;500ms · Unified balance</p></div>
          <button onClick={()=>setModal(null)} className="p-2 text-white/50"><X className="w-5 h-5"/></button>
        </div>
        <div className="space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
            <p className="text-xs text-white/50">Destination Chain</p>
            <select value={gwChain} onChange={e=>setGwChain(e.target.value)} className="w-full bg-transparent text-sm text-white focus:outline-none">
              {["ETH","MATIC","AVAX","ARB","BASE","OP"].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
            <p className="text-xs text-white/50">Recipient Address</p>
            <input value={gwDest} onChange={e=>setGwDest(e.target.value)} placeholder="0x…" className="w-full bg-transparent text-sm font-mono text-white focus:outline-none placeholder-white/30"/>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1"><p className="text-xs text-white/50">Amount</p><button className="text-xs text-glow-accent">Max</button></div>
            <div className="flex items-center gap-2">
              <input value={gwAmt} onChange={e=>setGwAmt(e.target.value)} type="number" min="0" placeholder="0.00" className="flex-1 text-xl font-bold bg-transparent text-white focus:outline-none placeholder-white/20"/>
              <span className="text-sm font-semibold text-white/60">USDC</span>
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full max-w-sm bg-[#1a1b23] border border-white/10 rounded-t-3xl p-5 pb-10 space-y-4">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2"/>
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-bold text-white">Nanopayment</h3><p className="text-xs text-white/40">Gas-free · x402 · from $0.000001</p></div>
          <button onClick={()=>setModal(null)} className="p-2 text-white/50"><X className="w-5 h-5"/></button>
        </div>
        <div className="space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1"><p className="text-xs text-white/50">Recipient</p><input value={npTo} onChange={e=>setNpTo(e.target.value)} placeholder="0x…" className="w-full bg-transparent text-sm font-mono text-white focus:outline-none placeholder-white/30"/></div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-white/50 mb-1.5">Amount USDC</p>
            <div className="flex items-center gap-2">
              <input value={npAmt} onChange={e=>setNpAmt(e.target.value)} type="number" min="0.000001" step="0.000001" className="flex-1 text-xl font-bold bg-transparent text-white focus:outline-none"/>
              <span className="text-sm font-semibold text-white/60">USDC</span>
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="w-full max-w-sm bg-[#1a1b23] border border-white/10 rounded-t-3xl p-5 pb-10">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4"/>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Receive USDC</h3>
          <button onClick={()=>setModal(null)} className="p-2 text-white/50"><X className="w-5 h-5"/></button>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-44 h-44 bg-white rounded-2xl p-3 flex items-center justify-center">
            <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center text-4xl">🔲</div>
          </div>
          <p className="text-xs text-white/40 text-center max-w-[240px]">Send only USDC and supported tokens to this address</p>
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2">
            <span className="text-xs font-mono text-white/70 break-all flex-1">{displayAddr}</span>
            <button onClick={copyAddr} className="text-white/50 hover:text-white flex-shrink-0">
              {copied?<CheckCircle className="w-4 h-4 text-emerald-400"/>:<Copy className="w-4 h-4"/>}
            </button>
          </div>
          <button onClick={copyAddr} className="w-full py-3 bg-white/8 border border-white/10 text-white font-medium rounded-2xl text-sm">
            Copy Address
          </button>
        </div>
      </div>
    </div>
  );

  // ── Swap Tab ─────────────────────────────────────────────────────────────────
  const SwapTab = (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-white px-1">Swap</h2>
      <div className="bg-[#1e2030] border border-white/8 rounded-2xl p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-xs text-white/40">From</p>
          <div className="flex items-center gap-3">
            <select value={swapFrom} onChange={e=>setSwapFrom(e.target.value)} className="bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-semibold focus:outline-none">
              {Object.keys(TOKEN_PRICES).map(k=><option key={k}>{k}</option>)}
            </select>
            <input value={swapAmt} onChange={e=>setSwapAmt(e.target.value)} type="number" min="0" placeholder="0.00"
              className="flex-1 text-xl font-bold bg-transparent text-white focus:outline-none placeholder-white/20 text-right"/>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <button onClick={()=>{const tmp=swapFrom;setSwapFrom(swapTo);setSwapTo(tmp);}} className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center">
            <ArrowLeftRight className="w-4 h-4 text-white/60"/>
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-white/40">To</p>
          <div className="flex items-center gap-3">
            <select value={swapTo} onChange={e=>setSwapTo(e.target.value)} className="bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-semibold focus:outline-none">
              {Object.keys(TOKEN_PRICES).map(k=><option key={k}>{k}</option>)}
            </select>
            <div className="flex-1 text-right">
              <p className="text-xl font-bold text-white/40">
                {swapAmt&&swapFrom&&swapTo ? ((parseFloat(swapAmt)||0)*(TOKEN_PRICES[swapFrom]??1)/(TOKEN_PRICES[swapTo]??1)).toFixed(6) : "0.000000"}
              </p>
              <p className="text-xs text-white/30 mt-0.5">≈ ${swapAmt?((parseFloat(swapAmt)||0)*(TOKEN_PRICES[swapFrom]??1)).toFixed(2):"0.00"}</p>
            </div>
          </div>
        </div>
      </div>
      {swapAmt && (
        <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-xs text-white/50 space-y-1">
          <div className="flex justify-between"><span>Rate</span><span>1 {swapFrom} = {((TOKEN_PRICES[swapFrom]??1)/(TOKEN_PRICES[swapTo]??1)).toFixed(6)} {swapTo}</span></div>
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
          <div key={f.label} className="bg-[#1e2030] border border-white/8 rounded-xl p-3 text-center">
            <f.icon className="w-4 h-4 text-glow-accent mx-auto mb-1"/>
            <p className="text-xs font-semibold text-white">{f.label}</p>
            <p className="text-[10px] text-white/40">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // ── History Tab ───────────────────────────────────────────────────────────
  const HistoryTab = (
    <div className="space-y-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <span className="text-sm font-semibold text-white">Transaction History</span>
        <button onClick={async()=>{
          if(!circle.userToken||!circle.activeWalletId)return;
          const r=await fetch(`/api/circle/transactions?userToken=${circle.userToken}&walletId=${circle.activeWalletId}`);
          const d=await r.json() as {transactions?:CircleTx[]};
          if(d.transactions) d.transactions.forEach(tx=>circle.appendTx(tx));
        }} className="text-white/40 hover:text-white"><RefreshCw className="w-4 h-4"/></button>
      </div>
      <div className="bg-[#1a1b23]">
        {circle.txHistory.length===0
          ? <div className="text-center py-16 text-white/30 text-sm">No transactions yet</div>
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

      <div className="max-w-sm mx-auto flex flex-col h-[calc(100dvh-56px)] bg-[#13141c] relative">

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
          <button className="flex items-center gap-2 bg-white/6 border border-white/8 rounded-xl px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-glow-gradient flex items-center justify-center text-[10px] font-bold text-white">
              {displayAddr.slice(2,4).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-white">{shortAddr(displayAddr)}</span>
            <ChevronDown className="w-3.5 h-3.5 text-white/50"/>
          </button>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 bg-white/6 border border-white/8 rounded-xl px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"/>
              <span className="text-xs font-medium text-white">Arc Testnet</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/50"/>
            </button>
          </div>
        </div>

        {/* ── Content based on tab ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === "home" && (
            <div className="space-y-3 pb-4">
              {/* Portfolio balance card */}
              <div className="mx-4 bg-gradient-to-br from-[#1e2240] to-[#161825] border border-white/8 rounded-3xl p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <div className="w-5 h-5 rounded-md bg-white/8 flex items-center justify-center"><Wallet className="w-3 h-3"/></div>
                    Portfolio Balance
                  </div>
                  <button onClick={()=>setHideBalance(!hideBalance)} className="text-white/40 hover:text-white">
                    {hideBalance?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                  </button>
                </div>
                <p className="text-3xl font-bold text-white mb-2">
                  {hideBalance ? "••••••" : `$${totalUSD.toFixed(2)}`}
                </p>
                <div className="flex items-center gap-2 mb-5">
                  <span className="flex items-center gap-1 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3"/>+0.00% 24h
                  </span>
                  <span className="text-xs font-medium text-white/60 bg-white/6 border border-white/8 px-2 py-0.5 rounded-full">USDC</span>
                  {hasCircle && <span className="text-xs font-medium text-glow-accent bg-glow-accent/10 border border-glow-accent/20 px-2 py-0.5 rounded-full flex items-center gap-1"><Shield className="w-3 h-3"/>MPC</span>}
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 border-t border-white/8 pt-4">
                  {[
                    {label:"USDC",    value: hideBalance?"••":balances.find(b=>b.token.symbol==="USDC")?.amount??"0", sub:"Native gas"},
                    {label:"Assets",  value: balances.length.toString(),                                               sub:"tokens"},
                    {label:"Network", value:"Arc",                                                                     sub:"Testnet"},
                  ].map(s=>(
                    <div key={s.label} className="bg-white/4 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{s.label}</p>
                      <p className="text-sm font-bold text-white">{s.value}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-around px-6 py-2">
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
                    <p className="text-sm font-semibold text-white">Set up Circle MPC Wallet</p>
                    <p className="text-xs text-white/50">Non-custodial · Gasless · CCTP + Gateway</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40"/>
                </button>
              )}

              {/* My Assets */}
              <div className="mx-4">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-base font-bold text-white">My Assets</span>
                  <button className="flex items-center gap-1.5 text-xs text-glow-accent bg-glow-accent/10 border border-glow-accent/20 px-3 py-1.5 rounded-xl">
                    <Plus className="w-3.5 h-3.5"/>Import
                  </button>
                </div>
                <div className="bg-[#1a1b23] border border-white/8 rounded-2xl overflow-hidden">
                  {balances.map(b=>(
                    <AssetRow key={b.token.symbol} symbol={b.token.symbol} name={b.token.name} amount={b.amount}
                      onClick={()=>toast(`${b.token.symbol}: ${b.amount}`,{icon:"💰"})}/>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "swap"    && SwapTab}
          {tab === "history" && HistoryTab}
          {tab === "settings" && (
            <div className="p-4 space-y-3">
              <h2 className="text-lg font-bold text-white px-1">Settings</h2>
              {[
                {icon:Shield, label:"Security", desc:"PIN · Biometrics · Recovery",  action:()=>{}},
                {icon:Globe,  label:"Networks", desc:"Manage connected networks",     action:()=>{}},
                {icon:Coins,  label:"Tokens",   desc:"Manage custom tokens",          action:()=>{}},
                {icon:Zap,    label:"DeFi",     desc:"Lending · Yield · LP positions",action:()=>{}},
              ].map(item=>(
                <button key={item.label} onClick={item.action}
                  className="w-full flex items-center gap-3 p-4 bg-[#1a1b23] border border-white/8 rounded-2xl hover:bg-white/4">
                  <div className="w-9 h-9 rounded-xl bg-glow-accent/15 flex items-center justify-center"><item.icon className="w-5 h-5 text-glow-accent"/></div>
                  <div className="text-left flex-1"><p className="text-sm font-semibold text-white">{item.label}</p><p className="text-xs text-white/40">{item.desc}</p></div>
                  <ChevronRight className="w-4 h-4 text-white/30"/>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Bottom nav (Trust Wallet style) ──────────────────────── */}
        <div className="flex-shrink-0 bg-[#13141c] border-t border-white/8 flex items-center">
          {([
            {id:"home",    icon:Home,     label:"Home"},
            {id:"swap",    icon:ArrowLeftRight, label:"Swap"},
            {id:"history", icon:Clock,    label:"History"},
            {id:"settings",icon:Settings, label:"Settings"},
          ] as const).map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)}
              className={cn("flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
                tab===item.id?"text-glow-accent":"text-white/30 hover:text-white/60")}>
              <item.icon className="w-5 h-5"/>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
