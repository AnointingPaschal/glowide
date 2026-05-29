"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useWalletStore } from "@/store/walletStore";
import { truncateAddress } from "@/lib/utils";
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Check, AlertTriangle, X, Search, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EthereumProvider } from "@/types/ethereum";

const ARC_CHAIN_ID = 5042002;
const ARC_HEX = "0x4CF072";

// ── Wallet registry with deeplinks ───────────────────────────────────────────
interface WalletDef {
  id: string; name: string; rdns: string; installUrl: string;
  deepLink: ((url: string) => string) | null;
  detect: (p: EthereumProvider) => boolean;
  bg: string; initial: string; icon: string | null;
}
const WALLETS: WalletDef[] = [
  { id:"metamask",    name:"MetaMask",        rdns:"io.metamask",         installUrl:"https://metamask.io/download/",                     deepLink: u=>`https://metamask.app.link/dapp/${u}`,                                              detect:p=>!!(p.isMetaMask&&!p.isBraveWallet&&!p.isCoinbaseWallet), bg:"#F6851B", initial:"M", icon:null },
  { id:"coinbase",    name:"Coinbase Wallet",  rdns:"com.coinbase.wallet",  installUrl:"https://www.coinbase.com/wallet/downloads",          deepLink: u=>`https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u)}`,                          detect:p=>!!(p.isCoinbaseWallet),                                   bg:"#0052FF", initial:"C", icon:null },
  { id:"trust",       name:"Trust Wallet",     rdns:"com.trustwallet.app",  installUrl:"https://trustwallet.com/download",                   deepLink: u=>`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(u)}`,      detect:p=>!!(p.isTrust),                                            bg:"#3375BB", initial:"T", icon:null },
  { id:"rainbow",     name:"Rainbow",          rdns:"me.rainbow",           installUrl:"https://rainbow.me/download",                        deepLink: u=>`https://rnbwapp.com/dapp?url=${encodeURIComponent(u)}`,                             detect:p=>!!(p.isRainbow),                                          bg:"linear-gradient(135deg,#4F87FF,#A855F7,#EC4899)", initial:"R", icon:null },
  { id:"phantom",     name:"Phantom",          rdns:"app.phantom",          installUrl:"https://phantom.app/download",                       deepLink: null,                                                                                   detect:p=>!!(p.isPhantom),                                          bg:"#AB9FF2", initial:"P", icon:null },
  { id:"brave",       name:"Brave Wallet",     rdns:"com.brave.wallet",     installUrl:"https://brave.com/download/",                        deepLink: null,                                                                                   detect:p=>!!(p.isBraveWallet),                                      bg:"#FF2D00", initial:"B", icon:null },
  { id:"okx",         name:"OKX Wallet",       rdns:"com.okex.wallet",      installUrl:"https://www.okx.com/web3/wallet",                    deepLink: u=>`okx://wallet/dapp/details?dappUrl=${encodeURIComponent(u)}`,                        detect:p=>!!(p as EthereumProvider&{isOKExWallet?:boolean}).isOKExWallet, bg:"#000", initial:"O", icon:null },
  { id:"imtoken",     name:"imToken",          rdns:"im.token.imTokenEVM",  installUrl:"https://token.im/download",                         deepLink: u=>`imtokenv2://navigate/DappView?url=${encodeURIComponent(u)}`,                        detect:()=>false,                                                   bg:"#11C4D1", initial:"i", icon:null },
  { id:"zerion",      name:"Zerion",           rdns:"io.zerion.wallet",     installUrl:"https://zerion.io/download",                        deepLink: u=>`https://app.zerion.io/?utm_source=glowide&url=${encodeURIComponent(u)}`,             detect:()=>false,                                                   bg:"#2962EF", initial:"Z", icon:null },
  { id:"bybit",       name:"Bybit Wallet",     rdns:"com.bybit",            installUrl:"https://www.bybit.com/en/web3/home",                 deepLink: null,                                                                                   detect:()=>false,                                                   bg:"#F7A600", initial:"B", icon:null },
  { id:"safepal",     name:"SafePal",          rdns:"io.safepal.wallet",    installUrl:"https://www.safepal.com/download",                   deepLink: null,                                                                                   detect:()=>false,                                                   bg:"#4A3FBD", initial:"S", icon:null },
];

