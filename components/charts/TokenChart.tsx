"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, ExternalLink,
  Activity, BarChart2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// lazy-load the heavy chart library
const TVChartInner = dynamic(() => import("./TVChartInner"), { ssr: false, loading: () => <div className="h-full flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-glow-accent/40"/></div> });

interface OhlcvBar  { time:number; open:number; high:number; low:number; close:number; volume:number; }
interface LinePoint { time:number; value:number; }
interface TokenMeta {
  symbol?:string; address?:string;
  coingecko?: { name?:string; symbol?:string; image?:string; price?:number; change24h?:number; change7d?:number; marketCap?:number; volume24h?:number; high24h?:number; low24h?:number; circSupply?:number; ath?:number; };
  dexscreener?: { priceUsd?:number; change24h?:number; liquidity?:number; volume24h?:number; volume1h?:number; buys24h?:number; sells24h?:number; fdv?:number; dexId?:string; url?:string; change1h?:number; pairs?: Array<{dexId:string;chainId:string;liquidity:number;priceUsd:number;url:string}>; };
}
type Timeframe = "1H"|"4H"|"1D"|"1W"|"1M";
type ChartType = "line"|"candlestick";

interface TokenChartProps { symbol?:string; address?:string; chainId?:string; name?:string; compact?:boolean; }

const fmt = {
  price: (n?: number) => {
    if (!n && n !== 0) return "—";
    if (n < 0.001) return "$" + n.toExponential(4);
    if (n < 1)     return "$" + n.toFixed(6);
    if (n < 100)   return "$" + n.toFixed(4);
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
  },
  large: (n?: number) => {
    if (!n) return "—";
    if (n >= 1e9) return "$" + (n/1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n/1e6).toFixed(2) + "M";
    if (n >= 1e3) return "$" + (n/1e3).toFixed(2) + "K";
    return "$" + n.toFixed(2);
  },
  pct: (n?: number) => {
    if (n === undefined || n === null) return "—";
    return (n >= 0 ? "+" : "") + Math.abs(n).toFixed(2) + "%";
  },
};

function Stat({ label, value, positive }: { label:string; value:string; positive?:boolean }) {
  return (
    <div className="bg-glow-surface border border-glow-border/40 rounded-xl p-2.5">
      <p className="text-[9px] text-glow-muted/60 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={cn("text-xs font-bold", positive===true?"text-emerald-400":positive===false?"text-red-400":"text-glow-text")}>{value}</p>
    </div>
  );
}

