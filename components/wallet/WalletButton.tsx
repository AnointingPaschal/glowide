"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useWalletStore } from "@/store/walletStore";
import { truncateAddress } from "@/lib/utils";
import {
  Wallet, ChevronDown, Copy, ExternalLink, LogOut,
  Check, AlertTriangle, X, Search, ShieldCheck,
  ArrowRight, Loader2, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EthereumProvider } from "@/types/ethereum";

const ARC_CHAIN_ID = 5042002;
const ARC_HEX = "0x4CF072";

// ── Wallet definitions — no hardcoding of "installed" wallets ──────────────
// Source: EIP-6963 announces installed wallets at runtime
// Mobile deeplinks follow the correct format from each wallet's documentation
interface WalletMeta {
  id: string; name: string; icon: string; rdns: string;
  deeplink: (url: string) => string;
  // install page shown when wallet NOT detected on desktop
  installUrl: string;
}

const WALLET_METAS: WalletMeta[] = [
  {
    id: "metamask", name: "MetaMask", rdns: "io.metamask",
    // Official MetaMask deep link format
    deeplink: (url) => `https://link.metamask.io/dapp/${encodeURIComponent(url)}`,
    installUrl: "https://metamask.io/download/",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 318.6 318.6'%3E%3Cpath fill='%23E2761B' d='M274.1 35.5l-99.5 73.9L193 65.8z'/%3E%3Cpath fill='%23E4761B' d='M44.4 35.5l98.7 74.6-17.5-44.3zm193.9 171.3l-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z'/%3E%3Cpath fill='%23E4761B' d='M103.6 138.2l-15.8 23.9 56.3 2.5-2-60.5zm111.3 0l-39-34.8-1.3 61.2 56.2-2.5zM106.8 247.4l33.8-16.5-29.2-22.8zm71.1-16.5l33.9 16.5-4.7-39.3z'/%3E%3Cpath fill='%23D7C1B3' d='M211.8 247.4l-33.9-16.5 2.7 22.1-.3 9.3zm-105 0l31.5 14.9-.2-9.3 2.5-22.1z'/%3E%3Cpath fill='%23233447' d='M138.8 193.5l-28.2-8.3 19.9-9.1zm40.9 0l8.3-17.4 20 9.1z'/%3E%3Cpath fill='%23CD6116' d='M106.8 247.4l4.8-40.6-31.3.9zM207 206.8l4.8 40.6 26.5-39.7zm23.8-44.7l-56.2 2.5 5.2 28.9 8.3-17.4 20 9.1zm-120.2 23.1l20-9.1 8.2 17.4 5.3-28.9-56.3-2.5z'/%3E%3Cpath fill='%23E4751F' d='M87.8 162.1l23.6 46-.8-22.9zm120.3 23.1l-1 22.9 23.7-46zm-64-20.6l-5.3 28.9 6.6 34.1 1.5-44.9zm30.5 0l-2.7 18 1.2 45 6.7-34.1z'/%3E%3Cpath fill='%23F6851B' d='M179.8 193.5l-6.7 34.1 4.8 3.3 29.2-22.8 1-22.9zm-69 14.7l.8 22.9 29.2 22.8 4.8-3.3-6.6-34.1z'/%3E%3Cpath fill='%23C0AD9E' d='M180.3 262.3l.3-9.3-2.5-2.2h-37.7l-2.3 2.2.2 9.3-31.5-14.9 11 9 22.3 15.5h38.3l22.4-15.5 11-9z'/%3E%3Cpath fill='%23161616' d='M178.1 230.9l-4.8-3.3h-27.7l-4.8 3.3-2.5 22.1 2.3-2.2h37.7l2.5 2.2z'/%3E%3Cpath fill='%23763D16' d='M278.3 114.2l8.5-40.8-12.7-37.9-96.2 71.4 37 31.3 52.3 15.3 11.6-13.5-5-3.6 8-7.3-6.2-4.8 8-6.1zM31.8 73.4l8.5 40.8-5.4 4 8 6.1-6.1 4.8 8 7.3-5 3.6 11.5 13.5 52.3-15.3 37-31.3-96.2-71.4z'/%3E%3Cpath fill='%23F6851B' d='M267.2 153.5l-52.3-15.3 15.9 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3l-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4l3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z'/%3E%3C/svg%3E",
  },
  {
    id: "trust", name: "Trust Wallet", rdns: "com.trustwallet.app",
    deeplink: (url) => `https://link.trustwallet.com/open_url?url=${encodeURIComponent(url)}`,
    installUrl: "https://trustwallet.com/download",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Ccircle cx='256' cy='256' r='256' fill='%233375BB'/%3E%3Cpath fill='white' d='M256 96l128 48v96c0 70.4-54.4 128-128 144-73.6-16-128-73.6-128-144v-96z'/%3E%3C/svg%3E",
  },
  {
    id: "phantom", name: "Phantom", rdns: "app.phantom",
    deeplink: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(window.location.origin)}`,
    installUrl: "https://phantom.app/download",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Ccircle cx='64' cy='64' r='64' fill='%23AB9FF2'/%3E%3Cpath fill='white' d='M110.5 64c0 25.7-20.8 46.5-46.5 46.5A46.5 46.5 0 0 1 17.5 64c0-25.7 20.8-46.5 46.5-46.5S110.5 38.3 110.5 64z'/%3E%3Cpath fill='%23AB9FF2' d='M84 54.5H44c-2.8 0-5 2.2-5 5s2.2 5 5 5h40c2.8 0 5-2.2 5-5s-2.2-5-5-5zm0 14H44c-2.8 0-5 2.2-5 5s2.2 5 5 5h40c2.8 0 5-2.2 5-5s-2.2-5-5-5z'/%3E%3C/svg%3E",
  },
  {
    id: "okx", name: "OKX Wallet", rdns: "com.okex.wallet",
    deeplink: (url) => `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(url)}`,
    installUrl: "https://www.okx.com/web3/wallet",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%23000'/%3E%3Cpath fill='white' d='M13 13h5v5h-5zm9 0h5v5h-5zm-9 9h5v5h-5zm14-4h-4v4h4v4h4v-8h-4zm0 8h-4v4h4v-4z'/%3E%3C/svg%3E",
  },
  {
    id: "coinbase", name: "Coinbase Wallet", rdns: "com.coinbase.wallet",
    deeplink: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
    installUrl: "https://www.coinbase.com/wallet/downloads",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%230052FF'/%3E%3Ccircle cx='16' cy='16' r='10' fill='white'/%3E%3Ccircle cx='16' cy='16' r='5' fill='%230052FF'/%3E%3C/svg%3E",
  },
  {
    id: "rainbow", name: "Rainbow", rdns: "me.rainbow",
    deeplink: (url) => `https://rnbwapp.com/dapp?url=${encodeURIComponent(url)}`,
    installUrl: "https://rainbow.me/download",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cdefs%3E%3ClinearGradient id='rg' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%234F87FF'/%3E%3Cstop offset='50%25' stop-color='%23A855F7'/%3E%3Cstop offset='100%25' stop-color='%23EC4899'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='20' cy='20' r='20' fill='url(%23rg)'/%3E%3C/svg%3E",
  },
  {
    id: "zerion", name: "Zerion", rdns: "io.zerion.wallet",
    deeplink: (url) => `https://app.zerion.io/?utm_source=glowide&url=${encodeURIComponent(url)}`,
    installUrl: "https://zerion.io/download",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%232962EF'/%3E%3Ctext x='20' y='26' font-size='18' text-anchor='middle' fill='white' font-family='Arial'%3EZ%3C/text%3E%3C/svg%3E",
  },
  {
    id: "imtoken", name: "imToken", rdns: "im.token.imTokenEVM",
    deeplink: (url) => `imtokenv2://navigate/DappView?url=${encodeURIComponent(url)}`,
    installUrl: "https://token.im/download",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2311C4D1'/%3E%3Ctext x='20' y='26' font-size='14' text-anchor='middle' fill='white' font-family='Arial'%3Eim%3C/text%3E%3C/svg%3E",
  },
];

