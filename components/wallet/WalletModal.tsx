"use client";
import { useState, useEffect, useCallback } from "react";
import { X, AlertCircle, Loader2, Wifi, Search, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EthereumProvider } from "@/types/ethereum";

interface EIP6963ProviderInfo { uuid: string; name: string; icon: string; rdns: string; }
interface EIP6963ProviderDetail { info: EIP6963ProviderInfo; provider: EthereumProvider; }

// ── Wallet registry ──────────────────────────────────────────────────
interface WalletDef {
  id: string;
  name: string;
  rdns: string;
  installUrl: string;
  mobileLink: ((url: string) => string) | null;
  detect: (p: EthereumProvider) => boolean;
  bg: string;       // tailwind bg class
  textColor: string;
  icon: string | null; // URL or null → use initials
  initial: string;
  popular?: boolean;
}

const WALLETS: WalletDef[] = [
  {
    id: "metamask", name: "MetaMask", rdns: "io.metamask",
    installUrl: "https://metamask.io/download/",
    mobileLink: (u) => `https://metamask.app.link/dapp/${u}`,
    detect: (p) => !!(p.isMetaMask && !p.isBraveWallet && !p.isCoinbaseWallet),
    bg: "bg-[#F6851B]", textColor: "text-white", initial: "M",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg", popular: true,
  },
  {
    id: "coinbase", name: "Coinbase Wallet", rdns: "com.coinbase.wallet",
    installUrl: "https://www.coinbase.com/wallet/downloads",
    mobileLink: (u) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u)}`,
    detect: (p) => !!(p.isCoinbaseWallet),
    bg: "bg-[#0052FF]", textColor: "text-white", initial: "C",
    icon: "https://avatars.githubusercontent.com/u/1885080?s=200", popular: true,
  },
  {
    id: "rainbow", name: "Rainbow", rdns: "me.rainbow",
    installUrl: "https://rainbow.me/download",
    mobileLink: (u) => `https://rnbwapp.com/dapp?url=${encodeURIComponent(u)}`,
    detect: (p) => !!(p.isRainbow),
    bg: "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500", textColor: "text-white", initial: "R",
    icon: null, popular: true,
  },
  {
    id: "trust", name: "Trust Wallet", rdns: "com.trustwallet.app",
    installUrl: "https://trustwallet.com/download",
    mobileLink: (u) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(u)}`,
    detect: (p) => !!(p.isTrust),
    bg: "bg-[#3375BB]", textColor: "text-white", initial: "T",
    icon: "https://trustwallet.com/assets/images/media/assets/TWT.png", popular: true,
  },
  {
    id: "phantom", name: "Phantom", rdns: "app.phantom",
    installUrl: "https://phantom.app/download",
    mobileLink: null,
    detect: (p) => !!(p.isPhantom),
    bg: "bg-[#AB9FF2]", textColor: "text-white", initial: "P",
    icon: null,
  },
  {
    id: "brave", name: "Brave Wallet", rdns: "com.brave.wallet",
    installUrl: "https://brave.com/download/",
    mobileLink: null,
    detect: (p) => !!(p.isBraveWallet),
    bg: "bg-[#FF2D00]", textColor: "text-white", initial: "B",
    icon: null,
  },
  {
    id: "okx", name: "OKX Wallet", rdns: "com.okex.wallet",
    installUrl: "https://www.okx.com/web3/wallet",
    mobileLink: (u) => `okx://wallet/dapp/details?dappUrl=${encodeURIComponent(u)}`,
    detect: (p) => !!(p as EthereumProvider & { isOKExWallet?: boolean }).isOKExWallet,
    bg: "bg-black", textColor: "text-white", initial: "O",
    icon: null,
  },
  {
    id: "bybit", name: "Bybit Wallet", rdns: "com.bybit",
    installUrl: "https://www.bybit.com/en/web3/home",
    mobileLink: null,
    detect: () => false,
    bg: "bg-[#F7A600]", textColor: "text-black", initial: "B",
    icon: null,
  },
  {
    id: "zerion", name: "Zerion", rdns: "io.zerion.wallet",
    installUrl: "https://zerion.io/download",
    mobileLink: (u) => `https://app.zerion.io/?utm_source=dapp&url=${encodeURIComponent(u)}`,
    detect: () => false,
    bg: "bg-[#2962EF]", textColor: "text-white", initial: "Z",
    icon: null,
  },
  {
    id: "imtoken", name: "imToken", rdns: "im.token.imTokenEVM",
    installUrl: "https://token.im/download",
    mobileLink: (u) => `imtokenv2://navigate/DappView?url=${encodeURIComponent(u)}`,
    detect: () => false,
    bg: "bg-[#11C4D1]", textColor: "text-white", initial: "i",
    icon: null,
  },
  {
    id: "safepal", name: "SafePal", rdns: "io.safepal.wallet",
    installUrl: "https://www.safepal.com/download",
    mobileLink: null,
    detect: () => false,
    bg: "bg-[#4A3FBD]", textColor: "text-white", initial: "S",
    icon: null,
  },
  {
    id: "tokenpocket", name: "TokenPocket", rdns: "pro.tokenpocket",
    installUrl: "https://www.tokenpocket.pro/en/download/app",
    mobileLink: (u) => `tpdapp://open?params={"url":"${u}"}`,
    detect: () => false,
    bg: "bg-[#2980FE]", textColor: "text-white", initial: "T",
    icon: null,
  },
  {
    id: "walletconnect", name: "WalletConnect", rdns: "",
    installUrl: "https://walletconnect.com/explorer",
    mobileLink: null,
    detect: () => false,
    bg: "bg-[#3B99FC]", textColor: "text-white", initial: "W",
    icon: null,
  },
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
  const [search, setSearch] = useState("");

  // ── EIP-6963 wallet discovery ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setError(null);
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

    // Legacy fallback
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

    return () => window.removeEventListener("eip6963:announceProvider", handleAnnounce);
  }, [isOpen]);

  // ── Connect handler ───────────────────────────────────────────
  const handleConnect = useCallback(async (provider: EthereumProvider, walletId: string) => {
    setError(null);
    setConnecting(walletId);
    try {
      await onConnect(provider);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg.includes("4001") || msg.toLowerCase().includes("rejected")
        ? "Connection rejected. Please approve in your wallet."
        : msg);
    } finally {
      setConnecting(null);
    }
  }, [onConnect, onClose]);

  if (!isOpen) return null;

  // Build merged list: detected wallets first, then known
  const detectedRdns = new Set(detected.map(d => d.rdns));
  const detectedIds = new Set(detected.map(d => d.id));

  const filtered = search.trim()
    ? WALLETS.filter(w => w.name.toLowerCase().includes(search.toLowerCase()))
    : WALLETS;

  const currentUrl = typeof window !== "undefined" ? window.location.href : "https://glowide.app";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[400px] bg-[#111118] border border-white/10 rounded-3xl shadow-2xl animate-fade-in overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Connect a Wallet</h2>
            <p className="text-xs text-gray-500 mt-1">
              {detected.length > 0
                ? `${detected.length} wallet${detected.length > 1 ? "s" : ""} detected in your browser`
                : "No wallet detected — install one below"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-all -mr-1 -mt-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search wallets…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#7c3aed]/60 transition-colors"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-white/[0.06] mx-0" />

        {/* Wallet list */}
        <div className="overflow-y-auto max-h-[min(60vh,420px)] py-2">

          {/* Detected wallets — shown at top with "Connected" affordance */}
          {detected.length > 0 && !search && (
            <>
              <div className="px-4 pt-2 pb-1">
                <span className="text-[10px] font-semibold text-[#7c3aed] uppercase tracking-widest">Detected</span>
              </div>
              {detected.map(w => {
                const kwDef = WALLETS.find(k => k.rdns === w.rdns || k.id === w.id);
                return (
                  <WalletRow
                    key={w.id}
                    name={w.name}
                    eip6963Icon={w.icon}
                    walletDef={kwDef ?? null}
                    badge="detected"
                    loading={connecting === w.id}
                    onClick={() => handleConnect(w.provider, w.id)}
                  />
                );
              })}
              <div className="h-px bg-white/[0.06] my-2" />
              <div className="px-4 pb-1">
                <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">More Wallets</span>
              </div>
            </>
          )}

          {/* All wallets */}
          {filtered.map(wallet => {
            // Skip if already shown as detected
            if (!search && (detectedRdns.has(wallet.rdns) || detectedIds.has(wallet.id))) return null;

            const detectedEntry = detected.find(d => d.rdns === wallet.rdns);
            const isDetected = !!detectedEntry;

            if (wallet.id === "walletconnect") {
              return (
                <WalletConnectRow
                  key="walletconnect"
                  currentUrl={currentUrl}
                  loading={connecting === "walletconnect"}
                />
              );
            }

            return (
              <WalletRow
                key={wallet.id}
                name={wallet.name}
                eip6963Icon={detectedEntry?.icon ?? ""}
                walletDef={wallet}
                badge={isDetected ? "detected" : "install"}
                loading={connecting === wallet.id}
                onClick={() => {
                  if (detectedEntry) {
                    handleConnect(detectedEntry.provider, wallet.id);
                  } else {
                    window.open(wallet.installUrl, "_blank");
                  }
                }}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="h-px bg-white/[0.06]" />
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Keys never leave your device
          </div>
          <a
            href="https://ethereum.org/en/wallets/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#7c3aed] hover:text-[#9f67ff] transition-colors flex items-center gap-1"
          >
            New to Web3? <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Wallet row ────────────────────────────────────────────────────
function WalletRow({ name, eip6963Icon, walletDef, badge, loading, onClick }: {
  name: string;
  eip6963Icon: string;
  walletDef: {
    bg: string; textColor: string; initial: string; icon: string | null; popular?: boolean;
  } | null;
  badge: "detected" | "install";
  loading: boolean;
  onClick: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  // Priority: EIP-6963 icon → known URL → initials
  const showImg = (eip6963Icon || walletDef?.icon) && !imgFailed;
  const imgSrc = eip6963Icon || walletDef?.icon || "";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors group"
    >
      {/* Icon */}
      <div className={cn(
        "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden text-base font-bold",
        showImg ? "bg-white" : (walletDef?.bg ?? "bg-gray-800"),
        !showImg && (walletDef?.textColor ?? "text-white"),
      )}>
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={name}
            className="w-10 h-10 object-contain"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-lg font-bold">{walletDef?.initial ?? name[0]}</span>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 text-left">
        <p className="text-[15px] font-semibold text-white leading-tight">{name}</p>
        {badge === "detected" && (
          <p className="text-xs text-emerald-400 mt-0.5">Ready to connect</p>
        )}
      </div>

      {/* Right side */}
      {loading ? (
        <Loader2 className="w-5 h-5 text-[#7c3aed] animate-spin flex-shrink-0" />
      ) : badge === "detected" ? (
        <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex-shrink-0">
          Connect
        </span>
      ) : (
        <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0">
          Install
        </span>
      )}
    </button>
  );
}

// ── WalletConnect special row ─────────────────────────────────────
function WalletConnectRow({ currentUrl, loading }: { currentUrl: string; loading: boolean }) {
  return (
    <button
      onClick={() => window.open(`https://walletconnect.com/explorer?search=`, "_blank")}
      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] transition-colors group"
    >
      <div className="w-12 h-12 rounded-2xl bg-[#3B99FC] flex items-center justify-center flex-shrink-0">
        {/* WalletConnect wave icon */}
        <svg width="28" height="18" viewBox="0 0 28 18" fill="none">
          <path d="M5.73 3.73C10.27-0.81 17.73-0.81 22.27 3.73L22.82 4.28C23.05 4.51 23.05 4.88 22.82 5.11L20.97 6.96C20.86 7.07 20.67 7.07 20.56 6.96L19.79 6.19C16.61 3.01 11.39 3.01 8.21 6.19L7.39 7.01C7.28 7.12 7.09 7.12 6.98 7.01L5.13 5.16C4.9 4.93 4.9 4.56 5.13 4.33L5.73 3.73ZM25.63 7.13L27.28 8.78C27.51 9.01 27.51 9.38 27.28 9.61L19.76 17.13C19.53 17.36 19.16 17.36 18.93 17.13L13.71 11.91C13.66 11.86 13.56 11.86 13.51 11.91L8.29 17.13C8.06 17.36 7.69 17.36 7.46 17.13L-0.07 9.6C-0.3 9.37-0.3 9 -0.07 8.77L1.58 7.12C1.81 6.89 2.18 6.89 2.41 7.12L7.63 12.34C7.68 12.39 7.78 12.39 7.83 12.34L13.05 7.12C13.28 6.89 13.65 6.89 13.88 7.12L19.1 12.34C19.15 12.39 19.25 12.39 19.3 12.34L24.52 7.12C24.78 6.9 25.39 6.9 25.63 7.13Z" fill="white"/>
        </svg>
      </div>
      <div className="flex-1 text-left">
        <p className="text-[15px] font-semibold text-white">WalletConnect</p>
        <p className="text-xs text-gray-500 mt-0.5">400+ compatible wallets</p>
      </div>
      {loading
        ? <Loader2 className="w-5 h-5 text-[#3B99FC] animate-spin flex-shrink-0" />
        : <Wifi className="w-4 h-4 text-gray-600 group-hover:text-[#3B99FC] transition-colors flex-shrink-0" />
      }
    </button>
  );
}
