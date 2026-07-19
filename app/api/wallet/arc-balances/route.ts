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
 */
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

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
      signal: AbortSignal.timeout(10000),
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

  // Run chainId check, native balance, and all token balances in parallel (was sequential)
  const padded = "000000000000000000000000" + address.slice(2);
  const callData = "0x70a08231" + padded; // balanceOf(address) selector

  const [chainIdCheck, nativeBalCheck, ...tokenResults] = await Promise.all([
    rpcCall("eth_chainId", []),
    rpcCall("eth_getBalance", [address, "latest"]),
    ...TOKENS.map(t => rpcCall("eth_call", [{ to: t.address, data: callData }, "latest"])),
  ]);

  if (chainIdCheck.error) {
    return NextResponse.json({
      error: `Cannot reach Arc Testnet RPC (${ARC_RPC}): ${chainIdCheck.error}`,
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
    address, balances, network: "arc-testnet", chainId: chainIdCheck.result,
    nativeGasUSDC,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  });
}
