'use client';
export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { NETWORKS, EVM_NETWORKS, LOGOS, type NetworkInfo } from '@/lib/circle-chains';
import { NetworkLogo } from '@/components/wallet/CryptoLogo';
import { useCircleLogos } from '@/hooks/useCircleLogos';
import {
  Search, ExternalLink, Copy, CheckCircle, Loader2, AlertCircle,
  Hash, Wallet, Code2, Box, RefreshCw, ChevronDown, Activity,
  Layers, Zap, TrendingUp, Globe, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/utils';

// ── EVM-compatible networks with Blockscout API ───────────────────────────────
const EXPLOREABLE = EVM_NETWORKS.filter(n => n.explorerApi);
// Also include Arc Testnet at the top
const ALL_NETWORKS_SORTED = [
  ...NETWORKS.filter(n => n.id === 'arc-testnet'),
  ...EXPLOREABLE.filter(n => n.id !== 'arc-testnet'),
];

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return (
    <button onClick={async e => { e.stopPropagation(); await navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 2000); }}
      className="text-glow-muted hover:text-glow-text transition-colors flex-shrink-0">
      {c ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400"/> : <Copy className="w-3.5 h-3.5"/>}
    </button>
  );
}

// ── Result row ─────────────────────────────────────────────────────────────────
function Row({ label, value, mono, link, className='' }: { label:string; value:React.ReactNode; mono?:boolean; link?:string; className?:string }) {
  return (
    <div className={cn("flex items-start gap-3 py-2.5 border-b border-glow-border/40 last:border-0", className)}>
      <span className="text-xs text-glow-muted w-36 flex-shrink-0 pt-0.5">{label}</span>
      <div className={cn("flex-1 text-sm text-glow-text break-all", mono && "font-mono text-xs")}>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="text-glow-cyan hover:underline flex items-center gap-1 w-fit">
            {value}<ExternalLink className="w-3 h-3 flex-shrink-0"/>
          </a>
        ) : value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = { success:'text-emerald-400 bg-emerald-500/15 border-emerald-500/25', ok:'text-emerald-400 bg-emerald-500/15 border-emerald-500/25', failed:'text-red-400 bg-red-500/15 border-red-500/25', error:'text-red-400 bg-red-500/15 border-red-500/25', pending:'text-amber-400 bg-amber-500/15 border-amber-500/25' }[status] ?? 'text-glow-muted bg-glow-card border-glow-border';
  const label = { ok:'Success', error:'Failed' }[status] ?? status;
  return <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize", cfg)}>{(status==='success'||status==='ok')?'✓':(status==='failed'||status==='error')?'✗':'⏳'} {label}</span>;
}

