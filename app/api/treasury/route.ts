export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const TREASURY_ABI = [
  { type:"function", name:"stats",          inputs:[], outputs:[{name:"bal",type:"uint256"},{name:"received",type:"uint256"},{name:"withdrawn",type:"uint256"},{name:"txCount",type:"uint256"}], stateMutability:"view" },
  { type:"function", name:"getTransactions",inputs:[{name:"offset",type:"uint256"},{name:"limit",type:"uint256"}], outputs:[{name:"records",type:"tuple[]",components:[{name:"from",type:"address"},{name:"amount",type:"uint256"},{name:"feeType",type:"string"},{name:"timestamp",type:"uint256"}]},{name:"total",type:"uint256"}], stateMutability:"view" },
  { type:"function", name:"balance",        inputs:[], outputs:[{type:"uint256"}], stateMutability:"view" },
  { type:"function", name:"admin",          inputs:[], outputs:[{type:"address"}], stateMutability:"view" },
];

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(ARC_RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc:"2.0", id:1, method, params }),
    next: { revalidate: 10 },
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contract = searchParams.get("contract");
  if (!contract) return NextResponse.json({ error: "contract address required" }, { status: 400 });

  try {
    // Call balance()
    const balHex = await rpc("eth_call", [{ to: contract, data: "0xb69ef8a8" }, "latest"]) as string; // keccak4("balance()")
    const bal = BigInt(balHex || "0x0").toString();

    return NextResponse.json({ balance: bal, contract, network: "Arc Testnet" });
  } catch (err) {
    return NextResponse.json({ balance: "0", error: String(err), contract });
  }
}
