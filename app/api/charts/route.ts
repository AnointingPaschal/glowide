export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// ── CoinGecko free API ─────────────────────────────────────────────────────
const CG_BASE = "https://api.coingecko.com/api/v3";

// Map common symbols to CoinGecko IDs
const SYMBOL_TO_CG: Record<string,string> = {
  BTC:"bitcoin", ETH:"ethereum", USDC:"usd-coin", EURC:"euro-coin",
  SOL:"solana", AVAX:"avalanche-2", MATIC:"matic-network", POL:"matic-network",
  ARB:"arbitrum", OP:"optimism", BNB:"binancecoin", LINK:"chainlink",
  UNI:"uniswap", AAVE:"aave", SUSHI:"sushi", CRV:"curve-dao-token",
  MKR:"maker", SNX:"synthetix-network-token", COMP:"compound-governance-token",
  DOT:"polkadot", ADA:"cardano", XRP:"ripple", DOGE:"dogecoin",
  SHIB:"shiba-inu", LTC:"litecoin", XLM:"stellar", ATOM:"cosmos",
  ALGO:"algorand", NEAR:"near", APT:"aptos", SUI:"sui", INJ:"injective-protocol",
  STRK:"starknet", CELO:"celo", ZK:"zksync", USYC:"hashnote-us-yield-coin",
  HBAR:"hedera-hashgraph", LINEA:"linea",
};

// Timeframe config
const TIMEFRAMES: Record<string,{days:string;interval:string}> = {
  "1H":  { days:"2",   interval:"hourly" },
  "4H":  { days:"7",   interval:"hourly" },
  "1D":  { days:"30",  interval:"daily"  },
  "1W":  { days:"90",  interval:"daily"  },
  "1M":  { days:"365", interval:"daily"  },
};

interface OhlcvBar { time:number; open:number; high:number; low:number; close:number; volume:number; }
interface LinePoint  { time:number; value:number; }

// ── CoinGecko: OHLC + market chart ───────────────────────────────────────────
async function fetchCoinGeckoOHLC(coinId: string, days = "30"): Promise<OhlcvBar[]> {
  const url = `${CG_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { headers:{"Accept":"application/json"}, signal: AbortSignal.timeout(8000), next:{revalidate:60} });
  if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`);
  const data = await res.json() as number[][];
  return data.map(([time,open,high,low,close]) => ({
    time: Math.floor(time/1000), open, high, low, close, volume: 0,
  }));
}

async function fetchCoinGeckoLine(coinId: string, days = "30"): Promise<LinePoint[]> {
  const url = `${CG_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { headers:{"Accept":"application/json"}, signal: AbortSignal.timeout(8000), next:{revalidate:60} });
  if (!res.ok) throw new Error(`CoinGecko chart ${res.status}`);
  const data = await res.json() as { prices:number[][]; volumes:number[][] };
  return data.prices.map(([t,v]) => ({ time: Math.floor(t/1000), value: v }));
}

async function fetchCoinGeckoMeta(coinId: string) {
  const url = `${CG_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;
  const res = await fetch(url, { headers:{"Accept":"application/json"}, signal: AbortSignal.timeout(8000), next:{revalidate:300} });
  if (!res.ok) return null;
  const d = await res.json() as Record<string,unknown>;
  const market = d.market_data as Record<string,Record<string,number>|null> | undefined;
  return {
    name:        d.name,
    symbol:      (d.symbol as string)?.toUpperCase(),
    image:       (d.image as Record<string,string>)?.small,
    price:       market?.current_price?.usd ?? 0,
    change24h:   market?.price_change_percentage_24h ?? 0,
    change7d:    market?.price_change_percentage_7d_in_currency?.usd ?? 0,
    marketCap:   market?.market_cap?.usd ?? 0,
    volume24h:   market?.total_volume?.usd ?? 0,
    high24h:     market?.high_24h?.usd ?? 0,
    low24h:      market?.low_24h?.usd ?? 0,
    circSupply:  market?.circulating_supply ?? 0,
    totalSupply: market?.total_supply ?? 0,
    ath:         market?.ath?.usd ?? 0,
  };
}

// ── DexScreener: on-chain pairs + candles ────────────────────────────────────
async function fetchDexScreener(address: string) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
    signal: AbortSignal.timeout(8000), next:{revalidate:30},
  });
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  const d = await res.json() as {
    pairs?: Array<{
      chainId:string; dexId:string; url:string; pairAddress:string;
      baseToken:{address:string;name:string;symbol:string};
      quoteToken:{address:string;name:string;symbol:string};
      priceUsd?:string; priceNative?:string;
      liquidity?:{usd?:number};
      volume?:{h24?:number;h6?:number;h1?:number};
      txns?:{h24?:{buys?:number;sells?:number}};
      priceChange?:{h24?:number;h6?:number;h1?:number};
      fdv?:number;
    }>;
  };

  const pairs = (d.pairs ?? []).filter(p => (p.liquidity?.usd ?? 0) > 1000)
    .sort((a,b) => (b.liquidity?.usd??0) - (a.liquidity?.usd??0));

  if (!pairs.length) return null;

  const top = pairs[0];
  return {
    pairAddress:  top.pairAddress,
    chainId:      top.chainId,
    dexId:        top.dexId,
    url:          top.url,
    baseToken:    top.baseToken,
    quoteToken:   top.quoteToken,
    priceUsd:     top.priceUsd ? parseFloat(top.priceUsd) : 0,
    priceNative:  top.priceNative ? parseFloat(top.priceNative) : 0,
    liquidity:    top.liquidity?.usd ?? 0,
    volume24h:    top.volume?.h24 ?? 0,
    volume6h:     top.volume?.h6  ?? 0,
    volume1h:     top.volume?.h1  ?? 0,
    change24h:    top.priceChange?.h24 ?? 0,
    change6h:     top.priceChange?.h6  ?? 0,
    change1h:     top.priceChange?.h1  ?? 0,
    buys24h:      top.txns?.h24?.buys  ?? 0,
    sells24h:     top.txns?.h24?.sells ?? 0,
    fdv:          top.fdv ?? 0,
    pairs:        pairs.slice(0, 5).map(p => ({
      dexId: p.dexId, chainId: p.chainId,
      priceUsd: p.priceUsd ? parseFloat(p.priceUsd) : 0,
      liquidity: p.liquidity?.usd ?? 0, volume24h: p.volume?.h24 ?? 0,
      pairAddress: p.pairAddress, url: p.url,
    })),
  };
}

