'use client';
export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Search, ExternalLink, Copy, CheckCircle, Loader2,
  AlertCircle, Hash, Wallet, Code2, Box, ChevronRight,
  RefreshCw, Zap, Clock, ArrowRight, ShieldCheck,
} from 'lucide-react';
import { truncateAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

const ARC_RPC      = process.env.NEXT_PUBLIC_ARC_RPC_URL      ?? 'https://rpc.testnet.arc.network';
const ARC_EXPLORER = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? 'https://testnet.arcscan.app';

interface ExplorerResult {
  type: 'address' | 'contract' | 'transaction' | 'block';
  data: Record<string, unknown>;
}

function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 2000); }}
      className="text-glow-muted hover:text-glow-text transition-colors flex-shrink-0">
      {c ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Row({ label, value, mono, link }: { label: string; value: React.ReactNode; mono?: boolean; link?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-glow-border/40 last:border-0">
      <span className="text-xs text-glow-muted w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className={cn("flex-1 text-sm text-glow-text break-all", mono && "font-mono text-xs")}>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="text-glow-cyan hover:underline flex items-center gap-1">
            {value}<ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : value}
      </span>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-glow-surface border border-glow-border rounded-xl px-3 py-2 text-center">
      <p className="text-[10px] text-glow-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}

function LatestBlock() {
  const [block, setBlock] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(ARC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: ['latest', false] }),
        cache: 'no-store',
      });
      const d = await res.json();
      if (d.result) setBlock(d.result);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 12000); return () => clearInterval(t); }, [refresh]);

  if (!block) return (
    <div className="bg-glow-card border border-glow-border rounded-2xl p-4 flex items-center gap-3">
      {loading ? <Loader2 className="w-4 h-4 animate-spin text-glow-accent" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
      <span className="text-sm text-glow-muted">{loading ? 'Connecting to Arc Testnet…' : 'Could not reach Arc Testnet RPC'}</span>
    </div>
  );

  const num = parseInt(block.number as string, 16);
  const ts  = parseInt(block.timestamp as string, 16);
  const txs = (block.transactions as unknown[])?.length ?? 0;
  const gas = parseInt(block.gasUsed as string, 16);
  const age = Math.max(0, Math.floor(Date.now() / 1000) - ts);

  return (
    <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Latest Block</span>
          <span className="text-xs text-glow-muted">· Arc Testnet · Chain 5042002</span>
        </div>
        <button onClick={refresh} className="p-1 text-glow-muted hover:text-glow-text">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <StatChip label="Block"  value={`#${num.toLocaleString()}`}   color="#7c3aed" />
        <StatChip label="TXs"    value={txs}                          color="#06b6d4" />
        <StatChip label="Gas"    value={gas.toLocaleString()}          color="#f59e0b" />
        <StatChip label="Age"    value={age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`} color="#10b981" />
      </div>
    </div>
  );
}

export default function ExplorerPage() {
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplorerResult | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const search = useCallback(async (q?: string) => {
    const val = (q ?? query).trim();
    if (!val) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(`/api/explorer?q=${encodeURIComponent(val)}&network=testnet`);
      const data = await res.json();
      if (!res.ok || data.error) setError(data.error ?? 'Not found on Arc Testnet');
      else setResult(data);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [query]);

  return (
    <AppLayout title="Explorer">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-glow-text">Arc Testnet Explorer</h1>
            <p className="text-sm text-glow-muted mt-0.5">Search addresses, transactions and blocks · Chain 5042002</p>
          </div>
          <div className="ml-auto">
            <a href={ARC_EXPLORER} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-glow-cyan hover:text-glow-accent-light transition-colors px-3 py-1.5 bg-glow-card border border-glow-border rounded-lg">
              <ExternalLink className="w-3.5 h-3.5" />ArcScan
            </a>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-glow-muted pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Address (0x…), transaction hash, or block number"
              className="w-full bg-glow-card border border-glow-border rounded-xl pl-11 pr-4 py-3 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/60 transition-colors"
              autoComplete="off" spellCheck={false}
            />
          </div>
          <button onClick={() => search()} disabled={loading || !query.trim()}
            className="px-5 py-3 bg-glow-gradient text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>

        {/* Latest block */}
        <LatestBlock />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">{error}</p>
              <p className="text-xs text-red-400/60 mt-1">Check the address/hash is correct and exists on Arc Testnet.</p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !error && (
          <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden animate-fade-in">
            {/* Type header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-glow-border bg-glow-surface/50">
              <div className="flex items-center gap-2.5">
                {result.type === 'address'     && <Wallet className="w-5 h-5 text-glow-accent" />}
                {result.type === 'contract'    && <Code2  className="w-5 h-5 text-glow-cyan"   />}
                {result.type === 'transaction' && <Hash   className="w-5 h-5 text-amber-400"   />}
                {result.type === 'block'       && <Box    className="w-5 h-5 text-emerald-400" />}
                <span className="text-sm font-bold text-glow-text capitalize">
                  {result.type === 'contract' ? 'Smart Contract' : result.type}
                </span>
                <span className="text-xs text-glow-muted px-2 py-0.5 bg-glow-accent/10 border border-glow-accent/20 rounded-full">Arc Testnet</span>
              </div>
              <a href={result.data.explorerUrl as string} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-glow-cyan hover:text-glow-accent-light px-3 py-1.5 bg-glow-bg border border-glow-border rounded-lg transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />View on ArcScan
              </a>
            </div>

            <div className="px-5 py-1">
              {/* Address / Contract */}
              {(result.type === 'address' || result.type === 'contract') && (() => {
                const d = result.data;
                return (
                  <>
                    <Row label="Address" mono value={<div className="flex items-center gap-1.5">{d.address as string}<CopyBtn text={d.address as string} /></div>} />
                    <Row label="Balance" value={<span className="font-semibold text-glow-cyan">{d.balance as string} USDC</span>} />
                    <Row label="Transactions" value={(d.txCount as number).toLocaleString()} />
                    <Row label="Type" value={
                      d.isContract
                        ? <span className="flex items-center gap-1.5 text-glow-cyan"><ShieldCheck className="w-3.5 h-3.5" />Smart Contract · {(d.bytecodeSize as number).toLocaleString()} bytes</span>
                        : <span className="flex items-center gap-1.5 text-glow-muted"><Wallet className="w-3.5 h-3.5" />Externally Owned Account</span>
                    } />
                  </>
                );
              })()}

              {/* Transaction */}
              {result.type === 'transaction' && (() => {
                const d = result.data;
                const ts = d.timestamp ? new Date((d.timestamp as number) * 1000).toLocaleString() : 'Pending';
                return (
                  <>
                    <Row label="Hash" mono value={<div className="flex items-center gap-1.5">{truncateAddress(d.hash as string, 14)}<CopyBtn text={d.hash as string} /></div>} />
                    <Row label="Status" value={
                      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full",
                        d.status === 'success' ? "text-emerald-400 bg-emerald-500/15 border border-emerald-500/25"
                          : d.status === 'failed' ? "text-red-400 bg-red-500/15 border border-red-500/25"
                          : "text-amber-400 bg-amber-500/15 border border-amber-500/25")}>
                        {d.status === 'success' ? '✓' : d.status === 'failed' ? '✗' : '⏳'} {String(d.status).toUpperCase()}
                      </span>
                    } />
                    <Row label="Block" value={
                      d.blockNumber
                        ? <button onClick={() => { setQuery(String(d.blockNumber)); search(String(d.blockNumber)); }}
                            className="text-glow-cyan hover:underline">#{(d.blockNumber as number).toLocaleString()}</button>
                        : 'Pending'
                    } />
                    <Row label="Timestamp" value={ts} />
                    <Row label="From" mono value={d.from ? <div className="flex items-center gap-1.5">{truncateAddress(d.from as string, 12)}<CopyBtn text={d.from as string} /></div> : '—'} />
                    <Row label="To" mono value={
                      d.to ? <div className="flex items-center gap-1.5">{truncateAddress(d.to as string, 12)}<CopyBtn text={d.to as string} /></div>
                      : d.contractCreated ? <span className="text-glow-cyan">Contract: {truncateAddress(d.contractCreated as string, 10)}</span>
                      : '—'
                    } />
                    <Row label="Value" value={<span className="text-glow-cyan font-semibold">{d.value as string} USDC</span>} />
                    <Row label="Gas Used" value={d.gasUsed ? (d.gasUsed as number).toLocaleString() : '—'} />
                    <Row label="Nonce" value={d.nonce as number} />
                    {(d.logs as number) > 0 && <Row label="Event Logs" value={`${d.logs} event${(d.logs as number) > 1 ? 's' : ''}`} />}
                  </>
                );
              })()}

              {/* Block */}
              {result.type === 'block' && (() => {
                const d = result.data;
                return (
                  <>
                    <Row label="Number" value={<span className="font-bold text-glow-text">#{(d.number as number).toLocaleString()}</span>} />
                    <Row label="Hash" mono value={<div className="flex items-center gap-1.5">{truncateAddress(d.hash as string, 14)}<CopyBtn text={d.hash as string} /></div>} />
                    <Row label="Timestamp" value={new Date((d.timestamp as number) * 1000).toLocaleString()} />
                    <Row label="Transactions" value={(d.txCount as number).toLocaleString()} />
                    <Row label="Gas Used" value={`${(d.gasUsed as number).toLocaleString()} / ${(d.gasLimit as number).toLocaleString()}`} />
                    {d.miner && <Row label="Miner" mono value={<div className="flex items-center gap-1.5">{truncateAddress(d.miner as string, 10)}<CopyBtn text={d.miner as string} /></div>} />}
                    <Row label="Size" value={`${(d.size as number).toLocaleString()} bytes`} />
                    {(d.transactions as unknown[])?.length > 0 && (
                      <div className="py-3">
                        <p className="text-xs text-glow-muted font-semibold uppercase tracking-wider mb-2">Transactions in this block</p>
                        <div className="space-y-1.5">
                          {(d.transactions as Array<{ hash: string; from: string; to: string; value: string }>).map(tx => (
                            <div key={tx.hash} className="flex items-center gap-2 text-xs p-2 bg-glow-surface rounded-lg">
                              <button onClick={() => { setQuery(tx.hash); search(tx.hash); }}
                                className="font-mono text-glow-cyan hover:underline truncate flex-1">{truncateAddress(tx.hash, 12)}</button>
                              <span className="text-glow-muted hidden sm:block flex-shrink-0">{tx.value} USDC</span>
                              <ArrowRight className="w-3 h-3 text-glow-muted flex-shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Network info — shown when idle */}
        {!result && !error && (
          <div className="bg-glow-card border border-glow-border rounded-2xl p-5 space-y-3">
            <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Arc Testnet Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ['Network',  'Arc Testnet'],
                ['Chain ID', '5042002'],
                ['Gas Token','USDC (6 decimals)'],
                ['RPC',      'rpc.testnet.arc.network'],
                ['Explorer', 'testnet.arcscan.app'],
                ['Status',   '🟢 Active'],
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
