"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, Loader2, Wifi, Search, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EthereumProvider } from "@/types/ethereum";

interface EIP6963ProviderInfo { uuid: string; name: string; icon: string; rdns: string; }
interface EIP6963ProviderDetail { info: EIP6963ProviderInfo; provider: EthereumProvider; }

interface WalletDef {
  id: string; name: string; rdns: string; installUrl: string;
  mobileLink: ((u: string) => string) | null;
  detect: (p: EthereumProvider) => boolean;
  bg: string; textColor: string; initial: string; icon: string | null;
}

const WALLETS: WalletDef[] = [
  { id:"walletconnect", name:"WalletConnect",  rdns:"",                        installUrl:"https://walletconnect.com/explorer",                   mobileLink:null,                                                                                         detect:()=>false,                                                                    bg:"bg-[#3B99FC]",   textColor:"text-white", initial:"W", icon:null },
  { id:"metamask",     name:"MetaMask",        rdns:"io.metamask",             installUrl:"https://metamask.io/download/",                        mobileLink:(u)=>`https://metamask.app.link/dapp/${u}`,                                                  detect:(p)=>!!(p.isMetaMask&&!p.isBraveWallet&&!p.isCoinbaseWallet),                bg:"bg-[#F6851B]",   textColor:"text-white", initial:"M", icon:"https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" },
  { id:"coinbase",     name:"Coinbase Wallet", rdns:"com.coinbase.wallet",     installUrl:"https://www.coinbase.com/wallet/downloads",            mobileLink:(u)=>`https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u)}`,                            detect:(p)=>!!(p.isCoinbaseWallet),                                                  bg:"bg-[#0052FF]",   textColor:"text-white", initial:"C", icon:null },
  { id:"okx",          name:"OKX Wallet",      rdns:"com.okex.wallet",         installUrl:"https://www.okx.com/web3/wallet",                      mobileLink:(u)=>`okx://wallet/dapp/details?dappUrl=${encodeURIComponent(u)}`,                          detect:(p)=>!!(p as EthereumProvider&{isOKExWallet?:boolean}).isOKExWallet,          bg:"bg-[#000000]",   textColor:"text-white", initial:"O", icon:null },
  { id:"trust",        name:"Trust Wallet",    rdns:"com.trustwallet.app",     installUrl:"https://trustwallet.com/download",                     mobileLink:(u)=>`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(u)}`,        detect:(p)=>!!(p.isTrust),                                                           bg:"bg-[#3375BB]",   textColor:"text-white", initial:"T", icon:null },
  { id:"rainbow",      name:"Rainbow",         rdns:"me.rainbow",              installUrl:"https://rainbow.me/download",                          mobileLink:(u)=>`https://rnbwapp.com/dapp?url=${encodeURIComponent(u)}`,                                detect:(p)=>!!(p.isRainbow),                                                         bg:"bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500", textColor:"text-white", initial:"R", icon:null },
  { id:"phantom",      name:"Phantom",         rdns:"app.phantom",             installUrl:"https://phantom.app/download",                         mobileLink:null,                                                                                         detect:(p)=>!!(p.isPhantom),                                                         bg:"bg-[#AB9FF2]",   textColor:"text-white", initial:"P", icon:null },
  { id:"brave",        name:"Brave Wallet",    rdns:"com.brave.wallet",        installUrl:"https://brave.com/download/",                          mobileLink:null,                                                                                         detect:(p)=>!!(p.isBraveWallet),                                                     bg:"bg-[#FF2D00]",   textColor:"text-white", initial:"B", icon:null },
  { id:"bybit",        name:"Bybit Wallet",    rdns:"com.bybit",               installUrl:"https://www.bybit.com/en/web3/home",                   mobileLink:null,                                                                                         detect:()=>false,                                                                    bg:"bg-[#F7A600]",   textColor:"text-black", initial:"B", icon:null },
  { id:"zerion",       name:"Zerion",          rdns:"io.zerion.wallet",        installUrl:"https://zerion.io/download",                           mobileLink:(u)=>`https://app.zerion.io/?url=${encodeURIComponent(u)}`,                                  detect:()=>false,                                                                    bg:"bg-[#2962EF]",   textColor:"text-white", initial:"Z", icon:null },
  { id:"imtoken",      name:"imToken",         rdns:"im.token.imTokenEVM",     installUrl:"https://token.im/download",                           mobileLink:(u)=>`imtokenv2://navigate/DappView?url=${encodeURIComponent(u)}`,                            detect:()=>false,                                                                    bg:"bg-[#11C4D1]",   textColor:"text-white", initial:"i", icon:null },
  { id:"safepal",      name:"SafePal",         rdns:"io.safepal.wallet",       installUrl:"https://www.safepal.com/download",                     mobileLink:null,                                                                                         detect:()=>false,                                                                    bg:"bg-[#4A3FBD]",   textColor:"text-white", initial:"S", icon:null },
  { id:"tokenpocket",  name:"TokenPocket",     rdns:"pro.tokenpocket",         installUrl:"https://www.tokenpocket.pro/en/download/app",          mobileLink:null,                                                                                         detect:()=>false,                                                                    bg:"bg-[#2980FE]",   textColor:"text-white", initial:"T", icon:null },
];

