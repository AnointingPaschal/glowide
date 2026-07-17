"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { TokenChart } from "@/components/charts/TokenChart";
import {
  Search, TrendingUp, TrendingDown, RefreshCw, ExternalLink,
  Star, Zap, Copy, CheckCircle, ChevronLeft, Activity,
  BarChart2, Droplets, ArrowUpRight, ArrowDownRight, Filter,
  Globe, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────
interface DexPair {
  chainId: string; dexId: string; url: string; pairAddress: string;
  baseToken:  { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?:  string; priceNative?: string;
  liquidity?: { usd?: number };
  volume?:    { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  txns?:      { h24?: { buys?: number; sells?: number } };
  fdv?: number; marketCap?: number;
  pairCreatedAt?: number;
}

interface CgToken {
  id: string; symbol: string; name: string; image: string;
  current_price: number; market_cap: number; market_cap_rank: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  total_volume: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtNum = (n?: number, dec = 2) => {
  if (!n && n !== 0) return "—";
  if (n >= 1e9)  return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6)  return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3)  return "$" + (n / 1e3).toFixed(2) + "K";
  return "$" + n.toFixed(dec);
};
const fmtPrice = (p?: string | number) => {
  const n = parseFloat(String(p ?? "0"));
  if (!n) return "$—";
  if (n < 0.000001) return "$" + n.toExponential(4);
  if (n < 0.01)     return "$" + n.toFixed(8);
  if (n < 1)        return "$" + n.toFixed(6);
  if (n < 1000)     return "$" + n.toFixed(4);
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
const pctColor = (v?: number) => (v ?? 0) >= 0 ? "text-emerald-400" : "text-red-400";
const pctLabel = (v?: number) => {
  if (v === undefined || v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
};

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627eea", polygon: "#8247e5", bsc: "#f3ba2f",
  arbitrum: "#12aaff", optimism: "#ff0420", base: "#0052ff",
  avalanche: "#e84142", solana: "#9945ff",
};

// ── Token card (list row) ──────────────────────────────────────────────────
function PairRow({ pair, rank, onClick }: { pair: DexPair; rank: number; onClick(): void }) {
  const pct24h = pair.priceChange?.h24;
  const up = (pct24h ?? 0) >= 0;
  const age = pair.pairCreatedAt
    ? Math.floor((Date.now() - pair.pairCreatedAt * 1000) / 3600000)
    : null;

  return (
    <button onClick={onClick}
      className="w-full grid grid-cols-[32px_1fr_80px_80px_80px_90px] items-center gap-2 px-4 py-3 hover:bg-glow-surface/50 transition-colors text-left border-b border-glow-border/20 last:border-0">
      <span className="text-[11px] text-glow-muted/50 font-mono">{rank}</span>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: CHAIN_COLORS[pair.chainId] ?? "#7c3aed" }}>
          {pair.baseToken.symbol.slice(0,2)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-glow-text truncate">
            {pair.baseToken.symbol}
            <span className="text-glow-muted/50 font-normal">/{pair.quoteToken.symbol}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-glow-muted/40 uppercase">{pair.chainId}</span>
            <span className="text-[9px] text-glow-muted/40">{pair.dexId}</span>
            {age !== null && age < 48 && (
              <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded">NEW</span>
            )}
          </div>
        </div>
      </div>
      <span className={cn("text-xs font-mono text-right tabular-nums hidden sm:block", up ? "text-emerald-400" : "text-red-400")}>
        {pctLabel(pair.priceChange?.h1)}
      </span>
      <span className={cn("text-xs font-mono text-right tabular-nums", up ? "text-emerald-400" : "text-red-400")}>
        {pctLabel(pct24h)}
      </span>
      <span className="text-xs font-mono text-glow-text/80 text-right tabular-nums">{fmtNum(pair.volume?.h24)}</span>
      <span className="text-xs font-mono text-glow-text text-right tabular-nums">{fmtPrice(pair.priceUsd)}</span>
    </button>
  );
}

// ── CoinGecko row ───────────────────────────────────────────────────────────
function CgRow({ token, rank, onClick }: { token: CgToken; rank: number; onClick(): void }) {
  const up = (token.price_change_percentage_24h ?? 0) >= 0;
  return (
    <button onClick={onClick}
      className="w-full grid grid-cols-[32px_1fr_80px_80px_80px_90px] items-center gap-2 px-4 py-3 hover:bg-glow-surface/50 transition-colors text-left border-b border-glow-border/20 last:border-0">
      <span className="text-[11px] text-glow-muted/50 font-mono">{rank}</span>
      <div className="flex items-center gap-2.5 min-w-0">
        {token.image ? (
          <img src={token.image} alt={token.symbol} width={32} height={32} className="rounded-full flex-shrink-0"/>
        ) : (
          <div className="w-8 h-8 rounded-full bg-glow-accent/20 flex items-center justify-center text-[11px] font-bold text-glow-accent flex-shrink-0">
            {token.symbol.slice(0,2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold text-glow-text">{token.symbol.toUpperCase()}</p>
          <p className="text-[10px] text-glow-muted/50 truncate">{token.name}</p>
        </div>
      </div>
      <span className={cn("text-xs font-mono text-right tabular-nums hidden sm:block",
        (token.price_change_percentage_1h_in_currency ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
        {pctLabel(token.price_change_percentage_1h_in_currency)}
      </span>
      <span className={cn("text-xs font-mono text-right tabular-nums", up ? "text-emerald-400" : "text-red-400")}>
        {pctLabel(token.price_change_percentage_24h)}
      </span>
      <span className="text-xs font-mono text-glow-text/80 text-right tabular-nums">{fmtNum(token.total_volume)}</span>
      <span className="text-xs font-mono text-glow-text text-right tabular-nums">{fmtPrice(token.current_price)}</span>
    </button>
  );
}

// ── Token Detail Page ──────────────────────────────────────────────────────
function TokenDetail({ pair, onBack }: { pair: DexPair | CgToken; onBack(): void }) {
  const isDex = "pairAddress" in pair;
  const p     = pair as DexPair;
  const cg    = pair as CgToken;
  const symbol   = isDex ? p.baseToken.symbol : cg.symbol.toUpperCase();
  const name     = isDex ? p.baseToken.name   : cg.name;
  const priceUsd = isDex ? p.priceUsd : String(cg.current_price);
  const address  = isDex ? p.baseToken.address : cg.id;
  const pct24h   = isDex ? p.priceChange?.h24 : cg.price_change_percentage_24h;
  const volume   = isDex ? p.volume?.h24 : cg.total_volume;
  const liq      = isDex ? p.liquidity?.usd : undefined;
  const mc       = isDex ? p.marketCap ?? p.fdv : cg.market_cap;
  const buys     = isDex ? p.txns?.h24?.buys   : undefined;
  const sells    = isDex ? p.txns?.h24?.sells  : undefined;
  const up       = (pct24h ?? 0) >= 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 text-glow-muted hover:text-glow-text">
          <ChevronLeft className="w-5 h-5"/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-glow-text">{symbol}</h2>
            <span className="text-sm text-glow-muted/60">{name}</span>
            {isDex && (
              <span className="text-[10px] bg-glow-surface border border-glow-border/50 px-2 py-0.5 rounded-full text-glow-muted/60 uppercase">
                {p.chainId} · {p.dexId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-2xl font-bold text-glow-text">{fmtPrice(priceUsd)}</span>
            <span className={cn("flex items-center gap-1 text-sm font-semibold", pctColor(pct24h))}>
              {up ? <ArrowUpRight className="w-4 h-4"/> : <ArrowDownRight className="w-4 h-4"/>}
              {pctLabel(pct24h)} <span className="text-glow-muted/50 font-normal text-xs">24h</span>
            </span>
          </div>
        </div>
        {isDex && p.url && (
          <a href={p.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 bg-glow-card border border-glow-border rounded-xl text-xs text-glow-muted hover:text-glow-text">
            <ExternalLink className="w-3.5 h-3.5"/>DexScreener
          </a>
        )}
      </div>

      {/* Chart */}
      <TokenChart symbol={symbol} address={isDex ? p.baseToken.address : undefined}/>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BarChart2, label: "Volume 24h", value: fmtNum(volume) },
          { icon: Droplets,  label: "Liquidity",  value: fmtNum(liq) },
          { icon: Globe,     label: "Market Cap",  value: fmtNum(mc) },
          { icon: Activity,  label: "Buys/Sells",  value: buys !== undefined ? `${buys}/${sells}` : "—" },
        ].map(s => (
          <div key={s.label} className="bg-glow-card border border-glow-border rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className="w-3.5 h-3.5 text-glow-accent/70"/>
              <span className="text-[10px] text-glow-muted/60 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-sm font-bold text-glow-text">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Timeframe price changes */}
      {isDex && p.priceChange && (
        <div className="bg-glow-card border border-glow-border rounded-xl p-4">
          <p className="text-xs font-semibold text-glow-muted/60 uppercase tracking-wider mb-3">Price Change</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "5m", v: p.priceChange.m5 },
              { label: "1h", v: p.priceChange.h1 },
              { label: "6h", v: p.priceChange.h6 },
              { label: "24h",v: p.priceChange.h24 },
            ].map(t => (
              <div key={t.label} className="text-center">
                <p className="text-[10px] text-glow-muted/50 mb-1">{t.label}</p>
                <p className={cn("text-sm font-bold", pctColor(t.v))}>{pctLabel(t.v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contract address */}
      {isDex && (
        <div className="bg-glow-card border border-glow-border rounded-xl p-4">
          <p className="text-xs text-glow-muted/60 mb-1">Token Contract</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-glow-cyan break-all">{p.baseToken.address}</code>
            <button onClick={() => navigator.clipboard.writeText(p.baseToken.address)}
              className="text-glow-muted/50 hover:text-glow-accent flex-shrink-0">
              <Copy className="w-3.5 h-3.5"/>
            </button>
          </div>
          <p className="text-xs text-glow-muted/60 mt-2 mb-1">Pair Address</p>
          <code className="text-xs font-mono text-glow-muted/50 break-all">{p.pairAddress}</code>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN DEX PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function DexPage() {
  const [view, setView]     = useState<"list"|"detail">("list");
  const [tab,  setTab]      = useState<"trending"|"new"|"gainers"|"losers">("trending");
  const [search, setSearch] = useState("");
  const [tokens, setTokens] = useState<CgToken[]>([]);
  const [pairs,  setPairs]  = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DexPair | CgToken | null>(null);

  const load = useCallback(async (action = "trending", q = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action });
      if (q) params.set("q", q);
      const res  = await fetch("/api/dex?" + params);
      const data = await res.json() as {
        tokens?: CgToken[]; pairs?: DexPair[];
        coins?: Array<{id:string;symbol:string;name:string}>;
      };
      if (data.tokens) {
        // Sort for gainers/losers
        let sorted = [...data.tokens];
        if (tab === "gainers") sorted.sort((a,b) => (b.price_change_percentage_24h??0) - (a.price_change_percentage_24h??0));
        if (tab === "losers")  sorted.sort((a,b) => (a.price_change_percentage_24h??0) - (b.price_change_percentage_24h??0));
        setTokens(sorted);
      }
      if (data.pairs) setPairs(data.pairs.filter(p => (p.liquidity?.usd ?? 0) > 1000).slice(0, 50));
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load("trending"); }, []);

  const handleTabChange = (t: typeof tab) => {
    setTab(t);
    if (t === "new") load("new-pairs");
    else load("trending");
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    if (v.length > 2) load("search", v);
    else if (!v) load("trending");
  };

  if (view === "detail" && selected) {
    return (
      <AppLayout title="Token Detail">
        <div className="p-4 max-w-4xl mx-auto">
          <TokenDetail pair={selected} onBack={() => { setView("list"); setSelected(null); }}/>
        </div>
      </AppLayout>
    );
  }

  const showPairs = tab === "new" && pairs.length > 0;

  return (
    <AppLayout title="DEX">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-glow-text">DEX Explorer</h1>
            <button onClick={() => load(tab === "new" ? "new-pairs" : "trending")}
              disabled={loading} className="p-2 text-glow-muted hover:text-glow-text">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")}/>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-glow-muted/50"/>
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search tokens, pairs, contracts…"
              className="w-full pl-10 pr-4 py-2.5 bg-glow-card border border-glow-border rounded-xl text-sm text-glow-text placeholder-glow-muted/40 focus:outline-none focus:border-glow-accent/50"/>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-0">
            {([
              ["trending", "🔥 Trending"],
              ["gainers",  "📈 Gainers"],
              ["losers",   "📉 Losers"],
              ["new",      "⚡ New Pairs"],
            ] as const).map(([id, label]) => (
              <button key={id} onClick={() => handleTabChange(id)}
                className={cn("px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all",
                  tab === id ? "bg-glow-accent/20 text-glow-accent-light" : "text-glow-muted/60 hover:text-glow-text")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[32px_1fr_80px_80px_80px_90px] gap-2 px-4 py-2 border-b border-glow-border/40 mt-3">
          {["#", "Token", "1h", "24h", "Volume", "Price"].map((h, i) => (
            <span key={h} className={cn("text-[10px] font-semibold text-glow-muted/50 uppercase tracking-wider",
              i > 0 && i < 5 ? "text-right" : i === 5 ? "text-right" : "")}>
              {h}
            </span>
          ))}
        </div>

        {/* Token list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-glow-accent/50"/>
          </div>
        ) : (
          <div>
            {showPairs
              ? pairs.map((p, i) => (
                  <PairRow key={p.pairAddress} pair={p} rank={i+1}
                    onClick={() => { setSelected(p); setView("detail"); }}/>
                ))
              : tokens.map((t, i) => (
                  <CgRow key={t.id} token={t} rank={i+1}
                    onClick={() => { setSelected(t); setView("detail"); }}/>
                ))
            }
            {!loading && tokens.length === 0 && pairs.length === 0 && (
              <div className="text-center py-12 text-glow-muted/50 text-sm">No results</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
