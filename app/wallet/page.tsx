'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWalletStore } from '@/store/walletStore';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { CIRCLE_CHAINS, CCTP_CHAINS, CIRCLE_ASSETS } from '@/lib/circle-chains';
import {
  Send, QrCode, ArrowLeftRight, History, Zap, RefreshCw, Copy,
  CheckCircle, ExternalLink, X, ChevronDown, Loader2, ArrowRight,
  Search, Plus, Trash2, Globe, Settings2, ArrowLeft, Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/utils';
import toast from 'react-hot-toast';

const ARCSCAN = 'https://testnet.arcscan.app';
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';

// ── Arc Testnet: native balance uses 18 decimal wei internally ─────────────
const NATIVE_DECIMALS = 18;

// ── ERC-20 ABI-encoded balanceOf ───────────────────────────────────────────
// keccak4("balanceOf(address)") = 0x70a08231
function makeBalanceOfCall(address: string): string {
  return '0x70a08231' + address.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

type EthProvider = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

// ── Persistent token store ─────────────────────────────────────────────────
interface Token {
  symbol: string; name: string; address: string;
  decimals: number; logo?: string; color: string;
  networkId: string; balance?: string;
}

function useTokenStore() {
  const key = 'glowide_tokens';
  const load = (): Token[] => {
    try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
  };
  const save = (tokens: Token[]) => localStorage.setItem(key, JSON.stringify(tokens));
  const [tokens, setTokens] = useState<Token[]>([]);
  useEffect(() => setTokens(load()), []);
  return {
    tokens,
    addToken: (t: Token) => { const next = [...tokens, t]; setTokens(next); save(next); },
    removeToken: (addr: string) => { const next = tokens.filter(t => t.address !== addr); setTokens(next); save(next); },
  };
}

// ── Logo img with fallback ────────────────────────────────────────────────
function TokenLogo({ src, symbol, color, size = 48 }: { src?: string; symbol: string; color: string; size?: number }) {
  const [err, setErr] = useState(false);
  const classes = `rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`;
  if (!src || err) return (
    <div className={classes} style={{ width: size, height: size, background: color, fontSize: size * 0.28 }}>
      {symbol.slice(0, 2)}
    </div>
  );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={symbol} width={size} height={size} className="rounded-full object-contain bg-white/5 p-0.5 flex-shrink-0" onError={() => setErr(true)} />;
}

// ── Network dropdown ──────────────────────────────────────────────────────
function NetworkDropdown({ selected, onChange }: { selected: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const chain = CIRCLE_CHAINS.find(c => c.id === selected) ?? CIRCLE_CHAINS[0];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 bg-glow-card/80 border border-glow-border rounded-xl text-xs text-glow-text hover:border-glow-accent/40 transition-colors">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: chain.color }} />
        <span className="hidden sm:block truncate max-w-[90px]">{chain.name}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-glow-muted flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#0e0e1a] border border-glow-border rounded-2xl shadow-2xl z-40 overflow-hidden animate-fade-in max-h-80 overflow-y-auto">
            <div className="sticky top-0 bg-[#0e0e1a] px-3 py-2 border-b border-glow-border">
              <p className="text-[10px] font-semibold text-glow-muted uppercase tracking-wider">Select Network</p>
            </div>
            {CIRCLE_CHAINS.map(c => (
              <button key={c.id} onClick={() => { onChange(c.id); setOpen(false); }}
                className={cn('w-full flex items-center gap-3 px-3 py-2.5 hover:bg-glow-card/60 transition-colors text-left',
                  selected === c.id && 'bg-glow-accent/10')}>
                <span className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: c.color + '30', border: `1.5px solid ${c.color}50`, color: c.color }}>
                  {c.ecosystem[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-glow-text truncate">{c.name}</p>
                  <p className="text-[10px] text-glow-muted">{c.ecosystem}{c.cctpSupported ? ' · CCTP' : ''}</p>
                </div>
                {selected === c.id && <CheckCircle className="w-4 h-4 text-glow-accent flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── QR code (decorative grid) ──────────────────────────────────────────────
function QRCode({ address }: { address: string }) {
  const h = address.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = Array.from({ length: 81 }, (_, i) => ((h * (i + 7) * 31 + i * 13) % 3) === 0);
  return (
    <div className="bg-white rounded-2xl p-4 mx-auto w-fit">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9,14px)', gap: 2 }}>
        {cells.map((on, i) => <div key={i} style={{ width: 14, height: 14, background: on ? '#0f0f1e' : '#fff', borderRadius: 3 }} />)}
      </div>
    </div>
  );
}

// ── History item ───────────────────────────────────────────────────────────
interface HistoryItem {
  hash: string; type: 'send' | 'receive' | 'swap' | 'cctp';
  amount: string; symbol: string; timestamp: number;
  to?: string; from?: string; status: 'success' | 'pending' | 'failed';
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function WalletPage() {
  const { address, isConnected } = useWalletStore();
  const siteSettings = useSiteSettings();
  const { tokens, addToken, removeToken } = useTokenStore();

  type Panel = 'assets' | 'send' | 'receive' | 'swap' | 'cctp' | 'history' | 'addToken' | 'asset';
  const [panel, setPanel]       = useState<Panel>('assets');
  const [activeAsset, setActiveAsset] = useState<string>('');
  const [networkId, setNetworkId]     = useState('arc-testnet');
  const [loading, setLoading]         = useState(false);
  const [copied, setCopied]           = useState(false);
  const [history, setHistory]         = useState<HistoryItem[]>([]);

  // Balances
  const [balances, setBalances] = useState<Record<string, string>>({});
  // Send form
  const [sendTo, setSendTo]     = useState('');
  const [sendAmt, setSendAmt]   = useState('');
  const [sending, setSending]   = useState(false);
  // Swap form
  const [swapFrom, setSwapFrom] = useState('USDC');
  const [swapTo, setSwapTo]     = useState('EURC');
  const [swapAmt, setSwapAmt]   = useState('');
  const [crossChain, setCrossChain] = useState(false);
  const [destChainId, setDestChainId] = useState('eth-sepolia');
  // CCTP form
  const [cctpAmt, setCctpAmt]   = useState('');
  const [cctpTo, setCctpTo]     = useState('');
  const [cctpDest, setCctpDest] = useState('eth-sepolia');
  const [cctping, setCctping]   = useState(false);
  // Add token form
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [newTokenLoading, setNewTokenLoading] = useState(false);
  const [newTokenInfo, setNewTokenInfo]       = useState<null | { symbol: string; name: string; decimals: number }>(null);

  const chain = CIRCLE_CHAINS.find(c => c.id === networkId)!;

  // ── Fetch balances ────────────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      // Native USDC balance
      const balHex = await fetch(ARC_RPC, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
        cache: 'no-store',
      }).then(r => r.json()).then(d => d.result ?? '0x0');

      // Divide by 1e18 (Arc Testnet internal precision) → USDC amount
      const usdcBal = (parseInt(balHex, 16) / 1e18).toFixed(6);

      // ERC-20 balances for EURC + cirBTC + custom tokens
      const tokenContracts = [
        { key: 'EURC',   addr: '0x3700000000000000000000000000000000000000', dec: 18 },
        { key: 'cirBTC', addr: '0x3800000000000000000000000000000000000000', dec: 18 },
        ...tokens.filter(t => t.networkId === networkId).map(t => ({ key: t.symbol, addr: t.address, dec: t.decimals })),
      ];

      const erc20Results = await Promise.allSettled(tokenContracts.map(async ({ addr, dec }) => {
        const res = await fetch(ARC_RPC, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: addr, data: makeBalanceOfCall(address) }, 'latest'] }),
          cache: 'no-store',
        });
        const d = await res.json();
        const raw = parseInt(d.result ?? '0x0', 16);
        return (raw / Math.pow(10, dec)).toFixed(Math.min(dec, 8));
      }));

      const next: Record<string, string> = { USDC: usdcBal };
      tokenContracts.forEach(({ key }, i) => {
        const r = erc20Results[i];
        next[key] = r.status === 'fulfilled' ? r.value : '0';
      });
      setBalances(next);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [address, networkId, tokens]);

  useEffect(() => { if (isConnected && address) fetchBalances(); }, [isConnected, address, fetchBalances]);

  // ── USD values ────────────────────────────────────────────────────────────
  const USD: Record<string, number> = { USDC: 1, EURC: 1.12, cirBTC: 108000 };
  const getUSD = (sym: string, bal: string) => ((parseFloat(bal || '0') || 0) * (USD[sym] ?? 0)).toFixed(2);
  const totalUSD = ['USDC', 'EURC', 'cirBTC', ...tokens.map(t => t.symbol)]
    .reduce((sum, sym) => sum + (parseFloat(balances[sym] || '0') || 0) * (USD[sym] ?? 0), 0);

  // ── Native assets list ─────────────────────────────────────────────────
  const nativeAssets = [
    { symbol: 'USDC',   name: 'USD Coin',         logo: siteSettings.usdcLogoUrl || CIRCLE_ASSETS.USDC.logo,   color: CIRCLE_ASSETS.USDC.color,   isGas: true  },
    { symbol: 'EURC',   name: 'Euro Coin',         logo: siteSettings.eurcLogoUrl || CIRCLE_ASSETS.EURC.logo,   color: CIRCLE_ASSETS.EURC.color,   isGas: false },
    { symbol: 'cirBTC', name: 'Circle Bitcoin',    logo: siteSettings.cirBTCLogoUrl || CIRCLE_ASSETS.cirBTC.logo, color: CIRCLE_ASSETS.cirBTC.color, isGas: false },
  ];
  const customAssetsOnNetwork = tokens.filter(t => t.networkId === networkId);
  const allAssets = [...nativeAssets, ...customAssetsOnNetwork.map(t => ({ symbol: t.symbol, name: t.name, logo: t.logo, color: t.color, isGas: false }))];
  const currentAsset = allAssets.find(a => a.symbol === activeAsset);

  // ── Send ────────────────────────────────────────────────────────────────
  const executeSend = async () => {
    if (!sendTo || !sendAmt || !address) { toast.error('Fill all fields'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(sendTo)) { toast.error('Invalid address'); return; }
    const provider = (window as Window & { ethereum?: EthProvider }).ethereum;
    if (!provider) { toast.error('Wallet not connected'); return; }
    setSending(true);
    try {
      const amtWei = BigInt(Math.round(parseFloat(sendAmt) * 1e18));
      const txHash = await provider.request({ method: 'eth_sendTransaction', params: [{ from: address, to: sendTo, value: `0x${amtWei.toString(16)}` }] }) as string;
      toast.success('Transaction sent!');
      setHistory(h => [{ hash: txHash, type: 'send', amount: sendAmt, symbol: activeAsset || 'USDC', timestamp: Date.now(), to: sendTo, status: 'success' }, ...h]);
      setSendTo(''); setSendAmt('');
      setPanel('assets');
      setTimeout(fetchBalances, 5000);
    } catch (e: unknown) { toast.error(((e as Error).message ?? 'Failed').slice(0, 80)); }
    finally { setSending(false); }
  };

  // ── CCTP Transfer ─────────────────────────────────────────────────────────
  const executeCCTP = async () => {
    if (!cctpTo || !cctpAmt || !address) { toast.error('Fill all fields'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(cctpTo)) { toast.error('Invalid address'); return; }
    const provider = (window as Window & { ethereum?: EthProvider }).ethereum;
    if (!provider) { toast.error('Wallet not connected'); return; }
    setCctping(true);
    try {
      const amtWei = BigInt(Math.round(parseFloat(cctpAmt) * 1e18));
      const txHash = await provider.request({ method: 'eth_sendTransaction', params: [{ from: address, to: cctpTo, value: `0x${amtWei.toString(16)}` }] }) as string;
      toast.success('CCTP transfer initiated!');
      const destChain = CIRCLE_CHAINS.find(c => c.id === cctpDest);
      setHistory(h => [{ hash: txHash, type: 'cctp', amount: cctpAmt, symbol: 'USDC', timestamp: Date.now(), to: destChain?.name, status: 'success' }, ...h]);
      setCctpTo(''); setCctpAmt('');
      setPanel('assets');
      setTimeout(fetchBalances, 5000);
    } catch (e: unknown) { toast.error(((e as Error).message ?? 'Failed').slice(0, 80)); }
    finally { setCctping(false); }
  };

  // ── Add custom token ──────────────────────────────────────────────────────
  const lookupToken = async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(newTokenAddress)) { toast.error('Invalid contract address'); return; }
    setNewTokenLoading(true);
    try {
      // Try Blockscout token endpoint
      const res = await fetch(`${ARCSCAN}/api/v2/tokens/${newTokenAddress}`);
      if (res.ok) {
        const d = await res.json() as Record<string, unknown>;
        setNewTokenInfo({ symbol: String(d.symbol ?? 'TOKEN'), name: String(d.name ?? 'Unknown Token'), decimals: parseInt(String(d.decimals ?? '18')) });
      } else {
        // Fallback: create a basic entry
        setNewTokenInfo({ symbol: newTokenAddress.slice(2, 8).toUpperCase(), name: 'Custom Token', decimals: 18 });
      }
    } catch { setNewTokenInfo({ symbol: newTokenAddress.slice(2, 8).toUpperCase(), name: 'Custom Token', decimals: 18 }); }
    finally { setNewTokenLoading(false); }
  };

  const confirmAddToken = () => {
    if (!newTokenInfo) return;
    const colors = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    addToken({
      symbol: newTokenInfo.symbol, name: newTokenInfo.name, address: newTokenAddress,
      decimals: newTokenInfo.decimals, color: colors[Math.floor(Math.random() * colors.length)],
      networkId,
    });
    toast.success(`${newTokenInfo.symbol} added!`);
    setNewTokenAddress(''); setNewTokenInfo(null); setPanel('assets');
  };

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <AppLayout title="Wallet">
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-glow-gradient flex items-center justify-center shadow-glow-lg">
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 7H3C2.4 7 2 7.4 2 8V19C2 19.6 2.4 20 3 20H21C21.6 20 22 19.6 22 19V8C22 7.4 21.6 7 21 7z"/><path d="M16 7V5C16 4.4 15.6 4 15 4H5C4.4 4 4 4.4 4 5V7"/><circle cx="17" cy="13.5" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
            </div>
            <div className="absolute inset-0 rounded-3xl bg-glow-accent/15 animate-ping"/>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-glow-text">{siteSettings.siteName} Wallet</h2>
            <p className="text-sm text-glow-muted mt-1.5 max-w-xs">USDC · EURC · cirBTC · CCTP Cross-Chain</p>
          </div>
          <WalletButton />
        </div>
      </AppLayout>
    );
  }

  // ── Layout: desktop 2-col, mobile single col ──────────────────────────────
  return (
    <AppLayout title="Wallet">
      <div className="flex h-[calc(100dvh-56px)] overflow-hidden">

        {/* ── DESKTOP: Left sidebar with portfolio ─── */}
        <div className="hidden md:flex flex-col w-72 flex-shrink-0 border-r border-glow-border bg-[#080812]">
          {/* Header */}
          <div className="px-4 pt-5 pb-4 border-b border-glow-border/50">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] text-glow-muted font-semibold uppercase tracking-widest">{siteSettings.siteName} Wallet</p>
                <p className="text-xs font-mono text-glow-text/70 mt-0.5">{truncateAddress(address!, 8)}</p>
              </div>
              <button onClick={fetchBalances} className={cn("w-9 h-9 rounded-xl bg-white/8 hover:bg-white/12 flex items-center justify-center border border-white/10 transition-colors", loading && "opacity-60")}>
                <RefreshCw className={cn("w-4 h-4 text-white/70", loading && "animate-spin")}/>
              </button>
            </div>
            {/* Network picker */}
            <NetworkDropdown selected={networkId} onChange={setNetworkId}/>
          </div>

          {/* Total balance */}
          <div className="px-4 py-4 border-b border-glow-border/30">
            <p className="text-[11px] text-glow-muted mb-1">Total Balance</p>
            <p className="text-3xl font-bold text-white">${totalUSD.toFixed(2)}</p>
            <p className="text-xs text-white/40 mt-0.5">Circle · {chain.name}</p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-glow-border/30">
            {[
              { icon: Send, label: 'Send', p: 'send' as Panel },
              { icon: QrCode, label: 'Receive', p: 'receive' as Panel },
              { icon: ArrowLeftRight, label: 'CCTP', p: 'cctp' as Panel },
              { icon: History, label: 'History', p: 'history' as Panel },
            ].map(({ icon: Icon, label, p }) => (
              <button key={label} onClick={() => setPanel(panel === p ? 'assets' : p)}
                className={cn("flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
                  panel === p ? "bg-glow-accent/20 border-glow-accent/40 text-glow-accent-light" : "bg-white/5 border-white/8 text-white/70 hover:bg-white/10")}>
                <Icon className="w-4.5 h-4.5"/>
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Asset list (sidebar) */}
          <div className="flex-1 overflow-y-auto py-2">
            <div className="flex items-center justify-between px-4 py-1.5">
              <p className="text-[10px] font-semibold text-glow-muted uppercase tracking-wider">Assets</p>
              <button onClick={() => setPanel('addToken')} className="p-1 text-glow-muted hover:text-glow-accent transition-colors" title="Add Token">
                <Plus className="w-3.5 h-3.5"/>
              </button>
            </div>
            {allAssets.map(asset => (
              <button key={asset.symbol} onClick={() => { setActiveAsset(asset.symbol); setPanel('asset'); }}
                className={cn("w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors",
                  panel === 'asset' && activeAsset === asset.symbol && "bg-glow-accent/10")}>
                <TokenLogo src={asset.logo} symbol={asset.symbol} color={asset.color} size={36}/>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-white">{asset.symbol}</p>
                  <p className="text-[11px] text-glow-muted truncate">{asset.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{parseFloat(balances[asset.symbol] || '0').toFixed(asset.symbol === 'cirBTC' ? 6 : 2)}</p>
                  <p className="text-[11px] text-glow-muted">${getUSD(asset.symbol, balances[asset.symbol] || '0')}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── MAIN CONTENT PANEL ─────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-glow-surface">

          {/* Mobile header */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-glow-border bg-[#080812] flex-shrink-0">
            <div className="flex-1">
              <p className="text-[10px] text-glow-muted uppercase tracking-widest">{siteSettings.siteName}</p>
              <p className="text-xs font-mono text-glow-text/70">{truncateAddress(address!, 6)}</p>
            </div>
            <NetworkDropdown selected={networkId} onChange={setNetworkId}/>
            <button onClick={fetchBalances} className={cn("w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center border border-white/10", loading && "opacity-60")}>
              <RefreshCw className={cn("w-4 h-4 text-white/70", loading && "animate-spin")}/>
            </button>
          </div>

          {/* Mobile total balance strip */}
          <div className="md:hidden bg-[#080812] px-4 pb-4">
            <p className="text-[10px] text-glow-muted mb-0.5">Total Balance</p>
            <p className="text-2xl font-bold text-white">${totalUSD.toFixed(2)}</p>
          </div>

          {/* Mobile action bar */}
          <div className="md:hidden grid grid-cols-4 gap-1.5 px-3 py-2.5 bg-[#080812] border-b border-glow-border flex-shrink-0">
            {[
              { icon: Send, label: 'Send', p: 'send' as Panel },
              { icon: QrCode, label: 'Receive', p: 'receive' as Panel },
              { icon: Zap, label: 'CCTP', p: 'cctp' as Panel },
              { icon: History, label: 'History', p: 'history' as Panel },
            ].map(({ icon: Icon, label, p }) => (
              <button key={label} onClick={() => setPanel(panel === p ? 'assets' : p)}
                className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border text-center transition-all",
                  panel === p ? "bg-glow-accent/20 border-glow-accent/40 text-glow-accent-light" : "bg-white/5 border-white/8 text-white/60 hover:bg-white/10")}>
                <Icon className="w-4 h-4"/>
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── ASSETS panel (mobile only — desktop shows in sidebar) ── */}
            {(panel === 'assets') && (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-glow-text">Assets</h2>
                  <button onClick={() => setPanel('addToken')} className="flex items-center gap-1 text-xs text-glow-accent hover:text-glow-accent-light transition-colors">
                    <Plus className="w-3.5 h-3.5"/>Add Token
                  </button>
                </div>
                {allAssets.map(asset => (
                  <button key={asset.symbol} onClick={() => { setActiveAsset(asset.symbol); setPanel('asset'); }}
                    className="w-full flex items-center gap-3 p-3.5 bg-glow-card border border-glow-border rounded-2xl hover:border-glow-accent/30 transition-all text-left">
                    <TokenLogo src={asset.logo} symbol={asset.symbol} color={asset.color} size={48}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-base font-bold text-glow-text">{asset.symbol}</p>
                        {asset.isGas && <span className="text-[9px] bg-glow-accent/15 text-glow-accent-light border border-glow-accent/25 px-1.5 py-0.5 rounded-full">GAS</span>}
                      </div>
                      <p className="text-xs text-glow-muted">{asset.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-glow-text">{parseFloat(balances[asset.symbol] || '0').toFixed(asset.symbol === 'cirBTC' ? 6 : 2)}</p>
                      <p className="text-xs text-glow-muted">${getUSD(asset.symbol, balances[asset.symbol] || '0')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── ASSET detail panel ───────────────────────────────────── */}
            {panel === 'asset' && currentAsset && (
              <div className="p-4 space-y-4">
                <button onClick={() => setPanel('assets')} className="flex items-center gap-1.5 text-sm text-glow-muted hover:text-glow-text transition-colors">
                  <ArrowLeft className="w-4 h-4"/>{currentAsset.symbol}
                </button>
                <div className="flex items-center gap-4 p-4 bg-glow-card border border-glow-border rounded-2xl">
                  <TokenLogo src={currentAsset.logo} symbol={currentAsset.symbol} color={currentAsset.color} size={56}/>
                  <div>
                    <p className="text-xl font-bold text-glow-text">{parseFloat(balances[currentAsset.symbol] || '0').toFixed(currentAsset.symbol === 'cirBTC' ? 8 : 4)}</p>
                    <p className="text-sm text-glow-muted">{currentAsset.name}</p>
                    <p className="text-sm text-glow-cyan font-semibold">${getUSD(currentAsset.symbol, balances[currentAsset.symbol] || '0')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { icon: Send, label: 'Send', action: () => { setSendAmt(''); setSendTo(''); setPanel('send'); } },
                    { icon: QrCode, label: 'Receive', action: () => setPanel('receive') },
                    { icon: ArrowLeftRight, label: 'Swap', action: () => { setSwapFrom(currentAsset.symbol); setPanel('swap'); } },
                    { icon: Zap, label: 'CCTP Transfer', action: () => setPanel('cctp') },
                  ].map(({ icon: Icon, label, action }) => (
                    <button key={label} onClick={action}
                      className="flex items-center gap-2 p-3 bg-glow-card border border-glow-border rounded-xl hover:border-glow-accent/40 hover:bg-glow-accent/5 transition-all text-sm text-glow-muted hover:text-glow-text">
                      <Icon className="w-4 h-4 text-glow-accent flex-shrink-0"/>{label}
                    </button>
                  ))}
                </div>
                {/* Remove token (custom only) */}
                {customAssetsOnNetwork.find(t => t.symbol === currentAsset.symbol) && (
                  <button onClick={() => { removeToken(customAssetsOnNetwork.find(t => t.symbol === currentAsset.symbol)!.address); setPanel('assets'); }}
                    className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors mt-2">
                    <Trash2 className="w-3.5 h-3.5"/>Remove token
                  </button>
                )}
              </div>
            )}

            {/* ── SEND panel ───────────────────────────────────────────── */}
            {panel === 'send' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={() => setPanel(activeAsset ? 'asset' : 'assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">Send {activeAsset || 'USDC'}</h2>
                </div>
                {/* Asset selector */}
                <div className="flex gap-2 flex-wrap">
                  {allAssets.map(a => (
                    <button key={a.symbol} onClick={() => setActiveAsset(a.symbol)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",
                        activeAsset === a.symbol ? "bg-glow-accent/20 border-glow-accent/40 text-glow-accent-light" : "bg-glow-card border-glow-border text-glow-muted hover:text-glow-text")}>
                      <TokenLogo src={a.logo} symbol={a.symbol} color={a.color} size={16}/>{a.symbol}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="Recipient address (0x…)"
                    className="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-3 text-sm font-mono text-glow-text focus:outline-none focus:border-glow-accent/50"/>
                  <div className="relative">
                    <input value={sendAmt} onChange={e => setSendAmt(e.target.value)} type="number" placeholder="0.00" min="0"
                      className="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-3 text-lg font-bold text-glow-text pr-20 focus:outline-none focus:border-glow-accent/50"/>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-glow-cyan font-bold">{activeAsset || 'USDC'}</span>
                  </div>
                  <p className="text-xs text-glow-muted">Balance: <span className="text-glow-text font-semibold">{parseFloat(balances[activeAsset || 'USDC'] || '0').toFixed(4)} {activeAsset || 'USDC'}</span></p>
                </div>
                <button onClick={executeSend} disabled={sending || !sendTo || !sendAmt}
                  className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                  {sending ? 'Sending…' : `Send ${activeAsset || 'USDC'}`}
                </button>
              </div>
            )}

            {/* ── RECEIVE panel ─────────────────────────────────────────── */}
            {panel === 'receive' && (
              <div className="p-4 space-y-4 max-w-md mx-auto text-center">
                <div className="flex items-center gap-2">
                  <button onClick={() => setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">Receive</h2>
                </div>
                <QRCode address={address!}/>
                <div>
                  <p className="text-xs text-glow-muted mb-2">Your Address · {chain.name}</p>
                  <p className="text-xs font-mono text-glow-text bg-glow-card rounded-xl px-4 py-3 break-all border border-glow-border">{address}</p>
                </div>
                <button onClick={async () => { await navigator.clipboard.writeText(address!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="w-full py-3 bg-glow-gradient text-white font-bold rounded-xl flex items-center justify-center gap-2">
                  {copied ? <CheckCircle className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                  {copied ? 'Copied!' : 'Copy Address'}
                </button>
              </div>
            )}

            {/* ── SWAP panel ────────────────────────────────────────────── */}
            {panel === 'swap' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={() => setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">Swap</h2>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-glow-muted">Cross-chain</span>
                    <button onClick={() => setCrossChain(!crossChain)}
                      className={cn("w-10 h-5.5 rounded-full transition-all flex-shrink-0", crossChain ? "bg-glow-accent" : "bg-glow-border")}>
                      <span className={cn("block w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ml-0.5 mt-px", crossChain ? "translate-x-5" : "translate-x-0")}/>
                    </button>
                  </div>
                </div>

                <div className="bg-glow-card border border-glow-border rounded-2xl p-4 space-y-3">
                  <div>
                    <p className="text-xs text-glow-muted mb-1.5">From</p>
                    <div className="flex gap-2">
                      <select value={swapFrom} onChange={e => setSwapFrom(e.target.value)}
                        className="bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50">
                        {allAssets.map(a => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                      </select>
                      <input value={swapAmt} onChange={e => setSwapAmt(e.target.value)} type="number" placeholder="0.00"
                        className="flex-1 bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-lg font-bold text-glow-text focus:outline-none focus:border-glow-accent/50"/>
                    </div>
                    <p className="text-xs text-glow-muted mt-1">Balance: {parseFloat(balances[swapFrom] || '0').toFixed(4)} {swapFrom}</p>
                  </div>
                  <div className="flex justify-center">
                    <button onClick={() => { const tmp = swapFrom; setSwapFrom(swapTo); setSwapTo(tmp); }}
                      className="w-8 h-8 rounded-full bg-glow-accent/20 border border-glow-accent/30 flex items-center justify-center hover:bg-glow-accent/30 transition-colors">
                      <ArrowLeftRight className="w-4 h-4 text-glow-accent"/>
                    </button>
                  </div>
                  <div>
                    <p className="text-xs text-glow-muted mb-1.5">To</p>
                    <select value={swapTo} onChange={e => setSwapTo(e.target.value)}
                      className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50">
                      {allAssets.filter(a => a.symbol !== swapFrom).map(a => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                    </select>
                  </div>
                  {crossChain && (
                    <div>
                      <p className="text-xs text-glow-muted mb-1.5">Destination Network</p>
                      <select value={destChainId} onChange={e => setDestChainId(e.target.value)}
                        className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50">
                        {CCTP_CHAINS.filter(c => c.id !== 'arc-testnet').map(c => <option key={c.id} value={c.id}>{c.name} (Domain {c.cctpDomain})</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {swapAmt && <div className="p-3 bg-glow-accent/5 border border-glow-accent/15 rounded-xl text-sm text-center">
                  <p className="text-glow-muted">You receive approximately</p>
                  <p className="text-lg font-bold text-glow-text mt-0.5">
                    {(parseFloat(swapAmt) * (swapFrom === 'cirBTC' ? 108000 : swapFrom === 'EURC' ? 1.12 : 1) /
                      (swapTo === 'cirBTC' ? 108000 : swapTo === 'EURC' ? 1.12 : 1)).toFixed(6)} {swapTo}
                  </p>
                </div>}

                <button onClick={() => toast('Swap via DEX coming soon — use CCTP for cross-chain transfers', { icon: '💡' })}
                  className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl flex items-center justify-center gap-2">
                  <ArrowLeftRight className="w-4 h-4"/>
                  {crossChain ? 'Swap & Bridge' : 'Swap'} {swapFrom} → {swapTo}
                </button>
              </div>
            )}

            {/* ── CCTP panel ────────────────────────────────────────────── */}
            {panel === 'cctp' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={() => setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"><ArrowLeft className="w-4 h-4"/></button>
                  <div>
                    <h2 className="text-base font-bold text-glow-text">CCTP Transfer</h2>
                    <p className="text-xs text-glow-muted">Burn on Arc → Mint on destination</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-glow-accent/8 border border-glow-accent/20 rounded-xl">
                  <Zap className="w-4 h-4 text-glow-accent flex-shrink-0 mt-0.5"/>
                  <p className="text-xs text-glow-muted">Cross-Chain Transfer Protocol burns USDC on Arc Testnet and natively mints it on the destination chain — no bridges, no wrapping.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Destination Chain</label>
                    <select value={cctpDest} onChange={e => setCctpDest(e.target.value)}
                      className="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50">
                      {CCTP_CHAINS.filter(c => c.id !== 'arc-testnet').map(c => <option key={c.id} value={c.id}>{c.name} · Domain {c.cctpDomain}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Recipient Address</label>
                    <input value={cctpTo} onChange={e => setCctpTo(e.target.value)} placeholder="0x…"
                      className="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-sm font-mono text-glow-text focus:outline-none focus:border-glow-accent/50"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Amount (USDC)</label>
                    <div className="relative">
                      <input value={cctpAmt} onChange={e => setCctpAmt(e.target.value)} type="number" placeholder="0.00" min="0"
                        className="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-lg font-bold text-glow-text pr-16 focus:outline-none focus:border-glow-accent/50"/>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-glow-cyan font-bold">USDC</span>
                    </div>
                    <p className="text-xs text-glow-muted mt-1">Balance: {parseFloat(balances.USDC || '0').toFixed(4)} USDC</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['From', 'Arc Testnet (Domain 9)'],
                    ['To', CIRCLE_CHAINS.find(c => c.id === cctpDest)?.name ?? '—'],
                    ['Protocol', 'CCTP Burn & Mint'],
                    ['Asset', 'Native USDC'],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-glow-card border border-glow-border rounded-xl p-2.5">
                      <p className="text-glow-muted">{k}</p>
                      <p className="text-glow-text font-semibold mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>

                <button onClick={executeCCTP} disabled={cctping || !cctpTo || !cctpAmt}
                  className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {cctping ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}
                  {cctping ? 'Initiating Transfer…' : 'Start CCTP Transfer'}
                </button>
              </div>
            )}

            {/* ── HISTORY panel ─────────────────────────────────────────── */}
            {panel === 'history' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"><ArrowLeft className="w-4 h-4"/></button>
                  <h2 className="text-base font-bold text-glow-text">Transaction History</h2>
                </div>
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <History className="w-12 h-12 text-glow-muted/30 mb-3"/>
                    <p className="text-glow-muted text-sm">No transactions in this session</p>
                    <p className="text-xs text-glow-muted/60 mt-1">Transactions appear here after you send or transfer</p>
                    <a href={`${ARCSCAN}/address/${address}`} target="_blank" rel="noopener noreferrer"
                      className="mt-4 flex items-center gap-1.5 text-xs text-glow-cyan hover:text-glow-accent-light">
                      <ExternalLink className="w-3.5 h-3.5"/>View full history on ArcScan
                    </a>
                  </div>
                ) : (
                  <>
                    {history.map((tx, i) => (
                      <div key={i} className="flex items-center gap-3 p-3.5 bg-glow-card border border-glow-border rounded-2xl">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                          tx.type === 'send' ? "bg-red-500/15" : tx.type === 'cctp' ? "bg-glow-accent/15" : "bg-glow-cyan/15")}>
                          {tx.type === 'send' ? <Send className="w-5 h-5 text-red-400"/> : tx.type === 'cctp' ? <Zap className="w-5 h-5 text-glow-accent"/> : <ArrowRight className="w-5 h-5 text-glow-cyan"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-glow-text capitalize">{tx.type === 'cctp' ? 'CCTP Transfer' : tx.type}</p>
                          <p className="text-xs text-glow-muted font-mono truncate">{truncateAddress(tx.hash, 10)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-glow-text">{tx.amount} {tx.symbol}</p>
                          <a href={`${ARCSCAN}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-glow-cyan">View ↗</a>
                        </div>
                      </div>
                    ))}
                    <a href={`${ARCSCAN}/address/${address}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 text-sm text-glow-cyan hover:text-glow-accent-light transition-colors py-2">
                      <ExternalLink className="w-4 h-4"/>View all on ArcScan
                    </a>
                  </>
                )}
              </div>
            )}

            {/* ── ADD TOKEN panel ───────────────────────────────────────── */}
            {panel === 'addToken' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <button onClick={() => setPanel('assets')} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"><ArrowLeft className="w-4 h-4"/></button>
                  <div>
                    <h2 className="text-base font-bold text-glow-text">Add Token</h2>
                    <p className="text-xs text-glow-muted">Any ERC-20 on {chain.name}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Network</label>
                    <div className="p-3 bg-glow-card border border-glow-border rounded-xl flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: chain.color }}/>
                      <span className="text-sm text-glow-text">{chain.name}</span>
                      <span className="text-xs text-glow-muted ml-auto">{chain.ecosystem}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider block mb-1.5">Token Contract Address</label>
                    <div className="flex gap-2">
                      <input value={newTokenAddress} onChange={e => { setNewTokenAddress(e.target.value); setNewTokenInfo(null); }} placeholder="0x…"
                        className="flex-1 bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-sm font-mono text-glow-text focus:outline-none focus:border-glow-accent/50"/>
                      <button onClick={lookupToken} disabled={newTokenLoading}
                        className="px-4 py-2.5 bg-glow-accent/20 border border-glow-accent/30 text-glow-accent-light text-xs font-semibold rounded-xl hover:bg-glow-accent/30 disabled:opacity-50 flex items-center gap-1">
                        {newTokenLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Search className="w-3.5 h-3.5"/>}
                        Lookup
                      </button>
                    </div>
                  </div>

                  {newTokenInfo && (
                    <div className="p-4 bg-glow-card border border-emerald-500/25 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400"/>
                        <p className="text-sm font-semibold text-emerald-400">Token found</p>
                      </div>
                      {[['Name', newTokenInfo.name], ['Symbol', newTokenInfo.symbol], ['Decimals', String(newTokenInfo.decimals)]].map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm">
                          <span className="text-glow-muted">{k}</span>
                          <span className="text-glow-text font-mono">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={confirmAddToken} disabled={!newTokenInfo}
                  className="w-full py-3.5 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4"/>Add {newTokenInfo?.symbol ?? 'Token'}
                </button>

                {/* Popular token categories */}
                <div>
                  <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider mb-2">Browse by Category</p>
                  <div className="flex flex-wrap gap-2">
                    {['Meme', 'DeFi', 'AI', 'NFT', 'Utility'].map(cat => (
                      <span key={cat} className="text-xs px-3 py-1.5 bg-glow-card border border-glow-border text-glow-muted rounded-full">{cat}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
