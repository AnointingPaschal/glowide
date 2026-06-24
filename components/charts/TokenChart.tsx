"use client";
import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, ExternalLink,
  Activity, BarChart2, ArrowUpRight, ArrowDownRight,
  Zap, Droplets, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// ── Lazy-load the heavy TradingView chart (no SSR) ────────────────────────────
const TVChartInner = dynamic(() => import("./TVChartInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <RefreshCw className="w-5 h-5 animate-spin text-glow-accent/40"/>
    </div>
  ),
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface OhlcvBar  { time:number; open:number; high:number; low:number; close:number; volume:number; }
interface LinePoint { time:number; value:number; }

interface TokenMeta {
  coingecko?: {
    name?:string; symbol?:string; image?:string; price?:number;
    change24h?:number; change7d?:number; marketCap?:number;
    volume24h?:number; high24h?:number; low24h?:number;
    circSupply?:number; ath?:number;
  };
  dexscreener?: {
    priceUsd?:number; change24h?:number; change1h?:number;
    liquidity?:number; volume24h?:number; volume1h?:number;
    buys24h?:number; sells24h?:number; fdv?:number;
    dexId?:string; url?:string;
    pairs?: Array<{dexId:string;chainId:string;liquidity:number;priceUsd:number;url:string}>;
  };
}

type Timeframe  = "1H"|"4H"|"1D"|"1W"|"1M";
type ChartMode  = "line"|"candlestick";

interface Props { symbol?:string; address?:string; chainId?:string; name?:string; compact?:boolean; }

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmt = {
  price(n?: number) {
    if (!n && n !== 0) return "—";
    if (n < 0.0001) return "$" + n.toExponential(4);
    if (n < 1)      return "$" + n.toFixed(6);
    if (n < 100)    return "$" + n.toFixed(4);
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
  },
  large(n?: number) {
    if (!n) return "—";
    if (n >= 1e9) return "$" + (n/1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n/1e6).toFixed(2) + "M";
    if (n >= 1e3) return "$" + (n/1e3).toFixed(2) + "K";
    return "$" + n.toFixed(2);
  },
  pct(n?: number) {
    if (n === undefined || n === null) return "—";
    return (n >= 0 ? "+" : "") + Math.abs(n).toFixed(2) + "%";
  },
  num(n?: number) {
    if (!n) return "—";
    return n.toLocaleString();
  },
};

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, positive, sub }: { label:string; value:string; positive?:boolean; sub?:string }) {
  return (
    <div className="bg-glow-surface border border-glow-border/50 rounded-xl p-2.5 space-y-0.5">
      <p className="text-[9px] font-semibold text-glow-muted/50 uppercase tracking-wider">{label}</p>
      <p className={cn("text-xs font-bold leading-tight",
        positive === true  ? "text-emerald-400" :
        positive === false ? "text-red-400"     : "text-glow-text")}>{value}</p>
      {sub && <p className="text-[9px] text-glow-muted/40">{sub}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export function TokenChart({ symbol, address, chainId, name, compact = false }: Props) {
  const [tf,       setTf]       = useState<Timeframe>("1D");
  const [mode,     setMode]     = useState<ChartMode>("line");
  const [data,     setData]     = useState<OhlcvBar[]|LinePoint[]>([]);
  const [meta,     setMeta]     = useState<TokenMeta|null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string|null>(null);

  // ── Fetch chart data (CoinGecko only) ─────────────────────────────────────
  const fetchChart = useCallback(async (timeframe: Timeframe, chartMode: ChartMode) => {
    if (!symbol && !address) return;
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({
        tf: timeframe,
        type: chartMode,
        source: "coingecko", // force CoinGecko
      });
      if (symbol)  p.set("symbol",  symbol.toUpperCase());
      if (address) p.set("address", address);
      if (chainId) p.set("chain",   chainId);
      const res = await fetch("/api/charts?" + p);
      const d   = await res.json() as { data:OhlcvBar[]|LinePoint[]; error?:string };
      if (d.error && !d.data?.length) { setError(d.error); setData([]); }
      else { setData(d.data ?? []); setError(null); }
    } catch(e) { setError((e as Error).message); }
    finally    { setLoading(false); }
  }, [symbol, address, chainId]);

  // ── Fetch metadata (CoinGecko price + DexScreener DEX data) ───────────────
  const fetchMeta = useCallback(async () => {
    if (!symbol && !address) return;
    try {
      const p = new URLSearchParams({ type: "meta" });
      if (symbol)  p.set("symbol",  symbol.toUpperCase());
      if (address) p.set("address", address);
      const res = await fetch("/api/charts?" + p);
      setMeta(await res.json() as TokenMeta);
    } catch { /* silent */ }
  }, [symbol, address]);

  useEffect(() => {
    fetchChart(tf, mode);
    fetchMeta();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, address]);

  useEffect(() => {
    fetchChart(tf, mode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tf, mode]);

  // ── Derived display values ─────────────────────────────────────────────────
  // Prefer CoinGecko price (more reliable), fallback to DexScreener
  const price    = meta?.coingecko?.price    ?? meta?.dexscreener?.priceUsd;
  const change   = meta?.coingecko?.change24h ?? meta?.dexscreener?.change24h ?? 0;
  const positive = change >= 0;
  const displayName = name || meta?.coingecko?.name || symbol?.toUpperCase();
  const dex      = meta?.dexscreener;
  const cg       = meta?.coingecko;

  const TFs: Timeframe[] = compact ? ["1D","1W","1M"] : ["1H","4H","1D","1W","1M"];

  // ── Chart render area ──────────────────────────────────────────────────────
  const chartHeight = compact ? "h-32" : "h-72";
  const chartArea = loading ? (
    <div className={cn("flex flex-col items-center justify-center gap-2", chartHeight)}>
      <RefreshCw className="w-5 h-5 text-glow-accent/40 animate-spin"/>
      <p className="text-[10px] text-glow-muted/40">Loading chart…</p>
    </div>
  ) : error || !data.length ? (
    <div className={cn("flex flex-col items-center justify-center gap-2", chartHeight)}>
      <Activity className="w-7 h-7 text-glow-muted/20"/>
      <p className="text-[11px] text-glow-muted/40">{error ?? "No chart data"}</p>
    </div>
  ) : (
    <div className={chartHeight}>
      <TVChartInner data={data} type={mode}/>
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMPACT MODE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (compact) return (
    <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
      {/* Token header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-glow-border/40">
        <div className="flex items-center gap-2">
          {cg?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cg.image} alt={symbol ?? ""} width={20} height={20} className="rounded-full flex-shrink-0"/>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-glow-text">{displayName}</span>
            {symbol && <span className="text-[10px] text-glow-muted/50">{symbol.toUpperCase()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {price !== undefined && (
            <span className="text-xs font-bold text-glow-text">{fmt.price(price)}</span>
          )}
          {change !== 0 && (
            <span className={cn("text-[10px] font-semibold flex items-center gap-0.5", positive ? "text-emerald-400" : "text-red-400")}>
              {positive ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
              {fmt.pct(change)}
            </span>
          )}
          <button onClick={() => { fetchChart(tf, mode); fetchMeta(); }}
            className="text-glow-muted/30 hover:text-glow-muted transition-colors">
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")}/>
          </button>
        </div>
      </div>

      {/* Timeframe + type buttons */}
      <div className="flex items-center gap-1 px-3 py-1.5">
        {TFs.map(t => (
          <button key={t} onClick={() => setTf(t)}
            className={cn("text-[10px] px-2 py-0.5 rounded font-medium transition-colors",
              tf === t ? "bg-glow-accent/20 text-glow-accent-light" : "text-glow-muted/40 hover:text-glow-muted")}>
            {t}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <button onClick={() => setMode("line")} className={cn("p-1 rounded transition-colors", mode==="line" ? "text-glow-accent" : "text-glow-muted/30")}>
            <TrendingUp className="w-3 h-3"/>
          </button>
          <button onClick={() => setMode("candlestick")} className={cn("p-1 rounded transition-colors", mode==="candlestick" ? "text-glow-accent" : "text-glow-muted/30")}>
            <BarChart2 className="w-3 h-3"/>
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="px-1 pb-2 overflow-hidden">{chartArea}</div>

      {/* DexScreener mini stats */}
      {dex && (
        <div className="border-t border-glow-border/30 px-3 py-2 flex items-center gap-4 flex-wrap">
          {dex.liquidity && (
            <div className="flex items-center gap-1 text-[10px] text-glow-muted">
              <Droplets className="w-3 h-3 text-blue-400 flex-shrink-0"/>
              {fmt.large(dex.liquidity)}
            </div>
          )}
          {dex.volume24h && (
            <div className="flex items-center gap-1 text-[10px] text-glow-muted">
              <BarChart2 className="w-3 h-3 text-glow-accent/60 flex-shrink-0"/>
              {fmt.large(dex.volume24h)} <span className="text-glow-muted/40">vol</span>
            </div>
          )}
          {dex.url && (
            <a href={dex.url} target="_blank" rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-[10px] text-glow-muted/50 hover:text-glow-cyan transition-colors">
              <ExternalLink className="w-3 h-3"/>Chart
            </a>
          )}
        </div>
      )}
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FULL MODE  — new layout:
  // 1. Token header (name + price from CoinGecko)
  // 2. TF + chart type buttons
  // 3. Chart (CoinGecko)
  // 4. DexScreener metadata (price, liq, vol, buys/sells, pairs)
  // 5. CoinGecko stats (market cap, ATH, supply)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="space-y-3">

      {/* ── 1. Token header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {cg?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cg.image} alt={symbol ?? ""} width={44} height={44} className="rounded-full flex-shrink-0"/>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-glow-text leading-tight">{displayName}</h3>
              {symbol && <span className="text-xs text-glow-muted/60 font-mono">{symbol.toUpperCase()}</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {price !== undefined && (
                <span className="text-2xl font-bold text-glow-text">{fmt.price(price)}</span>
              )}
              {change !== 0 && (
                <span className={cn("text-sm font-semibold flex items-center gap-1", positive ? "text-emerald-400" : "text-red-400")}>
                  {positive ? <TrendingUp className="w-4 h-4"/> : <TrendingDown className="w-4 h-4"/>}
                  {fmt.pct(change)}
                  <span className="text-glow-muted/40 font-normal text-[10px]">24h</span>
                </span>
              )}
              {cg?.change7d !== undefined && cg.change7d !== 0 && (
                <span className={cn("text-xs font-medium", cg.change7d >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
                  {fmt.pct(cg.change7d)} <span className="text-glow-muted/40">7d</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {dex?.url && (
            <a href={dex.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-surface border border-glow-border rounded-xl text-xs text-glow-muted hover:text-glow-text hover:border-glow-accent/30 transition-all">
              <ExternalLink className="w-3.5 h-3.5"/>DexScreener
            </a>
          )}
          <button onClick={() => { fetchChart(tf, mode); fetchMeta(); }}
            className="p-1.5 text-glow-muted hover:text-glow-text bg-glow-surface border border-glow-border rounded-xl transition-all hover:border-glow-accent/30">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")}/>
          </button>
        </div>
      </div>

      {/* ── 2. Buttons: timeframe + chart type ───────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {TFs.map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={cn("text-xs px-3 py-1.5 rounded-lg font-medium transition-all",
                tf === t
                  ? "bg-glow-accent/20 border border-glow-accent/30 text-glow-accent-light"
                  : "text-glow-muted/60 hover:text-glow-text hover:bg-glow-surface border border-transparent")}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMode("line")}
            className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
              mode === "line"
                ? "bg-glow-accent/15 border-glow-accent/30 text-glow-accent-light"
                : "border-transparent text-glow-muted/60 hover:text-glow-muted hover:bg-glow-surface")}>
            <TrendingUp className="w-3.5 h-3.5"/>Line
          </button>
          <button onClick={() => setMode("candlestick")}
            className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
              mode === "candlestick"
                ? "bg-glow-accent/15 border-glow-accent/30 text-glow-accent-light"
                : "border-transparent text-glow-muted/60 hover:text-glow-muted hover:bg-glow-surface")}>
            <BarChart2 className="w-3.5 h-3.5"/>Candles
          </button>
        </div>
      </div>

      {/* ── 3. Chart (CoinGecko data) ─────────────────────────────────── */}
      <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden p-1.5">
        {chartArea}
      </div>

      {/* ── 4. DexScreener metadata ───────────────────────────────────── */}
      {dex && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-glow-accent"/>
            <p className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-widest">On-Chain Data · DexScreener</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="DEX Price"     value={fmt.price(dex.priceUsd)}    />
            <StatCard label="Liquidity"     value={fmt.large(dex.liquidity)}   />
            <StatCard label="Volume 24h"    value={fmt.large(dex.volume24h)}   />
            <StatCard label="FDV"           value={fmt.large(dex.fdv)}         />
            <StatCard label="24h Change"    value={fmt.pct(dex.change24h)}    positive={(dex.change24h??0)>=0}/>
            <StatCard label="1h Change"     value={fmt.pct(dex.change1h)}     positive={(dex.change1h??0)>=0}/>
            <StatCard label="Buys 24h"      value={fmt.num(dex.buys24h)}      positive/>
            <StatCard label="Sells 24h"     value={fmt.num(dex.sells24h)}     positive={false}/>
          </div>

          {/* DEX pairs */}
          {(dex.pairs?.length ?? 0) > 0 && (
            <div className="bg-glow-card border border-glow-border rounded-xl overflow-hidden">
              <p className="text-[9px] font-semibold text-glow-muted/50 uppercase tracking-widest px-3 py-2 border-b border-glow-border/30">
                Trading Pairs
              </p>
              <div className="divide-y divide-glow-border/20">
                {dex.pairs!.slice(0, 5).map((pair, i) => (
                  <a key={i} href={pair.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2 hover:bg-glow-surface/50 transition-colors group">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-glow-accent font-semibold uppercase">{pair.dexId}</span>
                      <span className="text-[10px] text-glow-muted/40">{pair.chainId}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-glow-text font-mono font-semibold">{fmt.price(pair.priceUsd)}</span>
                      <span className="text-glow-muted/50">{fmt.large(pair.liquidity)}</span>
                      <ExternalLink className="w-3 h-3 text-glow-muted/30 group-hover:text-glow-muted transition-colors"/>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. CoinGecko market stats ─────────────────────────────────── */}
      {cg && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3 h-3 text-emerald-400"/>
            <p className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-widest">Market Data · CoinGecko</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Market Cap"    value={fmt.large(cg.marketCap)}            />
            <StatCard label="Volume 24h"    value={fmt.large(cg.volume24h)}            />
            <StatCard label="24h High"      value={fmt.price(cg.high24h)}  positive     />
            <StatCard label="24h Low"       value={fmt.price(cg.low24h)}   positive={false}/>
            <StatCard label="All-Time High" value={fmt.price(cg.ath)}                  />
            <StatCard label="Circ. Supply"  value={fmt.large(cg.circSupply)}           />
            <StatCard label="7d Change"     value={fmt.pct(cg.change7d)} positive={(cg.change7d??0)>=0}/>
          </div>
        </div>
      )}
    </div>
  );
}
