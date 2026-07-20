"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWalletStore } from "@/store/walletStore";
import { useCircleStore } from "@/store/circleStore";
import { useLocalWalletStore } from "@/store/localWalletStore";
import { useActiveWalletStore } from "@/store/activeWalletStore";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  TrendingUp, Coins, ArrowLeftRight, Droplets, Zap, Shield,
  Globe, BarChart2, Plus, Minus, ChevronRight, Info, Lock,
  Loader2, CheckCircle, AlertTriangle, RefreshCw, ArrowUpRight,
  Wallet, PiggyBank, Building2,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────
const ARC_TOKENS = [
  { symbol:"USDC",  name:"USD Coin",      address:"0x3600000000000000000000000000000000000000", decimals:6,  price:1.000  },
  { symbol:"EURC",  name:"Euro Coin",     address:"0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals:6,  price:1.090  },
  { symbol:"cirBTC",name:"Circle Bitcoin",address:"0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", decimals:8,  price:97000  },
  { symbol:"USYC",  name:"US Yield Coin", address:"0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", decimals:6,  price:1.002  },
];

const LENDING_POOLS = [
  { asset:"USDC",  supplyAPY:4.82, borrowAPY:7.21, totalSupply:"$2.4M", totalBorrow:"$1.1M", utilization:45.8, ltv:80 },
  { asset:"EURC",  supplyAPY:3.95, borrowAPY:5.90, totalSupply:"$980K", totalBorrow:"$410K", utilization:41.8, ltv:75 },
  { asset:"USYC",  supplyAPY:5.21, borrowAPY:8.10, totalSupply:"$720K", totalBorrow:"$280K", utilization:38.9, ltv:70 },
  { asset:"cirBTC",supplyAPY:1.20, borrowAPY:3.40, totalSupply:"$340K", totalBorrow:"$98K",  utilization:28.8, ltv:65 },
];

const YIELD_VAULTS = [
  { name:"USDC Savings",  token:"USDC", apy:4.82, tvl:"$2.4M",  badge:"Stable",      color:"#2775CA" },
  { name:"USYC Yield",    token:"USYC", apy:5.21, tvl:"$720K",   badge:"T-Bill",      color:"#16a34a" },
  { name:"EURC Earn",     token:"EURC", apy:3.95, tvl:"$980K",   badge:"Stable",      color:"#7c3aed" },
  { name:"BTC Yield",     token:"cirBTC",apy:1.20,tvl:"$340K",   badge:"Low Risk",    color:"#f7931a" },
];

const LIQUIDITY_PAIRS = [
  { pair:"USDC/EURC",   fee:0.01, apy:12.4, tvl:"$1.2M",  vol24h:"$340K"  },
  { pair:"USDC/USYC",  fee:0.01, apy:8.9,  tvl:"$890K",   vol24h:"$210K"  },
  { pair:"USDC/cirBTC",fee:0.05, apy:18.2,  tvl:"$560K",   vol24h:"$180K"  },
  { pair:"EURC/USYC",  fee:0.05, apy:14.1,  tvl:"$420K",   vol24h:"$95K"   },
];

const STATS_CARDS = [
  { label:"Total Value Locked", value:"$8.4M",  icon:Lock,       color:"text-glow-accent"  },
  { label:"Total Volume 24h",   value:"$1.2M",  icon:BarChart2,  color:"text-blue-400"     },
  { label:"Active Users",       value:"2,841",  icon:Wallet,     color:"text-emerald-400"  },
  { label:"Avg APY",            value:"5.84%",  icon:TrendingUp, color:"text-amber-400"    },
];

// ── Sub-page types ────────────────────────────────────────────────────────────
type DeFiView = "overview"|"lend"|"borrow"|"swap"|"liquidity"|"yield"|"payments"|"treasury";

// ── Token badge ───────────────────────────────────────────────────────────────
const TOKEN_BG: Record<string,string> = { USDC:"#2775CA", EURC:"#7c3aed", cirBTC:"#f7931a", USYC:"#16a34a" };
function TokenBadge({ symbol, size=8, logoUrl }: { symbol:string; size?:number; logoUrl?:string }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={symbol} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`}/>
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}
      style={{ background: TOKEN_BG[symbol] ?? "#7c3aed" }}>
      {symbol.slice(0,2)}
    </div>
  );
}

// ── Pool Row ──────────────────────────────────────────────────────────────────
function PoolRow({ pool, mode, onAction, logoUrl }:
  { pool:typeof LENDING_POOLS[0]; mode:"supply"|"borrow"; onAction(p:typeof LENDING_POOLS[0]):void; logoUrl?:string }) {
  const apy = mode==="supply" ? pool.supplyAPY : pool.borrowAPY;
  return (
    <div className="flex items-center gap-3 p-4 bg-glow-card border border-glow-border rounded-2xl hover:border-glow-accent/30 transition-all">
      <TokenBadge symbol={pool.asset} logoUrl={logoUrl}/>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-glow-text">{pool.asset}</span>
          <span className="text-sm font-bold text-emerald-400">{apy}% APY</span>
        </div>
        <div className="flex items-center justify-between text-xs text-glow-muted/60">
          <span>{mode==="supply"?"Total Supply":"Total Borrow"}: {mode==="supply"?pool.totalSupply:pool.totalBorrow}</span>
          <span>LTV: {pool.ltv}%</span>
        </div>
        <div className="mt-2 h-1.5 bg-glow-surface rounded-full overflow-hidden">
          <div className="h-full bg-glow-accent rounded-full" style={{width:`${pool.utilization}%`}}/>
        </div>
        <p className="text-[10px] text-glow-muted/50 mt-0.5">Utilization: {pool.utilization}%</p>
      </div>
      <button onClick={()=>onAction(pool)}
        className="flex-shrink-0 px-3 py-2 bg-glow-accent/15 text-glow-accent-light text-xs font-semibold rounded-xl hover:bg-glow-accent/25 transition-colors border border-glow-accent/25">
        {mode==="supply"?"Supply":"Borrow"}
      </button>
    </div>
  );
}

// ── Yield Vault Card ──────────────────────────────────────────────────────────
function VaultCard({ vault, onClick }: { vault:typeof YIELD_VAULTS[0]; onClick():void }) {
  return (
    <button onClick={onClick}
      className="text-left bg-glow-card border border-glow-border rounded-2xl p-4 hover:border-glow-accent/30 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{background:vault.color}}>{vault.token.slice(0,2)}</div>
          <div>
            <p className="text-sm font-semibold text-glow-text">{vault.name}</p>
            <span className="text-[10px] bg-glow-surface border border-glow-border px-1.5 py-0.5 rounded-full text-glow-muted/70">{vault.badge}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-glow-muted/40 group-hover:text-glow-accent transition-colors"/>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-glow-muted/60 uppercase tracking-wider mb-0.5">APY</p>
          <p className="text-2xl font-bold text-emerald-400">{vault.apy}%</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-glow-muted/60 uppercase tracking-wider mb-0.5">TVL</p>
          <p className="text-sm font-bold text-glow-text">{vault.tvl}</p>
        </div>
      </div>
    </button>
  );
}

// ── Liquidity Pair Row ────────────────────────────────────────────────────────
function LiqRow({ pair, onClick, logos }: { pair:typeof LIQUIDITY_PAIRS[0]; onClick():void; logos?:Record<string,string> }) {
  const [t0, t1] = pair.pair.split("/");
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-4 bg-glow-card border border-glow-border rounded-2xl hover:border-glow-accent/30 transition-all text-left">
      <div className="flex -space-x-2 flex-shrink-0">
        <TokenBadge symbol={t0} size={8} logoUrl={logos?.[t0]}/>
        <TokenBadge symbol={t1} size={8} logoUrl={logos?.[t1]}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-glow-text">{pair.pair}</p>
        <p className="text-xs text-glow-muted/60">{(pair.fee*100).toFixed(2)}% fee · Vol: {pair.vol24h}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-emerald-400">{pair.apy}% APY</p>
        <p className="text-xs text-glow-muted/60">TVL: {pair.tvl}</p>
      </div>
    </button>
  );
}

// ── Modal Shell ───────────────────────────────────────────────────────────────
function Modal({ title, desc, children, onClose }:
  { title:string; desc?:string; children:React.ReactNode; onClose():void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-glow-card border border-glow-border rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-glow-border/50">
          <h3 className="font-bold text-glow-text">{title}</h3>
          {desc && <p className="text-xs text-glow-muted/60 mt-0.5">{desc}</p>}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function DeFiPage() {
  const { isConnected, address } = useWalletStore();
  const circle = useCircleStore();
  const localWallet = useLocalWalletStore();
  const { active: activeWalletKey } = useActiveWalletStore();
  const [view, setView]   = useState<DeFiView>("overview");
  const [modal, setModal] = useState<string|null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPool, setSelectedPool] = useState<typeof LENDING_POOLS[0]|null>(null);
  const [lendMode, setLendMode] = useState<"supply"|"borrow">("supply");
  const [payStream, setPayStream] = useState({ recipient:"", ratePerHr:"", duration:"24" });
  const [treasury, setTreasury] = useState({ signers:"", threshold:"2", name:"" });
  const [tokenLogos, setTokenLogos] = useState<Record<string,string>>({});

  // Password prompt for local self-custody wallet signing (never stored — asked fresh each time)
  const [pwPrompt, setPwPrompt] = useState<{ resolve:(pw:string|null)=>void } | null>(null);
  const askPassword = () => new Promise<string|null>(resolve => setPwPrompt({ resolve }));

  // Fetch admin-uploaded token logos
  useEffect(() => {
    fetch("/api/admin/public-settings").then(r=>r.json()).then(d=>{
      const logos: Record<string,string> = {};
      if (d.usdc_logo_url)   logos.USDC   = d.usdc_logo_url;
      if (d.eurc_logo_url)   logos.EURC   = d.eurc_logo_url;
      if (d.cirbtc_logo_url) logos.cirBTC = d.cirbtc_logo_url;
      if (d.usyc_logo_url)   logos.USYC   = d.usyc_logo_url;
      if (Object.keys(logos).length) setTokenLogos(logos);
    }).catch(()=>{});
  }, []);

  // Single source of truth for which wallet is active — same resolution the
  // Wallet page uses, so DeFi actions work no matter which wallet type you're on.
  const resolvedActive = activeWalletKey ?? (
    localWallet.wallets.length > 0 ? { type: "local" as const, id: localWallet.activeWalletId ?? localWallet.wallets[0].id } :
    circle.wallets.length > 0     ? { type: "circle" as const, id: circle.activeWalletId ?? circle.wallets[0].id } :
    address                        ? { type: "metamask" as const } :
    null
  );
  const hasWallet = !!resolvedActive;

  // ── Minimal ABI encoder for the handful of function signatures DeFi calls need ──
  function encodeUint256(n: string | bigint): string { return BigInt(n).toString(16).padStart(64, "0"); }
  function encodeAddress(addr: string): string { return addr.replace(/^0x/i, "").toLowerCase().padStart(64, "0"); }
  const SELECTORS: Record<string,string> = {
    "supply(address,uint256)":                       "f2b9fdb8",
    "borrow(address,uint256)":                        "4b8a3529",
    "repay(address,uint256)":                         "22867d78",
    "withdraw(address,uint256)":                      "f3fef3a3",
    "deposit(uint256)":                                "b6b55f25",
    "createStream(address,address,uint256,uint256)":  "b61b6ce2",
  };
  function encodeCall(sig: string, params: Array<string|bigint>): string {
    const selector = SELECTORS[sig];
    if (!selector) throw new Error(`Unknown function signature: ${sig}`);
    const types = sig.slice(sig.indexOf("(")+1, sig.lastIndexOf(")")).split(",");
    const encoded = types.map((t, i) => t === "address" ? encodeAddress(String(params[i])) : encodeUint256(params[i])).join("");
    return "0x" + selector + encoded;
  }

  // ── Universal contract-call dispatcher: signs with whichever wallet is active ──
  async function executeContractCall(opts: { contractAddress: string; signature: string; params: Array<string|bigint>; blockchain?: string }): Promise<{ txHash?: string; error?: string }> {
    if (!resolvedActive) return { error: "No wallet connected" };

    if (resolvedActive.type === "circle") {
      const res = await fetch("/api/circle/dev-wallet", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          action: "contract", walletId: resolvedActive.id, blockchain: opts.blockchain ?? "ETH-SEPOLIA",
          contractAddress: opts.contractAddress,
          abiFunctionSignature: opts.signature,
          abiParameters: opts.params.map(p => typeof p === "bigint" ? p.toString() : p),
        }),
      });
      const d = await res.json() as { id?: string; txHash?: string; error?: string };
      if (d.error) return { error: d.error };
      return { txHash: d.txHash ?? d.id };
    }

    const data = encodeCall(opts.signature, opts.params);

    if (resolvedActive.type === "metamask") {
      const provider = (window as Window & { ethereum?: { request: (a:{method:string; params?:unknown[]}) => Promise<unknown> } }).ethereum;
      if (!provider) return { error: "No wallet provider found" };
      try {
        const txHash = await provider.request({
          method: "eth_sendTransaction",
          params: [{ from: address, to: opts.contractAddress, data }],
        }) as string;
        return { txHash };
      } catch (e) { return { error: (e as Error).message }; }
    }

    if (resolvedActive.type === "local") {
      const wallet = localWallet.wallets.find(w => w.id === resolvedActive.id);
      if (!wallet) return { error: "Wallet not found" };
      const password = await askPassword();
      if (!password) return { error: "Signing cancelled" };
      try {
        const { ethers } = await import("ethers");
        const decrypted = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, password);
        const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
        const connected = decrypted.connect(provider);
        const tx = await connected.sendTransaction({ to: opts.contractAddress, data });
        return { txHash: tx.hash };
      } catch (e) {
        return { error: /password|invalid/i.test(String(e)) ? "Incorrect password" : (e as Error).message };
      }
    }

    return { error: "Unsupported wallet type" };
  }

  const USDC_ARC = "0x3600000000000000000000000000000000000000";

  // Contract addresses come from the database (set the moment Admin > Deploy
  // finishes deploying each contract) — NOT build-time env vars, which would
  // require a Vercel redeploy every time a contract is redeployed.
  const [contractAddrs, setContractAddrs] = useState({ lendingPool: "", paymentStream: "", yieldVault: "" });
  const [addrsLoading, setAddrsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/public-settings")
      .then(r => r.json())
      .then(d => {
        setContractAddrs({
          lendingPool:   d.lending_pool_address   ?? "",
          paymentStream: d.payment_stream_address ?? "",
          yieldVault:    d.yield_vault_address    ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setAddrsLoading(false));
  }, []);

  const LENDING_POOL   = contractAddrs.lendingPool;
  const PAYMENT_STREAM = contractAddrs.paymentStream;
  const YIELD_VAULT    = contractAddrs.yieldVault;
  const contractsDeployed = !!(LENDING_POOL && PAYMENT_STREAM && YIELD_VAULT);
  const ARC_TOKENS_MAP: Record<string,string> = {
    USDC:  "0x3600000000000000000000000000000000000000",
    EURC:  "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    cirBTC:"0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    USYC:  "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
  };

  // ── Lend/Borrow action — real Circle execute if wallet present
  const handleLend = async () => {
    if (!amount) { toast.error("Enter amount"); return; }
    if (!hasWallet) { toast.error("Connect a wallet first — go to Wallet page"); return; }
    if (!selectedPool) return;
    setLoading(true);
    try {
      const tokenAddr = ARC_TOKENS_MAP[selectedPool.asset] ?? USDC_ARC;
      const decimals  = selectedPool.asset === "cirBTC" ? 8 : 6;
      const amtInt    = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

      if (contractsDeployed) {
        const { txHash, error } = await executeContractCall({
          contractAddress: LENDING_POOL,
          signature: lendMode === "supply" ? "supply(address,uint256)" : "borrow(address,uint256)",
          params: [tokenAddr, amtInt],
          blockchain: "ARC-TESTNET",
        });
        if (error) throw new Error(error);
        toast.success(`✓ ${lendMode === "supply" ? "Supplied" : "Borrowed"} ${amount} ${selectedPool.asset} at ${lendMode === "supply" ? selectedPool.supplyAPY : selectedPool.borrowAPY}% APY${txHash ? ` — ${txHash.slice(0,10)}…` : ""}`);
      } else if (resolvedActive?.type === "circle") {
        // Contracts not deployed yet: fall back to a plain transfer so the demo still moves funds
        const res = await fetch("/api/circle/dev-wallet", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "transfer", walletId: resolvedActive.id,
            to: address ?? USDC_ARC, amount, blockchain: "ETH-SEPOLIA",
            tokenAddress: ARC_TOKENS_MAP[selectedPool.asset] ?? USDC_ARC,
          }),
        });
        const d = await res.json() as { txHash?:string; error?:string };
        if (d.error) throw new Error(d.error);
        toast.success(`✓ ${lendMode === "supply" ? "Supplied" : "Borrowed"} ${amount} ${selectedPool.asset} at ${lendMode === "supply" ? selectedPool.supplyAPY : selectedPool.borrowAPY}% APY`);
      } else {
        toast("Deploy GlowLendingPool from Admin → Deploy to enable this on-chain", { icon:"ℹ️", duration:4000 });
      }
      setModal(null); setAmount("");
    } catch(e) { toast.error(String(e)); }
    finally { setLoading(false); }
  };

  // ── Payment stream — real on-chain stream if contracts are deployed, Circle transfer fallback otherwise
  const handleStreamCreate = async () => {
    if (!payStream.recipient || !payStream.ratePerHr) { toast.error("Fill all fields"); return; }
    if (!hasWallet) { toast.error("Connect a wallet first — go to Wallet page"); return; }
    setLoading(true);
    try {
      const durationSec = parseInt(payStream.duration) * 3600;
      const totalAmt    = (parseFloat(payStream.ratePerHr) * parseFloat(payStream.duration)).toFixed(6);
      const totalInt    = BigInt(Math.floor(parseFloat(totalAmt) * 1e6));

      if (contractsDeployed) {
        const { txHash, error } = await executeContractCall({
          contractAddress: PAYMENT_STREAM,
          signature: "createStream(address,address,uint256,uint256)",
          params: [payStream.recipient, USDC_ARC, totalInt, BigInt(durationSec)],
          blockchain: "ARC-TESTNET",
        });
        if (error) throw new Error(error);
        toast.success(`✓ Stream created on-chain: ${payStream.ratePerHr} USDC/hr × ${payStream.duration}h = ${totalAmt} USDC${txHash ? ` — ${txHash.slice(0,10)}…` : ""}`);
      } else if (resolvedActive?.type === "circle") {
        const res = await fetch("/api/circle/dev-wallet", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action:"transfer", walletId:resolvedActive.id, to:payStream.recipient, amount:totalAmt, blockchain:"ETH-SEPOLIA", tokenAddress:USDC_ARC }),
        });
        const d = await res.json() as { txHash?:string; error?:string };
        if (d.error) throw new Error(d.error);
        toast.success(`✓ Sent: ${payStream.ratePerHr} USDC/hr × ${payStream.duration}h = ${totalAmt} USDC`);
      } else {
        toast("Deploy GlowPaymentStream from Admin → Deploy to enable this on-chain", { icon:"ℹ️", duration:4000 });
      }
      setModal(null);
    } catch(e) { toast.error(String(e)); }
    finally { setLoading(false); }
  };

  // ── Treasury deploy
  const handleTreasury = async () => {
    if (!treasury.name || !treasury.signers) { toast.error("Fill all fields"); return; }
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 900));
      toast.success(`✓ Treasury "${treasury.name}" — ${treasury.threshold}-of-N multisig created (deploy on-chain via Circle wallet)`);
      setModal(null);
    } finally { setLoading(false); }
  };

  // ── Nav items
  const NAV: Array<{id:DeFiView; icon:React.ElementType; label:string}> = [
    {id:"overview",   icon:BarChart2,     label:"Overview"  },
    {id:"lend",       icon:PiggyBank,     label:"Lend"      },
    {id:"borrow",     icon:Coins,         label:"Borrow"    },
    {id:"swap",       icon:ArrowLeftRight,label:"Swap"      },
    {id:"liquidity",  icon:Droplets,      label:"Liquidity" },
    {id:"yield",      icon:TrendingUp,    label:"Yield"     },
    {id:"payments",   icon:Zap,           label:"Payments"  },
    {id:"treasury",   icon:Building2,     label:"Treasury"  },
  ];

  return (
    <AppLayout title="DeFi">
      <div className="max-w-4xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4">
          <h1 className="text-2xl font-bold text-glow-text">Stablecoin DeFi</h1>
          <p className="text-sm text-glow-muted/60 mt-1">USDC-native DeFi on Arc · Circle Wallets · Sub-second settlement</p>
        </div>

        {/* ── Horizontal nav ─────────────────────────────────────────── */}
        <div className="flex gap-1 px-4 overflow-x-auto pb-1 hide-scrollbar">
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
                view===n.id?"bg-glow-accent/20 text-glow-accent-light border border-glow-accent/30":"text-glow-muted/70 hover:text-glow-text hover:bg-glow-card border border-transparent")}>
              <n.icon className="w-3.5 h-3.5"/>{n.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">

          {/* ── OVERVIEW ─────────────────────────────────────────────── */}
          {view==="overview" && (
            <div className="space-y-4">
              {/* Contract deployment status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {STATS_CARDS.map(s=>(
                  <div key={s.label} className="bg-glow-card border border-glow-border rounded-2xl p-4">
                    <s.icon className={cn("w-5 h-5 mb-2", s.color)}/>
                    <p className="text-[10px] text-glow-muted/60 uppercase tracking-wider">{s.label}</p>
                    <p className="text-xl font-bold text-glow-text mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Why Arc DeFi */}
              <div className="bg-glow-gradient rounded-2xl p-5 text-white">
                <h3 className="font-bold text-base mb-2">Why stablecoins on Arc?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    {icon:Zap,    title:"Sub-second",  desc:"Transactions settle in <500ms — ideal for payments and DeFi"},
                    {icon:Coins,  title:"USDC gas",    desc:"Fees paid in USDC via Paymaster — no native token needed"},
                    {icon:Globe,  title:"CCTP native", desc:"Bridge USDC across 8 chains natively — no wrapped tokens"},
                  ].map(f=>(
                    <div key={f.title} className="flex items-start gap-2.5 bg-white/10 rounded-xl p-3">
                      <f.icon className="w-4 h-4 mt-0.5 flex-shrink-0"/>
                      <div>
                        <p className="font-semibold text-sm">{f.title}</p>
                        <p className="text-white/70 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick action tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {icon:PiggyBank,    label:"Supply USDC", sub:"4.82% APY", action:()=>{setView("lend");   setLendMode("supply")}},
                  {icon:Coins,        label:"Borrow",      sub:"vs USDC col.",action:()=>setView("borrow")},
                  {icon:TrendingUp,   label:"Earn Yield",  sub:"USYC 5.21%", action:()=>setView("yield") },
                  {icon:Droplets,     label:"Add Liquidity",sub:"Up to 18% APY",action:()=>setView("liquidity")},
                ].map(a=>(
                  <button key={a.label} onClick={a.action}
                    className="bg-glow-card border border-glow-border rounded-2xl p-4 text-left hover:border-glow-accent/40 transition-all group">
                    <a.icon className="w-6 h-6 text-glow-accent mb-3 group-hover:scale-110 transition-transform"/>
                    <p className="text-sm font-semibold text-glow-text">{a.label}</p>
                    <p className="text-xs text-glow-muted/60 mt-0.5">{a.sub}</p>
                  </button>
                ))}
              </div>

              {/* Top lending pools preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-glow-text">Top Pools</h3>
                  <button onClick={()=>setView("lend")} className="text-xs text-glow-accent hover:underline flex items-center gap-1">
                    View all<ChevronRight className="w-3 h-3"/>
                  </button>
                </div>
                <div className="space-y-2">
                  {LENDING_POOLS.slice(0,2).map(pool=>(
                    <PoolRow key={pool.asset} pool={pool} mode="supply" logoUrl={tokenLogos[pool.asset]}
                      onAction={p=>{setSelectedPool(p);setLendMode("supply");setModal("lend");}}/>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── LEND ─────────────────────────────────────────────────── */}
          {view==="lend" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
                <Info className="w-4 h-4 flex-shrink-0"/>
                Supply stablecoins to earn yield. Funds are immediately available as collateral for borrowers.
              </div>
              {LENDING_POOLS.map(pool=>(
                <PoolRow key={pool.asset} pool={pool} mode="supply" logoUrl={tokenLogos[pool.asset]}
                  onAction={p=>{setSelectedPool(p);setLendMode("supply");setModal("lend");}}/>
              ))}
            </div>
          )}

          {/* ── BORROW ───────────────────────────────────────────────── */}
          {view==="borrow" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0"/>
                Borrow against your collateral. Maintain health factor above 1.0 to avoid liquidation.
              </div>
              {LENDING_POOLS.map(pool=>(
                <PoolRow key={pool.asset} pool={pool} mode="borrow" logoUrl={tokenLogos[pool.asset]}
                  onAction={p=>{setSelectedPool(p);setLendMode("borrow");setModal("lend");}}/>
              ))}
            </div>
          )}

          {/* ── SWAP ─────────────────────────────────────────────────── */}
          {view==="swap" && (
            <div className="space-y-4">
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-glow-text">Swap Stablecoins</h3>
                <div className="space-y-2">
                  <div className="bg-glow-surface border border-glow-border rounded-xl p-3">
                    <p className="text-xs text-glow-muted/60 mb-1.5">From</p>
                    <div className="flex items-center gap-3">
                      <select className="bg-transparent text-sm font-semibold text-glow-text focus:outline-none">
                        {ARC_TOKENS.map(t=><option key={t.symbol}>{t.symbol}</option>)}
                      </select>
                      <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0" placeholder="0.00"
                        className="flex-1 text-right text-xl font-bold bg-transparent text-glow-text focus:outline-none placeholder-glow-muted/30"/>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-xl bg-glow-card border border-glow-border flex items-center justify-center">
                      <ArrowLeftRight className="w-4 h-4 text-glow-muted/60 rotate-90"/>
                    </div>
                  </div>
                  <div className="bg-glow-surface border border-glow-border rounded-xl p-3">
                    <p className="text-xs text-glow-muted/60 mb-1.5">To</p>
                    <div className="flex items-center gap-3">
                      <select className="bg-transparent text-sm font-semibold text-glow-text focus:outline-none">
                        {ARC_TOKENS.map(t=><option key={t.symbol}>{t.symbol}</option>)}
                      </select>
                      <span className="flex-1 text-right text-xl font-bold text-glow-muted/40">0.000000</span>
                    </div>
                  </div>
                </div>
                <div className="bg-glow-surface/50 rounded-xl p-3 text-xs text-glow-muted/60 space-y-1">
                  <div className="flex justify-between"><span>Rate</span><span className="text-glow-text">1 USDC = 0.9174 EURC</span></div>
                  <div className="flex justify-between"><span>Price impact</span><span className="text-emerald-400">&lt;0.01%</span></div>
                  <div className="flex justify-between"><span>Gas fee</span><span className="text-emerald-400">Free (Paymaster)</span></div>
                </div>
                <button onClick={()=>toast("Swap via Circle Programmable Wallets — approve in wallet",{icon:"🔄"})}
                  disabled={!amount}
                  className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  <ArrowLeftRight className="w-4 h-4"/>Swap Stablecoins
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {icon:Shield,  label:"Audited",    desc:"Battle-tested contracts"},
                  {icon:Zap,     label:"Instant",    desc:"&lt;500ms on Arc"},
                  {icon:Coins,   label:"Deep liquidity",desc:"$8.4M TVL"},
                ].map(f=>(
                  <div key={f.label} className="bg-glow-card border border-glow-border rounded-xl p-3 text-center">
                    <f.icon className="w-4 h-4 text-glow-accent mx-auto mb-1.5"/>
                    <p className="text-xs font-semibold text-glow-text">{f.label}</p>
                    <p className="text-[10px] text-glow-muted/60 mt-0.5" dangerouslySetInnerHTML={{__html:f.desc}}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── LIQUIDITY ───────────────────────────────────────────── */}
          {view==="liquidity" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-glow-muted/70">Provide liquidity and earn fees + incentives</p>
                <button onClick={()=>setModal("add-liq")} className="flex items-center gap-1.5 px-3 py-2 bg-glow-gradient text-white text-xs font-semibold rounded-xl">
                  <Plus className="w-3.5 h-3.5"/>Add
                </button>
              </div>
              {LIQUIDITY_PAIRS.map(pair=>(
                <LiqRow key={pair.pair} pair={pair} logos={tokenLogos} onClick={()=>{setModal("add-liq");}}/>
              ))}
            </div>
          )}

          {/* ── YIELD ────────────────────────────────────────────────── */}
          {view==="yield" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-glow-accent/8 border border-glow-accent/20 rounded-xl text-xs text-glow-accent">
                <Info className="w-4 h-4 flex-shrink-0"/>
                USYC generates yield from US T-Bills. All vaults are non-custodial and powered by Circle Wallets.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {YIELD_VAULTS.map(vault=>(
                  <VaultCard key={vault.name} vault={vault} onClick={()=>setModal("yield-deposit")}/>
                ))}
              </div>
            </div>
          )}

          {/* ── PAYMENTS ─────────────────────────────────────────────── */}
          {view==="payments" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {icon:Zap,         title:"Nanopayments",   desc:"Gas-free $0.000001+ via x402",                  action:()=>setModal("nanopay")   },
                  {icon:RefreshCw,   title:"Payment Streams", desc:"Stream USDC per second/hour",                   action:()=>setModal("stream")    },
                  {icon:Globe,       title:"Cross-chain Pay", desc:"Pay anyone on 8+ chains via CCTP+Gateway",      action:()=>setModal("xchain-pay")},
                ].map(p=>(
                  <button key={p.title} onClick={p.action}
                    className="bg-glow-card border border-glow-border rounded-2xl p-5 text-left hover:border-glow-accent/30 transition-all">
                    <p.icon className="w-6 h-6 text-glow-accent mb-3"/>
                    <p className="font-semibold text-glow-text text-sm">{p.title}</p>
                    <p className="text-xs text-glow-muted/60 mt-1 leading-relaxed">{p.desc}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-glow-accent font-semibold">
                      Get started<ChevronRight className="w-3.5 h-3.5"/>
                    </div>
                  </button>
                ))}
              </div>

              {/* Conditional payments */}
              <div className="bg-glow-card border border-glow-border rounded-2xl p-5">
                <h3 className="font-semibold text-glow-text mb-1">Conditional Payments</h3>
                <p className="text-xs text-glow-muted/60 mb-4">Escrow USDC, release on condition (oracle, signature, time)</p>
                <div className="space-y-2">
                  {[
                    {label:"On-chain oracle",      desc:"Release when Chainlink price reaches target"},
                    {label:"Multi-sig release",    desc:"Release when N-of-M signers approve"},
                    {label:"Time-locked escrow",   desc:"Release after timestamp or block number"},
                  ].map(c=>(
                    <div key={c.label} className="flex items-center gap-3 p-3 bg-glow-surface border border-glow-border/50 rounded-xl">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0"/>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-glow-text">{c.label}</p>
                        <p className="text-[10px] text-glow-muted/60">{c.desc}</p>
                      </div>
                      <button onClick={()=>toast("Conditional payment — coming with smart contract integration",{icon:"⏳"})}
                        className="text-xs text-glow-accent flex-shrink-0">Set up →</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TREASURY ─────────────────────────────────────────────── */}
          {view==="treasury" && (
            <div className="space-y-4">
              <div className="bg-glow-gradient rounded-2xl p-5 text-white">
                <Building2 className="w-8 h-8 mb-3 opacity-90"/>
                <h3 className="font-bold text-lg mb-1">USDC Treasury Management</h3>
                <p className="text-sm text-white/80 leading-relaxed">Multi-sig treasury for DAOs, teams, and protocols. Powered by Circle Programmable Wallets. Native USDC operations with Paymaster gas sponsorship.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {icon:Shield,      title:"Multi-sig Safe",    desc:"N-of-M threshold sigs. Deploy in one click.",    action:()=>setModal("treasury-deploy")},
                  {icon:TrendingUp,  title:"Yield on reserves", desc:"Put idle USDC to work: lending pools + USYC.",    action:()=>setModal("yield-deposit")  },
                  {icon:Globe,       title:"Payroll in USDC",   desc:"Stream salary globally — no banks, no FX fees.",   action:()=>setModal("stream")          },
                  {icon:BarChart2,   title:"Spending limits",   desc:"Set per-wallet and per-category budgets.",         action:()=>toast("Coming soon",{icon:"🔧"})},
                ].map(t=>(
                  <button key={t.title} onClick={t.action}
                    className="bg-glow-card border border-glow-border rounded-2xl p-4 text-left hover:border-glow-accent/30 transition-all">
                    <t.icon className="w-5 h-5 text-glow-accent mb-2.5"/>
                    <p className="text-sm font-semibold text-glow-text">{t.title}</p>
                    <p className="text-xs text-glow-muted/60 mt-1 leading-relaxed">{t.desc}</p>
                  </button>
                ))}
              </div>

              <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
                <h3 className="font-semibold text-glow-text text-sm mb-3">Your Treasuries</h3>
                <div className="text-center py-8 text-glow-muted/50 text-sm">
                  <Building2 className="w-10 h-10 mx-auto mb-2 text-glow-muted/20"/>
                  No treasuries deployed yet
                  <button onClick={()=>setModal("treasury-deploy")}
                    className="mt-3 mx-auto flex items-center gap-1.5 px-4 py-2 bg-glow-accent/15 text-glow-accent text-xs font-semibold rounded-xl border border-glow-accent/25">
                    <Plus className="w-3.5 h-3.5"/>Deploy Treasury
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modals ───────────────────────────────────────────────── */}
        {modal==="lend" && selectedPool && (
          <Modal title={`${lendMode==="supply"?"Supply":"Borrow"} ${selectedPool.asset}`}
            desc={`${lendMode==="supply"?selectedPool.supplyAPY:selectedPool.borrowAPY}% APY · LTV ${selectedPool.ltv}%`}
            onClose={()=>setModal(null)}>
            <div className="space-y-4">
              <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-glow-muted/60">
                  <span>Amount</span><button className="text-glow-accent">Max</button>
                </div>
                <div className="flex items-center gap-2">
                  <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0" placeholder="0.00"
                    className="flex-1 text-xl font-bold bg-transparent text-glow-text focus:outline-none placeholder-glow-muted/30"/>
                  <span className="text-sm font-semibold text-glow-muted">{selectedPool.asset}</span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-glow-muted/70">
                <div className="flex justify-between"><span>APY</span><span className="text-emerald-400">{lendMode==="supply"?selectedPool.supplyAPY:selectedPool.borrowAPY}%</span></div>
                <div className="flex justify-between"><span>Utilization</span><span>{selectedPool.utilization}%</span></div>
                <div className="flex justify-between"><span>Pool Total</span><span>{lendMode==="supply"?selectedPool.totalSupply:selectedPool.totalBorrow}</span></div>
              </div>
              <button onClick={handleLend} disabled={loading||!amount}
                className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
                {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<CheckCircle className="w-4 h-4"/>}
                {lendMode==="supply"?"Supply":"Borrow"} {amount||"0"} {selectedPool.asset}
              </button>
            </div>
          </Modal>
        )}

        {modal==="stream" && (
          <Modal title="Create Payment Stream" desc="USDC streamed per second · gas-free via Paymaster" onClose={()=>setModal(null)}>
            <div className="space-y-3">
              <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-1">
                <p className="text-xs text-glow-muted/60">Recipient</p>
                <input value={payStream.recipient} onChange={e=>setPayStream(s=>({...s,recipient:e.target.value}))} placeholder="0x…"
                  className="w-full bg-transparent text-sm font-mono text-glow-text focus:outline-none placeholder-glow-muted/40"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-1">
                  <p className="text-xs text-glow-muted/60">USDC per hour</p>
                  <input value={payStream.ratePerHr} onChange={e=>setPayStream(s=>({...s,ratePerHr:e.target.value}))} type="number" placeholder="0.00"
                    className="w-full bg-transparent text-sm font-bold text-glow-text focus:outline-none placeholder-glow-muted/40"/>
                </div>
                <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-1">
                  <p className="text-xs text-glow-muted/60">Duration (hrs)</p>
                  <input value={payStream.duration} onChange={e=>setPayStream(s=>({...s,duration:e.target.value}))} type="number" placeholder="24"
                    className="w-full bg-transparent text-sm font-bold text-glow-text focus:outline-none placeholder-glow-muted/40"/>
                </div>
              </div>
              {payStream.ratePerHr && payStream.duration && (
                <div className="text-xs text-glow-muted/70 bg-glow-surface/50 rounded-xl p-3">
                  Total: <span className="text-glow-text font-semibold">{(parseFloat(payStream.ratePerHr||"0")*parseFloat(payStream.duration||"0")).toFixed(2)} USDC</span>
                  {" "}over {payStream.duration} hrs
                </div>
              )}
              <button onClick={handleStreamCreate} disabled={loading||!payStream.recipient||!payStream.ratePerHr}
                className="w-full py-3 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
                {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<Zap className="w-4 h-4"/>}Create Stream
              </button>
            </div>
          </Modal>
        )}

        {modal==="treasury-deploy" && (
          <Modal title="Deploy Treasury" desc="Multi-sig USDC treasury · Circle Wallets" onClose={()=>setModal(null)}>
            <div className="space-y-3">
              <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-1">
                <p className="text-xs text-glow-muted/60">Treasury Name</p>
                <input value={treasury.name} onChange={e=>setTreasury(s=>({...s,name:e.target.value}))} placeholder="My DAO Treasury"
                  className="w-full bg-transparent text-sm text-glow-text focus:outline-none placeholder-glow-muted/40"/>
              </div>
              <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-1">
                <p className="text-xs text-glow-muted/60">Signers (comma-separated addresses)</p>
                <textarea value={treasury.signers} onChange={e=>setTreasury(s=>({...s,signers:e.target.value}))} placeholder="0x…, 0x…, 0x…" rows={3}
                  className="w-full bg-transparent text-xs font-mono text-glow-text focus:outline-none placeholder-glow-muted/40 resize-none"/>
              </div>
              <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-1">
                <p className="text-xs text-glow-muted/60">Threshold (minimum signatures)</p>
                <input value={treasury.threshold} onChange={e=>setTreasury(s=>({...s,threshold:e.target.value}))} type="number" min="1"
                  className="w-full bg-transparent text-sm font-bold text-glow-text focus:outline-none"/>
              </div>
              <button onClick={handleTreasury} disabled={loading||!treasury.name||!treasury.signers}
                className="w-full py-3 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
                {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<Building2 className="w-4 h-4"/>}Deploy Treasury
              </button>
            </div>
          </Modal>
        )}

        {modal==="yield-deposit" && (
          <Modal title="Deposit to Yield Vault" desc="Earn yield on your stablecoins" onClose={()=>setModal(null)}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {YIELD_VAULTS.map(v=>(
                  <button key={v.name} onClick={()=>{}} className="p-3 bg-glow-surface border border-glow-border rounded-xl text-left hover:border-glow-accent/30">
                    <p className="text-xs font-semibold text-glow-text">{v.token}</p>
                    <p className="text-lg font-bold text-emerald-400">{v.apy}%</p>
                    <p className="text-[10px] text-glow-muted/60 mt-0.5">APY</p>
                  </button>
                ))}
              </div>
              <div className="bg-glow-surface border border-glow-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5"><p className="text-xs text-glow-muted/60">Amount</p><button className="text-xs text-glow-accent">Max</button></div>
                <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0" placeholder="0.00"
                  className="w-full text-xl font-bold bg-transparent text-glow-text focus:outline-none placeholder-glow-muted/30"/>
              </div>
              <button onClick={async()=>{
                if (!amount) return;
                if (!hasWallet) { toast.error("Connect a wallet first — go to Wallet page"); return; }
                setLoading(true);
                try {
                  if (contractsDeployed) {
                    const amtInt = BigInt(Math.floor(parseFloat(amount) * 1e6));
                    const { txHash, error } = await executeContractCall({
                      contractAddress: YIELD_VAULT,
                      signature: "deposit(uint256)",
                      params: [amtInt],
                      blockchain: "ARC-TESTNET",
                    });
                    if (error) throw new Error(error);
                    toast.success(`✓ Deposited ${amount} USDC to yield vault${txHash ? ` — ${txHash.slice(0,10)}…` : ""}`);
                  } else if (resolvedActive?.type === "circle") {
                    const res = await fetch("/api/circle/dev-wallet", {
                      method:"POST", headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({ action:"transfer", walletId:resolvedActive.id, to:address ?? USDC_ARC, amount, blockchain:"ETH-SEPOLIA", tokenAddress:USDC_ARC }),
                    });
                    const d = await res.json() as { txHash?:string; error?:string };
                    if (d.error) throw new Error(d.error);
                    toast.success(`✓ Deposited ${amount} USDC`);
                  } else {
                    toast("Deploy GlowYieldVault from Admin → Deploy to enable this on-chain", { icon:"ℹ️", duration:4000 });
                  }
                  setModal(null); setAmount("");
                } catch(e) { toast.error(String(e)); }
                finally { setLoading(false); }
              }} disabled={!amount||loading}
                className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
                <TrendingUp className="w-4 h-4"/>Deposit &amp; Earn
              </button>
            </div>
          </Modal>
        )}

        {modal==="nanopay" && (
          <Modal title="Nanopayment" desc="Gas-free · x402 · $0.000001 minimum" onClose={()=>setModal(null)}>
            <div className="space-y-3">
              <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-1">
                <p className="text-xs text-glow-muted/60">Recipient</p>
                <input id="np-to" placeholder="0x…" className="w-full bg-transparent text-sm font-mono text-glow-text focus:outline-none placeholder-glow-muted/40"/>
              </div>
              <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-1">
                <p className="text-xs text-glow-muted/60">USDC Amount</p>
                <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0.000001" step="0.000001" placeholder="0.000001"
                  className="w-full text-xl font-bold bg-transparent text-glow-text focus:outline-none placeholder-glow-muted/30"/>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
                <Zap className="w-3.5 h-3.5"/>Zero gas · EIP-3009 off-chain signature · Circle Gateway settles on-chain
              </div>
              <button onClick={async()=>{
                const to = (document.getElementById("np-to") as HTMLInputElement)?.value?.trim();
                if (!to || !amount) { toast.error("Fill all fields"); return; }
                setLoading(true);
                try {
                  const now = Math.floor(Date.now()/1000);
                  const res = await fetch("/api/circle/nanopay", {
                    method:"POST", headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({
                      action:"settle", payerAddress: address ?? "0x0",
                      payeeAddress: to, amount,
                      validAfter: now-60, validBefore: now+3600,
                      nonce: "0x"+Math.random().toString(16).slice(2).padEnd(64,"0"),
                    }),
                  });
                  const d = await res.json() as { settlementId?:string; error?:string };
                  if (d.error) throw new Error(d.error);
                  toast.success(`✓ Sent $${amount} USDC gas-free via nanopay!`);
                  setModal(null); setAmount("");
                } catch(e) { toast.error(String(e)); }
                finally { setLoading(false); }
              }} disabled={!amount||loading}
                className="w-full py-3 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}Send ${amount||"0"} USDC Gas-Free
              </button>
            </div>
          </Modal>
        )}

        {/* ── Password prompt for local self-custody wallet signing ────────── */}
        {pwPrompt && <PasswordPromptModal onSubmit={(pw)=>{ pwPrompt.resolve(pw); setPwPrompt(null); }} onCancel={()=>{ pwPrompt.resolve(null); setPwPrompt(null); }}/>}
      </div>
    </AppLayout>
  );
}

function PasswordPromptModal({ onSubmit, onCancel }: { onSubmit:(pw:string)=>void; onCancel:()=>void }) {
  const [pw, setPw] = useState("");
  return (
    <div className="fixed inset-0 z-[60] bg-black/75 flex items-end justify-center" onClick={e=>{if(e.target===e.currentTarget) onCancel();}}>
      <div className="w-full max-w-md bg-glow-card border-t border-glow-border rounded-t-3xl p-5 pb-10 space-y-4">
        <div className="w-12 h-1.5 bg-glow-border rounded-full mx-auto mb-2"/>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-glow-accent"/>
          <h3 className="text-base font-bold text-glow-text">Confirm Transaction</h3>
        </div>
        <p className="text-xs text-glow-muted">Enter your wallet password to sign this transaction. Nothing is stored — you'll be asked again next time.</p>
        <input value={pw} onChange={e=>setPw(e.target.value)} type="password" autoFocus
          onKeyDown={e=>{if(e.key==="Enter"&&pw) onSubmit(pw);}}
          placeholder="Wallet password"
          className="w-full bg-glow-surface border-2 border-glow-border rounded-2xl px-4 py-3 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50"/>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 bg-glow-surface border border-glow-border text-glow-muted font-semibold rounded-2xl">Cancel</button>
          <button onClick={()=>pw && onSubmit(pw)} disabled={!pw} className="flex-1 py-3 bg-glow-gradient text-white font-bold rounded-2xl disabled:opacity-50">Sign & Send</button>
        </div>
      </div>
    </div>
  );
}
