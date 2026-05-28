"use client";
import { useState, useEffect, useCallback } from "react";
import { useWalletStore } from "@/store/walletStore";
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Check, AlertTriangle } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { WalletModal } from "./WalletModal";
import type { EthereumProvider } from "@/types/ethereum";

const ARC_CHAIN_ID = 5042002;
const ARC_HEX = "0x4CF072";

export function WalletButton() {
  const { address, isConnected, chainId, disconnect, setAddress, setChainId, setConnected, setConnecting } = useWalletStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeProvider, setActiveProvider] = useState<EthereumProvider | null>(null);

  // ── Silent reconnect on mount ─────────────────────────────────────
  useEffect(() => {
    const p = window.ethereum;
    if (!p) return;
    p.request({ method: "eth_accounts" }).then((accs) => {
      const accounts = accs as string[];
      if (accounts.length) {
        setAddress(accounts[0]);
        setConnected(true);
        setActiveProvider(p);
        p.request({ method: "eth_chainId" }).then(cid => setChainId(parseInt(cid as string, 16)));
      }
    }).catch(() => {});

    const onAccounts = (accs: unknown) => {
      const a = accs as string[];
      if (a.length) { setAddress(a[0]); setConnected(true); } else { disconnect(); }
    };
    const onChain = (cid: unknown) => setChainId(parseInt(cid as string, 16));
    p.on("accountsChanged", onAccounts);
    p.on("chainChanged", onChain);
    p.on("disconnect", disconnect);
    return () => {
      p.removeListener("accountsChanged", onAccounts);
      p.removeListener("chainChanged", onChain);
      p.removeListener("disconnect", disconnect);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch to Arc ─────────────────────────────────────────────────
  const switchToArc = useCallback(async (provider: EthereumProvider) => {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_HEX }] });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: ARC_HEX,
            chainName: "Arc Testnet",
            nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
            rpcUrls: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"],
            blockExplorerUrls: [process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app"],
          }],
        });
      }
    }
  }, []);

  // ── onConnect (called from modal) ─────────────────────────────────
  const handleConnect = useCallback(async (provider: EthereumProvider) => {
    setConnecting(true);
    try {
      const accs = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (!accs.length) throw new Error("No accounts returned");
      setAddress(accs[0]);
      setConnected(true);
      setActiveProvider(provider);
      const cid = await provider.request({ method: "eth_chainId" }) as string;
      const numericId = parseInt(cid, 16);
      setChainId(numericId);
      if (numericId !== ARC_CHAIN_ID) await switchToArc(provider);
      const newCid = await provider.request({ method: "eth_chainId" }) as string;
      setChainId(parseInt(newCid, 16));
    } finally {
      setConnecting(false);
    }
  }, [setConnecting, setAddress, setConnected, setChainId, switchToArc]);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isArc = chainId === ARC_CHAIN_ID;

  if (!isConnected) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-glow-card border-glow-border hover:border-glow-accent/60 text-glow-text hover:bg-glow-accent/10 transition-all"
        >
          <Wallet className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Connect</span>
        </button>
        <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onConnect={handleConnect} />
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1.5 px-2 py-1.5 bg-glow-card border border-glow-border rounded-lg hover:border-glow-accent/40 transition-colors text-xs"
        >
          <div className="w-5 h-5 rounded-full bg-glow-gradient flex items-center justify-center flex-shrink-0">
            <Wallet className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-glow-text font-mono font-medium hidden sm:block">{truncateAddress(address!)}</span>
          <span className={cn(
            "hidden md:inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full",
            isArc ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
          )}>
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
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      Arc Testnet · 5042002
                    </span>
                  ) : (
                    <button
                      onClick={() => activeProvider && switchToArc(activeProvider)}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                    >
                      <AlertTriangle className="w-3 h-3" /> Switch to Arc Testnet
                    </button>
                  )}
                </div>
              </div>
              <div className="p-1">
                <button onClick={handleCopy} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Address"}
                </button>
                <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors">
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
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onConnect={handleConnect} />
    </>
  );
}
