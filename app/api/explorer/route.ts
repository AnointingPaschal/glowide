import { NextRequest, NextResponse } from "next/server";

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network";
const ARC_EXPLORER = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app";

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const data = await res.json();
  return data.result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") || "auto";

  if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

  try {
    // Detect query type
    const isAddress = /^0x[0-9a-fA-F]{40}$/.test(query);
    const isTxHash = /^0x[0-9a-fA-F]{64}$/.test(query);
    const isBlock = /^\d+$/.test(query);

    if (isTxHash) {
      const [tx, receipt] = await Promise.all([
        rpcCall("eth_getTransactionByHash", [query]),
        rpcCall("eth_getTransactionReceipt", [query]),
      ]);
      return NextResponse.json({ type: "transaction", data: { tx, receipt, explorerUrl: `${ARC_EXPLORER}/tx/${query}` } });
    }

    if (isAddress) {
      const [balance, code, txCount] = await Promise.all([
        rpcCall("eth_getBalance", [query, "latest"]),
        rpcCall("eth_getCode", [query, "latest"]),
        rpcCall("eth_getTransactionCount", [query, "latest"]),
      ]);
      const isContract = code && code !== "0x";
      return NextResponse.json({
        type: isContract ? "contract" : "address",
        data: {
          address: query,
          balance: balance ? (parseInt(balance, 16) / 1e6).toFixed(6) : "0",
          isContract,
          txCount: txCount ? parseInt(txCount, 16) : 0,
          code: isContract ? code?.slice(0, 100) + "..." : null,
          explorerUrl: `${ARC_EXPLORER}/address/${query}`,
        },
      });
    }

    if (isBlock) {
      const block = await rpcCall("eth_getBlockByNumber", [`0x${parseInt(query).toString(16)}`, false]);
      return NextResponse.json({ type: "block", data: { block, explorerUrl: `${ARC_EXPLORER}/block/${query}` } });
    }

    return NextResponse.json({ error: "Could not determine query type" }, { status: 400 });
  } catch (err) {
    console.error("Explorer error:", err);
    // Return mock data for dev/demo
    return NextResponse.json({
      type: "address",
      data: {
        address: query,
        balance: "0.00",
        isContract: false,
        txCount: 0,
        explorerUrl: `${ARC_EXPLORER}/address/${query}`,
        error: "Could not fetch live data. Arc Testnet may be unavailable.",
      },
    });
  }
}
