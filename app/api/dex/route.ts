export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// Aggregate token data from DexScreener + CoinGecko + our DB
async function fetchDexScreenerPairs(query?: string) {
  try {
    const url = query
      ? `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
      : `https://api.dexscreener.com/latest/dex/pairs/ethereum`;  // ETH pairs as default market
    const res = await fetch(url, { next: { revalidate: 30 }, signal: AbortSignal.timeout(8000) });
    const d = await res.json() as { pairs?: unknown[] };
    return d.pairs ?? [];
  } catch { return []; }
}

async function fetchCoinGeckoCoins(search?: string) {
  try {
    const url = search
      ? `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(search)}`
      : `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=1h,24h,7d`;
    const res = await fetch(url, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) });
    return await res.json();
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "trending";
  const query  = searchParams.get("q") ?? "";
  const address= searchParams.get("address") ?? "";

  if (action === "search") {
    const [dex, cg] = await Promise.allSettled([
      fetchDexScreenerPairs(query),
      fetchCoinGeckoCoins(query),
    ]);
    const dexPairs = dex.status === "fulfilled" ? dex.value as Array<Record<string,unknown>> : [];
    const cgCoins  = cg.status  === "fulfilled" ? (cg.value as {coins?: unknown[]})?.coins ?? cg.value : [];
    return NextResponse.json({ pairs: dexPairs, coins: cgCoins });
  }

  if (action === "token" && address) {
    // Full token detail from DexScreener
    const [dex, cgRes] = await Promise.allSettled([
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { next: { revalidate: 10 } }).then(r=>r.json()),
      fetch(`https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`, { next: { revalidate: 60 } }).then(r=>r.json()),
    ]);
    return NextResponse.json({
      dex: dex.status === "fulfilled" ? dex.value : null,
      coingecko: cgRes.status === "fulfilled" ? cgRes.value : null,
    });
  }

  if (action === "trending") {
    const res = await fetchCoinGeckoCoins();
    return NextResponse.json({ tokens: Array.isArray(res) ? res : [] });
  }

  if (action === "new-pairs") {
    // Get newly created pairs from DexScreener
    const pairs = await fetchDexScreenerPairs("USDC");
    return NextResponse.json({ pairs: (pairs as unknown[]).slice(0, 50) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