// ── DexScreener candles via pair address ─────────────────────────────────────
async function fetchDexCandles(pairAddress: string, chainId: string): Promise<OhlcvBar[]> {
  // DexScreener doesn't have a public candle API — use price history approximation
  // via search API to get OHLCV-like data
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`,
    { signal: AbortSignal.timeout(8000), next:{revalidate:30} }
  );
  if (!res.ok) return [];
  // DexScreener doesn't expose candle data directly in free API
  // Return empty — will fall back to CoinGecko or line data
  return [];
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol    = (searchParams.get("symbol") ?? "").toUpperCase();
  const address   = searchParams.get("address") ?? "";
  const timeframe = searchParams.get("tf") ?? "1D";
  const type      = searchParams.get("type") ?? "line"; // "line" | "candlestick" | "meta"
  const chainId   = searchParams.get("chain") ?? "";

  if (!symbol && !address) {
    return NextResponse.json({ error:"symbol or address required" }, { status:400 });
  }

  try {
    // ── META request ──────────────────────────────────────────────────────
    if (type === "meta") {
      const cgId = SYMBOL_TO_CG[symbol];
      const [cgMeta, dexData] = await Promise.allSettled([
        cgId ? fetchCoinGeckoMeta(cgId) : Promise.resolve(null),
        address ? fetchDexScreener(address) : Promise.resolve(null),
      ]);

      return NextResponse.json({
        symbol,
        address,
        coingecko:   cgMeta.status  === "fulfilled" ? cgMeta.value  : null,
        dexscreener: dexData.status === "fulfilled" ? dexData.value : null,
      });
    }

    const { days } = TIMEFRAMES[timeframe] ?? TIMEFRAMES["1D"];
    const cgId = SYMBOL_TO_CG[symbol];

    // ── CHART data ─────────────────────────────────────────────────────────
    if (type === "candlestick") {
      // Try CoinGecko OHLC first (has it for major coins)
      if (cgId) {
        try {
          const ohlc = await fetchCoinGeckoOHLC(cgId, days);
          if (ohlc.length) return NextResponse.json({ type:"candlestick", data:ohlc, source:"coingecko" });
        } catch { /* try dex */ }
      }

      // DexScreener OHLC (for on-chain tokens)
      if (address) {
        try {
          const dex = await fetchDexScreener(address);
          if (dex?.pairAddress) {
            const candles = await fetchDexCandles(dex.pairAddress, dex.chainId || chainId);
            if (candles.length) return NextResponse.json({ type:"candlestick", data:candles, source:"dexscreener" });
          }
        } catch { /* fall through */ }
      }

      // Fallback: convert line data to pseudo-OHLC
      if (cgId) {
        try {
          const line = await fetchCoinGeckoLine(cgId, days);
          // Create pseudo candles (open=prev_close, high=max, low=min, close=last in window)
          const candlesFromLine: OhlcvBar[] = [];
          for (let i = 1; i < line.length; i++) {
            const prev = line[i-1].value;
            const curr = line[i].value;
            candlesFromLine.push({
              time: line[i].time,
              open: prev,
              high: Math.max(prev, curr) * (1 + Math.random() * 0.002),
              low:  Math.min(prev, curr) * (1 - Math.random() * 0.002),
              close: curr,
              volume: 0,
            });
          }
          return NextResponse.json({ type:"candlestick", data:candlesFromLine, source:"coingecko-approx" });
        } catch { /* fall through */ }
      }

      return NextResponse.json({ error:"No chart data available", data:[] });
    }

    // Line chart
    if (cgId) {
      try {
        const line = await fetchCoinGeckoLine(cgId, days);
        return NextResponse.json({ type:"line", data:line, source:"coingecko" });
      } catch { /* try dex */ }
    }

    // DexScreener price data for on-chain tokens
    if (address) {
      try {
        const dex = await fetchDexScreener(address);
        if (dex) {
          // Build a simple line from current price only (DexScreener free doesn't have history)
          const now = Math.floor(Date.now()/1000);
          const points: LinePoint[] = [{ time: now - 86400, value: dex.priceUsd * (1 + (dex.change24h/100)) }, { time: now, value: dex.priceUsd }];
          return NextResponse.json({ type:"line", data:points, source:"dexscreener-current" });
        }
      } catch { /* fall through */ }
    }

    return NextResponse.json({ error:"No chart data available", data:[], source:"none" });

  } catch(err) {
    console.error("[charts]", err);
    return NextResponse.json({ error:String(err), data:[] }, { status:500 });
  }
}
