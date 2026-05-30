"use client";
import { useState } from "react";
import {
  X, Shield, Key, Eye, EyeOff, Copy, CheckCircle,
  Plus, Trash2, LogOut, Wallet, RefreshCw, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/lib/utils";
import toast from "react-hot-toast";

export interface StoredWallet {
  id: string;
  label: string;
  address: string;
  encryptedKey?: string; // btoa(privateKey)
  mnemonic?: string;     // btoa(seedPhrase)
  source: "injected" | "imported" | "generated";
  createdAt: number;
}

// ── localStorage persistence ──────────────────────────────────────────────────
const STORE_KEY  = "glowide_wallets_v2";
const ACTIVE_KEY = "glowide_active_wallet";
export function loadWallets(): StoredWallet[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]"); } catch { return []; }
}
export function saveWallets(ws: StoredWallet[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(ws));
}
export function getActiveId(): string {
  return localStorage.getItem(ACTIVE_KEY) ?? "injected";
}
export function setActiveId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

// ── Wallet details modal ──────────────────────────────────────────────────────
function WalletDetails({ wallet, onClose, onDelete }: {
  wallet: StoredWallet;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const pk     = wallet.encryptedKey ? atob(wallet.encryptedKey) : null;
  const phrase = wallet.mnemonic    ? atob(wallet.mnemonic)     : null;

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0e0e1a] border border-glow-border rounded-3xl p-5 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", wallet.source === "generated" ? "bg-emerald-500/20" : "bg-amber-500/20")}>
              {wallet.source === "generated" ? <Shield className="w-4 h-4 text-emerald-400"/> : <Key className="w-4 h-4 text-amber-400"/>}
            </div>
            <div>
              <p className="text-sm font-bold text-glow-text">{wallet.label}</p>
              <p className="text-[10px] text-glow-muted capitalize">{wallet.source} wallet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-glow-muted hover:text-glow-text rounded-lg hover:bg-glow-card"><X className="w-4 h-4"/></button>
        </div>

        {/* Address */}
        <div className="bg-glow-card border border-glow-border rounded-xl p-3">
          <p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1">Address</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-glow-text flex-1 break-all">{wallet.address}</code>
            <button onClick={() => copy(wallet.address, "Address")} className="p-1 text-glow-muted hover:text-glow-text flex-shrink-0">
              {copied === "Address" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400"/> : <Copy className="w-3.5 h-3.5"/>}
            </button>
          </div>
        </div>

        {/* Seed Phrase */}
        {phrase && (
          <div className="bg-glow-card border border-amber-500/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Secret Recovery Phrase</p>
              <div className="flex gap-1.5">
                <button onClick={() => setShowPhrase(!showPhrase)} className="p-1 text-glow-muted hover:text-glow-text">
                  {showPhrase ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                </button>
                {showPhrase && (
                  <button onClick={() => copy(phrase, "Seed phrase")} className="p-1 text-glow-muted hover:text-glow-text">
                    {copied === "Seed phrase" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400"/> : <Copy className="w-3.5 h-3.5"/>}
                  </button>
                )}
              </div>
            </div>
            {showPhrase ? (
              <div className="grid grid-cols-3 gap-1">
                {phrase.split(" ").map((w, i) => (
                  <div key={i} className="bg-glow-surface border border-glow-border/50 rounded-lg px-2 py-1 text-xs font-mono text-glow-text flex items-center gap-1">
                    <span className="text-glow-muted text-[9px] w-3">{i+1}.</span>{w}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="bg-glow-surface border border-glow-border/50 rounded-lg px-2 py-1 text-xs font-mono text-glow-muted/30">• • • •</div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Never share this with anyone</p>
          </div>
        )}

        {/* Private Key */}
        {pk && (
          <div className="bg-glow-card border border-glow-border rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-glow-muted uppercase tracking-wider font-semibold">Private Key</p>
              <div className="flex gap-1.5">
                <button onClick={() => setShowKey(!showKey)} className="p-1 text-glow-muted hover:text-glow-text">
                  {showKey ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                </button>
                {showKey && (
                  <button onClick={() => copy(pk, "Private key")} className="p-1 text-glow-muted hover:text-glow-text">
                    {copied === "Private key" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400"/> : <Copy className="w-3.5 h-3.5"/>}
                  </button>
                )}
              </div>
            </div>
            {showKey ? (
              <code className="text-xs font-mono text-amber-400 break-all block bg-glow-surface rounded-lg p-2">{pk}</code>
            ) : (
              <div className="bg-glow-surface rounded-lg p-2 text-xs text-glow-muted/30 font-mono">{"•".repeat(64)}</div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <a href={`https://testnet.arcscan.app/address/${wallet.address}`} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-glow-border text-glow-muted text-xs rounded-xl hover:bg-glow-card hover:text-glow-text transition-colors">
            View on ArcScan
          </a>
          <button onClick={() => { onDelete(wallet.id); onClose(); }}
            className="px-4 py-2.5 border border-red-500/30 text-red-400 text-xs rounded-xl hover:bg-red-500/10 transition-colors flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5"/>Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main wallet switcher modal ────────────────────────────────────────────────
interface WalletSwitcherProps {
  injectedAddress: string | null;
  wallets: StoredWallet[];
  activeId: string;
  onSwitch: (id: string, address: string, privateKey: string | null) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function WalletSwitcher({ injectedAddress, wallets, activeId, onSwitch, onAdd, onDelete, onClose }: WalletSwitcherProps) {
  const [details, setDetails] = useState<StoredWallet | null>(null);

  const WalletRow = ({ wallet, isActive }: { wallet: StoredWallet; isActive: boolean }) => (
    <div className={cn("flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer",
      isActive ? "bg-glow-accent/10 border-glow-accent/40" : "bg-glow-card border-glow-border hover:border-glow-accent/20")}>
      <button className="flex items-center gap-3 flex-1 min-w-0 text-left"
        onClick={() => {
          const pk = wallet.encryptedKey ? atob(wallet.encryptedKey) : null;
          onSwitch(wallet.id, wallet.address, pk);
        }}>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          wallet.source === "generated" ? "bg-emerald-500/15" : "bg-amber-500/15")}>
          {wallet.source === "generated" ? <Shield className="w-5 h-5 text-emerald-400"/> : <Key className="w-5 h-5 text-amber-400"/>}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-glow-text">{wallet.label}</p>
          <p className="text-[11px] font-mono text-glow-muted truncate">{truncateAddress(wallet.address, 12)}</p>
        </div>
      </button>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isActive && <span className="text-[10px] text-glow-accent bg-glow-accent/15 border border-glow-accent/30 px-2 py-0.5 rounded-full">Active</span>}
        <button onClick={() => setDetails(wallet)} className="p-1.5 text-glow-muted hover:text-glow-text rounded-lg hover:bg-glow-surface transition-colors">
          <Key className="w-3.5 h-3.5"/>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-sm bg-[#0e0e1a] border border-glow-border rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-glow-border">
            <p className="text-sm font-bold text-glow-text">Select Wallet</p>
            <button onClick={onClose} className="p-1.5 text-glow-muted hover:text-glow-text rounded-lg hover:bg-glow-card"><X className="w-4 h-4"/></button>
          </div>

          <div className="p-4 space-y-2 max-h-[60dvh] overflow-y-auto">
            {/* Connected browser wallet */}
            {injectedAddress && (
              <div className={cn("flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer",
                activeId === "injected" ? "bg-glow-accent/10 border-glow-accent/40" : "bg-glow-card border-glow-border hover:border-glow-accent/20")}
                onClick={() => onSwitch("injected", injectedAddress, null)}>
                <div className="w-10 h-10 rounded-xl bg-glow-accent/20 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-5 h-5 text-glow-accent"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-glow-text">Browser Wallet</p>
                  <p className="text-[11px] font-mono text-glow-muted truncate">{truncateAddress(injectedAddress, 12)}</p>
                  <p className="text-[10px] text-glow-muted">MetaMask / Injected</p>
                </div>
                {activeId === "injected" && <span className="text-[10px] text-glow-accent bg-glow-accent/15 border border-glow-accent/30 px-2 py-0.5 rounded-full flex-shrink-0">Active</span>}
              </div>
            )}

            {/* Stored wallets */}
            {wallets.map(w => <WalletRow key={w.id} wallet={w} isActive={activeId === w.id}/>)}

            {wallets.length === 0 && !injectedAddress && (
              <div className="py-8 text-center">
                <Wallet className="w-10 h-10 text-glow-muted/30 mx-auto mb-2"/>
                <p className="text-sm text-glow-muted">No wallets yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 pb-4">
            <button onClick={onAdd}
              className="w-full flex items-center justify-center gap-2 py-3 bg-glow-gradient text-white text-sm font-semibold rounded-xl">
              <Plus className="w-4 h-4"/>Add / Import Wallet
            </button>
          </div>
        </div>
      </div>

      {details && (
        <WalletDetails wallet={details} onClose={() => setDetails(null)} onDelete={onDelete}/>
      )}
    </>
  );
}
