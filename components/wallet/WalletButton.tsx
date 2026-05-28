"use client";
import { useState } from "react";
import { useWalletStore } from "@/store/walletStore";
import { Button } from "@/components/ui/Button";
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Check } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function WalletButton() {
  const { address, isConnected, isConnecting, chainId, disconnect } = useWalletStore();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = () => {
    // In full impl: trigger wallet connection modal
    const mockAddress = "0x" + Math.random().toString(16).slice(2, 42).padEnd(40, "0");
    useWalletStore.setState({ address: mockAddress, isConnected: true, chainId: 5042002 });
  };

  if (!isConnected) {
    return (
      <Button onClick={handleConnect} isLoading={isConnecting} size="sm" variant="outline" className="gap-2">
        <Wallet className="w-3.5 h-3.5" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-1.5 bg-glow-card border border-glow-border rounded-lg hover:border-glow-accent/40 transition-colors text-sm"
      >
        <div className="w-6 h-6 rounded-full bg-glow-gradient flex items-center justify-center">
          <Wallet className="w-3 h-3 text-white" />
        </div>
        <span className="text-glow-text font-medium">{truncateAddress(address!)}</span>
        {chainId === 5042002 && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Arc
          </span>
        )}
        <ChevronDown className={cn("w-3.5 h-3.5 text-glow-muted transition-transform", showMenu && "rotate-180")} />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-glow-card border border-glow-border rounded-xl shadow-card-shadow z-50 overflow-hidden animate-fade-in">
            <div className="p-3 border-b border-glow-border">
              <p className="text-xs text-glow-muted mb-1">Connected Wallet</p>
              <p className="text-sm font-mono text-glow-text">{truncateAddress(address!, 6)}</p>
              <p className="text-xs text-glow-muted mt-0.5">Arc Testnet · Chain 5042002</p>
            </div>
            <div className="p-1">
              <button onClick={handleCopy} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 px-3 py-2 text-sm text-glow-muted hover:text-glow-text hover:bg-glow-surface rounded-lg transition-colors">
                <ExternalLink className="w-4 h-4" />
                View on ArcScan
              </a>
              <button onClick={() => { disconnect(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
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