// ── Network selector dropdown ──────────────────────────────────────────────────
function NetworkSelector({ selected, onChange, arcLogoUrl='' }: { selected: string; onChange: (id: string) => void; arcLogoUrl?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const net = ALL_NETWORKS_SORTED.find(n => n.id === selected) ?? ALL_NETWORKS_SORTED[0];
  const filtered = ALL_NETWORKS_SORTED.filter(n =>
    !search || n.name.toLowerCase().includes(search.toLowerCase()) || n.shortName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-2 pr-3 py-2 bg-glow-card border border-glow-border rounded-xl hover:border-glow-accent/40 transition-colors text-sm">
        <NetworkLogo networkId={net.id} fallbackLogo={net.id==="arc-testnet" && arcLogoUrl ? arcLogoUrl : net.logo} resolvedLogo={net.id==="arc-testnet" && arcLogoUrl ? arcLogoUrl : undefined} size={20}/>
        <span className="font-medium text-glow-text hidden sm:block">{net.shortName}</span>
        {net.testnet && <span className="hidden md:block text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded-full">TEST</span>}
        <ChevronDown className={cn("w-3.5 h-3.5 text-glow-muted transition-transform", open && "rotate-180")}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setSearch(''); }}/>
          <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#0e0e1a] border border-glow-border rounded-2xl shadow-2xl z-40 overflow-hidden animate-fade-in">
            <div className="p-2 border-b border-glow-border">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search networks…"
                className="w-full bg-glow-bg rounded-lg px-3 py-2 text-xs text-glow-text placeholder-glow-muted/50 focus:outline-none border border-glow-border focus:border-glow-accent/50" autoFocus/>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {/* Group: Arc */}
              {filtered.filter(n => n.id === 'arc-testnet').map(n => (
                <button key={n.id} onClick={() => { onChange(n.id); setOpen(false); setSearch(''); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-glow-card/60 transition-colors", selected===n.id && "bg-glow-accent/10")}>
                  <NetworkLogo networkId={n.id} fallbackLogo={n.id==="arc-testnet" && arcLogoUrl ? arcLogoUrl : n.logo} resolvedLogo={n.id==="arc-testnet" && arcLogoUrl ? arcLogoUrl : undefined} size={28}/>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-semibold text-glow-text">{n.name}</p>
                    <p className="text-[10px] text-glow-muted">{n.ecosystem} · USDC native gas</p>
                  </div>
                  {selected===n.id && <CheckCircle className="w-3.5 h-3.5 text-glow-accent flex-shrink-0"/>}
                </button>
              ))}
              {/* Group: EVM testnets with API */}
              {filtered.filter(n => n.id !== 'arc-testnet' && n.testnet).length > 0 && (
                <p className="text-[10px] font-semibold text-glow-muted uppercase tracking-widest px-3 pt-2 pb-1">EVM Testnets</p>
              )}
              {filtered.filter(n => n.id !== 'arc-testnet' && n.testnet).map(n => (
                <button key={n.id} onClick={() => { onChange(n.id); setOpen(false); setSearch(''); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 hover:bg-glow-card/60 transition-colors", selected===n.id && "bg-glow-accent/10")}>
                  <NetworkLogo networkId={n.id} fallbackLogo={n.id==="arc-testnet" && arcLogoUrl ? arcLogoUrl : n.logo} resolvedLogo={n.id==="arc-testnet" && arcLogoUrl ? arcLogoUrl : undefined} size={24}/>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-medium text-glow-text">{n.name}</p>
                    <p className="text-[10px] text-glow-muted">{n.ecosystem}{n.chainId ? ` · ${n.chainId}` : ''}</p>
                  </div>
                  {selected===n.id && <CheckCircle className="w-3.5 h-3.5 text-glow-accent flex-shrink-0"/>}
                </button>
              ))}
              {filtered.filter(n => !n.testnet && n.id !== 'arc-testnet').length > 0 && (
                <p className="text-[10px] font-semibold text-glow-muted uppercase tracking-widest px-3 pt-2 pb-1">EVM Mainnets</p>
              )}
              {filtered.filter(n => !n.testnet && n.id !== 'arc-testnet').map(n => (
                <button key={n.id} onClick={() => { onChange(n.id); setOpen(false); setSearch(''); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 hover:bg-glow-card/60 transition-colors", selected===n.id && "bg-glow-accent/10")}>
                  <NetworkLogo networkId={n.id} fallbackLogo={n.id==="arc-testnet" && arcLogoUrl ? arcLogoUrl : n.logo} resolvedLogo={n.id==="arc-testnet" && arcLogoUrl ? arcLogoUrl : undefined} size={24}/>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-medium text-glow-text">{n.name}</p>
                    <p className="text-[10px] text-glow-muted">{n.ecosystem}{n.chainId ? ` · ${n.chainId}` : ''}</p>
                  </div>
                  {selected===n.id && <CheckCircle className="w-3.5 h-3.5 text-glow-accent flex-shrink-0"/>}
                </button>
              ))}
              {filtered.length === 0 && <p className="text-xs text-glow-muted text-center py-4">No networks found</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Network stats widget ───────────────────────────────────────────────────────
function NetworkStats({ network }: { network: NetworkInfo }) {
  const [block, setBlock] = useState<{ number:string; hash:string; txCount:number; gasUsed:string; timestamp:string }|null>(null);
  const [stats, setStats] = useState<{ total_transactions?:string; total_blocks?:string }|null>(null);
  const [loading, setLoading] = useState(false);
  const isArc = network.id === 'arc-testnet';
  const rpc = isArc ? 'https://rpc.testnet.arc.network' : null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (network.explorerApi) {
        const [statsRes, blockRes] = await Promise.allSettled([
          fetch(`/api/explorer?type=stats&network=${network.id}`).then(r=>r.json()),
          isArc && rpc ? fetch(rpc, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getBlockByNumber',params:['latest',false]}),cache:'no-store'}).then(r=>r.json()) : Promise.resolve(null),
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data);
        if (blockRes.status === 'fulfilled' && blockRes.value?.result) {
          const b = blockRes.value.result;
          setBlock({ number:parseInt(b.number,16).toLocaleString(), hash:b.hash, txCount:(b.transactions??[]).length, gasUsed:parseInt(b.gasUsed||'0',16).toLocaleString(), timestamp:b.timestamp });
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [network, isArc, rpc]);

  useEffect(() => { refresh(); const t = isArc ? setInterval(refresh, 12000) : null; return () => { if (t) clearInterval(t); }; }, [refresh, isArc]);

  const cards = [
    { icon:Layers,     label:'Latest Block',   value:block?.number ?? '—',   color:'#7c3aed' },
    { icon:Activity,   label:'TXs in Block',   value:block ? String(block.txCount) : '—', color:'#06b6d4' },
    { icon:Zap,        label:'Gas Used',        value:block?.gasUsed ?? '—',  color:'#f59e0b' },
    { icon:TrendingUp, label:'Total TXs',       value:stats?.total_transactions ? parseInt(stats.total_transactions).toLocaleString() : '—', color:'#10b981' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ icon:Icon, label, value, color }) => (
        <div key={label} className="bg-glow-card border border-glow-border rounded-2xl p-3.5 relative overflow-hidden">
          <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full opacity-10 blur-xl" style={{ background:color }}/>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:`${color}20` }}>
              <Icon className="w-4 h-4" style={{ color }}/>
            </div>
            <div>
              <p className="text-[10px] text-glow-muted uppercase tracking-wider">{label}</p>
              <p className="text-sm font-bold text-glow-text leading-tight">{value}</p>
            </div>
          </div>
          {label === 'Latest Block' && isArc && (
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ExplorerPage() {
  const cl = useCircleLogos();
  const [networkId, setNetworkId] = useState('arc-testnet');
  const [query, setQuery]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<Record<string,unknown>|null>(null);
  const [error, setError]         = useState<string|null>(null);
  const network = ALL_NETWORKS_SORTED.find(n => n.id === networkId) ?? ALL_NETWORKS_SORTED[0];

  const search = useCallback(async (q?: string) => {
    const val = (q ?? query).trim();
    if (!val) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(`/api/explorer?q=${encodeURIComponent(val)}&network=${networkId}`);
      const d = await res.json();
      if (!res.ok || d.error) setError(d.error ?? 'Not found on this network');
      else setResult(d);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [query, networkId]);

  const nav = (q: string) => { setQuery(q); search(q); };

  return (
    <AppLayout title="Explorer">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-glow-text">Multi-Chain Explorer</h1>
            <p className="text-sm text-glow-muted mt-0.5">Circle network ecosystem · {ALL_NETWORKS_SORTED.length} networks · Blockscout API</p>
          </div>
          <a href={network.explorer} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-glow-cyan hover:text-glow-accent-light px-3 py-1.5 bg-glow-card border border-glow-border rounded-lg transition-colors">
            <ExternalLink className="w-3.5 h-3.5"/>Open in Explorer
          </a>
        </div>

        {/* Network selector + search */}
        <div className="flex gap-2">
          <NetworkSelector selected={networkId} arcLogoUrl={cl.ARC} onChange={id => { setNetworkId(id); setResult(null); setError(null); }}/>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-glow-muted pointer-events-none"/>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==='Enter' && search()}
              placeholder={`Search address · tx hash · block number on ${network.shortName}…`}
              className="w-full bg-glow-card border border-glow-border rounded-xl pl-11 pr-4 py-3 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/60 transition-colors"/>
          </div>
          <button onClick={() => search()} disabled={loading || !query.trim()}
            className="px-5 py-3 bg-glow-gradient text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>

        {/* Network info bar */}
        <div className="flex items-center gap-3 p-3 bg-glow-card border border-glow-border rounded-xl flex-wrap">
          <NetworkLogo networkId={network.id} fallbackLogo={network.id==="arc-testnet" && cl.ARC ? cl.ARC : network.logo} resolvedLogo={network.id==="arc-testnet" && cl.ARC ? cl.ARC : undefined} size={28}/>
          <div>
            <p className="text-sm font-semibold text-glow-text">{network.name}</p>
            <p className="text-[10px] text-glow-muted">{network.ecosystem}{network.chainId ? ` · Chain ${network.chainId}` : ''}{network.testnet ? ' · Testnet' : ' · Mainnet'}</p>
          </div>
          {network.cctpSupported && <span className="text-[10px] text-glow-accent bg-glow-accent/10 border border-glow-accent/20 px-2 py-0.5 rounded-full flex items-center gap-1"><Zap className="w-2.5 h-2.5"/>CCTP {network.cctpDomain !== undefined ? `Domain ${network.cctpDomain}` : ''}</span>}
          {/* Circle assets on this network */}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {network.usdc  && <span className="flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full"><NetworkLogo networkId="usdc" fallbackLogo={LOGOS.usdc} size={12}/>USDC</span>}
            {network.eurc  && <span className="flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full"><NetworkLogo networkId="eurc" fallbackLogo={LOGOS.eurc} size={12}/>EURC</span>}
            {network.cirbtc && <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full"><NetworkLogo networkId="cirbtc" fallbackLogo={LOGOS.cirbtc} size={12}/>cirBTC</span>}
            {network.usyc  && <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full"><NetworkLogo networkId="usyc" fallbackLogo={LOGOS.usyc} size={12}/>USYC</span>}
          </div>
        </div>

        {/* Live stats (only for networks with APIs) */}
        {network.explorerApi && <NetworkStats network={network}/>}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-sm font-medium text-red-300">{error}</p>
              <p className="text-xs text-red-400/60 mt-1">Try searching on <a href={network.explorer} target="_blank" rel="noopener noreferrer" className="underline">{network.name} explorer ↗</a></p>
            </div>
          </div>
        )}

        {/* ── Address result ─────────────────────────────────────── */}
        {result && (result.type === 'address' || result.type === 'contract') && (() => {
          const d = result.data as Record<string,unknown>;
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
                  <ExternalLink className="w-3.5 h-3.5"/>Explorer
                </a>
              </div>
              <div className="px-5 py-1">
                <Row label="Address" mono value={<div className="flex items-center gap-1.5">{d.address as string}<CopyBtn text={d.address as string}/></div>}/>
                <Row label="Balance" value={<span className="font-semibold text-glow-cyan">{d.balance as string} {network.id === 'arc-testnet' ? 'USDC' : 'native'}</span>}/>
                <Row label="Transactions" value={(d.txCount as number)?.toLocaleString() ?? '—'}/>
                <Row label="Type" value={d.isContract ? <span className="flex items-center gap-1.5 text-glow-cyan"><Code2 className="w-3.5 h-3.5"/>Smart Contract{d.tokenSymbol ? ` · ${d.tokenSymbol}` : ''}</span> : <span className="text-glow-muted">EOA</span>}/>
                {Array.isArray(d.tokenBalances) && (d.tokenBalances as unknown[]).length > 0 && (
                  <div className="py-3">
                    <p className="text-xs text-glow-muted font-semibold uppercase tracking-wider mb-2">Token Balances</p>
                    <div className="space-y-1.5">
                      {(d.tokenBalances as Array<{symbol:string;balance:string;address:string}>).map(tok => (
                        <div key={tok.address} className="flex items-center justify-between text-sm p-2 bg-glow-surface rounded-lg">
                          <button onClick={() => nav(tok.address)} className="text-glow-cyan hover:underline font-mono text-xs">{tok.symbol}</button>
                          <span className="text-glow-text font-semibold">{tok.balance}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(d.recentTxs) && (d.recentTxs as unknown[]).length > 0 && (
                  <div className="py-3">
                    <p className="text-xs text-glow-muted font-semibold uppercase tracking-wider mb-2">Recent Transactions</p>
                    <div className="space-y-1.5">
                      {(d.recentTxs as Array<{hash:string;value:string;status:string}>).map(tx => (
                        <div key={tx.hash} className="flex items-center gap-3 p-2 bg-glow-surface rounded-lg">
                          <StatusBadge status={tx.status ?? 'pending'}/>
                          <button onClick={() => nav(tx.hash)} className="flex-1 font-mono text-xs text-glow-cyan hover:underline truncate">{truncateAddress(tx.hash, 10)}</button>
                          <span className="text-xs text-glow-muted flex-shrink-0">{tx.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Transaction result ─────────────────────────────────── */}
        {result && result.type === 'transaction' && (() => {
          const d = result.data as Record<string,unknown>;
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
                  <ExternalLink className="w-3.5 h-3.5"/>Explorer
                </a>
              </div>
              <div className="px-5 py-1">
                <Row label="Tx Hash" mono value={<div className="flex items-center gap-1.5">{truncateAddress(d.hash as string, 14)}<CopyBtn text={d.hash as string}/></div>}/>
                <Row label="Status" value={<StatusBadge status={String(d.status)}/>}/>
                {d.block && <Row label="Block" value={<button onClick={() => nav(String(d.block))} className="text-glow-cyan hover:underline">#{String(d.block)}</button>}/>}
                {d.timestamp && <Row label="Timestamp" value={new Date(String(d.timestamp)).toLocaleString()}/>}
                <Row label="From" mono value={d.from ? <div className="flex items-center gap-1.5"><button onClick={() => nav(d.from as string)} className="text-glow-cyan hover:underline">{truncateAddress(d.from as string, 12)}</button><CopyBtn text={d.from as string}/></div> : '—'}/>
                <Row label="To" mono value={d.to ? <div className="flex items-center gap-1.5"><button onClick={() => nav(d.to as string)} className="text-glow-cyan hover:underline">{truncateAddress(d.to as string, 12)}</button><CopyBtn text={d.to as string}/></div> : d.contractCreated ? <span className="text-glow-cyan">Contract: {truncateAddress(d.contractCreated as string, 10)}</span> : '—'}/>
                {d.value !== undefined && <Row label="Value" value={<span className="text-glow-cyan font-semibold">{d.value as string}</span>}/>}
                {d.decodedMethod && <Row label="Method" value={<span className="text-glow-accent font-mono text-xs px-2 py-0.5 bg-glow-accent/10 rounded-lg">{d.decodedMethod as string}</span>}/>}
                {d.revertReason && <Row label="Revert Reason" value={<span className="text-red-400 text-xs">{d.revertReason as string}</span>}/>}
              </div>
            </div>
          );
        })()}

        {/* ── Block result ───────────────────────────────────────── */}
        {result && result.type === 'block' && (() => {
          const d = result.data as Record<string,unknown>;
          return (
            <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-glow-border bg-glow-surface/50">
                <div className="flex items-center gap-2.5"><Box className="w-5 h-5 text-emerald-400"/><span className="text-sm font-bold text-glow-text">Block #{String(d.number)}</span></div>
                <a href={d.explorerUrl as string} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-glow-cyan hover:text-glow-accent-light px-3 py-1.5 bg-glow-bg border border-glow-border rounded-lg flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5"/>Explorer
                </a>
              </div>
              <div className="px-5 py-1">
                <Row label="Block" value={`#${String(d.number)}`}/>
                <Row label="Hash" mono value={<div className="flex items-center gap-1.5">{truncateAddress(d.hash as string, 14)}<CopyBtn text={d.hash as string}/></div>}/>
                {d.timestamp && <Row label="Timestamp" value={new Date(String(d.timestamp)).toLocaleString()}/>}
                <Row label="Transactions" value={String(d.txCount ?? 0)}/>
                {d.gasUsed !== undefined && <Row label="Gas" value={`${String(d.gasUsed)} / ${String(d.gasLimit)}`}/>}
                {d.miner && <Row label="Miner" mono value={<div className="flex items-center gap-1.5"><button onClick={() => nav(d.miner as string)} className="text-glow-cyan hover:underline">{truncateAddress(d.miner as string, 12)}</button><CopyBtn text={d.miner as string}/></div>}/>}
                {Array.isArray(d.transactions) && (d.transactions as unknown[]).length > 0 && (
                  <div className="py-3">
                    <p className="text-xs text-glow-muted font-semibold uppercase tracking-wider mb-2">Transactions</p>
                    <div className="space-y-1.5">
                      {(d.transactions as Array<{hash:string;value:string;status:string}>).map(tx => (
                        <div key={tx.hash} className="flex items-center gap-3 p-2 bg-glow-surface rounded-lg">
                          <StatusBadge status={tx.status ?? 'pending'}/>
                          <button onClick={() => nav(tx.hash)} className="flex-1 font-mono text-xs text-glow-cyan hover:underline truncate">{truncateAddress(tx.hash, 12)}</button>
                          <span className="text-xs text-glow-muted">{tx.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Idle state */}
        {!result && !error && !loading && (
          <div className="bg-glow-card border border-glow-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-glow-cyan"/>
              <p className="text-sm font-semibold text-glow-text">Circle Network Ecosystem</p>
              <span className="text-xs text-glow-muted ml-auto">{NETWORKS.length} networks total</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {NETWORKS.slice(0, 24).map(n => (
                <button key={n.id} onClick={() => setNetworkId(n.id)}
                  className={cn("flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left hover:border-glow-accent/30 hover:bg-glow-surface",
                    n.id === networkId ? "border-glow-accent/40 bg-glow-accent/5" : "border-glow-border/50 bg-glow-surface/30")}>
                  <NetworkLogo networkId={n.id} fallbackLogo={n.id==="arc-testnet" && cl.ARC ? cl.ARC : n.logo} resolvedLogo={n.id==="arc-testnet" && cl.ARC ? cl.ARC : undefined} size={22}/>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-glow-text truncate">{n.shortName}</p>
                    <p className="text-[9px] text-glow-muted truncate">{n.testnet ? 'Testnet' : 'Mainnet'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
