"use client";
import { useState, useEffect, useCallback } from "react";
import { X, ExternalLink, AlertCircle, ChevronRight, Loader2, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EthereumProvider } from "@/types/ethereum";

interface EIP6963ProviderInfo { uuid: string; name: string; icon: string; rdns: string; }
interface EIP6963ProviderDetail { info: EIP6963ProviderInfo; provider: EthereumProvider; }

const KNOWN_WALLETS = [
  { id: "metamask",  name: "MetaMask",        rdns: "io.metamask",         installUrl: "https://metamask.io/download/",             deepLink: (u: string) => `https://metamask.app.link/dapp/${u}`,                           detect: (p: EthereumProvider) => !!(p.isMetaMask && !p.isBraveWallet && !p.isCoinbaseWallet) },
  { id: "coinbase",  name: "Coinbase Wallet",  rdns: "com.coinbase.wallet", installUrl: "https://www.coinbase.com/wallet/downloads",  deepLink: (u: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u)}`,      detect: (p: EthereumProvider) => !!(p.isCoinbaseWallet) },
  { id: "brave",     name: "Brave Wallet",     rdns: "com.brave.wallet",    installUrl: "https://brave.com/download/",                deepLink: null,                                                                            detect: (p: EthereumProvider) => !!(p.isBraveWallet) },
  { id: "rainbow",   name: "Rainbow",          rdns: "me.rainbow",          installUrl: "https://rainbow.me/download",                deepLink: (u: string) => `https://rnbwapp.com/dapp?url=${encodeURIComponent(u)}`,          detect: (p: EthereumProvider) => !!(p.isRainbow) },
  { id: "trust",     name: "Trust Wallet",     rdns: "com.trustwallet.app", installUrl: "https://trustwallet.com/download",           deepLink: (u: string) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(u)}`, detect: (p: EthereumProvider) => !!(p.isTrust) },
  { id: "phantom",   name: "Phantom",          rdns: "app.phantom",         installUrl: "https://phantom.app/download",               deepLink: null,                                                                            detect: (p: EthereumProvider) => !!(p.isPhantom) },
];

interface DetectedWallet { id: string; name: string; icon: string; provider: EthereumProvider; rdns?: string; }

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (provider: EthereumProvider) => Promise<void>;
}

export function WalletModal({ isOpen, onClose, onConnect }: WalletModalProps) {
  const [detected, setDetected] = useState<DetectedWallet[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"wallets" | "mobile">("wallets");

  useEffect(() => {
    if (!isOpen) return;
    const wallets: DetectedWallet[] = [];
    const seen = new Set<string>();

    const handleAnnounce = (event: Event) => {
      const { detail } = event as CustomEvent<EIP6963ProviderDetail>;
      const { info, provider } = detail;
      if (seen.has(info.uuid)) return;
      seen.add(info.uuid);
      wallets.push({ id: info.uuid, name: info.name, icon: info.icon, provider, rdns: info.rdns });
      setDetected([...wallets]);
    };

    window.addEventListener("eip6963:announceProvider", handleAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Fallback: legacy window.ethereum
    setTimeout(() => {
      if (wallets.length === 0 && window.ethereum) {
        const list = window.ethereum.providers ?? [window.ethereum];
        for (const p of list) {
          const kw = KNOWN_WALLETS.find(k => k.detect(p));
          const id = kw?.id ?? `injected-${Math.random().toString(36).slice(2)}`;
          if (seen.has(id)) continue;
          seen.add(id);
          wallets.push({ id, name: kw?.name ?? "Injected Wallet", icon: "", provider: p });
        }
        setDetected([...wallets]);
      }
    }, 300);

    return () => window.removeEventListener("eip6963:announceProvider", handleAnnounce);
  }, [isOpen]);

  const handleConnect = useCallback(async (provider: EthereumProvider, walletId: string) => {
    setError(null);
    setConnecting(walletId);
    try {
      await onConnect(provider);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg.includes("4001") || msg.toLowerCase().includes("rejected") ? "Connection rejected." : msg);
    } finally {
      setConnecting(null);
    }
  }, [onConnect, onClose]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== "undefined" ? window.location.href : "https://glowide.app";
  const detectedRdns = new Set(detected.map(d => d.rdns));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-glow-card border border-glow-border rounded-2xl shadow-card-shadow animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-glow-border">
          <div>
            <h2 className="text-base font-semibold text-white">Connect Wallet</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose your wallet to connect</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-glow-surface transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-glow-border">
          {(["wallets", "mobile"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn(
              "flex-1 py-2.5 text-xs font-medium transition-colors capitalize",
              tab === t ? "text-glow-accent-light border-b-2 border-glow-accent" : "text-gray-500 hover:text-gray-300"
            )}>
              {t === "wallets" ? "Browser Wallets" : "Mobile / QR"}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {tab === "wallets" && (
            <>
              {detected.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Detected ({detected.length})</p>
                  <div className="space-y-2">
                    {detected.map(w => (
                      <WalletRow key={w.id} name={w.name} icon={w.icon} badge="Installed" badgeGreen
                        loading={connecting === w.id} onClick={() => handleConnect(w.provider, w.id)} />
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {detected.length > 0 ? "More Wallets" : "Install a Wallet"}
                </p>
                <div className="space-y-2">
                  {KNOWN_WALLETS.filter(kw => !detectedRdns.has(kw.rdns) && !detected.find(d => d.id === kw.id)).map(kw => (
                    <WalletRow key={kw.id} name={kw.name} icon="" badge="Install" badgeGreen={false}
                      loading={false} onClick={() => window.open(kw.installUrl, "_blank")} />
                  ))}
                </div>
              </div>
              {detected.length === 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-300">
                    No wallet extension detected. Install one above or use the{" "}
                    <button className="underline" onClick={() => setTab("mobile")}>Mobile / QR</button> tab.
                  </p>
                </div>
              )}
            </>
          )}

          {tab === "mobile" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Open GlowIDE directly in your wallet&apos;s browser.</p>
              <div className="space-y-2">
                {KNOWN_WALLETS.filter(kw => kw.deepLink).map(kw => (
                  <a key={kw.id} href={kw.deepLink!(currentUrl)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-glow-surface border border-glow-border rounded-xl hover:border-glow-accent/40 transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-glow-card border border-glow-border flex items-center justify-center text-sm font-bold text-glow-accent flex-shrink-0">
                      {kw.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{kw.name}</p>
                      <p className="text-xs text-gray-500">Open in {kw.name} browser</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-glow-accent flex-shrink-0" />
                  </a>
                ))}
              </div>
              <div className="p-3 bg-glow-surface border border-glow-border rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Wifi className="w-4 h-4 text-glow-cyan" />
                  <span className="text-sm font-medium text-white">WalletConnect</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">Set <code className="text-glow-cyan">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> to enable QR connections.</p>
                <a href="https://walletconnect.com/explorer" target="_blank" rel="noopener noreferrer" className="text-xs text-glow-cyan underline">Browse 400+ wallets →</a>
              </div>
              <div className="p-3 bg-glow-bg border border-glow-border rounded-xl">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Direct URL</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-gray-400 font-mono truncate">{currentUrl}</span>
                  <button onClick={() => navigator.clipboard.writeText(currentUrl)} className="text-xs text-glow-accent hover:text-glow-accent-light flex-shrink-0">Copy</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-glow-border bg-glow-bg/50">
          <p className="text-[10px] text-gray-600 text-center">Wallet keys never leave your device.</p>
        </div>
      </div>
    </div>
  );
}

function WalletRow({ name, icon, badge, badgeGreen, loading, onClick }: {
  name: string; icon: string; badge: string; badgeGreen: boolean; loading: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-glow-surface border border-glow-border rounded-xl hover:border-glow-accent/40 hover:bg-glow-accent/5 transition-all">
      <div className="w-9 h-9 rounded-xl bg-glow-card border border-glow-border flex items-center justify-center text-sm font-bold text-glow-accent flex-shrink-0">
        {icon
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={icon} alt={name} className="w-8 h-8 rounded-lg object-contain bg-white p-0.5" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          : name[0]
        }
      </div>
      <span className="flex-1 text-sm font-medium text-white text-left">{name}</span>
      {loading
        ? <Loader2 className="w-4 h-4 text-glow-accent animate-spin flex-shrink-0" />
        : <span className={cn("text-xs px-2 py-0.5 rounded-full border flex-shrink-0",
            badgeGreen ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-gray-500 bg-glow-bg border-glow-border"
          )}>{badge}</span>
      }
    </button>
  );
}