interface Detected { id: string; name: string; icon: string; provider: EthereumProvider; rdns?: string; }

export function WalletButton() {
  const { address, isConnected, chainId, isConnecting, disconnect, setAddress, setChainId, setConnected, setConnecting } = useWalletStore();
  const [modalOpen, setModalOpen]   = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const [detected, setDetected]     = useState<Detected[]>([]);
  const [connecting, setConnectingId] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [mounted, setMounted]       = useState(false);
  const [activeProvider, setActiveProvider] = useState<EthereumProvider | null>(null);
  const [isMobile]                  = useState(() => typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));

  useEffect(() => { setMounted(true); }, []);

  // Silent reconnect
  useEffect(() => {
    const p = window.ethereum;
    if (!p) return;
    p.request({ method:"eth_accounts" }).then(a => {
      const accs = a as string[];
      if (!accs.length) return;
      setAddress(accs[0]); setConnected(true); setActiveProvider(p);
      p.request({ method:"eth_chainId" }).then(c => setChainId(parseInt(c as string, 16)));
    }).catch(() => {});
    const onAccounts = (a: unknown) => { const accs = a as string[]; accs.length ? (setAddress(accs[0]), setConnected(true)) : disconnect(); };
    const onChain = (c: unknown) => setChainId(parseInt(c as string, 16));
    p.on("accountsChanged", onAccounts); p.on("chainChanged", onChain); p.on("disconnect", disconnect);
    return () => { p.removeListener("accountsChanged", onAccounts); p.removeListener("chainChanged", onChain); p.removeListener("disconnect", disconnect); };
  }, []); // eslint-disable-line

  // EIP-6963 detection when modal opens
  useEffect(() => {
    if (!modalOpen) return;
    setSearch(""); setError(null);
    const wallets: Detected[] = []; const seen = new Set<string>();
    const onAnnounce = (e: Event) => {
      const { detail } = e as CustomEvent<{info:{uuid:string;name:string;icon:string;rdns:string};provider:EthereumProvider}>;
      if (seen.has(detail.info.uuid)) return;
      seen.add(detail.info.uuid);
      wallets.push({ id:detail.info.uuid, name:detail.info.name, icon:detail.info.icon, provider:detail.provider, rdns:detail.info.rdns });
      setDetected([...wallets]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      if (!wallets.length && window.ethereum) {
        const list = window.ethereum.providers ?? [window.ethereum];
        list.forEach(p => {
          const kw = WALLETS.find(k => k.detect(p));
          const id = kw?.id ?? `inj-${Math.random().toString(36).slice(2)}`;
          if (seen.has(id)) return; seen.add(id);
          wallets.push({ id, name:kw?.name??"Injected Wallet", icon:"", provider:p });
          setDetected([...wallets]);
        });
      }
    }, 300);
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, [modalOpen]);

  // Lock body scroll
  useEffect(() => { if (modalOpen) document.body.style.overflow="hidden"; else document.body.style.overflow=""; return () => { document.body.style.overflow=""; }; }, [modalOpen]);

  const switchToArc = async (p: EthereumProvider) => {
    try { await p.request({ method:"wallet_switchEthereumChain", params:[{chainId:ARC_HEX}] }); }
    catch (e: any) {
      if (e?.code === 4902) await p.request({ method:"wallet_addEthereumChain", params:[{ chainId:ARC_HEX, chainName:"Arc Testnet", nativeCurrency:{name:"USD Coin",symbol:"USDC",decimals:6}, rpcUrls:[process.env.NEXT_PUBLIC_ARC_RPC_URL??"https://rpc.testnet.arc.network"], blockExplorerUrls:[process.env.NEXT_PUBLIC_ARC_EXPLORER_URL??"https://testnet.arcscan.app"] }] });
    }
  };

  const handleConnect = useCallback(async (provider: EthereumProvider, walletId: string) => {
    setError(null); setConnectingId(walletId); setConnecting(true);
    try {
      const accs = await provider.request({ method:"eth_requestAccounts" }) as string[];
      if (!accs.length) throw new Error("No accounts returned");
      setAddress(accs[0]); setConnected(true); setActiveProvider(provider);
      const cid = await provider.request({ method:"eth_chainId" }) as string;
      const num = parseInt(cid, 16); setChainId(num);
      if (num !== ARC_CHAIN_ID) await switchToArc(provider);
      const newCid = await provider.request({ method:"eth_chainId" }) as string;
      setChainId(parseInt(newCid, 16));
      setModalOpen(false);
    } catch (e: any) {
      const msg = e?.message ?? "Connection failed";
      setError(msg.includes("4001")||msg.toLowerCase().includes("rejected") ? "Rejected by wallet." : msg.slice(0,100));
    } finally { setConnectingId(null); setConnecting(false); }
  }, []); // eslint-disable-line

  const copyAddress = async () => { if (!address) return; await navigator.clipboard.writeText(address); setCopied(true); setTimeout(()=>setCopied(false), 2000); };

  const isArc = chainId === ARC_CHAIN_ID;
  const currentUrl = typeof window !== "undefined" ? window.location.href : "https://glowide.app";
  const filteredWallets = search ? WALLETS.filter(w => w.name.toLowerCase().includes(search.toLowerCase())) : WALLETS;
  const detectedRdns = new Set(detected.map(d => d.rdns));
  const detectedIds  = new Set(detected.map(d => d.id));

  // ── Disconnected button ─────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-glow-card border-glow-border hover:border-glow-accent/60 text-glow-text hover:bg-glow-accent/10 transition-all">
          <Wallet className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Connect</span>
        </button>

        {mounted && modalOpen && createPortal(
          <div style={{position:"fixed",inset:0,zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(8px)"}} onClick={() => setModalOpen(false)} />
            <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:"400px",background:"#0e0e18",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"20px",boxShadow:"0 32px 80px rgba(0,0,0,0.7)",overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"min(90vh,600px)",animation:"fadeSlideUp 0.2s ease-out"}}>
              <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(12px) scale(0.97)}to{opacity:1;transform:none}}`}</style>

              {/* Header */}
              <div style={{padding:"20px 20px 14px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexShrink:0}}>
                <div>
                  <p style={{fontSize:"17px",fontWeight:700,color:"#fff",margin:0}}>Connect a Wallet</p>
                  <p style={{fontSize:"12px",color:"#6b7280",marginTop:"3px"}}>{detected.length > 0 ? `${detected.length} wallet${detected.length>1?"s":""} detected` : isMobile ? "Open in your wallet app" : "Choose your wallet"}</p>
                </div>
                <button onClick={() => setModalOpen(false)} style={{padding:"6px",background:"rgba(255,255,255,0.06)",border:"none",borderRadius:"8px",cursor:"pointer",color:"#9ca3af",lineHeight:1}}>
                  <X style={{width:"15px",height:"15px"}} />
                </button>
              </div>

              {/* Search */}
              <div style={{padding:"0 16px 10px",flexShrink:0}}>
                <div style={{position:"relative"}}>
                  <Search style={{position:"absolute",left:"11px",top:"50%",transform:"translateY(-50%)",width:"14px",height:"14px",color:"#6b7280",pointerEvents:"none"}} />
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search wallets…"
                    style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",padding:"9px 12px 9px 33px",fontSize:"13px",color:"#e5e7eb",outline:"none",fontFamily:"inherit"}}
                    onFocus={e=>e.target.style.borderColor="rgba(124,58,237,0.6)"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"} />
                </div>
              </div>

              {error && (
                <div style={{margin:"0 16px 10px",padding:"10px 12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"10px",display:"flex",alignItems:"flex-start",gap:"8px",flexShrink:0}}>
                  <AlertTriangle style={{width:"14px",height:"14px",color:"#f87171",flexShrink:0,marginTop:"1px"}} />
                  <p style={{fontSize:"12px",color:"#fca5a5",margin:0}}>{error}</p>
                </div>
              )}

              <div style={{height:"1px",background:"rgba(255,255,255,0.06)",flexShrink:0}} />

              {/* Wallet list */}
              <div style={{overflowY:"auto",flex:1,paddingTop:"4px"}}>
                {/* Detected first */}
                {detected.length > 0 && !search && (
                  <>
                    <p style={{fontSize:"10px",fontWeight:600,color:"#7c3aed",textTransform:"uppercase",letterSpacing:"0.1em",padding:"8px 18px 4px"}}>Detected</p>
                    {detected.map(w => {
                      const def = WALLETS.find(k => k.rdns === w.rdns || k.id === w.id);
                      return <WRow key={w.id} name={w.name} bg={def?.bg??"#555"} initial={def?.initial??w.name[0]} eip6963Icon={w.icon} badge="detected" loading={connecting===w.id} onClick={()=>handleConnect(w.provider,w.id)} />;
                    })}
                    <div style={{height:"1px",background:"rgba(255,255,255,0.06)",margin:"6px 0"}} />
                    <p style={{fontSize:"10px",fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.1em",padding:"4px 18px 4px"}}>All Wallets</p>
                  </>
                )}

                {/* Mobile deeplinks */}
                {isMobile && !search && (
                  <>
                    <p style={{fontSize:"10px",fontWeight:600,color:"#06b6d4",textTransform:"uppercase",letterSpacing:"0.1em",padding:"4px 18px 4px"}}>Open in App</p>
                    {WALLETS.filter(w => w.deepLink).map(w => (
                      <a key={w.id} href={w.deepLink!(currentUrl)} style={{display:"flex",alignItems:"center",gap:"14px",padding:"10px 16px",color:"inherit",textDecoration:"none"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.04)")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <WIcon bg={w.bg} initial={w.initial} />
                        <div style={{flex:1}}><p style={{fontSize:"14px",fontWeight:600,color:"#fff",margin:0}}>{w.name}</p><p style={{fontSize:"11px",color:"#6b7280",margin:"2px 0 0"}}>Open in {w.name} app</p></div>
                        <ExternalLink style={{width:"14px",height:"14px",color:"#6b7280"}} />
                      </a>
                    ))}
                    <div style={{height:"1px",background:"rgba(255,255,255,0.06)",margin:"6px 0"}} />
                    <p style={{fontSize:"10px",fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.1em",padding:"4px 18px 4px"}}>Browser Extension</p>
                  </>
                )}

                {/* All wallets */}
                {filteredWallets.map(wallet => {
                  if (!search && (detectedRdns.has(wallet.rdns)||detectedIds.has(wallet.id))) return null;
                  const det = detected.find(d => d.rdns===wallet.rdns);
                  return <WRow key={wallet.id} name={wallet.name} bg={wallet.bg} initial={wallet.initial} eip6963Icon={det?.icon??""} badge={det?"detected":"install"} loading={connecting===wallet.id} onClick={()=>det?handleConnect(det.provider,wallet.id):window.open(wallet.installUrl,"_blank")} />;
                })}

                {detected.length === 0 && !isMobile && (
                  <div style={{padding:"12px 16px",margin:"0 16px 8px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:"12px"}}>
                    <p style={{fontSize:"12px",color:"#fbbf24",margin:0}}>No wallet detected. Install one above or open on mobile to use a wallet app.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{height:"1px",background:"rgba(255,255,255,0.06)",flexShrink:0}} />
              <div style={{padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"#6b7280"}}>
                  <ShieldCheck style={{width:"13px",height:"13px",color:"#10b981"}} />
                  Keys never leave your device
                </div>
                <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noopener noreferrer" style={{fontSize:"11px",color:"#7c3aed",textDecoration:"none",display:"flex",alignItems:"center",gap:"3px"}}>
                  New to wallets? <ArrowRight style={{width:"11px",height:"11px"}} />
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // ── Connected ───────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <button onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-glow-card border border-glow-border rounded-lg hover:border-glow-accent/40 transition-colors text-xs">
        <div className="w-5 h-5 rounded-full bg-glow-gradient flex items-center justify-center flex-shrink-0">
          <Wallet className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-glow-text font-mono font-medium hidden sm:block">{truncateAddress(address!)}</span>
        <span className={cn("hidden md:inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full", isArc ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10")}>
          <span className={cn("w-1.5 h-1.5 rounded-full", isArc ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
          {isArc ? "Arc" : "Wrong net"}
        </span>
        <ChevronDown className={cn("w-3 h-3 text-glow-muted transition-transform", menuOpen && "rotate-180")} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-glow-card border border-glow-border rounded-xl shadow-card-shadow z-50 overflow-hidden animate-fade-in">
            <div className="p-3 border-b border-glow-border">
              <p className="text-xs text-glow-muted mb-0.5">Connected Wallet</p>
              <p className="text-sm font-mono text-glow-text">{truncateAddress(address!, 8)}</p>
              <div className="mt-1.5">
                {isArc ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />Arc Testnet · 5042002</span>
                ) : (
                  <button onClick={() => activeProvider && switchToArc(activeProvider)} className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
                    <AlertTriangle className="w-3 h-3" />Switch to Arc Testnet
                  </button>
                )}
              </div>
            </div>
            <div className="p-1">
              <button onClick={copyAddress} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}{copied ? "Copied!" : "Copy Address"}
              </button>
              <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors">
                <ExternalLink className="w-4 h-4" />View on ArcScan
              </a>
              <button onClick={() => { disconnect(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WIcon({ bg, initial }: { bg: string; initial: string }) {
  return (
    <div style={{width:"44px",height:"44px",minWidth:"44px",borderRadius:"14px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",fontWeight:700,color:"#fff",background:bg,flexShrink:0}}>
      {initial}
    </div>
  );
}

function WRow({ name, bg, initial, eip6963Icon, badge, loading, onClick }: { name:string;bg:string;initial:string;eip6963Icon:string;badge:"detected"|"install";loading:boolean;onClick:()=>void }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <button onClick={onClick} disabled={loading}
      style={{width:"100%",display:"flex",alignItems:"center",gap:"14px",padding:"10px 16px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}
      onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.04)")}
      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
      {eip6963Icon && !imgErr
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={eip6963Icon} alt={name} style={{width:"44px",height:"44px",minWidth:"44px",borderRadius:"14px",objectFit:"contain",background:"#fff",padding:"4px",flexShrink:0}} onError={()=>setImgErr(true)} />
        : <WIcon bg={bg} initial={initial} />
      }
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:"15px",fontWeight:600,color:"#fff",margin:0}}>{name}</p>
        {badge==="detected" && <p style={{fontSize:"11px",color:"#34d399",margin:"2px 0 0"}}>Ready to connect</p>}
      </div>
      {loading
        ? <Loader2 style={{width:"18px",height:"18px",color:"#7c3aed",flexShrink:0,animation:"spin 1s linear infinite"}} />
        : badge==="detected"
          ? <span style={{fontSize:"11px",fontWeight:500,color:"#34d399",background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.2)",padding:"3px 10px",borderRadius:"999px",flexShrink:0}}>Connect</span>
          : <span style={{fontSize:"11px",color:"#6b7280",flexShrink:0}}>Install</span>
      }
    </button>
  );
}
