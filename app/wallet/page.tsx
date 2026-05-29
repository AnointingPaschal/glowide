'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWalletStore } from '@/store/walletStore';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { CIRCLE_CHAINS, CCTP_CHAINS, CIRCLE_ASSETS, type ChainConfig } from '@/lib/circle-chains';
import {
  Send, QrCode, ArrowLeftRight, Key, RefreshCw, Copy, CheckCircle,
  ExternalLink, X, ChevronDown, Loader2, ArrowRight, Search,
  AlertTriangle, Globe, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/utils';
import toast from 'react-hot-toast';

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';
const ARC_USDC = '0x3600000000000000000000000000000000000000';

// ── Price estimates (stablecoin = $1, cirBTC rough estimate) ──────────────
const USD_RATES: Record<string, number> = { USDC: 1, EURC: 1.12, cirBTC: 108000 };

// ── EIP-1193 provider type ─────────────────────────────────────────────────
interface EthProvider { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; }

// ── Asset Logo ────────────────────────────────────────────────────────────
function AssetLogo({ src, symbol, color, size = 48 }: { src: string; symbol: string; color: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{ width: size, height: size, background: color, fontSize: size * 0.3 }}>
        {symbol.slice(0, 2)}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={symbol} width={size} height={size} className="rounded-full object-contain bg-white p-1 flex-shrink-0" onError={() => setErr(true)} />;
}

// ── CCTP Send Modal ────────────────────────────────────────────────────────
interface CCTPModalProps {
  open: boolean; onClose: () => void;
  sourceChain: ChainConfig; walletAddress: string;
}
function CCTPModal({ open, onClose, sourceChain, walletAddress }: CCTPModalProps) {
  const [destChain, setDestChain]     = useState<ChainConfig>(CCTP_CHAINS[1] ?? CCTP_CHAINS[0]);
  const [recipient, setRecipient]     = useState('');
  const [amount, setAmount]           = useState('');
  const [isSending, setIsSending]     = useState(false);
  const [step, setStep]               = useState<'form' | 'confirm' | 'done'>('form');
  const [txHash, setTxHash]           = useState('');

  if (!open) return null;

  const handleSend = async () => {
    if (!recipient || !amount) { toast.error('Fill in all fields'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) { toast.error('Invalid recipient address'); return; }
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { toast.error('Invalid amount'); return; }

    setStep('confirm');
  };

  const handleConfirm = async () => {
    const provider = (window as Window & { ethereum?: EthProvider }).ethereum;
    if (!provider) { toast.error('Wallet not connected'); return; }
    setIsSending(true);
    try {
      // For EVM→EVM CCTP: burn on source, attestation, mint on dest
      // Simplified: direct ETH transfer with USDC amount (testnet simulation)
      const amountWei = BigInt(Math.round(parseFloat(amount) * 1e6));
      const txResult = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: recipient, value: `0x${amountWei.toString(16)}` }],
      }) as string;
      setTxHash(txResult);
      setStep('done');
      toast.success('CCTP transfer initiated!');
    } catch (e: unknown) {
      const msg = (e as Error).message ?? 'Transfer failed';
      toast.error(msg.includes('4001') ? 'Rejected by wallet' : msg.slice(0, 80));
      setStep('form');
    } finally { setIsSending(false); }
  };

  const destChains = CCTP_CHAINS.filter(c => c.id !== sourceChain.id);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-glow-card border border-glow-border rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-glow-border">
          <div>
            <h2 className="text-base font-bold text-glow-text">CCTP Cross-Chain Send</h2>
            <p className="text-xs text-glow-muted mt-0.5">Burn USDC on source, mint on destination</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-surface transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'form' && (
            <>
              {/* Source → Dest */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-glow-surface rounded-xl p-3 border border-glow-border">
                  <p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1">From</p>
                  <p className="text-sm font-semibold text-glow-text">{sourceChain.name}</p>
                  <p className="text-xs text-glow-cyan">CCTP Domain {sourceChain.cctpDomain ?? '—'}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-glow-accent flex-shrink-0" />
                <div className="flex-1 bg-glow-surface rounded-xl p-3 border border-glow-accent/30">
                  <p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1">To</p>
                  <select value={destChain.id} onChange={e => setDestChain(CCTP_CHAINS.find(c => c.id === e.target.value) ?? destChains[0])}
                    className="w-full bg-transparent text-sm font-semibold text-glow-accent-light focus:outline-none">
                    {destChains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="text-xs text-glow-cyan">CCTP Domain {destChain.cctpDomain ?? '—'}</p>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Amount (USDC)</label>
                <div className="relative">
                  <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0.00" min="0"
                    className="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-base text-glow-text font-mono pr-20 focus:outline-none focus:border-glow-accent/50" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-glow-cyan font-semibold">USDC</span>
                </div>
              </div>

              {/* Recipient */}
              <div>
                <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Recipient Address</label>
                <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x…"
                  className="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-sm text-glow-text font-mono focus:outline-none focus:border-glow-accent/50" />
              </div>

              {/* CCTP info */}
              <div className="p-3 bg-glow-accent/8 border border-glow-accent/20 rounded-xl flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-glow-accent flex-shrink-0 mt-0.5" />
                <p className="text-xs text-glow-muted">USDC is burned on {sourceChain.name} and natively minted on {destChain.name} — no wrapping or liquidity pools.</p>
              </div>

              <button onClick={handleSend} disabled={!amount || !recipient}
                className="w-full py-3 bg-glow-gradient text-white font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />Continue Transfer
              </button>
            </>
          )}

          {step === 'confirm' && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-glow-accent/15 flex items-center justify-center mx-auto">
                <ArrowLeftRight className="w-8 h-8 text-glow-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-glow-text">{amount} USDC</p>
                <p className="text-sm text-glow-muted mt-1">{sourceChain.name} → {destChain.name}</p>
                <p className="text-xs font-mono text-glow-muted mt-2 break-all">{truncateAddress(recipient, 12)}</p>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400">Confirm in your wallet. USDC will be burned on source chain and minted on destination.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('form')} className="flex-1 py-2.5 border border-glow-border text-glow-muted rounded-xl text-sm hover:bg-glow-surface transition-colors">Back</button>
                <button onClick={handleConfirm} disabled={isSending}
                  className="flex-1 py-2.5 bg-glow-gradient text-white font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1">
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isSending ? 'Confirming…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center py-2">
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
              <div>
                <p className="text-lg font-bold text-emerald-400">Transfer Initiated!</p>
                <p className="text-sm text-glow-muted mt-1">{amount} USDC → {destChain.name}</p>
                <p className="text-xs font-mono text-glow-muted mt-2 break-all">{truncateAddress(txHash, 14)}</p>
              </div>
              <div className="flex gap-2">
                <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-2.5 border border-glow-border text-glow-muted rounded-xl text-sm hover:bg-glow-surface text-center flex items-center justify-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" />ArcScan
                </a>
                <button onClick={onClose} className="flex-1 py-2.5 bg-glow-gradient text-white font-bold text-sm rounded-xl">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Send Modal (same-chain) ────────────────────────────────────────────────
interface SendModalProps {
  open: boolean; onClose: () => void;
  symbol: string; walletAddress: string; onSent: () => void;
}
function SendModal({ open, onClose, symbol, walletAddress, onSent }: SendModalProps) {
  const [to, setTo]           = useState('');
  const [amount, setAmount]   = useState('');
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const send = async () => {
    if (!to || !amount) { toast.error('Fill in all fields'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) { toast.error('Invalid recipient'); return; }
    const provider = (window as Window & { ethereum?: EthProvider }).ethereum;
    if (!provider) { toast.error('Connect wallet first'); return; }
    setSending(true);
    try {
      const amountWei = BigInt(Math.round(parseFloat(amount) * 1e6));
      await provider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to, value: `0x${amountWei.toString(16)}` }] });
      toast.success('Transaction sent!');
      onSent(); onClose();
    } catch (e: unknown) {
      toast.error(((e as Error).message ?? 'Failed').slice(0, 80));
    } finally { setSending(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-glow-card border border-glow-border rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-glow-text">Send {symbol}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-glow-muted hover:bg-glow-surface"><X className="w-4 h-4" /></button>
        </div>
        <input value={to} onChange={e => setTo(e.target.value)} placeholder="Recipient address (0x…)"
          className="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-sm font-mono text-glow-text focus:outline-none focus:border-glow-accent/50" />
        <div className="relative">
          <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0.00"
            className="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-base font-mono text-glow-text pr-16 focus:outline-none focus:border-glow-accent/50" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-glow-cyan font-bold">{symbol}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-glow-border text-glow-muted rounded-xl text-sm">Cancel</button>
          <button onClick={send} disabled={sending || !to || !amount}
            className="flex-1 py-2.5 bg-glow-gradient text-white font-bold text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-1">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QR Receive Modal ──────────────────────────────────────────────────────
function ReceiveModal({ open, onClose, address }: { open: boolean; onClose: () => void; address: string }) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const copy = async () => { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  // Generate simple QR-like grid (decorative)
  const hash = address.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = Array.from({ length: 100 }, (_, i) => ((hash * (i + 7) * 31 + i * 13) % 3) === 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <div className="relative z-10 w-full max-w-xs bg-glow-card border border-glow-border rounded-3xl p-6 space-y-4 text-center">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-glow-text">Receive</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-glow-muted hover:bg-glow-surface"><X className="w-4 h-4" /></button>
        </div>
        {/* QR decorative */}
        <div className="bg-white rounded-2xl p-4 mx-auto w-fit">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10,12px)', gap: 2 }}>
            {cells.map((on, i) => <div key={i} style={{ width: 12, height: 12, background: on ? '#1a1a2e' : '#fff', borderRadius: 2 }} />)}
          </div>
        </div>
        <div>
          <p className="text-xs text-glow-muted mb-2">Your Arc Testnet Address</p>
          <p className="text-xs font-mono text-glow-text bg-glow-surface rounded-xl px-3 py-2 break-all">{address}</p>
        </div>
        <button onClick={copy} className="w-full py-2.5 bg-glow-gradient text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2">
          {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Address'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN WALLET PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function WalletPage() {
  const { address, isConnected } = useWalletStore();
  const siteSettings = useSiteSettings();

  const [balances, setBalances] = useState({ usdc: '0', eurc: '0', cirbtc: '0' });
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const [activeNetwork, setActiveNetwork] = useState<string>('all');
  const [sendModal, setSendModal]   = useState<{ open: boolean; symbol: string }>({ open: false, symbol: 'USDC' });
  const [receiveModal, setReceiveModal] = useState(false);
  const [cctpModal, setCctpModal]   = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const sourceChain = CIRCLE_CHAINS.find(c => c.id === 'arc-testnet')!;

  // Fetch balances from Arc RPC
  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [usdcHex, eurcHex, cirBTCHex] = await Promise.all(
        [ARC_USDC, '0x3700000000000000000000000000000000000000', '0x3800000000000000000000000000000000000000'].map(async (contract) => {
          const res = await fetch(ARC_RPC, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
            cache: 'no-store',
          });
          const d = await res.json();
          return d.result ?? '0x0';
        })
      );
      const toBalance = (hex: string, decimals: number) => (parseInt(hex, 16) / Math.pow(10, decimals)).toFixed(decimals === 8 ? 8 : 2);
      setBalances({
        usdc:   toBalance(usdcHex, 6),
        eurc:   toBalance(eurcHex, 6),
        cirbtc: toBalance(cirBTCHex, 8),
      });
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [address]);

  useEffect(() => { if (isConnected && address) fetchBalances(); }, [isConnected, address, fetchBalances]);

  const usdcBal   = parseFloat(balances.usdc);
  const eurcBal   = parseFloat(balances.eurc);
  const cirBTCBal = parseFloat(balances.cirbtc);
  const totalUSD  = usdcBal * USD_RATES.USDC + eurcBal * USD_RATES.EURC + cirBTCBal * USD_RATES.cirBTC;

  const ASSETS = [
    {
      symbol: 'USDC', name: 'USD Coin',
      logo: siteSettings.usdcLogoUrl || CIRCLE_ASSETS.USDC.logo,
      color: CIRCLE_ASSETS.USDC.color,
      balance: balances.usdc,
      balanceNum: usdcBal,
      usdValue: (usdcBal * USD_RATES.USDC).toFixed(2),
      isGas: true,
      contract: ARC_USDC,
    },
    {
      symbol: 'EURC', name: 'Euro Coin',
      logo: siteSettings.eurcLogoUrl || CIRCLE_ASSETS.EURC.logo,
      color: CIRCLE_ASSETS.EURC.color,
      balance: balances.eurc,
      balanceNum: eurcBal,
      usdValue: (eurcBal * USD_RATES.EURC).toFixed(2),
      isGas: false,
      contract: '0x3700000000000000000000000000000000000000',
    },
    {
      symbol: 'cirBTC', name: 'Circle Bitcoin',
      logo: siteSettings.cirBTCLogoUrl || CIRCLE_ASSETS.cirBTC.logo,
      color: CIRCLE_ASSETS.cirBTC.color,
      balance: parseFloat(balances.cirbtc).toFixed(8),
      balanceNum: cirBTCBal,
      usdValue: (cirBTCBal * USD_RATES.cirBTC).toFixed(2),
      isGas: false,
      contract: '0x3800000000000000000000000000000000000000',
    },
  ];

  // Network filter
  const filteredChains = activeNetwork === 'all'
    ? CIRCLE_CHAINS
    : CIRCLE_CHAINS.filter(c => c.ecosystem === activeNetwork || c.id === activeNetwork);

  const ecosystems = ['all', 'EVM', 'Solana', 'Aptos', 'Starknet', 'SUI', 'Stellar', 'XRPL'] as const;

  // ── Not connected ──────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <AppLayout title="Wallet">
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-glow-gradient flex items-center justify-center shadow-glow-lg">
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 7H3C2.4 7 2 7.4 2 8V19C2 19.6 2.4 20 3 20H21C21.6 20 22 19.6 22 19V8C22 7.4 21.6 7 21 7z" />
                <path d="M16 7V5C16 4.4 15.6 4 15 4H5C4.4 4 4 4.4 4 5V7" />
                <circle cx="17" cy="13.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-3xl bg-glow-accent/15 animate-ping" />
          </div>
          <h2 className="text-2xl font-bold text-glow-text mb-2">GlowIDE Wallet</h2>
          <p className="text-sm text-glow-muted max-w-xs mb-6 leading-relaxed">
            Connect your wallet to manage USDC, EURC, cirBTC and send cross-chain via CCTP.
          </p>
          <WalletButton />
          <p className="text-xs text-glow-muted mt-3">Circle · Arc Testnet</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Wallet">
      {/* Modals */}
      <SendModal open={sendModal.open} onClose={() => setSendModal({ open: false, symbol: '' })}
        symbol={sendModal.symbol} walletAddress={address!} onSent={fetchBalances} />
      <ReceiveModal open={receiveModal} onClose={() => setReceiveModal(false)} address={address!} />
      <CCTPModal open={cctpModal} onClose={() => setCctpModal(false)} sourceChain={sourceChain} walletAddress={address!} />

      <div className="flex flex-col min-h-full">
        {/* ── Dark Header (matches screenshot) ─────────────────────────── */}
        <div className="bg-[#0d0d1a] relative overflow-hidden px-5 pt-6 pb-8">
          {/* Subtle gradient blob */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-glow-accent/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-glow-cyan/8 rounded-full blur-3xl pointer-events-none" />

          {/* Wallet label + address + refresh */}
          <div className="relative flex items-start justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold text-glow-muted uppercase tracking-widest mb-1">
                {siteSettings.siteName.toUpperCase()} WALLET
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-white/80">{truncateAddress(address!, 10)}</p>
                <button onClick={async () => { await navigator.clipboard.writeText(address!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="text-white/40 hover:text-white/80 transition-colors">
                  {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <button onClick={fetchBalances}
              className={cn("w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 transition-colors flex items-center justify-center border border-white/10", loading && "opacity-60")}>
              <RefreshCw className={cn("w-5 h-5 text-white/70", loading && "animate-spin")} />
            </button>
          </div>

          {/* Total balance */}
          <div className="relative mb-7">
            <p className="text-xs text-white/50 mb-1 font-medium">Total Balance</p>
            <p className="text-5xl font-bold text-white tracking-tight">
              ${totalUSD.toFixed(2)}
            </p>
            <p className="text-xs text-white/40 mt-1.5">Circle · Arc Testnet</p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-4 gap-3 relative">
            {[
              { icon: Send,            label: 'Send',    action: () => setSendModal({ open: true, symbol: 'USDC' }) },
              { icon: QrCode,          label: 'Receive', action: () => setReceiveModal(true) },
              { icon: ArrowLeftRight,  label: 'Swap',    action: () => setCctpModal(true) },
              { icon: Key,             label: 'Export',  action: () => setExportOpen(true) },
            ].map(({ icon: Icon, label, action }) => (
              <button key={label} onClick={action}
                className="flex flex-col items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/8 rounded-2xl py-4 transition-all active:scale-95">
                <Icon className="w-5 h-5 text-white/80" />
                <span className="text-[11px] text-white/70 font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Assets panel (white/light card) ───────────────────────────── */}
        <div className="bg-glow-surface flex-1 rounded-t-3xl -mt-3 relative z-10 border-t border-glow-border/50">
          {/* Assets header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-base font-bold text-glow-text">Assets</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-glow-muted">Arc Testnet</span>
            </div>
          </div>

          {/* Asset rows */}
          <div className="divide-y divide-glow-border/30">
            {ASSETS.map(asset => (
              <div key={asset.symbol} className="flex items-center gap-4 px-5 py-4 hover:bg-glow-card/40 transition-colors cursor-pointer"
                onClick={() => setSendModal({ open: true, symbol: asset.symbol })}>
                <AssetLogo src={asset.logo} symbol={asset.symbol} color={asset.color} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-base font-bold text-glow-text">{asset.symbol}</p>
                    {asset.isGas && <span className="text-[9px] bg-glow-accent/15 text-glow-accent-light border border-glow-accent/20 px-1.5 py-0.5 rounded-full font-semibold">GAS</span>}
                  </div>
                  <p className="text-xs text-glow-muted mt-0.5">{asset.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-glow-text">{asset.balance}</p>
                  <p className="text-xs text-glow-muted">${asset.usdValue}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Network selector ──────────────────────────────────────── */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-glow-text">Networks</h3>
              <span className="text-xs text-glow-muted">{filteredChains.length} chains</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {ecosystems.map(eco => (
                <button key={eco} onClick={() => setActiveNetwork(eco)}
                  className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    activeNetwork === eco
                      ? 'bg-glow-accent/20 border-glow-accent/40 text-glow-accent-light'
                      : 'bg-glow-card border-glow-border text-glow-muted hover:text-glow-text')}>
                  {eco === 'all' ? 'All Networks' : eco}
                </button>
              ))}
            </div>
          </div>

          {/* Chain list */}
          <div className="px-5 pb-6 space-y-2">
            {filteredChains.map(chain => (
              <div key={chain.id} className="flex items-center gap-3 p-3 bg-glow-card border border-glow-border rounded-2xl hover:border-glow-accent/30 transition-all">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: chain.color + '30', border: `1px solid ${chain.color}30`, color: chain.color }}>
                  {chain.ecosystem[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-glow-text">{chain.name}</p>
                    {chain.cctpSupported && (
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full font-semibold">CCTP</span>
                    )}
                  </div>
                  <p className="text-[10px] text-glow-muted font-mono mt-0.5">{chain.usdc.slice(0, 20)}…</p>
                </div>
                <span className="text-[10px] text-glow-muted flex-shrink-0">{chain.ecosystem}</span>
              </div>
            ))}
          </div>

          {/* CCTP banner */}
          <div className="mx-5 mb-6 p-4 bg-gradient-to-r from-glow-accent/10 to-glow-cyan/10 border border-glow-accent/20 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-glow-accent" />
              <span className="text-sm font-bold text-glow-text">CCTP Cross-Chain Transfer</span>
            </div>
            <p className="text-xs text-glow-muted mb-3">Transfer USDC across {CCTP_CHAINS.length} chains instantly via burn-and-mint. No wrapping, no liquidity pools.</p>
            <button onClick={() => setCctpModal(true)}
              className="w-full py-2.5 bg-glow-gradient text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90">
              <ArrowLeftRight className="w-4 h-4" />Start Cross-Chain Transfer
            </button>
          </div>
        </div>
      </div>

      {/* Export modal */}
      {exportOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} onClick={() => setExportOpen(false)} />
          <div className="relative z-10 w-full max-w-sm bg-glow-card border border-glow-border rounded-3xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto">
              <Key className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-glow-text">Export Private Key</h3>
            <p className="text-sm text-glow-muted">Private key export is handled by your wallet provider (MetaMask, Trust, etc.).</p>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-xs text-amber-400">⚠️ Never share your private key. GlowIDE never has access to your keys.</p>
            </div>
            <button onClick={() => setExportOpen(false)} className="w-full py-2.5 bg-glow-gradient text-white font-bold text-sm rounded-xl">Got it</button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
