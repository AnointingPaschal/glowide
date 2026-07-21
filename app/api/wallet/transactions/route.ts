/**
 * GET /api/wallet/transactions?address=0x...&token=USDC&limit=10
 *
 * Server-side eth_getLogs proxy — fetches ERC-20 Transfer events from Arc
 * using the dedicated RPC URL from Vercel env at RUNTIME (not build time).
 * This is important: NEXT_PUBLIC_ vars in client code are embedded when the
 * app is built; a server-side route always picks up the current Vercel value.
 */
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

const TOKEN_META: Record<string, { address: string; decimals: number }> = {
  USDC:   { address: "0x3600000000000000000000000000000000000000", decimals: 18 },
  EURC:   { address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6  },
  cirBTC: { address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", decimals: 8  },
  USYC:   { address: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", decimals: 6  },
};

// ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function getLogs(params: object): Promise<unknown[]> {
  try {
    const res = await fetch(ARC_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [params] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const d = await res.json() as { result?: unknown[]; error?: unknown };
    return d.result ?? [];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.toLowerCase().trim();
  const token   = searchParams.get("token") ?? "USDC";
  const limit   = Math.min(parseInt(searchParams.get("limit") ?? "8"), 20);

  if (!address || !address.startsWith("0x") || address.length !== 42)
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const meta = TOKEN_META[token];
  if (!meta)
    return NextResponse.json({ error: `Unknown token: ${token}` }, { status: 400 });

  const paddedAddr = "0x" + "000000000000000000000000" + address.slice(2);

  // Fire both directions in parallel
  const [inbound, outbound] = await Promise.all([
    getLogs({ address: meta.address, fromBlock: "earliest", toBlock: "latest",
      topics: [TRANSFER_TOPIC, null, paddedAddr] }),
    getLogs({ address: meta.address, fromBlock: "earliest", toBlock: "latest",
      topics: [TRANSFER_TOPIC, paddedAddr, null] }),
  ]);

  const fmt = (hex: string) => {
    try { return (Number(BigInt(hex)) / Math.pow(10, meta.decimals)).toFixed(4); }
    catch { return "0"; }
  };

  type LogEntry = { transactionHash: string; topics: string[]; data: string };
  const ins  = (inbound  as LogEntry[]).slice(-limit).map(l => ({
    hash: l.transactionHash, direction: "in" as const,
    from: "0x" + (l.topics[1]?.slice(26) ?? ""), to: address, value: fmt(l.data),
  }));
  const outs = (outbound as LogEntry[]).slice(-limit).map(l => ({
    hash: l.transactionHash, direction: "out" as const,
    from: address, to: "0x" + (l.topics[2]?.slice(26) ?? ""), value: fmt(l.data),
  }));

  const txns = [...ins, ...outs].slice(0, limit);

  return NextResponse.json({ txns, token, address, rpcUrl: ARC_RPC }, {
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
  });
}
