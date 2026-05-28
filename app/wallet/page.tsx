'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useWalletStore } from '@/store/walletStore';
import { WalletButton } from '@/components/wallet/WalletButton';
import { copyToClipboard } from '@/lib/utils';
import {
  RefreshCw, Copy, CheckCircle, ExternalLink, Send, Download,
  ArrowLeftRight, Key, History, ArrowRight, Loader2, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Token definitions with real logos ────────────────────────────
const TOKENS = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    logo: 'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    color: '#2775CA',
    bg: '#EBF4FF',
    note: 'Gas token on Arc Testnet',
    decimals: 6,
    usdRate: 1.0,
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    logo: 'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/ethereum/assets/0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c/logo.png',
    color: '#1A56DB',
    bg: '#EFF6FF',
    note: 'Euro-backed stablecoin',
    decimals: 6,
    usdRate: 1.12,
  },
  {
    symbol: 'cirBTC',
    name: 'Circle Bitcoin',
    logo: 'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/bitcoin/info/logo.png',
    color: '#F7931A',
    bg: '#FFF7ED',
    note: 'Bitcoin wrapped by Circle',
    decimals: 8,
    usdRate: 108000,
  },
];

type ModalType = 'send' | 'receive' | null;

function TokenLogo({ token, size = 44 }: { token: typeof TOKENS[0]; size?: number }) {
  const [err, setErr] = useState(false);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: err ? token.color : token.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)' }}>
      {!err
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={token.logo} alt={token.symbol} style={{ width: size * 0.75, height: size * 0.75, objectFit: 'contain' }} onError={() => setErr(true)} />
        : <span style={{ color: '#fff', fontWeight: 700, fontSize: size * 0.32 }}>{token.symbol[0]}</span>
      }
    </div>
  );
}