interface DetectedWallet { id:string; name:string; icon:string; provider:EthereumProvider; rdns?:string; }

export interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (provider: EthereumProvider) => Promise<void>;
}

export function WalletModal({ isOpen, onClose, onConnect }: WalletModalProps) {
  const [detected, setDetected]   = useState<DetectedWallet[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [mounted, setMounted]     = useState(false);

  // Portal needs document — only available client-side
  useEffect(() => { setMounted(true); }, []);

  // EIP-6963 discovery
  useEffect(() => {
    if (!isOpen) return;
    setSearch(""); setError(null);
    const wallets: DetectedWallet[] = [];
    const seen = new Set<string>();

    const onAnnounce = (e: Event) => {
      const { detail } = e as CustomEvent<EIP6963ProviderDetail>;
      if (seen.has(detail.info.uuid)) return;
      seen.add(detail.info.uuid);
      wallets.push({ id: detail.info.uuid, name: detail.info.name, icon: detail.info.icon, provider: detail.provider, rdns: detail.info.rdns });
      setDetected([...wallets]);
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    setTimeout(() => {
      if (wallets.length === 0 && window.ethereum) {
        const list = window.ethereum.providers ?? [window.ethereum];
        for (const p of list) {
          const kw = WALLETS.find(k => k.detect(p));
          const id = kw?.id ?? `injected-${Math.random().toString(36).slice(2)}`;
          if (seen.has(id)) continue;
          seen.add(id);
          wallets.push({ id, name: kw?.name ?? "Injected Wallet", icon: "", provider: p });
        }
        setDetected([...wallets]);
      }
    }, 300);

    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleConnect = useCallback(async (provider: EthereumProvider, id: string) => {
    setError(null); setConnecting(id);
    try { await onConnect(provider); onClose(); }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg.includes("4001") || msg.toLowerCase().includes("rejected") ? "Connection rejected by wallet." : msg);
    } finally { setConnecting(null); }
  }, [onConnect, onClose]);

  if (!mounted || !isOpen) return null;

  const detectedRdns = new Set(detected.map(d => d.rdns));
  const detectedIds  = new Set(detected.map(d => d.id));
  const filtered = search.trim()
    ? WALLETS.filter(w => w.name.toLowerCase().includes(search.toLowerCase()))
    : WALLETS;
  const currentUrl = typeof window !== "undefined" ? window.location.href : "https://glowide.app";

  const modal = (
    <div
      style={{ position:"fixed", inset:0, zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}
    >
      {/* Backdrop */}
      <div
        style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)" }}
        onClick={onClose}
      />

      {/* Card — inline styles guarantee no parent overrides */}
      <div
        style={{
          position:"relative", zIndex:1,
          width:"100%", maxWidth:"390px",
          background:"#0e0e18",
          border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:"24px",
          boxShadow:"0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.15)",
          overflow:"hidden",
          display:"flex", flexDirection:"column",
          maxHeight:"min(90vh, 640px)",
          animation:"fadeSlideUp 0.2s ease-out",
        }}
      >
        <style>{`
          @keyframes fadeSlideUp {
            from { opacity:0; transform:translateY(12px) scale(0.97); }
            to   { opacity:1; transform:translateY(0)    scale(1);    }
          }
        `}</style>

        {/* Header */}
        <div style={{ padding:"22px 22px 16px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexShrink:0 }}>
          <div>
            <p style={{ fontSize:"18px", fontWeight:700, color:"#fff", letterSpacing:"-0.3px", margin:0 }}>Connect a Wallet</p>
            <p style={{ fontSize:"12px", color:"#6b7280", marginTop:"4px" }}>
              {detected.length > 0 ? `${detected.length} wallet${detected.length > 1 ? "s" : ""} detected` : "Choose how to connect"}
            </p>
          </div>
          <button onClick={onClose} style={{ padding:"6px", background:"rgba(255,255,255,0.06)", border:"none", borderRadius:"10px", cursor:"pointer", color:"#9ca3af", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <X style={{ width:"16px", height:"16px" }} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding:"0 16px 12px", flexShrink:0 }}>
          <div style={{ position:"relative" }}>
            <Search style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", width:"15px", height:"15px", color:"#6b7280", pointerEvents:"none" }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search wallets…"
              style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"12px", padding:"10px 12px 10px 36px", fontSize:"13px", color:"#e5e7eb", outline:"none", fontFamily:"inherit" }}
              onFocus={e => (e.target.style.borderColor = "rgba(124,58,237,0.6)")}
              onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin:"0 16px 10px", padding:"10px 12px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:"12px", display:"flex", alignItems:"flex-start", gap:"8px", flexShrink:0 }}>
            <AlertCircle style={{ width:"14px", height:"14px", color:"#f87171", flexShrink:0, marginTop:"1px" }} />
            <p style={{ fontSize:"12px", color:"#fca5a5", margin:0 }}>{error}</p>
          </div>
        )}

        {/* Divider */}
        <div style={{ height:"1px", background:"rgba(255,255,255,0.06)", flexShrink:0 }} />

        {/* Wallet list */}
        <div style={{ overflowY:"auto", flex:1 }}>
          {/* Detected section */}
          {detected.length > 0 && !search && (
            <>
              <div style={{ padding:"10px 18px 4px" }}>
                <span style={{ fontSize:"10px", fontWeight:600, color:"#7c3aed", textTransform:"uppercase", letterSpacing:"0.1em" }}>Detected</span>
              </div>
              {detected.map(w => {
                const def = WALLETS.find(k => k.rdns === w.rdns || k.id === w.id);
                return <Row key={w.id} name={w.name} eip6963Icon={w.icon} def={def ?? null} badge="detected" loading={connecting===w.id} onClick={() => handleConnect(w.provider, w.id)} />;
              })}
              <div style={{ height:"1px", background:"rgba(255,255,255,0.06)", margin:"6px 0" }} />
              <div style={{ padding:"6px 18px 4px" }}>
                <span style={{ fontSize:"10px", fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em" }}>All Wallets</span>
              </div>
            </>
          )}

          {/* Wallets */}
          {filtered.map(wallet => {
            if (!search && (detectedRdns.has(wallet.rdns) || detectedIds.has(wallet.id))) return null;
            const det = detected.find(d => d.rdns === wallet.rdns);

            if (wallet.id === "walletconnect") {
              return <WCRow key="wc" loading={connecting==="walletconnect"} />;
            }

            return (
              <Row
                key={wallet.id}
                name={wallet.name}
                eip6963Icon={det?.icon ?? ""}
                def={wallet}
                badge={det ? "detected" : "install"}
                loading={connecting === wallet.id}
                onClick={() => det ? handleConnect(det.provider, wallet.id) : window.open(wallet.installUrl, "_blank")}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ height:"1px", background:"rgba(255,255,255,0.06)", flexShrink:0 }} />
        <div style={{ padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"11px", color:"#6b7280" }}>
            <ShieldCheck style={{ width:"13px", height:"13px", color:"#10b981" }} />
            Keys never leave your device
          </div>
          <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noopener noreferrer"
            style={{ fontSize:"11px", color:"#7c3aed", textDecoration:"none", display:"flex", alignItems:"center", gap:"3px" }}
            onMouseEnter={e => (e.currentTarget.style.color="#9f67ff")}
            onMouseLeave={e => (e.currentTarget.style.color="#7c3aed")}
          >
            New to Web3? <ArrowRight style={{ width:"11px", height:"11px" }} />
          </a>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Row ───────────────────────────────────────────────────────────
function Row({ name, eip6963Icon, def, badge, loading, onClick }: {
  name: string; eip6963Icon: string;
  def: WalletDef | null;
  badge: "detected" | "install";
  loading: boolean; onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const imgSrc = eip6963Icon || def?.icon || "";
  const showImg = !!imgSrc && !imgErr;

  return (
    <button
      onClick={onClick} disabled={loading}
      style={{ width:"100%", display:"flex", alignItems:"center", gap:"14px", padding:"10px 16px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" }}
      onMouseEnter={e => (e.currentTarget.style.background="rgba(255,255,255,0.04)")}
      onMouseLeave={e => (e.currentTarget.style.background="transparent")}
    >
      {/* Icon */}
      <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden", showImg ? "bg-white" : (def?.bg ?? "bg-gray-800"))} style={{ minWidth:"44px", minHeight:"44px" }}>
        {showImg
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={imgSrc} alt={name} style={{ width:"32px", height:"32px", objectFit:"contain" }} onError={() => setImgErr(true)} />
          : <span className={cn("text-base font-bold", def?.textColor ?? "text-white")}>{def?.initial ?? name[0]}</span>
        }
      </div>

      {/* Name */}
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:"15px", fontWeight:600, color:"#fff", margin:0, lineHeight:"1.2" }}>{name}</p>
        {badge === "detected" && <p style={{ fontSize:"11px", color:"#34d399", marginTop:"2px" }}>Ready to connect</p>}
      </div>

      {/* Status */}
      {loading
        ? <Loader2 style={{ width:"18px", height:"18px", color:"#7c3aed", flexShrink:0 }} className="animate-spin" />
        : badge === "detected"
          ? <span style={{ fontSize:"11px", fontWeight:500, color:"#34d399", background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.25)", padding:"3px 10px", borderRadius:"999px", flexShrink:0, whiteSpace:"nowrap" }}>Connect</span>
          : <span style={{ fontSize:"11px", color:"#6b7280", flexShrink:0 }}>Install</span>
      }
    </button>
  );
}

// ── WalletConnect row ─────────────────────────────────────────────
function WCRow({ loading }: { loading: boolean }) {
  return (
    <button
      onClick={() => window.open("https://walletconnect.com/explorer", "_blank")}
      style={{ width:"100%", display:"flex", alignItems:"center", gap:"14px", padding:"10px 16px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" }}
      onMouseEnter={e => (e.currentTarget.style.background="rgba(255,255,255,0.04)")}
      onMouseLeave={e => (e.currentTarget.style.background="transparent")}
    >
      <div style={{ width:"44px", height:"44px", minWidth:"44px", borderRadius:"16px", background:"#3B99FC", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="26" height="17" viewBox="0 0 28 18" fill="none">
          <path d="M5.73 3.73C10.27-0.81 17.73-0.81 22.27 3.73L22.82 4.28C23.05 4.51 23.05 4.88 22.82 5.11L20.97 6.96C20.86 7.07 20.67 7.07 20.56 6.96L19.79 6.19C16.61 3.01 11.39 3.01 8.21 6.19L7.39 7.01C7.28 7.12 7.09 7.12 6.98 7.01L5.13 5.16C4.9 4.93 4.9 4.56 5.13 4.33L5.73 3.73ZM25.63 7.13L27.28 8.78C27.51 9.01 27.51 9.38 27.28 9.61L19.76 17.13C19.53 17.36 19.16 17.36 18.93 17.13L13.71 11.91C13.66 11.86 13.56 11.86 13.51 11.91L8.29 17.13C8.06 17.36 7.69 17.36 7.46 17.13L-0.07 9.6C-0.3 9.37-0.3 9-0.07 8.77L1.58 7.12C1.81 6.89 2.18 6.89 2.41 7.12L7.63 12.34C7.68 12.39 7.78 12.39 7.83 12.34L13.05 7.12C13.28 6.89 13.65 6.89 13.88 7.12L19.1 12.34C19.15 12.39 19.25 12.39 19.3 12.34L24.52 7.12C24.78 6.9 25.39 6.9 25.63 7.13Z" fill="white"/>
        </svg>
      </div>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:"15px", fontWeight:600, color:"#fff", margin:0 }}>WalletConnect</p>
        <p style={{ fontSize:"11px", color:"#6b7280", marginTop:"2px" }}>400+ compatible wallets</p>
      </div>
      {loading
        ? <Loader2 style={{ width:"18px", height:"18px", color:"#3B99FC", flexShrink:0 }} className="animate-spin" />
        : <Wifi style={{ width:"15px", height:"15px", color:"#6b7280", flexShrink:0 }} />
      }
    </button>
  );
}
