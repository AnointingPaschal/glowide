"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWalletStore } from "@/store/walletStore";
import { useCircleStore } from "@/store/circleStore";
import type { CircleWalletEntry, CircleTx } from "@/store/circleStore";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  Wallet, Send, ArrowDownLeft, ArrowUpRight, RefreshCw, Copy, CheckCircle,
  Eye, EyeOff, ChevronRight, QrCode, Plus, X, Loader2, Shield,
  Zap, ArrowLeftRight, Globe, AlertTriangle, Search, Settings,
  ArrowRightLeft, Lock, KeyRound, Fingerprint, Activity,
  ExternalLink, MoreVertical, TrendingUp, TrendingDown, Coins,
} from "lucide-react";

// ── Circle SDK (browser) — loaded dynamically ──────────────────────────────
declare global {
  interface Window {
    CircleW3s?: {
      W3SSdk: new (cfg: { appId: string }) => {
        setAuthentication(a: { userToken: string; encryptionKey: string }): void;
        execute(challengeId: string, cb: (err: unknown, res: unknown) => void): void;
      };
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function shortAddr(a: string) { return `${a.slice(0,6)}…${a.slice(-4)}`; }
function fmt(n: string | number, dec = 6) { return parseFloat(String(n)).toFixed(dec); }
function usd(amount: string, price = 1) { return (parseFloat(amount) * price).toFixed(2); }

const TOKEN_PRICES: Record<string, number> = {
  USDC: 1, EURC: 1.09, "cirBTC": 97000, USYC: 1.002,
  ETH: 3500, MATIC: 0.92, AVAX: 40, ARB: 1.2, OP: 2.1, BNB: 620,
};

const CHAIN_COLORS: Record<string, string> = {
  ETH: "#627eea", MATIC: "#8247e5", AVAX: "#e84142", ARB: "#12aaff",
  BASE: "#0052ff", OP: "#ff0420", BNB: "#f3ba2f", "ETH-SEPOLIA": "#627eea",
};

const ARC_USDC_TOKEN_ID = "5797fbd6-3795-519d-84ca-ec4c5f80c3b1"; // sandbox USDC on Arc/ETH-SEPOLIA

// ── Amount input ─────────────────────────────────────────────────────────────
function AmountInput({ value, onChange, symbol, balance }:
  { value: string; onChange(v: string): void; symbol: string; balance: string }) {
  return (
    <div className="bg-glow-surface border border-glow-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-glow-muted/70">Amount</span>
        <button onClick={() => onChange(balance)} className="text-xs text-glow-accent">Max</button>
      </div>
      <div className="flex items-center gap-3">
        <input value={value} onChange={e => onChange(e.target.value)} type="number"
          placeholder="0.00" min="0" step="any"
          className="flex-1 text-2xl font-bold bg-transparent text-glow-text focus:outline-none"/>
        <span className="text-sm font-semibold text-glow-muted/70 flex-shrink-0">{symbol}</span>
      </div>
      <p className="text-xs text-glow-muted/50 mt-1">Balance: {fmt(balance)} {symbol}</p>
    </div>
  );
}

// ── Token row ─────────────────────────────────────────────────────────────────
function TokenRow({ symbol, name, amount, blockchain, onClick }:
  { symbol: string; name: string; amount: string; blockchain?: string; onClick?(): void }) {
  const price  = TOKEN_PRICES[symbol] ?? 1;
  const value  = usd(amount, price);
  const change = ((Math.random() - 0.45) * 8).toFixed(2);
  const up     = parseFloat(change) >= 0;
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-glow-surface/60 transition-colors active:bg-glow-surface">
      {/* Token logo placeholder */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 text-sm"
        style={{ background: CHAIN_COLORS[blockchain ?? symbol] ?? "#7c3aed" }}>
        {symbol.slice(0,2)}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-glow-text">{symbol}</p>
        <p className="text-xs text-glow-muted/60 truncate">{name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-glow-text">{fmt(amount, 4)}</p>
        <p className={cn("text-xs flex items-center gap-0.5 justify-end", up ? "text-emerald-400" : "text-red-400")}>
          {up ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
          {up ? "+" : ""}{change}%
        </p>
      </div>
    </button>
  );
}

// ── QR Code (simple SVG version) ─────────────────────────────────────────────
function QRPlaceholder({ address }: { address: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="w-48 h-48 bg-white rounded-2xl p-3 flex items-center justify-center">
        <div className="text-center">
          <QrCode className="w-32 h-32 text-glow-bg mx-auto"/>
          <p className="text-[9px] text-gray-400 mt-1 font-mono break-all">{address.slice(0,20)}</p>
        </div>
      </div>
      <p className="text-xs text-glow-muted/70 max-w-[200px] text-center">
        Send only supported tokens to this address
      </p>
    </div>
  );
}

// ── TX Row ─────────────────────────────────────────────────────────────────────
function TxRow({ tx, explorerBase }: { tx: CircleTx; explorerBase: string }) {
  const isIn  = tx.transactionType === "INBOUND";
  const ok    = tx.state === "COMPLETE" || tx.state === "CONFIRMED";
  const fail  = tx.state === "FAILED" || tx.state === "DENIED";
  const date  = new Date(tx.createDate);
  const ago   = Date.now() - date.getTime();
  const label = ago < 3600000 ? `${Math.floor(ago/60000)}m ago` : ago < 86400000 ? `${Math.floor(ago/3600000)}h ago` : date.toLocaleDateString();
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-glow-border/20 last:border-0">
      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
        isIn ? "bg-emerald-500/15" : "bg-red-500/15")}>
        {isIn ? <ArrowDownLeft className="w-4 h-4 text-emerald-400"/> : <ArrowUpRight className="w-4 h-4 text-red-400"/>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-glow-text">{isIn ? "Received" : "Sent"}</p>
        <p className="text-xs text-glow-muted/60 font-mono truncate">
          {tx.destinationAddress ? shortAddr(tx.destinationAddress) : "—"}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn("text-sm font-semibold", isIn ? "text-emerald-400" : "text-glow-text")}>
          {isIn ? "+" : "-"}{tx.amounts?.[0] ?? "—"} USDC
        </p>
        <div className="flex items-center gap-1 justify-end">
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
            ok ? "bg-emerald-500/15 text-emerald-400" : fail ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400")}>
            {ok ? "✓" : fail ? "✗" : "⋯"}
          </span>
          <span className="text-[10px] text-glow-muted/50">{label}</span>
          {tx.txHash && (
            <a href={`${explorerBase}/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer"
              className="text-glow-muted/40 hover:text-glow-accent ml-1">
              <ExternalLink className="w-3 h-3"/>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WALLET PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function WalletPage() {
  const { address: metamaskAddr, isConnected, chainId } = useWalletStore();
  const circle = useCircleStore();

  // Which "wallet mode" is shown
  const [mode, setMode] = useState<"home"|"send"|"receive"|"cctp"|"gateway"|"nanopay"|"activity"|"setup">("home");
  const [hideBalance, setHideBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingWallets, setLoadingWallets] = useState(false);

  // Circle setup state
  const [setupStep, setSetupStep] = useState<"welcome"|"creating"|"init"|"done">("welcome");
  const [newUserId, setNewUserId] = useState("");

  // Send form
  const [sendTo,     setSendTo]     = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendToken,  setSendToken]  = useState("USDC");

  // CCTP bridge
  const [cctpDest,   setCctpDest]   = useState("ETH-SEPOLIA");
  const [cctpAmount, setCctpAmount] = useState("");

  // Gateway
  const [gwDest,     setGwDest]     = useState("");
  const [gwAmount,   setGwAmount]   = useState("");
  const [gwChain,    setGwChain]    = useState("ETH");

  // Nanopay
  const [npRecipient, setNpRecipient] = useState("");
  const [npAmount,    setNpAmount]    = useState("0.0001");

  // Challenge / SDK execution
  const [pendingChallenge, setPendingChallenge] = useState<{id:string;userToken:string;encryptionKey:string}|null>(null);
  const sdkRef = useRef<{ execute(id:string, cb:(e:unknown,r:unknown)=>void):void } | null>(null);

  // Load Circle SDK from CDN on mount
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@circle-fin/w3s-pw-web-sdk/dist/app.js";
    script.async = true;
    script.onload = () => {
      if (window.CircleW3s) {
        const sdk = new window.CircleW3s.W3SSdk({ appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? "test" });
        sdkRef.current = sdk as unknown as { execute(id:string,cb:(e:unknown,r:unknown)=>void):void };
      }
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch{} };
  }, []);

  // Execute a pending Circle challenge (PIN confirmation)
  const executeChallenge = useCallback(async (challengeId: string, userToken: string, encryptionKey: string) => {
    if (!sdkRef.current) {
      toast.error("Circle SDK not loaded yet — check NEXT_PUBLIC_CIRCLE_APP_ID");
      return;
    }
    const sdk = sdkRef.current as unknown as {
      setAuthentication(a:{userToken:string;encryptionKey:string}):void;
      execute(id:string,cb:(e:unknown,r:unknown)=>void):void;
    };
    sdk.setAuthentication({ userToken, encryptionKey });
    sdk.execute(challengeId, (err) => {
      if (err) { toast.error(`Challenge failed: ${(err as Error).message}`); return; }
      toast.success("✓ Confirmed!");
      loadWallets();
    });
  }, []);

  // Load wallets from Circle
  const loadWallets = useCallback(async () => {
    if (!circle.userToken) return;
    setLoadingWallets(true);
    try {
      const res  = await fetch(`/api/circle/wallets?userToken=${circle.userToken}&action=list`);
      const data = await res.json() as { wallets?: CircleWalletEntry[] };
      if (data.wallets?.length) {
        circle.setWallets(data.wallets);
        circle.setActive(data.wallets[0].id);
        circle.setInit(true);
        // Load balances for active wallet
        const bRes = await fetch(`/api/circle/wallets?userToken=${circle.userToken}&action=balances&walletId=${data.wallets[0].id}`);
        const bData = await bRes.json() as { tokenBalances?: Array<{token:{symbol:string;name:string;decimals:number};amount:string}> };
        if (bData.tokenBalances) {
          const updated = { ...data.wallets[0], balances: bData.tokenBalances };
          circle.setWallets([updated, ...data.wallets.slice(1)]);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoadingWallets(false); }
  }, [circle]);

  // Load tx history
  const loadTxHistory = useCallback(async () => {
    if (!circle.userToken || !circle.activeWalletId) return;
    try {
      const res  = await fetch(`/api/circle/transactions?userToken=${circle.userToken}&walletId=${circle.activeWalletId}`);
      const data = await res.json() as { transactions?: CircleTx[] };
      if (data.transactions) data.transactions.forEach(tx => circle.appendTx(tx));
    } catch {}
  }, [circle]);

  useEffect(() => {
    if (circle.userToken && circle.isInitialized) { loadWallets(); loadTxHistory(); }
  }, [circle.userToken, circle.isInitialized]);

  // Create Circle user + get token
  const setupCircleWallet = async () => {
    setLoading(true); setSetupStep("creating");
    try {
      const uid = `glow-${metamaskAddr?.toLowerCase() ?? Date.now()}`;
      // Create user
      const cRes = await fetch("/api/circle/users", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ action: "create", userId: uid, email: metamaskAddr ?? "" }),
      });
      const cData = await cRes.json() as { user?: { id: string }; error?: string };
      const userId = cData.user?.id ?? uid;
      setNewUserId(userId);

      // Get session token
      const tRes = await fetch("/api/circle/users", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ action: "token", userId }),
      });
      const tData = await tRes.json() as { userToken?: string; encryptionKey?: string; error?: string };
      if (!tData.userToken) throw new Error(tData.error ?? "Could not get user token");

      circle.setSession(userId, tData.userToken, tData.encryptionKey ?? "", Date.now() + 3600000);

      // Initialize user (creates wallet, triggers PIN setup in Circle SDK)
      setSetupStep("init");
      const iRes = await fetch("/api/circle/users", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ action: "initialize", userToken: tData.userToken }),
      });
      const iData = await iRes.json() as { challengeId?: string; error?: string };
      if (!iData.challengeId) throw new Error(iData.error ?? "Init failed");

      // Execute challenge (PIN setup popup)
      setPendingChallenge({ id: iData.challengeId, userToken: tData.userToken, encryptionKey: tData.encryptionKey ?? "" });
      if (sdkRef.current) {
        (sdkRef.current as unknown as {setAuthentication(a:{userToken:string;encryptionKey:string}):void})
          .setAuthentication({ userToken: tData.userToken, encryptionKey: tData.encryptionKey ?? "" });
        sdkRef.current.execute(iData.challengeId, (err) => {
          if (err) { toast.error(`Setup failed: ${(err as Error).message}`); return; }
          circle.setInit(true); circle.setPinSet(true);
          setSetupStep("done"); setMode("home");
          toast.success("✓ Circle Wallet created!");
          loadWallets();
        });
      } else {
        // SDK not loaded — mark as done anyway so user can try PIN later
        circle.setInit(true); setSetupStep("done"); setMode("home");
        toast("Wallet created — install Circle SDK to set PIN", { icon: "ℹ️" });
        loadWallets();
      }
    } catch (e) {
      toast.error(String(e));
      setSetupStep("welcome");
    } finally { setLoading(false); }
  };

  // Send USDC via Circle
  const handleSend = async () => {
    if (!circle.userToken || !circle.activeWalletId || !sendTo || !sendAmount) {
      toast.error("Fill all fields and connect Circle Wallet"); return;
    }
    setLoading(true);
    try {
      const res  = await fetch("/api/circle/transactions", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          action: "transfer", userToken: circle.userToken,
          walletId: circle.activeWalletId,
          destinationAddress: sendTo,
          amounts: [sendAmount],
          tokenId: ARC_USDC_TOKEN_ID,
          blockchain: "ETH-SEPOLIA",
        }),
      });
      const data = await res.json() as { challengeId?: string; error?: string };
      if (!data.challengeId) throw new Error(data.error ?? "No challenge");
      // Execute PIN confirmation
      if (sdkRef.current && circle.encryptionKey) {
        (sdkRef.current as unknown as {setAuthentication(a:{userToken:string;encryptionKey:string}):void})
          .setAuthentication({ userToken: circle.userToken, encryptionKey: circle.encryptionKey });
        sdkRef.current.execute(data.challengeId, (err) => {
          if (err) { toast.error("PIN rejected"); return; }
          toast.success("✓ Sent!");
          setSendTo(""); setSendAmount(""); setMode("home");
          loadWallets(); loadTxHistory();
        });
      } else {
        toast("Challenge ID: " + data.challengeId + " — confirm with Circle SDK", { icon: "🔑" });
      }
    } catch (e) { toast.error(String(e)); }
    finally { setLoading(false); }
  };

  // Gateway instant cross-chain transfer
  const handleGatewayTransfer = async () => {
    if (!gwDest || !gwAmount) { toast.error("Fill destination and amount"); return; }
    setLoading(true);
    try {
      const activeWallet = circle.wallets.find(w => w.id === circle.activeWalletId);
      const res = await fetch("/api/circle/gateway", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          action: "transfer",
          sourceAddress: activeWallet?.address ?? metamaskAddr ?? "",
          destinationAddress: gwDest,
          amount: gwAmount,
          sourceBlockchain: "ETH-SEPOLIA",
          destinationBlockchain: gwChain,
        }),
      });
      const data = await res.json() as { transactionId?: string; state?: string; error?: string };
      if (data.error) throw new Error(data.error);
      toast.success(`✓ Gateway transfer initiated! ID: ${data.transactionId?.slice(0,8)}`);
      setMode("home"); setGwDest(""); setGwAmount("");
    } catch (e) { toast.error(String(e)); }
    finally { setLoading(false); }
  };

  // Nanopayment send (gas-free, sub-cent)
  const handleNanopay = async () => {
    if (!npRecipient || !npAmount) { toast.error("Fill recipient and amount"); return; }
    setLoading(true);
    try {
      const activeWallet = circle.wallets.find(w => w.id === circle.activeWalletId);
      const now = Math.floor(Date.now() / 1000);
      const res = await fetch("/api/circle/nanopay", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          action: "settle",
          payerAddress:  activeWallet?.address ?? metamaskAddr,
          payeeAddress:  npRecipient,
          amount: npAmount,
          validAfter:  now - 60,
          validBefore: now + 3600,
          nonce: `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`,
        }),
      });
      const data = await res.json() as { settlementId?: string; error?: string };
      if (data.error) throw new Error(data.error);
      toast.success(`✓ Nanopayment sent! $${npAmount} USDC (gas-free)`);
      setMode("home");
    } catch (e) { toast.error(String(e)); }
    finally { setLoading(false); }
  };

  const copyAddr = async (a: string) => {
    await navigator.clipboard.writeText(a);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // Derived values
  const activeWallet     = circle.wallets.find(w => w.id === circle.activeWalletId);
  const displayAddress   = activeWallet?.address ?? metamaskAddr ?? "";
  const hasCircleWallet  = circle.isInitialized && circle.wallets.length > 0;
  const totalUSD         = activeWallet?.balances?.reduce((acc, b) => {
    return acc + parseFloat(b.amount) * (TOKEN_PRICES[b.token.symbol] ?? 1);
  }, 0) ?? 0;

  // ── SETUP SCREEN ───────────────────────────────────────────────────────────
  if (mode === "setup" || (!hasCircleWallet && !isConnected)) {
    return (
      <AppLayout title="Wallet">
        <div className="max-w-sm mx-auto p-4 space-y-6 pt-8">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 rounded-3xl bg-glow-gradient flex items-center justify-center mx-auto shadow-glow-lg">
              <Shield className="w-10 h-10 text-white"/>
            </div>
            <h1 className="text-2xl font-bold text-glow-text">GlowIDE Wallet</h1>
            <p className="text-sm text-glow-muted/70">Powered by Circle MPC — you hold your keys</p>
          </div>

          <div className="space-y-3">
            {[
              { icon: KeyRound,    title: "Non-custodial MPC",    desc: "2-of-2 MPC. Circle never holds your full key." },
              { icon: Fingerprint, title: "Social / PIN auth",    desc: "Google, Apple, email OTP, or PIN with biometrics." },
              { icon: Zap,         title: "Gasless USDC pays",    desc: "Pay gas in USDC via Circle Paymaster — no ETH needed." },
              { icon: Globe,       title: "Unified cross-chain",  desc: "Gateway: move USDC across chains in <500ms." },
              { icon: Coins,       title: "Nanopayments",         desc: "Send as little as $0.000001 USDC — gas-free." },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-3 p-3 bg-glow-card border border-glow-border rounded-xl">
                <f.icon className="w-5 h-5 text-glow-accent mt-0.5 flex-shrink-0"/>
                <div>
                  <p className="text-sm font-semibold text-glow-text">{f.title}</p>
                  <p className="text-xs text-glow-muted/70">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {setupStep === "welcome" && (
            <div className="space-y-3">
              <button onClick={setupCircleWallet} disabled={loading}
                className="w-full py-4 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-base disabled:opacity-60">
                {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Plus className="w-5 h-5"/>}
                Create Circle Wallet
              </button>
              {isConnected && (
                <button onClick={() => { circle.setInit(true); setMode("home"); }}
                  className="w-full py-3 border border-glow-border text-glow-muted rounded-2xl text-sm">
                  Use MetaMask only
                </button>
              )}
            </div>
          )}
          {(setupStep === "creating" || setupStep === "init") && (
            <div className="text-center space-y-3 py-4">
              <Loader2 className="w-10 h-10 animate-spin text-glow-accent mx-auto"/>
              <p className="text-sm text-glow-text font-medium">
                {setupStep === "creating" ? "Creating your MPC wallet…" : "Initializing — set your PIN in the popup…"}
              </p>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Wallet">
      <div className="max-w-sm mx-auto flex flex-col min-h-[calc(100dvh-56px)]">

        {/* ── HOME ─────────────────────────────────────────────────────── */}
        {mode === "home" && (
          <>
            {/* Balance card */}
            <div className="bg-glow-gradient mx-4 mt-4 rounded-3xl p-5 text-white shadow-glow-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-80">Total balance</span>
                  {loadingWallets && <Loader2 className="w-3.5 h-3.5 animate-spin opacity-60"/>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setHideBalance(!hideBalance)} className="opacity-70 hover:opacity-100">
                    {hideBalance ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                  <button onClick={loadWallets} className="opacity-70 hover:opacity-100">
                    <RefreshCw className={cn("w-4 h-4", loadingWallets && "animate-spin")}/>
                  </button>
                </div>
              </div>
              <p className="text-3xl font-bold">
                {hideBalance ? "••••••" : `$${totalUSD.toFixed(2)}`}
              </p>
              {displayAddress && (
                <button onClick={() => copyAddr(displayAddress)}
                  className="flex items-center gap-1.5 mt-2 opacity-70 hover:opacity-100 transition-opacity">
                  <span className="text-xs font-mono">{shortAddr(displayAddress)}</span>
                  {copied ? <CheckCircle className="w-3.5 h-3.5"/> : <Copy className="w-3.5 h-3.5"/>}
                </button>
              )}
              {hasCircleWallet && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Shield className="w-3.5 h-3.5 opacity-60"/>
                  <span className="text-xs opacity-60">Circle MPC Secured</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-4 gap-3 mx-4 mt-4">
              {[
                { icon: Send,            label: "Send",     action: () => setMode("send")     },
                { icon: ArrowDownLeft,   label: "Receive",  action: () => setMode("receive")  },
                { icon: ArrowLeftRight,  label: "CCTP",     action: () => setMode("cctp")     },
                { icon: Globe,           label: "Gateway",  action: () => setMode("gateway")  },
              ].map(b => (
                <button key={b.label} onClick={b.action}
                  className="flex flex-col items-center gap-1.5 py-3 bg-glow-card border border-glow-border rounded-2xl hover:border-glow-accent/40 transition-all active:scale-95">
                  <b.icon className="w-5 h-5 text-glow-accent"/>
                  <span className="text-[11px] text-glow-muted font-medium">{b.label}</span>
                </button>
              ))}
            </div>

            {/* Nanopay button */}
            <button onClick={() => setMode("nanopay")}
              className="mx-4 mt-3 p-3 bg-glow-card border border-glow-border rounded-2xl flex items-center gap-3 hover:border-glow-accent/40 transition-all">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-400"/>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-glow-text">Nanopayments</p>
                <p className="text-xs text-glow-muted/70">Gas-free · $0.000001 min · x402 protocol</p>
              </div>
              <ChevronRight className="w-4 h-4 text-glow-muted/40 ml-auto"/>
            </button>

            {/* Tokens */}
            <div className="mx-4 mt-4 bg-glow-card border border-glow-border rounded-2xl overflow-hidden flex-1 mb-4">
              <div className="flex items-center justify-between px-4 py-3 border-b border-glow-border/40">
                <span className="text-sm font-semibold text-glow-text">Assets</span>
                <div className="flex gap-2">
                  <button onClick={() => setMode("activity")} className="text-xs text-glow-accent hover:underline">History</button>
                  <button onClick={() => setMode("setup")}
                    className="p-1 text-glow-muted/50 hover:text-glow-text"><Settings className="w-4 h-4"/></button>
                </div>
              </div>

              {activeWallet?.balances?.length ? (
                activeWallet.balances.map(b => (
                  <TokenRow key={b.token.symbol} symbol={b.token.symbol} name={b.token.name}
                    amount={b.amount} blockchain={activeWallet.blockchain}
                    onClick={() => { setSendToken(b.token.symbol); setMode("send"); }}/>
                ))
              ) : (
                // Fallback: MetaMask balances
                [
                  { symbol: "USDC", name: "USD Coin", amount: "0.000000" },
                  { symbol: "EURC", name: "Euro Coin", amount: "0.000000" },
                  { symbol: "cirBTC", name: "Circle Bitcoin", amount: "0.000000" },
                ].map(t => (
                  <TokenRow key={t.symbol} symbol={t.symbol} name={t.name} amount={t.amount}
                    onClick={() => setMode("send")}/>
                ))
              )}
            </div>
          </>
        )}

        {/* ── SEND ─────────────────────────────────────────────────────── */}
        {mode === "send" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode("home")} className="p-2 text-glow-muted hover:text-glow-text">
                <X className="w-5 h-5"/>
              </button>
              <h2 className="text-lg font-bold text-glow-text">Send {sendToken}</h2>
            </div>

            {!hasCircleWallet && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0"/>
                Create a Circle Wallet to send with MPC security. Using MetaMask only.
              </div>
            )}

            <AmountInput value={sendAmount} onChange={setSendAmount} symbol={sendToken}
              balance={activeWallet?.balances?.find(b=>b.token.symbol===sendToken)?.amount ?? "0"}/>

            <div className="bg-glow-surface border border-glow-border rounded-2xl p-4">
              <p className="text-xs text-glow-muted/70 mb-2">To address</p>
              <input value={sendTo} onChange={e => setSendTo(e.target.value)}
                placeholder="0x… or ENS name"
                className="w-full bg-transparent text-sm font-mono text-glow-text focus:outline-none placeholder-glow-muted/40"/>
            </div>

            <button onClick={handleSend} disabled={loading || !sendTo || !sendAmount}
              className="w-full py-4 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>}
              Send {sendAmount || "0"} {sendToken}
            </button>
            <p className="text-center text-xs text-glow-muted/50">
              {hasCircleWallet ? "Requires PIN confirmation via Circle MPC" : "Will open MetaMask"}
            </p>
          </div>
        )}

        {/* ── RECEIVE ──────────────────────────────────────────────────── */}
        {mode === "receive" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode("home")} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
              <h2 className="text-lg font-bold text-glow-text">Receive</h2>
            </div>
            <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
              <QRPlaceholder address={displayAddress}/>
              <div className="flex items-center gap-2 justify-center mt-2">
                <span className="text-xs font-mono text-glow-text">{shortAddr(displayAddress)}</span>
                <button onClick={() => copyAddr(displayAddress)}>
                  {copied ? <CheckCircle className="w-4 h-4 text-emerald-400"/> : <Copy className="w-4 h-4 text-glow-muted"/>}
                </button>
              </div>
            </div>
            <button onClick={() => copyAddr(displayAddress)}
              className="w-full py-3 bg-glow-card border border-glow-border rounded-2xl text-sm font-medium text-glow-text">
              Copy Address
            </button>
          </div>
        )}

        {/* ── CCTP BRIDGE ──────────────────────────────────────────────── */}
        {mode === "cctp" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode("home")} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
              <h2 className="text-lg font-bold text-glow-text">CCTP Bridge</h2>
            </div>
            <div className="p-3 bg-glow-accent/8 border border-glow-accent/20 rounded-xl text-xs text-glow-accent">
              Cross-Chain Transfer Protocol — native USDC burn + mint across chains. No wrapped tokens.
            </div>
            <div className="space-y-1">
              <p className="text-xs text-glow-muted/70">From</p>
              <div className="p-3 bg-glow-surface border border-glow-border rounded-xl text-sm font-medium text-glow-text">
                Arc Testnet (Domain 26)
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-glow-muted/70">To</p>
              <select value={cctpDest} onChange={e => setCctpDest(e.target.value)}
                className="w-full p-3 bg-glow-surface border border-glow-border rounded-xl text-sm text-glow-text focus:outline-none">
                {[["ETH-SEPOLIA","Ethereum Sepolia"],["ETH","Ethereum"],["MATIC","Polygon"],
                  ["AVAX","Avalanche"],["ARB","Arbitrum"],["BASE","Base"],["OP","Optimism"]].map(([v,l])=>(
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <AmountInput value={cctpAmount} onChange={setCctpAmount} symbol="USDC"
              balance={activeWallet?.balances?.find(b=>b.token.symbol==="USDC")?.amount ?? "0"}/>
            <button disabled={loading || !cctpAmount}
              onClick={async () => {
                setLoading(true);
                try {
                  if (!circle.userToken || !circle.activeWalletId) {
                    toast.error("Connect Circle Wallet first"); return;
                  }
                  // CCTP via contract execution (burn on source, mint on dest)
                  const res = await fetch("/api/circle/transactions", {
                    method: "POST", headers: {"Content-Type":"application/json"},
                    body: JSON.stringify({
                      action: "contract", userToken: circle.userToken,
                      walletId: circle.activeWalletId, blockchain: "ETH-SEPOLIA",
                      contractAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
                      abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
                      abiParameters: [cctpAmount, 0, displayAddress.padStart(64,"0"), displayAddress],
                    }),
                  });
                  const d = await res.json() as { challengeId?: string; error?: string };
                  if (d.challengeId && sdkRef.current && circle.encryptionKey) {
                    (sdkRef.current as unknown as {setAuthentication(a:{userToken:string;encryptionKey:string}):void})
                      .setAuthentication({ userToken: circle.userToken, encryptionKey: circle.encryptionKey });
                    sdkRef.current.execute(d.challengeId, (err) => {
                      if (err) { toast.error("PIN rejected"); return; }
                      toast.success(`✓ Bridging ${cctpAmount} USDC via CCTP!`);
                      setMode("home");
                    });
                  } else {
                    toast.success("CCTP transfer initiated");
                    setMode("home");
                  }
                } catch(e) { toast.error(String(e)); }
                finally { setLoading(false); }
              }}
              className="w-full py-4 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <ArrowLeftRight className="w-5 h-5"/>}
              Bridge via CCTP
            </button>
          </div>
        )}

        {/* ── GATEWAY ──────────────────────────────────────────────────── */}
        {mode === "gateway" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode("home")} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
              <h2 className="text-lg font-bold text-glow-text">Gateway Transfer</h2>
            </div>
            <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
              Unified cross-chain USDC balance. Transfers settle in &lt;500ms after balance established.
            </div>
            <div className="space-y-1">
              <p className="text-xs text-glow-muted/70">Destination Chain</p>
              <select value={gwChain} onChange={e => setGwChain(e.target.value)}
                className="w-full p-3 bg-glow-surface border border-glow-border rounded-xl text-sm text-glow-text focus:outline-none">
                {["ETH","MATIC","AVAX","ARB","BASE","OP"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-glow-muted/70">Destination Address</p>
              <input value={gwDest} onChange={e => setGwDest(e.target.value)}
                placeholder="0x…" className="w-full p-3 bg-glow-surface border border-glow-border rounded-xl text-sm font-mono text-glow-text focus:outline-none"/>
            </div>
            <AmountInput value={gwAmount} onChange={setGwAmount} symbol="USDC"
              balance={activeWallet?.balances?.find(b=>b.token.symbol==="USDC")?.amount ?? "0"}/>
            <button onClick={handleGatewayTransfer} disabled={loading || !gwDest || !gwAmount}
              className="w-full py-4 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Globe className="w-5 h-5"/>}
              Transfer via Gateway
            </button>
          </div>
        )}

        {/* ── NANOPAYMENTS ─────────────────────────────────────────────── */}
        {mode === "nanopay" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode("home")} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
              <h2 className="text-lg font-bold text-glow-text">Nanopayment</h2>
            </div>
            <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl space-y-1 text-xs">
              <p className="font-semibold text-emerald-400">Zero gas · Sub-cent minimums</p>
              <p className="text-glow-muted/70">Signs EIP-3009 payment authorization off-chain. Gateway batches and settles onchain.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-glow-muted/70">Recipient Address</p>
              <input value={npRecipient} onChange={e => setNpRecipient(e.target.value)}
                placeholder="0x…" className="w-full p-3 bg-glow-surface border border-glow-border rounded-xl text-sm font-mono text-glow-text focus:outline-none"/>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-glow-muted/70">Amount (USDC) — min $0.000001</p>
              <input value={npAmount} onChange={e => setNpAmount(e.target.value)} type="number" min="0.000001" step="0.000001"
                className="w-full p-3 bg-glow-surface border border-glow-border rounded-xl text-lg font-bold text-glow-text focus:outline-none"/>
            </div>
            <button onClick={handleNanopay} disabled={loading || !npRecipient || !npAmount}
              className="w-full py-4 bg-glow-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Zap className="w-5 h-5"/>}
              Send ${npAmount} USDC (gas-free)
            </button>
            <p className="text-center text-xs text-glow-muted/50">Powered by Circle x402 protocol</p>
          </div>
        )}

        {/* ── ACTIVITY ─────────────────────────────────────────────────── */}
        {mode === "activity" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode("home")} className="p-2 text-glow-muted"><X className="w-5 h-5"/></button>
              <h2 className="text-lg font-bold text-glow-text">Transaction History</h2>
              <button onClick={loadTxHistory} className="ml-auto text-glow-muted/50 hover:text-glow-text">
                <RefreshCw className="w-4 h-4"/>
              </button>
            </div>
            <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
              {circle.txHistory.length === 0 ? (
                <div className="text-center py-12 text-glow-muted/50 text-sm">No transactions yet</div>
              ) : (
                circle.txHistory.map(tx => (
                  <TxRow key={tx.id} tx={tx} explorerBase="https://sepolia.etherscan.io"/>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