interface Detected { id: string; name: string; icon: string; provider: EthereumProvider; rdns?: string; }

export function WalletButton() {
  const { address, isConnected, chainId, isConnecting, disconnect,
    setAddress, setChainId, setConnected, setConnecting } = useWalletStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const [detected, setDetected]   = useState<Detected[]>([]);
  const [connecting, setConnectingId] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [mounted, setMounted]     = useState(false);
  const [isMobile, setIsMobile]   = useState(false);
  const [activeProvider, setActiveProvider] = useState<EthereumProvider | null>(null);

  useEffect(() => {
    setMounted(true);
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  // Silent reconnect
  useEffect(() => {
    const p = window.ethereum;
    if (!p) return;
    p.request({ method: "eth_accounts" }).then(a => {
      const accs = a as string[];
      if (!accs.length) return;
      setAddress(accs[0]); setConnected(true); setActiveProvider(p);
      p.request({ method: "eth_chainId" }).then(c => setChainId(parseInt(c as string, 16)));
    }).catch(() => {});
    const onA = (a: unknown) => { const accs = a as string[]; accs.length ? (setAddress(accs[0]), setConnected(true)) : disconnect(); };
    const onC = (c: unknown) => setChainId(parseInt(c as string, 16));
    p.on("accountsChanged", onA); p.on("chainChanged", onC); p.on("disconnect", disconnect);
    return () => { p.removeListener("accountsChanged", onA); p.removeListener("chainChanged", onC); p.removeListener("disconnect", disconnect); };
  }, []); // eslint-disable-line

  // EIP-6963 detection when modal opens
  useEffect(() => {
    if (!modalOpen) return;
    setSearch(""); setError(null); setDetected([]);
    const wallets: Detected[] = [];
    const seen = new Set<string>();

    const onAnnounce = (e: Event) => {
      const { detail } = e as CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: EthereumProvider }>;
      if (seen.has(detail.info.uuid)) return;
      seen.add(detail.info.uuid);
      wallets.push({ id: detail.info.uuid, name: detail.info.name, icon: detail.info.icon, provider: detail.provider, rdns: detail.info.rdns });
      setDetected([...wallets]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Legacy fallback after 300ms if no EIP-6963 announcements
    setTimeout(() => {
      if (!wallets.length && window.ethereum) {
        const list = window.ethereum.providers ?? [window.ethereum];
        for (const p of list) {
          // Detect without hardcoding — use flags the wallet sets on itself
          const flags: Record<string, boolean> = {};
          const pAny = p as unknown as Record<string, unknown>;
          for (const k of Object.keys(pAny)) {
            if (k.startsWith("is") && typeof pAny[k] === "boolean") {
              flags[k] = true;
            }
          }
          const flagStr = Object.keys(flags).join(",");
          const meta = WALLET_METAS.find(wm =>
            (wm.id === "metamask" && flags.isMetaMask && !flags.isBraveWallet && !flags.isCoinbaseWallet) ||
            (wm.id === "coinbase" && flags.isCoinbaseWallet) ||
            (wm.id === "trust"    && flags.isTrust) ||
            (wm.id === "rainbow"  && flags.isRainbow) ||
            (wm.id === "phantom"  && flags.isPhantom) ||
            (wm.id === "brave"    && flags.isBraveWallet) ||
            (wm.id === "okx"      && (flags.isOKExWallet || flags.isOkxWallet))
          );
          const id = meta?.id ?? `inj-${flagStr || Math.random().toString(36).slice(2)}`;
          if (seen.has(id)) continue;
          seen.add(id);
          wallets.push({ id, name: meta?.name ?? "Injected Wallet", icon: meta?.icon ?? "", provider: p });
          setDetected([...wallets]);
        }
      }
    }, 300);
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, [modalOpen]);

  useEffect(() => {
    if (modalOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  const switchToArc = async (p: EthereumProvider) => {
    try { await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_HEX }] }); }
    catch (e: unknown) {
      if ((e as { code?: number }).code === 4902) {
        await p.request({ method: "wallet_addEthereumChain", params: [{
          chainId: ARC_HEX, chainName: "Arc Testnet",
          nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
          rpcUrls: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"],
          blockExplorerUrls: ["https://testnet.arcscan.app"],
        }] });
      }
    }
  };

  const handleConnect = useCallback(async (provider: EthereumProvider, walletId: string) => {
    setError(null); setConnectingId(walletId); setConnecting(true);
    try {
      const accs = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (!accs.length) throw new Error("No accounts returned");
      setAddress(accs[0]); setConnected(true); setActiveProvider(provider);
      const cid = await provider.request({ method: "eth_chainId" }) as string;
      const num = parseInt(cid, 16); setChainId(num);
      if (num !== ARC_CHAIN_ID) { await switchToArc(provider); }
      const nc = await provider.request({ method: "eth_chainId" }) as string;
      setChainId(parseInt(nc, 16));
      setModalOpen(false);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Connection failed";
      setError(msg.includes("4001") || msg.toLowerCase().includes("rejected") ? "Rejected by wallet." : msg.slice(0, 100));
    } finally { setConnectingId(null); setConnecting(false); }
  }, []); // eslint-disable-line

  const isArc = chainId === ARC_CHAIN_ID;
  const currentUrl = typeof window !== "undefined" ? window.location.href : "https://glowide.app";
  const filteredMetas = search ? WALLET_METAS.filter(w => w.name.toLowerCase().includes(search.toLowerCase())) : WALLET_METAS;
  const detectedRdns  = new Set(detected.map(d => d.rdns));
  const detectedIds   = new Set(detected.map(d => d.id));

  if (!isConnected) {
    return (
      <>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-glow-card border-glow-border hover:border-glow-accent/60 text-glow-text hover:bg-glow-accent/10 transition-all">
          <Wallet className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Connect</span>
        </button>

        {mounted && modalOpen && createPortal(
          <div style={{ position:"fixed",inset:0,zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px" }}>
            <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(10px)" }} onClick={()=>setModalOpen(false)} />
            <div style={{ position:"relative",zIndex:1,width:"100%",maxWidth:"400px",background:"#0e0e18",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"20px",boxShadow:"0 32px 80px rgba(0,0,0,0.7)",overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"min(90dvh,600px)",animation:"wModalIn 0.2s ease-out" }}>
              <style>{`@keyframes wModalIn{from{opacity:0;transform:translateY(14px) scale(0.96)}to{opacity:1;transform:none}}`}</style>

              {/* Header */}
              <div style={{padding:"20px 20px 14px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexShrink:0}}>
                <div>
                  <p style={{fontSize:"17px",fontWeight:700,color:"#fff",margin:0}}>Connect a Wallet</p>
                  <p style={{fontSize:"12px",color:"#6b7280",marginTop:"3px"}}>
                    {isMobile ? "Open in your wallet app" : detected.length ? `${detected.length} wallet${detected.length>1?"s":""} detected` : "Choose your wallet"}
                  </p>
                </div>
                <button onClick={()=>setModalOpen(false)} style={{padding:"6px",background:"rgba(255,255,255,0.06)",border:"none",borderRadius:"8px",cursor:"pointer",color:"#9ca3af",lineHeight:1,flexShrink:0}}>
                  <X style={{width:"15px",height:"15px"}}/>
                </button>
              </div>

              {/* Search */}
              <div style={{padding:"0 16px 10px",flexShrink:0}}>
                <div style={{position:"relative"}}>
                  <Search style={{position:"absolute",left:"11px",top:"50%",transform:"translateY(-50%)",width:"14px",height:"14px",color:"#6b7280",pointerEvents:"none"}}/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search wallets…"
                    style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",padding:"9px 12px 9px 33px",fontSize:"13px",color:"#e5e7eb",outline:"none",fontFamily:"inherit"}}
                    onFocus={e=>(e.target.style.borderColor="rgba(124,58,237,0.6)")}
                    onBlur={e=>(e.target.style.borderColor="rgba(255,255,255,0.08)")}/>
                </div>
              </div>

              {error && (
                <div style={{margin:"0 16px 10px",padding:"10px 12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"10px",display:"flex",alignItems:"flex-start",gap:"8px",flexShrink:0}}>
                  <AlertTriangle style={{width:"14px",height:"14px",color:"#f87171",flexShrink:0,marginTop:"1px"}}/>
                  <p style={{fontSize:"12px",color:"#fca5a5",margin:0}}>{error}</p>
                </div>
              )}

              <div style={{height:"1px",background:"rgba(255,255,255,0.06)",flexShrink:0}}/>

              {/* Wallet rows */}
              <div style={{overflowY:"auto",flex:1,paddingBottom:"4px"}}>

                {/* Detected (EIP-6963) */}
                {detected.length > 0 && !search && (
                  <>
                    <SectionLabel color="#7c3aed" label={`Detected (${detected.length})`}/>
                    {detected.map(w => {
                      const meta = WALLET_METAS.find(m => m.rdns === w.rdns || m.id === w.id);
                      return <WRow key={w.id} name={w.name} icon={w.icon || meta?.icon || ""} badge="detected" loading={connecting===w.id} onClick={()=>handleConnect(w.provider,w.id)}/>;
                    })}
                    <div style={{height:"1px",background:"rgba(255,255,255,0.06)",margin:"4px 0"}}/>
                  </>
                )}

                {/* Mobile: deeplinks first */}
                {isMobile && !search && (
                  <>
                    <SectionLabel color="#06b6d4" label="Open in Wallet App"/>
                    {WALLET_METAS.filter(w => !!w.deeplink).map(w => (
                      <DeeplinkRow key={w.id} meta={w} currentUrl={currentUrl}/>
                    ))}
                    <div style={{height:"1px",background:"rgba(255,255,255,0.06)",margin:"4px 0"}}/>
                    {detected.length === 0 && <SectionLabel color="#6b7280" label="Browser Extension"/>}
                  </>
                )}

                {/* All wallets (not detected) */}
                {filteredMetas.map(meta => {
                  if (!search && (detectedRdns.has(meta.rdns) || detectedIds.has(meta.id))) return null;
                  const det = detected.find(d => d.rdns === meta.rdns || d.id === meta.id);
                  return (
                    <WRow key={meta.id} name={meta.name} icon={meta.icon} badge={det ? "detected" : "install"}
                      loading={connecting === meta.id}
                      onClick={det
                        ? () => handleConnect(det.provider, meta.id)
                        : () => window.open(meta.installUrl, "_blank")}
                    />
                  );
                })}

                {!isMobile && detected.length === 0 && (
                  <div style={{margin:"8px 16px",padding:"10px 12px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:"10px"}}>
                    <p style={{fontSize:"12px",color:"#fbbf24",margin:0}}>No wallet extension detected. Install one above or open this page in your mobile wallet browser.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{height:"1px",background:"rgba(255,255,255,0.06)",flexShrink:0}}/>
              <div style={{padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"#6b7280"}}>
                  <ShieldCheck style={{width:"13px",height:"13px",color:"#10b981"}}/>Keys never leave your device
                </div>
                <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noopener noreferrer"
                  style={{fontSize:"11px",color:"#7c3aed",textDecoration:"none",display:"flex",alignItems:"center",gap:"3px"}}>
                  New to wallets? <ArrowRight style={{width:"11px",height:"11px"}}/>
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="relative">
      <button onClick={()=>setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-glow-card border border-glow-border rounded-lg hover:border-glow-accent/40 transition-colors text-xs">
        <div className="w-5 h-5 rounded-full bg-glow-gradient flex items-center justify-center flex-shrink-0">
          <Wallet className="w-2.5 h-2.5 text-white"/>
        </div>
        <span className="text-glow-text font-mono font-medium hidden sm:block">{truncateAddress(address!)}</span>
        <span className={cn("hidden md:inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full", isArc?"text-emerald-400 bg-emerald-500/10":"text-amber-400 bg-amber-500/10")}>
          <span className={cn("w-1.5 h-1.5 rounded-full", isArc?"bg-emerald-400 animate-pulse":"bg-amber-400")}/>
          {isArc ? "Arc" : "Wrong net"}
        </span>
        <ChevronDown className={cn("w-3 h-3 text-glow-muted transition-transform", menuOpen&&"rotate-180")}/>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={()=>setMenuOpen(false)}/>
          <div className="absolute right-0 top-full mt-2 w-56 bg-glow-card border border-glow-border rounded-xl shadow-card-shadow z-50 overflow-hidden animate-fade-in">
            <div className="p-3 border-b border-glow-border">
              <p className="text-xs text-glow-muted mb-0.5">Connected Wallet</p>
              <p className="text-sm font-mono text-glow-text">{truncateAddress(address!, 8)}</p>
              <div className="mt-1.5">
                {isArc ? <span className="flex items-center gap-1 text-xs text-emerald-400"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>Arc Testnet · 5042002</span>
                  : <button onClick={()=>activeProvider&&switchToArc(activeProvider)} className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"><AlertTriangle className="w-3 h-3"/>Switch to Arc Testnet</button>
                }
              </div>
            </div>
            <div className="p-1">
              <button onClick={async()=>{await navigator.clipboard.writeText(address!);setCopied(true);setTimeout(()=>setCopied(false),2000);}} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors">
                {copied?<Check className="w-4 h-4 text-emerald-400"/>:<Copy className="w-4 h-4"/>}{copied?"Copied!":"Copy Address"}
              </button>
              <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors">
                <ExternalLink className="w-4 h-4"/>View on ArcScan
              </a>
              <button onClick={()=>{disconnect();setMenuOpen(false);}} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                <LogOut className="w-4 h-4"/>Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────
function SectionLabel({ color, label }: { color: string; label: string }) {
  return <p style={{fontSize:"10px",fontWeight:600,color,textTransform:"uppercase",letterSpacing:"0.1em",padding:"8px 18px 4px"}}>{label}</p>;
}

function WRow({ name, icon, badge, loading, onClick }: { name:string; icon:string; badge:"detected"|"install"; loading:boolean; onClick:()=>void }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <button onClick={onClick} disabled={loading}
      style={{width:"100%",display:"flex",alignItems:"center",gap:"14px",padding:"10px 16px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}
      onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.04)")}
      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
      <div style={{width:"44px",height:"44px",minWidth:"44px",borderRadius:"14px",overflow:"hidden",background:"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {icon && !imgErr
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={icon} alt={name} style={{width:"44px",height:"44px",objectFit:"cover"}} onError={()=>setImgErr(true)}/>
          : <span style={{fontSize:"16px",fontWeight:700,color:"#9ca3af"}}>{name[0]}</span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:"15px",fontWeight:600,color:"#fff",margin:0}}>{name}</p>
        {badge==="detected" && <p style={{fontSize:"11px",color:"#34d399",margin:"2px 0 0"}}>Ready to connect</p>}
      </div>
      {loading
        ? <Loader2 style={{width:"18px",height:"18px",color:"#7c3aed",flexShrink:0,animation:"spin 1s linear infinite"}}/>
        : badge==="detected"
          ? <span style={{fontSize:"11px",fontWeight:500,color:"#34d399",background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.2)",padding:"3px 10px",borderRadius:"999px",flexShrink:0}}>Connect</span>
          : <span style={{fontSize:"11px",color:"#6b7280",flexShrink:0}}>Install</span>
      }
    </button>
  );
}

function DeeplinkRow({ meta, currentUrl }: { meta: WalletMeta; currentUrl: string }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <a href={meta.deeplink(currentUrl)}
      style={{width:"100%",display:"flex",alignItems:"center",gap:"14px",padding:"10px 16px",color:"inherit",textDecoration:"none"}}
      onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.04)")}
      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
      <div style={{width:"44px",height:"44px",minWidth:"44px",borderRadius:"14px",overflow:"hidden",background:"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {meta.icon && !imgErr
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={meta.icon} alt={meta.name} style={{width:"44px",height:"44px",objectFit:"cover"}} onError={()=>setImgErr(true)}/>
          : <Smartphone style={{width:"20px",height:"20px",color:"#9ca3af"}}/>}
      </div>
      <div style={{flex:1}}>
        <p style={{fontSize:"15px",fontWeight:600,color:"#fff",margin:0}}>{meta.name}</p>
        <p style={{fontSize:"11px",color:"#6b7280",margin:"2px 0 0"}}>Open in {meta.name} browser</p>
      </div>
      <ExternalLink style={{width:"14px",height:"14px",color:"#6b7280",flexShrink:0}}/>
    </a>
  );
}
