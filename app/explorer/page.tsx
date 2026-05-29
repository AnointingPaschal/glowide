'use client';
export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Search, ExternalLink, Copy, CheckCircle, Loader2,
  AlertCircle, Activity, Hash, Wallet, Code2, Box,
  ArrowRight, ChevronRight, RefreshCw, Network, Zap,
  Clock, Coins, FileText, ShieldCheck,
} from 'lucide-react';
import { truncateAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';

type NetworkId = 'testnet' | 'mainnet';

interface NetworkInfo { rpc: string; explorer: string; chainId: number; name: string; }
interface ExplorerResult {
  type: 'address' | 'contract' | 'transaction' | 'block';
  network: NetworkInfo;
  data: Record<string, unknown>;
  error?: string;
}

const SAMPLE_SEARCHES: Record<NetworkId, Array<{ label: string; type: string; value: string }>> = {
  testnet: [
    { label: 'Sample Address', type: 'address',     value: '0x0000000000000000000000000000000000000001' },
    { label: 'Block #1',       type: 'block',        value: '1' },
  ],
  mainnet: [
    { label: 'Sample Address', type: 'address',     value: '0x0000000000000000000000000000000000000001' },
    { label: 'Block #1',       type: 'block',        value: '1' },
  ],
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const click = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={click} className="text-glow-muted hover:text-glow-text transition-colors flex-shrink-0">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Row({ label, value, mono, link }: { label: string; value: React.ReactNode; mono?: boolean; link?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-glow-border/50 last:border-0">
      <span className="text-xs text-glow-muted w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className={cn("flex-1 text-sm text-glow-text break-all", mono && "font-mono text-xs")}>
        {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-glow-cyan hover:underline flex items-center gap-1">{value}<ExternalLink className="w-3 h-3 flex-shrink-0" /></a> : value}
      </span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-glow-card border border-glow-border rounded-xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-[11px] text-glow-muted uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-glow-text leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ── Latest block ───────────────────────────────────────────────────────────
function LatestBlock({ networkId }: { networkId: NetworkId }) {
  const [block, setBlock] = useState<Record<string,unknown>|null>(null);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const rpc = networkId === 'mainnet'
        ? (process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL ?? 'https://rpc.arc.network')
        : (process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network');
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: ['latest', false] }),
        cache: 'no-store',
      });
      const d = await res.json();
      setBlock(d.result);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [networkId]);

  useEffect(() => { fetch_(); const t = setInterval(fetch_, 12000); return () => clearInterval(t); }, [fetch_]);

  if (!block) return (
    <div className="bg-glow-card border border-glow-border rounded-2xl p-4 flex items-center gap-3">
      {loading ? <Loader2 className="w-4 h-4 animate-spin text-glow-accent" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
      <span className="text-sm text-glow-muted">{loading ? 'Connecting to Arc…' : 'Could not connect to Arc RPC'}</span>
    </div>
  );

  const num = parseInt(block.number as string, 16);
  const ts  = parseInt(block.timestamp as string, 16);
  const txs = (block.transactions as unknown[])?.length ?? 0;
  const gas = parseInt(block.gasUsed as string, 16);
  const age = Math.floor(Date.now() / 1000) - ts;

  return (
    <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Latest Block</span>
        </div>
        <button onClick={fetch_} className="p-1 text-glow-muted hover:text-glow-text transition-colors">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Hash}     label="Block"  value={`#${num.toLocaleString()}`}   color="#7c3aed" />
        <StatCard icon={Activity} label="TXs"    value={txs}                          color="#06b6d4" />
        <StatCard icon={Zap}      label="Gas"    value={gas.toLocaleString()}          color="#f59e0b" />
        <StatCard icon={Clock}    label="Age"    value={age < 60 ? `${age}s` : `${Math.floor(age/60)}m`} color="#10b981" />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ExplorerPage() {
  const [query, setQuery]     = useState('');
  const [network, setNetwork] = useState<NetworkId>('testnet');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ExplorerResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const search = useCallback(async (q?: string) => {
    const val = (q ?? query).trim();
    if (!val) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(`/api/explorer?q=${encodeURIComponent(val)}&network=${network}`);
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? 'Not found'); }
      else { setResult(data); }
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [query, network]);

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') search(); };

  const net = network === 'mainnet'
    ? { explorer: process.env.NEXT_PUBLIC_ARC_MAINNET_EXPLORER_URL ?? 'https://arcscan.app', name: 'Arc Mainnet' }
    : { explorer: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? 'https://testnet.arcscan.app', name: 'Arc Testnet' };

  return (
    <AppLayout title="Explorer">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-glow-text">Arc Block Explorer</h1>
          <p className="text-sm text-glow-muted mt-0.5">Search addresses, transactions, and blocks on Arc</p>
        </div>

        {/* Network selector */}
        <div className="flex items-center gap-2">
          {(['testnet', 'mainnet'] as NetworkId[]).map(n => (
            <button key={n} onClick={() => { setNetwork(n); setResult(null); setError(null); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                network === n
                  ? n === 'mainnet'
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : "bg-glow-accent/15 border-glow-accent/40 text-glow-accent-light"
                  : "bg-glow-card border-glow-border text-glow-muted hover:text-glow-text"
              )}>
              <Network className="w-3.5 h-3.5" />
              {n === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'}
              {n === 'mainnet' && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded-full font-semibold">LIVE</span>}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-glow-muted" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="Search by address (0x…), transaction hash, or block number"
              className="w-full bg-glow-card border border-glow-border rounded-xl pl-11 pr-4 py-3 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/60 transition-colors"
            />
          </div>
          <button onClick={() => search()} disabled={loading || !query.trim()}
            className="px-5 py-3 bg-glow-gradient text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>

        {/* Quick searches */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-glow-muted">Try:</span>
          {SAMPLE_SEARCHES[network].map(s => (
            <button key={s.value} onClick={() => { setQuery(s.value); search(s.value); }}
              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-glow-card border border-glow-border rounded-lg text-glow-muted hover:text-glow-text hover:border-glow-accent/30 transition-all">
              {s.type === 'address' ? <Wallet className="w-3 h-3" /> : s.type === 'transaction' ? <Hash className="w-3 h-3" /> : <Box className="w-3 h-3" />}
              {s.label} <ChevronRight className="w-3 h-3" />
            </button>
          ))}
        </div>

        {/* Latest block */}
        <LatestBlock networkId={network} />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">{error}</p>
              <p className="text-xs text-red-400/70 mt-1">
                Make sure you're searching on the right network ({network === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'}).
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !error && (
          <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden animate-fade-in">
            {/* Result header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-glow-border bg-glow-surface/50">
              <div className="flex items-center gap-2.5">
                {result.type === 'address'     && <Wallet className="w-5 h-5 text-glow-accent" />}
                {result.type === 'contract'    && <Code2  className="w-5 h-5 text-glow-cyan"   />}
                {result.type === 'transaction' && <Hash   className="w-5 h-5 text-amber-400"   />}
                {result.type === 'block'       && <Box    className="w-5 h-5 text-emerald-400" />}
                <div>
                  <span className="text-sm font-bold text-glow-text capitalize">
                    {result.type === 'contract' ? 'Smart Contract' : result.type}
                  </span>
                  <span className="ml-2 text-xs text-glow-muted">{result.network?.name ?? net.name}</span>
                </div>
              </div>
              <a href={result.data.explorerUrl as string} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-glow-cyan hover:text-glow-accent-light transition-colors px-3 py-1.5 bg-glow-bg border border-glow-border rounded-lg">
                <ExternalLink className="w-3.5 h-3.5" />ArcScan
              </a>
            </div>

            <div className="px-5 py-1 divide-y-0">
              {/* Address result */}
              {(result.type === 'address' || result.type === 'contract') && (() => {
                const d = result.data;
                return (
                  <>
                    <Row label="Address" mono value={<div className="flex items-center gap-1.5">{d.address as string}<CopyBtn text={d.address as string}/></div>}/>
                    <Row label="USDC Balance" value={<span className="font-semibold text-glow-cyan">{d.balance as string} USDC</span>}/>
                    <Row label="Transactions" value={(d.txCount as number).toLocaleString()}/>
                    <Row label="Type" value={
                      d.isContract
                        ? <span className="flex items-center gap-1 text-glow-cyan"><ShieldCheck className="w-3.5 h-3.5"/>Smart Contract ({(d.bytecodeSize as number).toLocaleString()} bytes)</span>
                        : <span className="flex items-center gap-1 text-glow-muted"><Wallet className="w-3.5 h-3.5"/>Externally Owned Account</span>
                    }/>
                    {d.isContract && <Row label="View on ArcScan" value="Full contract details, source code & ABI" link={d.explorerUrl as string}/>}
                  </>
                );
              })()}

              {/* Transaction result */}
              {result.type === 'transaction' && (() => {
                const d = result.data;
                const ts = d.timestamp ? new Date((d.timestamp as number) * 1000).toLocaleString() : 'Pending';
                return (
                  <>
                    <Row label="Tx Hash" mono value={<div className="flex items-center gap-1.5">{truncateAddress(d.hash as string, 12)}<CopyBtn text={d.hash as string}/></div>}/>
                    <Row label="Status" value={
                      <span className={cn("flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-full",
                        d.status==='success' ? "text-emerald-400 bg-emerald-500/15" : d.status==='failed' ? "text-red-400 bg-red-500/15" : "text-amber-400 bg-amber-500/15")}>
                        {d.status==='success' ? '✓' : d.status==='failed' ? '✗' : '⏳'} {String(d.status).toUpperCase()}
                      </span>}/>
                    <Row label="Block" value={d.blockNumber ? <button onClick={()=>{setQuery(String(d.blockNumber));search(String(d.blockNumber));}} className="text-glow-cyan hover:underline">#{(d.blockNumber as number).toLocaleString()}</button> : 'Pending'}/>
                    <Row label="Timestamp" value={ts}/>
                    <Row label="From" mono value={<div className="flex items-center gap-1.5">{d.from ? truncateAddress(d.from as string, 10) : '—'}{d.from && <CopyBtn text={d.from as string}/>}</div>}/>
                    <Row label="To" mono value={<div className="flex items-center gap-1.5">{d.to ? truncateAddress(d.to as string, 10) : (d.contractCreated ? `Contract created: ${truncateAddress(d.contractCreated as string, 8)}` : '—')}{d.to && <CopyBtn text={d.to as string}/>}</div>}/>
                    <Row label="Value" value={<span className="text-glow-cyan font-semibold">{d.value as string} USDC</span>}/>
                    <Row label="Gas Used" value={d.gasUsed ? (d.gasUsed as number).toLocaleString() : '—'}/>
                    <Row label="Nonce" value={d.nonce as number}/>
                    {(d.logs as number) > 0 && <Row label="Event Logs" value={`${d.logs} event${(d.logs as number) > 1 ? 's' : ''}`}/>}
                  </>
                );
              })()}

              {/* Block result */}
              {result.type === 'block' && (() => {
                const d = result.data;
                const ts = new Date((d.timestamp as number) * 1000).toLocaleString();
                return (
                  <>
                    <Row label="Block Number" value={<span className="font-bold text-glow-text">#{(d.number as number).toLocaleString()}</span>}/>
                    <Row label="Hash" mono value={<div className="flex items-center gap-1.5">{truncateAddress(d.hash as string, 12)}<CopyBtn text={d.hash as string}/></div>}/>
                    <Row label="Timestamp" value={ts}/>
                    <Row label="Transactions" value={(d.txCount as number).toLocaleString()}/>
                    <Row label="Gas Used" value={`${(d.gasUsed as number).toLocaleString()} / ${(d.gasLimit as number).toLocaleString()}`}/>
                    <Row label="Miner" mono value={d.miner ? <div className="flex items-center gap-1.5">{truncateAddress(d.miner as string, 10)}<CopyBtn text={d.miner as string}/></div> : '—'}/>
                    <Row label="Size" value={`${(d.size as number).toLocaleString()} bytes`}/>
                    {(d.transactions as unknown[])?.length > 0 && (
                      <div className="py-3">
                        <p className="text-xs text-glow-muted font-semibold uppercase tracking-wider mb-2">Latest Transactions</p>
                        <div className="space-y-1.5">
                          {(d.transactions as Array<{hash:string;from:string;to:string;value:string}>).map(tx => (
                            <div key={tx.hash} className="flex items-center gap-2 text-xs p-2 bg-glow-surface rounded-lg">
                              <button onClick={()=>{setQuery(tx.hash);search(tx.hash);}} className="font-mono text-glow-cyan hover:underline truncate flex-1">{truncateAddress(tx.hash, 10)}</button>
                              <span className="text-glow-muted hidden sm:block">{tx.value} USDC</span>
                              <ArrowRight className="w-3 h-3 text-glow-muted flex-shrink-0"/>
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

        {/* Network info cards */}
        {!result && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id:'testnet' as NetworkId, label:'Arc Testnet', chainId:'5042002', status:'Test', color:'#7c3aed', rpc:'rpc.testnet.arc.network', scanner:'testnet.arcscan.app' },
              { id:'mainnet' as NetworkId, label:'Arc Mainnet', chainId:'5040002', status:'Live', color:'#10b981', rpc:'rpc.arc.network',         scanner:'arcscan.app' },
            ].map(n => (
              <div key={n.id} onClick={() => setNetwork(n.id)}
                className={cn("bg-glow-card border rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.01]",
                  network===n.id ? "border-glow-accent/40 ring-1 ring-glow-accent/20" : "border-glow-border")}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-glow-text">{n.label}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:`${n.color}20`,color:n.color}}>{n.status}</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-glow-muted">Chain ID</span><span className="font-mono text-glow-text">{n.chainId}</span></div>
                  <div className="flex justify-between"><span className="text-glow-muted">Gas Token</span><span className="text-glow-cyan">USDC (6 decimals)</span></div>
                  <div className="flex justify-between"><span className="text-glow-muted">RPC</span><span className="font-mono text-glow-text truncate ml-4">{n.rpc}</span></div>
                  <div className="flex justify-between"><span className="text-glow-muted">Scanner</span><a href={`https://${n.scanner}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-glow-cyan hover:underline">{n.scanner}</a></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