export default function WalletPage() {
  const { address, isConnected, balances, setBalances } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [sendToken, setSendToken] = useState('USDC');
  const [sendForm, setSendForm] = useState({ to: '', amount: '' });
  const [isSending, setIsSending] = useState(false);
  const [txHistory, setTxHistory] = useState<{ hash: string; type: string; amount: string; symbol: string; time: string; status: string }[]>([]);

  const tokenBalances: Record<string, string> = {
    USDC: balances.usdc || '0.000000',
    EURC: balances.eurc || '0.000000',
    cirBTC: balances.cirBTC || '0.00000000',
  };

  const totalUSD = TOKENS.reduce((acc, t) => {
    const bal = parseFloat(tokenBalances[t.symbol] || '0');
    return acc + bal * t.usdRate;
  }, 0);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/wallet/balances?address=${address}`);
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances ?? data);
      }
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [address, setBalances]);

  useEffect(() => {
    if (address) fetchBalances();
  }, [address, fetchBalances]);

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!sendForm.to || !sendForm.amount) { toast.error('Fill in all fields'); return; }
    if (!sendForm.to.startsWith('0x') || sendForm.to.length !== 42) { toast.error('Invalid address'); return; }
    setIsSending(true);
    try {
      const provider = (window as Window & { ethereum?: { request: (a: { method: string; params: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!provider || !address) throw new Error('Wallet not connected');
      // Native transfer (USDC is gas token on Arc)
      await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: sendForm.to, value: '0x0', data: '0x' }],
      });
      toast.success('Transaction sent!');
      setModal(null);
      setSendForm({ to: '', amount: '' });
      setTimeout(fetchBalances, 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsSending(false);
    }
  };

  if (!isConnected) {
    return (
      <AppLayout title="Wallet">
        <div className="flex flex-col items-center justify-center h-[70vh] p-6 text-center">
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}>
            <Key style={{ width: 36, height: 36, color: '#fff' }} />
          </div>
          <h2 className="text-2xl font-bold text-[var(--glow-text)] mb-2">Connect Your Wallet</h2>
          <p className="text-sm text-[var(--glow-muted)] max-w-xs mb-8">Connect a wallet to view balances, transfer assets, and interact with Arc Testnet.</p>
          <WalletButton />
        </div>
      </AppLayout>
    );
  }

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-6)}` : '';

  return (
    <AppLayout title="Wallet">
      <div className="min-h-full pb-8" style={{ background: 'var(--glow-bg)' }}>
        <div className="max-w-md mx-auto px-4 pt-4 md:pt-6 space-y-4">

          {/* ── Hero card ─────────────────────────────────────────── */}
          <div style={{
            borderRadius: 24, overflow: 'hidden',
            background: 'linear-gradient(160deg, #1a1040 0%, #0d0d1f 100%)',
            border: '1px solid rgba(124,58,237,0.25)',
            boxShadow: '0 8px 40px rgba(124,58,237,0.2)',
          }}>
            {/* Top bar */}
            <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#9ca3af', textTransform: 'uppercase' }}>GlowIDE Wallet</p>
                <button onClick={() => handleCopy(address!)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#e2e8f0' }}>{shortAddr}</span>
                  {copied ? <CheckCircle style={{ width: 13, height: 13, color: '#34d399' }} /> : <Copy style={{ width: 13, height: 13, color: '#9ca3af' }} />}
                </button>
              </div>
              <button onClick={fetchBalances} disabled={isLoading} style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {isLoading ? <Loader2 style={{ width: 16, height: 16, color: '#9ca3af' }} className="animate-spin" /> : <RefreshCw style={{ width: 16, height: 16, color: '#9ca3af' }} />}
              </button>
            </div>

            {/* Balance */}
            <div style={{ padding: '8px 20px 20px' }}>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Total Balance</p>
              <p style={{ fontSize: 40, fontWeight: 800, color: '#ffffff', letterSpacing: '-1px', lineHeight: 1.1 }}>
                ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p style={{ fontSize: 12, color: '#7c86a0', marginTop: 6 }}>Circle · Arc Testnet</p>
            </div>

            {/* Action buttons */}
            <div style={{ padding: '0 16px 20px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: 'Send',    icon: Send,           white: true,  action: () => setModal('send') },
                { label: 'Receive', icon: Download,       white: false, action: () => setModal('receive') },
                { label: 'Swap',    icon: ArrowLeftRight, white: false, action: () => toast('Coming soon') },
                { label: 'Export',  icon: Key,            white: false, action: () => toast('Coming soon') },
              ].map(btn => {
                const Icon = btn.icon;
                return (
                  <button key={btn.label} onClick={btn.action} style={{
                    borderRadius: 16, padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none', transition: 'opacity 0.15s',
                    background: btn.white ? '#ffffff' : 'rgba(255,255,255,0.1)',
                    color: btn.white ? '#0d0d1f' : '#e2e8f0',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <Icon style={{ width: 20, height: 20 }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Assets card ───────────────────────────────────────── */}
          <div style={{ borderRadius: 20, background: 'var(--glow-surface)', border: '1px solid var(--glow-border)', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glow-border)' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--glow-text)' }}>Assets</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: 'var(--glow-muted)' }}>Arc Testnet</span>
              </div>
            </div>

            {/* Token rows */}
            {TOKENS.map((token, i) => {
              const bal = parseFloat(tokenBalances[token.symbol] || '0');
              const usd = bal * token.usdRate;
              return (
                <div key={token.symbol} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: i < TOKENS.length - 1 ? '1px solid var(--glow-border)' : 'none' }}>
                  <TokenLogo token={token} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--glow-text)', margin: 0 }}>{token.symbol}</p>
                    <p style={{ fontSize: 12, color: 'var(--glow-muted)', margin: '2px 0 0' }}>{token.name}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--glow-text)', margin: 0 }}>
                      {token.symbol === 'cirBTC' ? bal.toFixed(8) : bal.toFixed(2)}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--glow-muted)', margin: '2px 0 0' }}>
                      ${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Full address row */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--glow-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--glow-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => handleCopy(address!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--glow-muted)', padding: 4 }}>
                  {copied ? <CheckCircle style={{ width: 15, height: 15, color: '#34d399' }} /> : <Copy style={{ width: 15, height: 15 }} />}
                </button>
                <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--glow-muted)', padding: 4 }}>
                  <ExternalLink style={{ width: 15, height: 15 }} />
                </a>
              </div>
            </div>
          </div>

          {/* ── Transaction History ────────────────────────────────── */}
          <button
            onClick={() => toast('Transaction history coming soon')}
            style={{ width: '100%', borderRadius: 20, background: 'var(--glow-surface)', border: '1px solid var(--glow-border)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', boxShadow: 'var(--card-shadow)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glow-border)')}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <History style={{ width: 20, height: 20, color: '#7c3aed' }} />
            </div>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--glow-text)', textAlign: 'left' }}>Transaction History</span>
            <ArrowRight style={{ width: 18, height: 18, color: 'var(--glow-muted)' }} />
          </button>

          {/* ── Send shortcut ──────────────────────────────────────── */}
          <button
            onClick={() => setModal('send')}
            style={{ width: '100%', borderRadius: 20, background: 'var(--glow-surface)', border: '1px solid var(--glow-border)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', boxShadow: 'var(--card-shadow)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glow-border)')}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send style={{ width: 20, height: 20, color: '#06b6d4' }} />
            </div>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--glow-text)', textAlign: 'left' }}>Send</span>
            <ArrowRight style={{ width: 18, height: 18, color: 'var(--glow-muted)' }} />
          </button>
        </div>
      </div>

      {/* ── Send Modal ────────────────────────────────────────────── */}
      <Modal isOpen={modal === 'send'} onClose={() => setModal(null)} title="Send Assets" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--glow-muted)] mb-1.5">Token</label>
            <div className="flex gap-2">
              {TOKENS.map(t => (
                <button key={t.symbol} onClick={() => setSendToken(t.symbol)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${sendToken === t.symbol ? 'bg-[var(--glow-accent)]/20 border-[var(--glow-accent)]/50 text-[var(--glow-accent-light)]' : 'bg-[var(--glow-card)] border-[var(--glow-border)] text-[var(--glow-muted)]'}`}>
                  {t.symbol}
                </button>
              ))}
            </div>
          </div>
          <Input label="Recipient Address" placeholder="0x..." value={sendForm.to} onChange={e => setSendForm(p => ({ ...p, to: e.target.value }))} />
          <Input label={`Amount (${sendToken})`} type="number" placeholder="0.00" value={sendForm.amount} onChange={e => setSendForm(p => ({ ...p, amount: e.target.value }))}
            hint={`Available: ${tokenBalances[sendToken]} ${sendToken}`} />
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Double-check the recipient address. Transactions are irreversible.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="gradient" className="flex-1" isLoading={isSending} onClick={handleSend} disabled={!sendForm.to || !sendForm.amount}>
              <Send className="w-4 h-4 mr-2" />Send
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Receive Modal ─────────────────────────────────────────── */}
      <Modal isOpen={modal === 'receive'} onClose={() => setModal(null)} title="Receive Assets" size="sm">
        <div className="space-y-4 text-center">
          {/* QR placeholder */}
          <div className="w-48 h-48 mx-auto rounded-2xl bg-white flex items-center justify-center border-4 border-[var(--glow-border)] overflow-hidden">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${address}&bgcolor=ffffff&color=0d0d1f`} alt="QR Code" className="w-44 h-44" />
          </div>
          <div>
            <p className="text-xs text-[var(--glow-muted)] mb-1">Your Arc Testnet address</p>
            <p className="text-xs font-mono text-[var(--glow-text)] break-all bg-[var(--glow-card)] rounded-xl p-3">{address}</p>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => { handleCopy(address!); toast.success('Address copied!'); }}>
            {copied ? <CheckCircle className="w-4 h-4 mr-2 text-emerald-400" /> : <Copy className="w-4 h-4 mr-2" />}
            Copy Address
          </Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
