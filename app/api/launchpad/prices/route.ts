/**
 * /api/launchpad/prices — on-chain price indexer for Arc Testnet tokens.
 * 
 * Reads Transfer events via eth_getLogs, correlates token/USDC transfers
 * in the same tx to compute swap price, then writes to Supabase.
 *
 * Vercel cron: add to vercel.json → "crons":[{"path":"/api/launchpad/prices","schedule":"*\/5 * * * *"}]
 * Manual:  GET /api/launchpad/prices?all=1   — index last 50 tokens
 *          GET /api/launchpad/prices?token=0x...  — single token
 *          GET /api/launchpad/prices   — index latest 10 tokens
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";

const ARC_RPC   = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? (process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network");
const USDC_ADDR = "0x3600000000000000000000000000000000000000";
const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function supabase() {
  const url  = (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "").trim();
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !sKey) throw new Error("Supabase env vars not set");
  return { url, sKey };
}

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  const d = await res.json() as { result?: unknown; error?: { message: string } };
  if (d.error) throw new Error(d.error.message ?? "RPC error");
  return d.result;
}

type Log = { data: string; blockNumber: string; transactionHash: string; topics: string[] };

async function getLogs(address: string, fromBlock: string): Promise<Log[]> {
  try {
    return await rpcCall("eth_getLogs", [{
      address, fromBlock, toBlock: "latest",
      topics: [TRANSFER_SIG],
    }]) as Log[];
  } catch { return []; }
}

async function indexToken(token: { id: string; token_address: string; decimals: number; total_supply: string }) {
  const mult = Math.pow(10, token.decimals ?? 18);
  const now  = Date.now();

  // ~2s block time on Arc → 43200 blocks/24h
  const currentBlock = parseInt(await rpcCall("eth_blockNumber", []) as string, 16);
  const fromBlock    = "0x" + Math.max(0, currentBlock - 43200).toString(16);

  const [tokenLogs, usdcLogs] = await Promise.all([
    getLogs(token.token_address, fromBlock),
    getLogs(USDC_ADDR, fromBlock),
  ]);

  // Map USDC amount per tx
  const usdcPerTx = new Map<string, number>();
  for (const l of usdcLogs) {
    const amt = parseInt(l.data || "0x0", 16) / 1e6;
    if (amt > 0) usdcPerTx.set(l.transactionHash, (usdcPerTx.get(l.transactionHash) ?? 0) + amt);
  }

  // Unique holders + swap events
  const holderSet = new Set<string>();
  type Swap = { time: number; price: number; usdcAmt: number };
  const swaps: Swap[] = [];

  for (const l of tokenLogs) {
    const to = "0x" + (l.topics[2] ?? "").slice(26).toLowerCase();
    if (to.length === 42 && to !== "0x" + "0".repeat(40)) holderSet.add(to);

    const tokenAmt = parseInt(l.data || "0x0", 16) / mult;
    const usdcAmt  = usdcPerTx.get(l.transactionHash) ?? 0;
    if (tokenAmt > 0 && usdcAmt > 0) {
      const blockNum = parseInt(l.blockNumber, 16);
      const approxMs = now - (currentBlock - blockNum) * 2000;
      swaps.push({ time: approxMs / 1000, price: usdcAmt / tokenAmt, usdcAmt });
    }
  }

  const latestSwap = swaps[swaps.length - 1];
  const price      = latestSwap?.price ?? null;
  const volume24h  = swaps.reduce((s, x) => s + x.usdcAmt, 0);
  const supply     = parseFloat(token.total_supply || "0") / mult;
  const marketCap  = price !== null ? price * supply : null;
  const holders    = holderSet.size;

  // 24-point hourly sparkline
  const priceHistory = price !== null ? Array.from({ length: 24 }, (_, i) => {
    const hEnd   = now / 1000 - i * 3600;
    const inHour = swaps.filter(s => s.time >= hEnd - 3600 && s.time < hEnd);
    const p      = inHour.length > 0 ? inHour.reduce((a, b) => a + b.price, 0) / inHour.length : price;
    return { time: hEnd, price: p };
  }).reverse() : [];

  // Patch Supabase
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), holders };
  if (price !== null)          patch.price_usd     = price;
  if (marketCap !== null)      patch.market_cap    = marketCap;
  if (volume24h > 0)           patch.volume_24h    = volume24h;
  if (priceHistory.length > 0) patch.price_history = priceHistory;

  const { url, sKey } = supabase();
  await fetch(`${url}/rest/v1/launchpad_tokens?id=eq.${token.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "apikey": sKey, "Authorization": `Bearer ${sKey}` },
    body: JSON.stringify(patch),
  });

  return { id: token.id, address: token.token_address, price, volume24h, marketCap, holders, swaps: swaps.length };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const singleAddr = searchParams.get("token");
  const all        = searchParams.get("all") === "1";

  try {
    const { url, sKey } = supabase();

    let qs = "select=id,token_address,decimals,total_supply&order=launched_at.desc&limit=10";
    if (singleAddr) qs = `select=id,token_address,decimals,total_supply&token_address=ilike.${singleAddr}&limit=1`;
    else if (all)   qs = "select=id,token_address,decimals,total_supply&order=launched_at.desc&limit=50";

    const tokensRes = await fetch(`${url}/rest/v1/launchpad_tokens?${qs}`, {
      headers: { "apikey": sKey, "Authorization": `Bearer ${sKey}` }, cache: "no-store",
    });
    const tokens = await tokensRes.json() as Array<{ id: string; token_address: string; decimals: number; total_supply: string }>;

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ updated: 0, message: "No tokens to index" });
    }

    // Batch: 5 at a time to avoid RPC overload
    const results: Array<{ status: string; value?: unknown; reason?: string }> = [];
    for (let i = 0; i < tokens.length; i += 5) {
      const settled = await Promise.allSettled(tokens.slice(i, i + 5).map(indexToken));
      results.push(...settled.map(r => r.status === "fulfilled"
        ? { status: "ok",    value: (r as PromiseFulfilledResult<unknown>).value }
        : { status: "error", reason: String((r as PromiseRejectedResult).reason) }
      ));
    }

    return NextResponse.json({
      updated: results.filter(r => r.status === "ok").length,
      failed:  results.filter(r => r.status === "error").length,
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
