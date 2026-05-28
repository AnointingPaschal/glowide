"use client";
import { useState, useEffect, useCallback } from "react";
import { useWalletStore } from "@/store/walletStore";
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Check, AlertCircle } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Arc Testnet config
const ARC_TESTNET = {
  chainId: "0x4CF072", // 5042002 in hex
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"],
  blockExplorerUrls: [process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app"],
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
    };
  }
}

export function WalletButton() {
  const { address, isConnected, isConnecting, chainId, disconnect,
          setAddress, setChainId, setConnected, setConnecting } = useWalletStore();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────
  const getProvider = () => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    return window.ethereum;
  };

  const switchToArc = async () => {
    const provider = getProvider();
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET.chainId }],
      });
    } catch (switchErr: unknown) {
      // Chain not added – add it
      if (
        typeof switchErr === "object" &&
        switchErr !== null &&
        "code" in switchErr &&
        (switchErr as { code: number }).code === 4902
      ) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET],
        });
      } else {
        throw switchErr;
      }
    }
  };

  // ── Reconnect on mount if previously connected ─────────────────────
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    // Silently check if already authorized
    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const accs = accounts as string[];
        if (accs.length > 0) {
          setAddress(accs[0]);
          setConnected(true);
          provider
            .request({ method: "eth_chainId" })
            .then((cid) => setChainId(parseInt(cid as string, 16)));
        }
      })
      .catch(() => {});

    // ── Event listeners ───────────────────────────────────────────────
    const onAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        disconnect();
      } else {
        setAddress(accs[0]);
        setConnected(true);
      }
    };

    const onChainChanged = (chainIdHex: unknown) => {
      setChainId(parseInt(chainIdHex as string, 16));
    };

    const onDisconnect = () => disconnect();

    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);
    provider.on("disconnect", onDisconnect);

    return () => {
      provider.removeListener("accountsChanged", onAccountsChanged);
      provider.removeListener("chainChanged", onChainChanged);
      provider.removeListener("disconnect", onDisconnect);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connect ───────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    setError(null);
    const provider = getProvider();

    if (!provider) {
      setError("No wallet detected. Install MetaMask or a compatible wallet.");
      return;
    }

    setConnecting(true);
    try {
      // Request accounts
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned.");
      }

      setAddress(accounts[0]);
      setConnected(true);

      // Get chain
      const cid = await provider.request({ method: "eth_chainId" }) as string;
      const numericChainId = parseInt(cid, 16);
      setChainId(numericChainId);

      // Switch to Arc Testnet if not already on it
      if (numericChainId !== 5042002) {
        await switchToArc();
        const newCid = await provider.request({ method: "eth_chainId" }) as string;
        setChainId(parseInt(newCid, 16));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed.";
      if (msg.includes("User rejected") || msg.includes("4001")) {
        setError("Connection cancelled.");
      } else {
        setError(msg);
      }
    } finally {
      setConnecting(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disconnect (clear local state) ──────────────────────────────────
  const handleDisconnect = () => {
    disconnect();
    setShowMenu(false);
  };

  // ── Copy address ─────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render: Not Connected ────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
            "bg-glow-card border-glow-border hover:border-glow-accent/60 text-glow-text hover:bg-glow-accent/10",
            isConnecting && "opacity-60 cursor-not-allowed"
          )}
        >
          {isConnecting ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="hidden sm:inline">Connecting…</span>
            </>
          ) : (
            <>
              <Wallet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Connect</span>
            </>
          )}
        </button>

        {/* Error tooltip */}
        {error && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-red-950 border border-red-700/50 rounded-xl p-3 z-50 shadow-card-shadow animate-fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-300">{error}</p>
                {error.includes("No wallet") && (
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-glow-cyan underline mt-1 inline-block"
                  >
                    Install MetaMask →
                  </a>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-300 flex-shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Connected ────────────────────────────────────────────
  const isArcNetwork = chainId === 5042002;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-glow-card border border-glow-border rounded-lg hover:border-glow-accent/40 transition-colors text-xs"
      >
        {/* Avatar */}
        <div className="w-5 h-5 rounded-full bg-glow-gradient flex items-center justify-center flex-shrink-0">
          <Wallet className="w-2.5 h-2.5 text-white" />
        </div>

        {/* Address */}
        <span className="text-glow-text font-mono font-medium hidden sm:block">
          {truncateAddress(address!)}
        </span>

        {/* Network badge */}
        <span className={cn(
          "hidden md:inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full",
          isArcNetwork
            ? "text-emerald-400 bg-emerald-500/10"
            : "text-amber-400 bg-amber-500/10"
        )}>
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            isArcNetwork ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
          )} />
          {isArcNetwork ? "Arc" : "Wrong"}
        </span>

        <ChevronDown className={cn("w-3 h-3 text-glow-muted transition-transform", showMenu && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-glow-card border border-glow-border rounded-xl shadow-card-shadow z-50 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-3 border-b border-glow-border">
              <p className="text-xs text-glow-muted mb-0.5">Connected Wallet</p>
              <p className="text-sm font-mono text-glow-text">{truncateAddress(address!, 6)}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {isArcNetwork ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Arc Testnet · 5042002
                  </span>
                ) : (
                  <button
                    onClick={switchToArc}
                    className="text-xs text-amber-400 hover:text-amber-300 underline"
                  >
                    Switch to Arc Testnet
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-1">
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Address"}
              </button>

              <a
                href={`https://testnet.arcscan.app/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View on ArcScan
              </a>

              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
