/**
 * GET /api/wallet/arc-balances?address=0x...
 * Server-side Arc Testnet ERC-20 balance reader.
 * More reliable than client-side RPC calls (no CORS, no timeout issues).
 */
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

const TOKENS = [
  { symbol: "USDC",   address: "0x3600000000000000000000000000000000000000", decimals: 18, name: "USD Coin"       },
  { symbol: "EURC",   address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6,  name: "Euro Coin"      },
  { symbol: "cirBTC", address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", decimals: 8,  name: "Circle Bitcoin"  },
  { symbol: "USYC",   address: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", decimals: 6,  name: "US Yield Coin"   },
];

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const d = await res.json() as { result?: string; error?: { message: string } };
  if (d.error) throw new Error(d.error.message);
  return d.result ?? "0x0";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.toLowerCase().trim();
  if (!address || !address.startsWith("0x")) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const padded = "000000000000000000000000" + address.slice(2);
  // balanceOf(address) selector = 0x70a08231
  const callData = "0x70a08231" + padded;

  const results = await Promise.allSettled(
    TOKENS.map(async (t) => {
      const raw = await rpcCall("eth_call", [{ to: t.address, data: callData }, "latest"]);
      let amount = "0";
      if (raw && raw !== "0x" && raw !== "0x0" && raw.length > 2) {
        try {
          const val = Number(BigInt(raw)) / Math.pow(10, t.decimals);
          amount = val.toFixed(val > 0 ? Math.min(t.decimals, 6) : 0);
        } catch { amount = "0"; }
      }
      return { symbol: t.symbol, name: t.name, decimals: t.decimals, amount };
    })
  );

  const balances: Record<string, { name: string; amount: string; decimals: number }> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      balances[TOKENS[i].symbol] = {
        name: r.value.name,
        amount: r.value.amount,
        decimals: r.value.decimals,
      };
    } else {
      balances[TOKENS[i].symbol] = { name: TOKENS[i].name, amount: "0", decimals: TOKENS[i].decimals };
    }
  });

  return NextResponse.json({ address, balances, network: "arc-testnet" });
}