export function TokenChart({ symbol, address, chainId, name, compact = false }: TokenChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [chartData, setChartData] = useState<OhlcvBar[]|LinePoint[]>([]);
  const [meta,      setMeta]      = useState<TokenMeta|null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string|null>(null);
  const [source,    setSource]    = useState("");

  const fetchChart = useCallback(async (tf: Timeframe, ct: ChartType) => {
    if (!symbol && !address) return;
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ tf, type: ct });
      if (symbol)  p.set("symbol",  symbol.toUpperCase());
      if (address) p.set("address", address);
      if (chainId) p.set("chain",   chainId);
      const res = await fetch("/api/charts?" + p.toString());
      const d   = await res.json() as { data:OhlcvBar[]|LinePoint[]; source?:string; error?:string };
      if (d.error && !d.data?.length) { setError(d.error); setChartData([]); }
      else { setChartData(d.data ?? []); setSource(d.source ?? ""); setError(null); }
    } catch(e) { setError((e as Error).message); }
    finally   { setLoading(false); }
  }, [symbol, address, chainId]);

  const fetchMeta = useCallback(async () => {
    if (!symbol && !address) return;
    try {
      const p = new URLSearchParams({ type:"meta" });
      if (symbol)  p.set("symbol",  symbol.toUpperCase());
      if (address) p.set("address", address);
      const res = await fetch("/api/charts?" + p.toString());
      setMeta(await res.json() as TokenMeta);
    } catch { /* silent */ }
  }, [symbol, address]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchChart(timeframe, chartType); fetchMeta(); }, [symbol, address]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchChart(timeframe, chartType); }, [timeframe, chartType]);

  const price    = meta?.dexscreener?.priceUsd || meta?.coingecko?.price;
  const change   = meta?.dexscreener?.change24h ?? meta?.coingecko?.change24h ?? 0;
  const positive = change >= 0;
  const displayName = name || meta?.coingecko?.name || symbol;

  const TFs: Timeframe[] = compact ? ["1D","1W","1M"] : ["1H","4H","1D","1W","1M"];

  const chartArea = loading ? (
    <div className={cn("flex flex-col items-center justify-center gap-2", compact?"h-28":"h-64")}>
      <RefreshCw className="w-5 h-5 text-glow-accent/40 animate-spin"/>
      <p className="text-[10px] text-glow-muted/40">Fetching from CoinGecko & DexScreener…</p>
    </div>
  ) : error || !chartData.length ? (
    <div className={cn("flex flex-col items-center justify-center gap-2", compact?"h-28":"h-64")}>
      <Activity className={cn("text-glow-muted/20", compact?"w-6 h-6":"w-8 h-8")}/>
      <p className={cn("text-glow-muted/40", compact?"text-[10px]":"text-sm")}>{error ?? "No data"}</p>
    </div>
  ) : (
    <div className={compact?"h-28":"h-64"}>
      <TVChartInner data={chartData} type={chartType} />
    </div>
  );

  if (compact) return (
    <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-glow-border/40">
        <div className="flex items-center gap-2">
          {meta?.coingecko?.image && (<img src={meta.coingecko.image} alt={symbol||"token"} width={18} height={18} className="rounded-full"/>)}
          <span className="text-xs font-semibold text-glow-text">{displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          {price && <span className="text-xs font-bold text-glow-text">{fmt.price(price)}</span>}
          {change !== 0 && <span className={cn("text-[10px] font-semibold flex items-center gap-0.5", positive?"text-emerald-400":"text-red-400")}>{positive?<ArrowUpRight className="w-3 h-3"/>:<ArrowDownRight className="w-3 h-3"/>}{fmt.pct(change)}</span>}
          <button onClick={()=>{fetchChart(timeframe,chartType);fetchMeta();}} className="text-glow-muted/30 hover:text-glow-muted"><RefreshCw className={cn("w-3 h-3",loading&&"animate-spin")}/></button>
        </div>
      </div>
      <div className="flex items-center gap-1 px-3 py-1.5">
        {TFs.map(tf=><button key={tf} onClick={()=>setTimeframe(tf)} className={cn("text-[10px] px-2 py-0.5 rounded font-medium",timeframe===tf?"bg-glow-accent/20 text-glow-accent-light":"text-glow-muted/40 hover:text-glow-muted")}>{tf}</button>)}
        <div className="ml-auto flex gap-1">
          <button onClick={()=>setChartType("line")} className={cn("p-1 rounded",chartType==="line"?"text-glow-accent":"text-glow-muted/30")}><TrendingUp className="w-3 h-3"/></button>
          <button onClick={()=>setChartType("candlestick")} className={cn("p-1 rounded",chartType==="candlestick"?"text-glow-accent":"text-glow-muted/30")}><BarChart2 className="w-3 h-3"/></button>
        </div>
      </div>
      <div className="px-1 pb-1">{chartArea}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {meta?.coingecko?.image && (<img src={meta.coingecko.image} alt={symbol||"token"} width={40} height={40} className="rounded-full"/>)}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-glow-text">{displayName}</h3>
              <span className="text-sm text-glow-muted">{symbol?.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {price !== undefined && <span className="text-2xl font-bold text-glow-text">{fmt.price(price)}</span>}
              {change !== 0 && <span className={cn("text-sm font-semibold flex items-center gap-1",positive?"text-emerald-400":"text-red-400")}>{positive?<TrendingUp className="w-4 h-4"/>:<TrendingDown className="w-4 h-4"/>}{fmt.pct(change)}<span className="text-glow-muted/50 font-normal text-xs">24h</span></span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {meta?.dexscreener?.url && <a href={meta.dexscreener.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 bg-glow-surface border border-glow-border rounded-lg text-xs text-glow-muted hover:text-glow-text"><ExternalLink className="w-3 h-3"/>DexScreener</a>}
          <button onClick={()=>{fetchChart(timeframe,chartType);fetchMeta();}} className="p-1.5 text-glow-muted hover:text-glow-text bg-glow-surface border border-glow-border rounded-lg"><RefreshCw className={cn("w-3.5 h-3.5",loading&&"animate-spin")}/></button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {TFs.map(tf=><button key={tf} onClick={()=>setTimeframe(tf)} className={cn("text-xs px-2.5 py-1 rounded-lg font-medium transition-all",timeframe===tf?"bg-glow-accent/20 border border-glow-accent/30 text-glow-accent-light":"text-glow-muted/60 hover:text-glow-muted border border-transparent")}>{tf}</button>)}
        </div>
        <div className="flex items-center gap-1">
          {[["line","Line",TrendingUp],["candlestick","Candles",BarChart2]].map(([ct,lbl,Icon])=>(
            <button key={ct as string} onClick={()=>setChartType(ct as ChartType)}
              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",chartType===ct?"bg-glow-accent/15 border-glow-accent/30 text-glow-accent-light":"border-transparent text-glow-muted/60 hover:text-glow-muted")}>
              <Icon className="w-3.5 h-3.5"/>{lbl as string}
            </button>
          ))}
          {source && <span className="text-[9px] text-glow-muted/30 ml-1">{source}</span>}
        </div>
      </div>

      <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden p-1">{chartArea}</div>

      {(meta?.coingecko||meta?.dexscreener) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Volume 24h"  value={fmt.large(meta?.dexscreener?.volume24h||meta?.coingecko?.volume24h)}/>
          <Stat label="Liquidity"   value={fmt.large(meta?.dexscreener?.liquidity)}/>
          <Stat label="Market Cap"  value={fmt.large(meta?.coingecko?.marketCap||meta?.dexscreener?.fdv)}/>
          <Stat label="7d Change"   value={fmt.pct(meta?.coingecko?.change7d)} positive={(meta?.coingecko?.change7d??0)>=0}/>
          {meta?.dexscreener && <>
            <Stat label="Buys 24h"  value={(meta.dexscreener.buys24h??0).toLocaleString()} positive/>
            <Stat label="Sells 24h" value={(meta.dexscreener.sells24h??0).toLocaleString()} positive={false}/>
            <Stat label="1h Change" value={fmt.pct(meta.dexscreener.change1h)} positive={(meta.dexscreener.change1h??0)>=0}/>
            <Stat label="FDV"       value={fmt.large(meta.dexscreener.fdv)}/>
          </>}
          {meta?.coingecko && <>
            <Stat label="24h High"  value={fmt.price(meta.coingecko.high24h)} positive/>
            <Stat label="24h Low"   value={fmt.price(meta.coingecko.low24h)} positive={false}/>
            <Stat label="ATH"       value={fmt.price(meta.coingecko.ath)}/>
            <Stat label="Circ. Supply" value={fmt.large(meta.coingecko.circSupply)}/>
          </>}
        </div>
      )}

      {(meta?.dexscreener?.pairs?.length??0) > 1 && (
        <div className="bg-glow-card border border-glow-border rounded-xl overflow-hidden">
          <p className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-widest px-3 py-2 border-b border-glow-border/30">Trading Pairs</p>
          <div className="divide-y divide-glow-border/20">
            {meta!.dexscreener!.pairs!.slice(0,4).map((p,i)=>(
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3 py-2 hover:bg-glow-surface/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-glow-accent font-medium uppercase">{p.dexId}</span>
                  <span className="text-[10px] text-glow-muted/50">{p.chainId}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-glow-text font-mono">{fmt.price(p.priceUsd)}</span>
                  <span className="text-glow-muted/60">{fmt.large(p.liquidity)} liq</span>
                  <ExternalLink className="w-3 h-3 text-glow-muted/40"/>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
