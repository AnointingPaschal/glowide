/**
 * GET /api/debug/trace?tx=0x...
 * Server-side proxy for debug_traceTransaction on Arc Testnet (avoids CORS).
 * Returns the full opcode-level execution trace: each step's opcode, gas,
 * program counter, depth, and stack — the same data Remix's debugger uses.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? (process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network");

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  const d = await res.json() as { result?: unknown; error?: { message: string; code?: number } };
  if (d.error) throw new Error(`${d.error.code ?? ""} ${d.error.message}`.trim());
  return d.result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txHash = searchParams.get("tx")?.trim();
  if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
    return NextResponse.json({ error: `Invalid transaction hash: "${txHash}"` }, { status: 400 });
  }

  try {
    // Fetch the transaction + receipt first so the debugger has context
    // (to/from/value/status) even if tracing isn't supported.
    const [tx, receipt] = await Promise.all([
      rpcCall("eth_getTransactionByHash", [txHash]),
      rpcCall("eth_getTransactionReceipt", [txHash]),
    ]);

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found on Arc Testnet" }, { status: 404 });
    }

    // Try the standard debug_traceTransaction (struct logger) — most
    // Geth/Reth-based EVM chains (including Arc) support this.
    let trace: unknown = null;
    let traceError: string | null = null;
    try {
      trace = await rpcCall("debug_traceTransaction", [
        txHash,
        { tracer: undefined, disableStorage: false, disableMemory: false, disableStack: false },
      ]);
    } catch (e) {
      traceError = (e as Error).message;
    }

    return NextResponse.json({ tx, receipt, trace, traceError });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
