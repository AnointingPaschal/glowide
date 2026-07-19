/**
 * /api/prices — live token prices from CoinGecko (free tier, no key needed)
 * Falls back to reasonable defaults if the API is unreachable.
 * Cache: 60s on the edge so the wallet page doesn't hammer CoinGecko.
 */
export const dynamic = "force-dynamic";
export const revalidate = 60;

import { NextResponse } from "next/server";

const COINGECKO_IDS: Record<string, string> = {
  USDC:   "usd-coin",
  EURC:   "euro-coin",
  cirBTC: "bitcoin",
  USYC:   "usual-usd",   // closest proxy; USYC is yield-bearing USDC
  ETH:    "ethereum",
  MATIC:  "matic-network",
  AVAX:   "avalanche-2",
  ARB:    "arbitrum",
  OP:     "optimism",
  BNB:    "binancecoin",
  SOL:    "solana",
};

const FALLBACK: Record<string, { price: number; change: number }> = {
  USDC:   { price: 1.00,    change: -0.01 },
  EURC:   { price: 1.09,    change:  0.05 },
  cirBTC: { price: 97000,   change:  2.31 },
  USYC:   { price: 1.002,   change:  0.08 },
  ETH:    { price: 3200,    change: -1.24 },
  MATIC:  { price: 0.55,    change:  0.87 },
  AVAX:   { price: 38,      change: -0.55 },
  ARB:    { price: 0.95,    change:  1.42 },
  OP:     { price: 1.80,    change:  0.60 },
  BNB:    { price: 600,     change:  0.80 },
  SOL:    { price: 165,     change:  2.10 },
};

export async function GET() {
  try {
    const ids = [...new Set(Object.values(COINGECKO_IDS))].join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(6000) }
    );

    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);

    const raw = await res.json() as Record<string, { usd: number; usd_24h_change: number }>;

    const prices: Record<string, { price: number; change: number }> = {};
    for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
      const d = raw[geckoId];
      prices[symbol] = d
        ? { price: d.usd, change: d.usd_24h_change ?? 0 }
        : FALLBACK[symbol] ?? { price: 1, change: 0 };
    }

    return NextResponse.json({ prices, source: "coingecko", ts: Date.now() });
  } catch {
    // Fallback: return hardcoded values so the wallet never breaks
    return NextResponse.json({ prices: FALLBACK, source: "fallback", ts: Date.now() });
  }
}
