import { NextRequest, NextResponse } from "next/server";

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL || (process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    if (!address) return NextResponse.json({ error: "Address required" }, { status: 400 });

    const response = await fetch(ARC_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 1 }),
    });
    const data = await response.json();
    const nativeBalance = data.result ? (parseInt(data.result, 16) / 1e6).toFixed(6) : "0.000000";

    return NextResponse.json({
      address,
      balances: {
        usdc: nativeBalance,
        eurc: "0.000000",
        cirBTC: "0.00000000",
        native: nativeBalance,
      },
      network: "Arc Testnet",
      chainId: 5042002,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
