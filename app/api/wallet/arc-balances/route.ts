/**
 * GET /api/wallet/arc-balances?address=0x...&debug=1
 * Server-side Arc Testnet ERC-20 balance reader.
 *
 * IMPORTANT (per https://docs.arc.io/arc/references/contract-addresses):
 * USDC on Arc has TWO decimal representations:
 *   - Native gas balance:      18 decimals (eth_getBalance)
 *   - ERC-20 interface (balanceOf): 6 decimals
 * We call balanceOf() here, so USDC MUST use 6 decimals, not 18.
 * Getting this wrong silently divides the real balance by 10^12.
 *
 * Performance: all balanceOf + eth_getBalance calls run in parallel.
 * Response is cached for 15 s at the Vercel edge so repeated page visits
 * return instantly instead of hitting the RPC every time.
 */
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// Use the dedicated RPC from Vercel env (set by the user) — this is the
// single source of truth for which endpoint to hit. Falls back to the
// public endpoint only if nothing is configured.
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

const TOKENS = [
  { symbol: "USDC",   address: "0x3600000000000000000000000000000000000000", decimals: 6, name: "USD Coin"       },
  { symbol: "EURC",   address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6, name: "Euro Coin"      },
  { symbol: "cirBTC", address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", decimals: 8, name: "Circle Bitcoin"  },
  { symbol: "USYC",   address: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", decimals: 6, name: "US Yield Coin"   },
];

async function rpcCall(method: string, params: unknown[]): Promise<{ result?: string; error?: string }> {
  try {
    const res = await fetch(ARC_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      // 5 s timeout — a dedicated RPC should respond in well under a second;
      // 10 s was masking slow/failed calls rather than surfacing them quickly.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { error: `RPC HTTP ${res.status}: ${res.statusText}` };
    const d = await res.json() as { result?: string; error?: { message: string; code?: number } };
    if (d.error) return { error: `RPC error ${d.error.code ?? ""}: ${d.error.message}` };
    return { result: d.result ?? "0x0" };
  } catch (e) {
    return { error: `Network error: ${(e as Error).message}` };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.toLowerCase().trim();
  const debug   = searchParams.get("debug") === "1";

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: `Invalid address: "${address}"` }, { status: 400 });
  }

  // Fire native balance + all 4 token balanceOf() calls in parallel —
  // skip the eth_chainId check (saves a round-trip; we already know this is Arc).
  const padded   = "000000000000000000000000" + address.slice(2);
  const callData = "0x70a08231" + padded; // balanceOf(address) selector

  const [nativeBalCheck, ...tokenResults] = await Promise.all([
    rpcCall("eth_getBalance", [address, "latest"]),
    ...TOKENS.map(t => rpcCall("eth_call", [{ to: t.address, data: callData }, "latest"])),
  ]);

  // Surface a meaningful error if the RPC itself is unreachable
  if (nativeBalCheck.error && tokenResults.every(r => r.error)) {
    return NextResponse.json({
      error: `Cannot reach Arc Testnet RPC (${ARC_RPC}): ${nativeBalCheck.error}`,
      rpcUrl: ARC_RPC,
    }, { status: 502 });
  }

  let nativeGasUSDC = "0";
  if (!nativeBalCheck.error && nativeBalCheck.result && nativeBalCheck.result !== "0x0") {
    try {
      const val = Number(BigInt(nativeBalCheck.result)) / 1e18;
      nativeGasUSDC = val.toFixed(val > 0 ? 6 : 0);
    } catch { /* keep "0" */ }
  }

  const results = TOKENS.map((t, i) => {
    const { result: raw, error } = tokenResults[i];
    if (error) {
      return { symbol: t.symbol, name: t.name, decimals: t.decimals, amount: "0", error, rawResult: null as string | null };
    }
    let amount = "0";
    try {
      if (raw && raw !== "0x" && raw !== "0x0" && raw.length > 2) {
        const val = Number(BigInt(raw)) / Math.pow(10, t.decimals);
        amount = val.toFixed(val > 0 ? Math.min(t.decimals, 6) : 0);
      }
    } catch (e) {
      return { symbol: t.symbol, name: t.name, decimals: t.decimals, amount: "0", error: `Parse error: ${(e as Error).message}`, rawResult: raw };
    }
    return { symbol: t.symbol, name: t.name, decimals: t.decimals, amount, error: null as string | null, rawResult: debug ? raw : undefined };
  });

  // RECONCILIATION: On Arc, USDC's native balance and its ERC-20 interface balance
  // represent the SAME underlying value (per docs.arc.io) — just scaled with different
  // decimals (18 vs 6). If the ERC-20 balanceOf() call comes back 0 while the native
  // eth_getBalance shows real funds, trust the native value instead of showing a
  // misleading $0.00 — this can happen if the system contract's call semantics differ
  // slightly from a standard ERC-20 token.
  const usdcResult = results.find(r => r.symbol === "USDC");
  if (usdcResult && parseFloat(usdcResult.amount) === 0 && parseFloat(nativeGasUSDC) > 0) {
    usdcResult.amount = nativeGasUSDC;
  }

  const balances: Record<string, { name: string; amount: string; decimals: number; error?: string | null; rawResult?: string | null }> = {};
  const errors: Record<string, string> = {};
  results.forEach((r) => {
    balances[r.symbol] = {
      name: r.name, amount: r.amount, decimals: r.decimals,
      ...(debug ? { error: r.error, rawResult: r.rawResult ?? null } : {}),
    };
    if (r.error) errors[r.symbol] = r.error;
  });

  return NextResponse.json({
    address, balances, network: "arc-testnet", chainId: "0x4CE352", // Arc chain ID (5042002)
    nativeGasUSDC,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  }, {
    headers: {
      // Cache at the Vercel edge for 15 s — repeated page visits or wallet-
      // tab opens within that window return instantly without a new RPC call.
      // stale-while-revalidate: serve the cached version while fetching fresh
      // data in the background, so the user NEVER sees a loading flash.
      "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
    },
  });
}
