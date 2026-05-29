'use client';
export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Search, ExternalLink, Copy, CheckCircle, Loader2,
  AlertCircle, Hash, Wallet, Code2, Box, RefreshCw,
  Zap, Clock, ArrowRight, ShieldCheck, Activity,
  ChevronRight, TrendingUp, Layers,
} from 'lucide-react';
import { truncateAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

const ARCSCAN = 'https://testnet.arcscan.app';
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';

function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return (
    <button onClick={async e => { e.stopPropagation(); await navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 2000); }}
      className="text-glow-muted hover:text-glow-text transition-colors flex-shrink-0">
      {c ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Row({ label, value, mono, link, className='' }: { label: string; value: React.ReactNode; mono?: boolean; link?: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 py-2.5 border-b border-glow-border/40 last:border-0", className)}>
      <span className="text-xs text-glow-muted w-36 flex-shrink-0 pt-0.5">{label}</span>
      <div className={cn("flex-1 text-sm text-glow-text break-all", mono && "font-mono text-xs")}>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="text-glow-cyan hover:underline flex items-center gap-1 w-fit">
            {value}<ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    success: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
    failed:  "text-red-400 bg-red-500/15 border-red-500/25",
    pending: "text-amber-400 bg-amber-500/15 border-amber-500/25",
    ok:      "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
    error:   "text-red-400 bg-red-500/15 border-red-500/25",
  }[status] ?? "text-glow-muted bg-glow-card border-glow-border";
  const label = { ok: "Success", error: "Failed" }[status] ?? status;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize", cfg)}>
      {(status === 'success' || status === 'ok') ? '✓' : status === 'failed' || status === 'error' ? '✗' : '⏳'} {label}
    </span>
  );
}

interface NetStats { total_blocks?: string; total_transactions?: string; average_block_time?: number; gas_prices?: Record<string, unknown>; }
interface LatestBlock { number: string; hash: string; timestamp: string; gasUsed: string; txCount: number; }

function NetworkStats() {
  const [stats, setStats] = useState<NetStats | null>(null);
  const [block, setBlock] = useState<LatestBlock | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Stats from Blockscout
      const [statsRes, blockRes] = await Promise.allSettled([
        fetch(`/api/explorer?type=stats`).then(r => r.json()),
        fetch(ARC_RPC, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: ['latest', false] }),
          cache: 'no-store',
        }).then(r => r.json()),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data);
      if (blockRes.status === 'fulfilled') {
        const b = blockRes.value.result;
        if (b) setBlock({
          number: parseInt(b.number, 16).toLocaleString(),
          hash: b.hash, timestamp: b.timestamp,
          gasUsed: parseInt(b.gasUsed, 16).toLocaleString(),
          txCount: (b.transactions as unknown[])?.length ?? 0,
        });
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 12000); return () => clearInterval(t); }, [refresh]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { icon: Layers,     label: 'Latest Block',  value: block?.number ?? '—',                                       color: '#7c3aed' },
        { icon: Activity,   label: 'TXs in Block',  value: block ? String(block.txCount) : '—',                        color: '#06b6d4' },
        { icon: Zap,        label: 'Gas Used',       value: block?.gasUsed ?? '—',                                       color: '#f59e0b' },
        { icon: TrendingUp, label: 'Total TXs',      value: stats?.total_transactions ? parseInt(stats.total_transactions).toLocaleString() : '—', color: '#10b981' },
      ].map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-glow-card border border-glow-border rounded-2xl p-3.5 relative overflow-hidden">
          <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full opacity-10 blur-xl" style={{ background: color }}/>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
              <Icon className="w-4 h-4" style={{ color }}/>
            </div>
            <div>
              <p className="text-[10px] text-glow-muted uppercase tracking-wider">{label}</p>
              <p className="text-sm font-bold text-glow-text leading-tight">{value}</p>
            </div>
          </div>
          {label === 'Latest Block' && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>
              <span className="text-[10px] text-emerald-400">Live</span>
              <button onClick={refresh} className="ml-auto p-0.5 text-glow-muted hover:text-glow-text">
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")}/>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ExplorerPage() {
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const search = useCallback(async (q?: string) => {
    const val = (q ?? query).trim();
    if (!val) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(`/api/explorer?q=${encodeURIComponent(val)}&network=testnet`);
      const d = await res.json();
      if (!res.ok || d.error) setError(d.error ?? 'Not found');
      else setResult(d);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [query]);

  const nav = (q: string) => { setQuery(q); search(q); };

  return (
    <AppLayout title="Explorer">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-glow-text">Arc Testnet Explorer</h1>
            <p className="text-sm text-glow-muted mt-0.5">Powered by Blockscout · Chain 5042002</p>
          </div>
          <a href={ARCSCAN} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-glow-cyan hover:text-glow-accent-light px-3 py-1.5 bg-glow-card border border-glow-border rounded-lg transition-colors">
            <ExternalLink className="w-3.5 h-3.5"/>ArcScan ↗
          </a>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-glow-muted pointer-events-none"/>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Search address · transaction hash · block number · token name…"
              className="w-full bg-glow-card border border-glow-border rounded-xl pl-11 pr-4 py-3 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/60 transition-colors"/>
          </div>
          <button onClick={() => search()} disabled={loading || !query.trim()}
            className="px-5 py-3 bg-glow-gradient text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>

        {/* Network stats */}
        <NetworkStats/>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-sm font-medium text-red-300">{error}</p>
              <p className="text-xs text-red-400/60 mt-1">Check the value and try again. Complex queries will use Blockscout universal search.</p>
            </div>
          </div>
        )}

        {/* ── Address / Contract ─────────────────────────────────── */}
        {result && (result.type === 'address' || result.type === 'contract') && (() => {
          const d = result.data as Record<string, unknown>;
          return (
            <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-glow-border bg-glow-surface/50">
                <div className="flex items-center gap-2.5">
                  {d.isContract ? <Code2 className="w-5 h-5 text-glow-cyan"/> : <Wallet className="w-5 h-5 text-glow-accent"/>}
                  <span className="text-sm font-bold text-glow-text">{d.isContract ? 'Smart Contract' : 'Address'}</span>
                  {d.isVerified && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full flex items-center gap-1"><ShieldCheck className="w-3 h-3"/>Verified</span>}
                  {d.name && <span className="text-xs text-glow-muted bg-glow-surface px-2 py-0.5 rounded-full">{d.name as string}</span>}
                </div>
                <a href={d.explorerUrl as string} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-glow-cyan hover:text-glow-accent-light px-3 py-1.5 bg-glow-bg border border-glow-border rounded-lg flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5"/>ArcScan
                </a>
              </div>
              <div className="px-5 py-1">
                <Row label="Address" mono value={<div className="flex items-center gap-1.5">{d.address as string}<CopyBtn text={d.address as string}/></div>}/>
                <Row label="USDC Balance" value={<span className="font-semibold text-glow-cyan">{d.balance as string} USDC</span>}/>
                <Row label="Transactions" value={(d.txCount as number).toLocaleString()}/>
                <Row label="Type" value={
                  d.isContract
                    ? <span className="flex items-center gap-1.5 text-glow-cyan"><Code2 className="w-3.5 h-3.5"/>Smart Contract {d.tokenSymbol ? `· ${d.tokenSymbol}` : ''}</span>
                    : <span className="flex items-center gap-1.5 text-glow-muted"><Wallet className="w-3.5 h-3.5"/>Externally Owned Account</span>
                }/>
                {/* Token balances */}
                {Array.isArray(d.tokenBalances) && (d.tokenBalances as unknown[]).length > 0 && (
                  <div className="py-3">
                    <p className="text-xs text-glow-muted font-semibold uppercase tracking-wider mb-2">Token Balances</p>
                    <div className="space-y-1.5">
                      {(d.tokenBalances as Array<{symbol:string;name:string;balance:string;address:string}>).map(tok => (
                        <div key={tok.address} className="flex items-center justify-between text-sm p-2 bg-glow-surface rounded-lg">
                          <button onClick={() => nav(tok.address)} className="text-glow-cyan hover:underline font-mono text-xs">{tok.symbol}</button>
                          <span className="text-glow-text font-semibold">{tok.balance}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Recent transactions */}
                {Array.isArray(d.recentTxs) && (d.recentTxs as unknown[]).length > 0 && (
                  <div className="py-3">
                    <p className="text-xs text-glow-muted font-semibold uppercase tracking-wider mb-2">Recent Transactions</p>
                    <div className="space-y-1.5">
                      {(d.recentTxs as Array<{hash:string;from:string;to:string;value:string;status:string;timestamp:string}>).map(tx => (
                        <div key={tx.hash} className="flex items-center gap-3 p-2 bg-glow-surface rounded-lg">
                          <StatusBadge status={tx.status ?? 'pending'}/>
                          <button onClick={() => nav(tx.hash)} className="flex-1 font-mono text-xs text-glow-cyan hover:underline truncate">{truncateAddress(tx.hash, 10)}</button>
                          <span className="text-xs text-glow-muted flex-shrink-0">{tx.value} USDC</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Transaction ───────────────────────────────────────── */}
        {result && result.type === 'transaction' && (() => {
          const d = result.data as Record<string, unknown>;
          return (
            <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-glow-border bg-glow-surface/50">
                <div className="flex items-center gap-2.5">
                  <Hash className="w-5 h-5 text-amber-400"/>
                  <span className="text-sm font-bold text-glow-text">Transaction</span>
                  <StatusBadge status={String(d.status ?? 'pending')}/>
                </div>
                <a href={d.explorerUrl as string} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-glow-cyan hover:text-glow-accent-light px-3 py-1.5 bg-glow-bg border border-glow-border rounded-lg flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5"/>ArcScan
                </a>
              </div>
              <div className="px-5 py-1">
                <Row label="Tx Hash" mono value={<div className="flex items-center gap-1.5">{truncateAddress(d.hash as string, 14)}<CopyBtn text={d.hash as string}/></div>}/>
                <Row label="Status" value={<StatusBadge status={String(d.status)}/>}/>
                {d.block && <Row label="Block" value={<button onClick={() => nav(String(d.block))} className="text-glow-cyan hover:underline">#{String(d.block)}</button>}/>}
                {d.timestamp && <Row label="Timestamp" value={new Date(String(d.timestamp)).toLocaleString()}/>}
                <Row label="From" mono value={d.from ? <div className="flex items-center gap-1.5"><button onClick={() => nav(d.from as string)} className="text-glow-cyan hover:underline">{truncateAddress(d.from as string, 12)}</button><CopyBtn text={d.from as string}/></div> : '—'}/>
                <Row label="To" mono value={
                  d.to ? <div className="flex items-center gap-1.5"><button onClick={() => nav(d.to as string)} className="text-glow-cyan hover:underline">{truncateAddress(d.to as string, 12)}</button><CopyBtn text={d.to as string}/></div>
                  : d.contractCreated ? <span className="text-glow-cyan">Contract: {truncateAddress(d.contractCreated as string, 10)}</span>
                  : '—'
                }/>
                {d.value !== undefined && <Row label="Value" value={<span className="text-glow-cyan font-semibold">{d.value as string} USDC</span>}/>}
                {d.gasUsed !== undefined && d.gasUsed !== null && <Row label="Gas Used" value={String(d.gasUsed)}/>}
                {d.nonce !== undefined && <Row label="Nonce" value={String(d.nonce)}/>}
                {d.decodedMethod && <Row label="Method" value={<span className="text-glow-accent font-mono text-xs px-2 py-0.5 bg-glow-accent/10 rounded-lg">{d.decodedMethod as string}</span>}/>}
                {d.revertReason && <Row label="Revert Reason" value={<span className="text-red-400 text-xs">{d.revertReason as string}</span>}/>}
                {d.fee && <Row label="Transaction Fee" value={<span className="text-glow-muted text-xs">{JSON.stringify(d.fee)}</span>}/>}
              </div>
            </div>
          );
        })()}

        {/* ── Block ─────────────────────────────────────────────── */}
        {result && result.type === 'block' && (() => {
          const d = result.data as Record<string, unknown>;
          return (
            <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-glow-border bg-glow-surface/50">
                <div className="flex items-center gap-2.5">
                  <Box className="w-5 h-5 text-emerald-400"/>
                  <span className="text-sm font-bold text-glow-text">Block #{String(d.number)}</span>
                </div>
                <a href={d.explorerUrl as string} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-glow-cyan hover:text-glow-accent-light px-3 py-1.5 bg-glow-bg border border-glow-border rounded-lg flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5"/>ArcScan
                </a>
              </div>
              <div className="px-5 py-1">
                <Row label="Block Number" value={<span className="font-bold">#{String(d.number)}</span>}/>
                <Row label="Hash" mono value={<div className="flex items-center gap-1.5">{truncateAddress(d.hash as string, 14)}<CopyBtn text={d.hash as string}/></div>}/>
                {d.timestamp && <Row label="Timestamp" value={new Date(String(d.timestamp)).toLocaleString()}/>}
                <Row label="Transactions" value={String(d.txCount)}/>
                {d.gasUsed !== undefined && <Row label="Gas Used" value={`${String(d.gasUsed)} / ${String(d.gasLimit)}`}/>}
                {d.miner && <Row label="Miner" mono value={<div className="flex items-center gap-1.5"><button onClick={() => nav(d.miner as string)} className="text-glow-cyan hover:underline">{truncateAddress(d.miner as string, 12)}</button><CopyBtn text={d.miner as string}/>{d.minerLabel && <span className="text-xs text-glow-muted">({d.minerLabel as string})</span>}</div>}/>}
                {d.size !== undefined && <Row label="Block Size" value={`${String(d.size)} bytes`}/>}
                {Array.isArray(d.transactions) && (d.transactions as unknown[]).length > 0 && (
                  <div className="py-3">
                    <p className="text-xs text-glow-muted font-semibold uppercase tracking-wider mb-2">Transactions</p>
                    <div className="space-y-1.5">
                      {(d.transactions as Array<{hash:string;from:string;to:string;value:string;status:string}>).map(tx => (
                        <div key={tx.hash} className="flex items-center gap-3 p-2 bg-glow-surface rounded-lg">
                          <StatusBadge status={tx.status ?? 'pending'}/>
                          <button onClick={() => nav(tx.hash)} className="flex-1 font-mono text-xs text-glow-cyan hover:underline truncate">{truncateAddress(tx.hash, 12)}</button>
                          <span className="text-xs text-glow-muted flex-shrink-0">{tx.value} USDC</span>
                          <ArrowRight className="w-3 h-3 text-glow-muted flex-shrink-0"/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Network info panel when idle */}
        {!result && !error && !loading && (
          <div className="bg-glow-card border border-glow-border rounded-2xl p-5">
            <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider mb-3">Arc Testnet</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                ['Chain ID', '5042002'], ['Gas Token', 'USDC (6 dec)'],
                ['Explorer', 'testnet.arcscan.app'], ['API', 'Blockscout v2'],
                ['RPC', 'rpc.testnet.arc.network'], ['Status', '🟢 Active'],
              ].map(([k, v]) => (
                <div key={k} className="bg-glow-surface rounded-xl p-3">
                  <p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1">{k}</p>
                  <p className="text-xs font-mono text-glow-text">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
