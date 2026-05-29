'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useWalletStore } from '@/store/walletStore';
import { truncateAddress, copyToClipboard } from '@/lib/utils';
import { RefreshCw, Copy, CheckCircle, ExternalLink, Send, Download, ArrowLeftRight, Loader2, AlertCircle, Activity, Shield, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Official Circle / Arc asset definitions ───────────────────────
const TOKENS = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    description: 'Native gas token on Arc Testnet',
    logo: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    balanceKey: 'usdc' as const,
    decimals: 6,
    isGas: true,
    color: '#2775CA',
    bgGradient: 'from-[#2775CA]/20 to-[#1a5fa8]/10',
    border: 'border-[#2775CA]/25',
    textColor: 'text-[#60a5fa]',
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    description: 'Euro-backed stablecoin by Circle',
    logo: 'https://assets.coingecko.com/coins/images/26045/large/euro-coin.png',
    balanceKey: 'eurc' as const,
    decimals: 6,
    isGas: false,
    color: '#1A56DB',
    bgGradient: 'from-[#1A56DB]/20 to-[#1e3a8a]/10',
    border: 'border-[#1A56DB]/25',
    textColor: 'text-[#818cf8]',
  },
  {
    symbol: 'cirBTC',
    name: 'Circle Bitcoin',
    description: 'Bitcoin wrapped by Circle',
    logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    balanceKey: 'cirBTC' as const,
    decimals: 8,
    isGas: false,
    color: '#F7931A',
    bgGradient: 'from-[#F7931A]/20 to-[#92400e]/10',
    border: 'border-[#F7931A]/25',
    textColor: 'text-[#fb923c]',
  },
];

interface SendForm { to: string; amount: string; }

export default function WalletPage() {
  const { address, isConnected, balances, setBalances } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendModal, setSendModal] = useState<{ open: boolean; token: string }>({ open: false, token: '' });
  const [sendForm, setSendForm] = useState<SendForm>({ to: '', amount: '' });
  const [isSending, setIsSending] = useState(false);
  const [txHistory, setTxHistory] = useState<{ hash: string; type: string; amount: string; ts: number }[]>([]);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/wallet/balances?address=${address}`);
      if (res.ok) {
        const data = await res.json();
        if (data.balances) setBalances(data.balances);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [address, setBalances]);

  useEffect(() => {
    if (isConnected && address) fetchBalances();
  }, [isConnected, address, fetchBalances]);

  const handleCopyAddress = async () => {
    if (!address) return;
    await copyToClipboard(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!sendForm.to || !sendForm.amount) { toast.error('Fill in all fields'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(sendForm.to)) { toast.error('Invalid recipient address'); return; }
    const provider = (window as Window & { ethereum?: { request: (a: { method: string; params: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!provider || !address) { toast.error('Wallet not connected'); return; }
    setIsSending(true);
    try {
      const token = TOKENS.find(t => t.symbol === sendModal.token)!;
      const amountWei = BigInt(Math.round(parseFloat(sendForm.amount) * 10 ** token.decimals)).toString(16);
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: sendForm.to, value: `0x${amountWei}` }],
      }) as string;
      toast.success(`Transaction sent: ${txHash.slice(0, 18)}…`);
      setSendModal({ open: false, token: '' });
      setSendForm({ to: '', amount: '' });
      setTxHistory(h => [{ hash: txHash, type: `Send ${sendModal.token}`, amount: sendForm.amount, ts: Date.now() }, ...h]);
      setTimeout(fetchBalances, 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      toast.error(msg.includes('4001') ? 'Rejected by wallet' : msg.slice(0, 80));
    } finally { setIsSending(false); }
  };

  const tokenBalance = (key: 'usdc' | 'eurc' | 'cirBTC') =>
    parseFloat(balances[key] ?? '0').toFixed(key === 'cirBTC' ? 8 : 2);

  // ── Not connected ───────────────────────────────────────────────
  if (!isConnected) {
    return (
      <AppLayout title="Wallet">
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
          {/* Glowing wallet icon */}
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-glow-accent/30 to-glow-cyan/20 border border-glow-accent/30 flex items-center justify-center shadow-glow-lg">
              <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                <path d="M21 7H3C2.4 7 2 7.4 2 8V19C2 19.6 2.4 20 3 20H21C21.6 20 22 19.6 22 19V8C22 7.4 21.6 7 21 7Z" stroke="url(#wg)" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M16 7V5C16 4.4 15.6 4 15 4H5C4.4 4 4 4.4 4 5V7" stroke="url(#wg)" strokeWidth="1.5"/>
                <circle cx="17" cy="13.5" r="1.5" fill="#9f67ff"/>
                <defs><linearGradient id="wg" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse"><stop stopColor="#7c3aed"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs>
              </svg>
            </div>
            <div className="absolute inset-0 rounded-3xl bg-glow-accent/10 animate-ping" />
          </div>
          <h2 className="text-2xl font-bold text-glow-text mb-2">Your Web3 Wallet</h2>
          <p className="text-glow-muted max-w-sm mb-8 text-sm leading-relaxed">
            Connect your wallet to view balances, transfer assets, and interact with Arc Testnet.
          </p>
          <WalletButton />
          <p className="text-xs text-glow-muted mt-4">Supports MetaMask, Coinbase, Rainbow, Trust &amp; more</p>
        </div>
      </AppLayout>
    );
  }

  // ── Connected ───────────────────────────────────────────────────
  return (
    <AppLayout title="Wallet">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

        {/* ── Portfolio card ─────────────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden border border-glow-accent/20 bg-gradient-to-br from-glow-accent/10 via-glow-surface to-glow-cyan/5 p-6">
          {/* Background decoration */}
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-glow-accent/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-glow-cyan/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              {/* Wallet address */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-glow-gradient flex items-center justify-center shadow-glow-sm flex-shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 7H3a1 1 0 00-1 1v11a1 1 0 001 1h18a1 1 0 001-1V8a1 1 0 00-1-1z"/><path d="M16 7V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2"/><circle cx="17" cy="13.5" r="1.5" fill="currentColor" stroke="none"/></svg>
                </div>
                <div>
                  <p className="text-xs text-glow-muted">Connected Wallet</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono text-glow-text font-medium">{truncateAddress(address!, 8)}</span>
                    <button onClick={handleCopyAddress} className="text-glow-muted hover:text-glow-text transition-colors">
                      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer" className="text-glow-muted hover:text-glow-cyan transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="success" className="text-xs">Connected</Badge>
                <Badge variant="info" className="text-xs">Arc Testnet · 5042002</Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setSendModal({ open: true, token: 'USDC' })} className="gap-1.5">
                <Send className="w-3.5 h-3.5" />Send
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCopyAddress} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />Receive
              </Button>
              <Button variant="ghost" size="icon" onClick={fetchBalances} className={loading ? 'animate-spin' : ''}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Token balances ─────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-glow-muted uppercase tracking-wider mb-3">Circle Assets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TOKENS.map(token => (
              <div key={token.symbol} className={`rounded-2xl border bg-gradient-to-br ${token.bgGradient} ${token.border} p-4 flex flex-col gap-3`}>
                {/* Token header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <TokenLogo src={token.logo} symbol={token.symbol} color={token.color} />
                    <div>
                      <p className="text-sm font-bold text-glow-text">{token.symbol}</p>
                      <p className="text-[10px] text-glow-muted">{token.name}</p>
                    </div>
                  </div>
                  {token.isGas && (
                    <Badge variant="warning" className="text-[10px]">Gas</Badge>
                  )}
                </div>

                {/* Balance */}
                <div>
                  {loading ? (
                    <div className="h-7 w-24 bg-glow-border/40 rounded animate-pulse" />
                  ) : (
                    <p className={`text-2xl font-bold ${token.textColor}`}>{tokenBalance(token.balanceKey)}</p>
                  )}
                  <p className="text-[10px] text-glow-muted mt-0.5">{token.description}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSendModal({ open: true, token: token.symbol })}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-xl bg-glow-card border border-glow-border text-glow-text hover:border-glow-accent/40 transition-all"
                  >
                    <Send className="w-3 h-3" />Send
                  </button>
                  <button
                    onClick={handleCopyAddress}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-xl bg-glow-card border border-glow-border text-glow-text hover:border-glow-accent/40 transition-all"
                  >
                    <Download className="w-3 h-3" />Receive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent activity ────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-glow-muted uppercase tracking-wider mb-3">Recent Activity</h2>
          <div className="rounded-2xl border border-glow-border bg-glow-card overflow-hidden">
            {txHistory.length === 0 ? (
              <div className="py-12 text-center">
                <Activity className="w-8 h-8 text-glow-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm text-glow-muted">No transactions yet</p>
                <p className="text-xs text-glow-muted/60 mt-1">Transactions made in this session will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-glow-border">
                {txHistory.map((tx, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-glow-surface flex items-center justify-center flex-shrink-0">
                      <Send className="w-4 h-4 text-glow-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-glow-text">{tx.type}</p>
                      <p className="text-xs text-glow-muted font-mono truncate">{tx.hash.slice(0,20)}…</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-glow-text">{tx.amount}</p>
                      <a href={`https://testnet.arcscan.app/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-glow-cyan">View →</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Network info + Security ────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-glow-border bg-glow-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-glow-cyan" />
              <span className="text-sm font-semibold text-glow-text">Network Info</span>
            </div>
            <div className="space-y-2 text-sm">
              {[['Network','Arc Testnet'],['Chain ID','5042002'],['Gas Token','USDC'],['RPC','rpc.testnet.arc.network'],['Explorer','testnet.arcscan.app']].map(([k,v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-glow-muted">{k}</span>
                  <span className="text-glow-text font-medium text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-glow-border bg-glow-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-glow-text">Security</span>
            </div>
            <ul className="space-y-2 text-sm">
              {['Private keys never leave your wallet','All transactions require wallet signature','Read-only access by default','No custody of your assets'].map(item => (
                <li key={item} className="flex items-center gap-2 text-glow-muted">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Send Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={sendModal.open} onClose={() => setSendModal({ open: false, token: '' })} title={`Send ${sendModal.token}`} size="sm">
        <div className="space-y-4">
          {sendModal.token && (
            <div className="flex items-center gap-3 p-3 bg-glow-surface rounded-xl border border-glow-border">
              {TOKENS.filter(t => t.symbol === sendModal.token).map(t => (
                <div key={t.symbol} className="flex items-center gap-2">
                  <TokenLogo src={t.logo} symbol={t.symbol} color={t.color} size="sm" />
                  <div>
                    <p className="text-sm font-bold text-glow-text">{t.symbol}</p>
                    <p className="text-xs text-glow-muted">Balance: {tokenBalance(t.balanceKey)} {t.symbol}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Input label="Recipient Address" placeholder="0x…" value={sendForm.to} onChange={e => setSendForm(p => ({ ...p, to: e.target.value }))} />
          <Input label={`Amount (${sendModal.token})`} type="number" placeholder="0.00" value={sendForm.amount} onChange={e => setSendForm(p => ({ ...p, amount: e.target.value }))} />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setSendModal({ open: false, token: '' })}>Cancel</Button>
            <Button variant="gradient" className="flex-1" isLoading={isSending} onClick={handleSend} disabled={!sendForm.to || !sendForm.amount}>
              <Send className="w-4 h-4 mr-2" />Send
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

// ── Token Logo component with fallback ────────────────────────────
function TokenLogo({ src, symbol, color, size = 'md' }: { src: string; symbol: string; color: string; size?: 'sm'|'md' }) {
  const [err, setErr] = useState(false);
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  if (err) {
    return (
      <div className={`${dim} rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0`} style={{ background: color }}>
        {symbol.slice(0, 2)}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={symbol} className={`${dim} rounded-full object-contain bg-white p-0.5 flex-shrink-0`} onError={() => setErr(true)} />;
}
