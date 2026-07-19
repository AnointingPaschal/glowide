export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const ARC_RPC  = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const USDC_ARC = "0x3600000000000000000000000000000000000000";
const TREASURY = "0xCca907AE079DB7638A4d2D3e82defaea5FBDF383";

function readContract(filename: string): string {
  try { return readFileSync(join(process.cwd(), "contracts", filename), "utf8"); }
  catch { throw new Error(`Contract not found: contracts/${filename}`); }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { contract?: string };
  const which = body.contract ?? "all";

  const sources: Record<string, { source: string; constructorArgs: unknown[]; envVar: string }> = {};
  if (which === "lending" || which === "all")
    sources.GlowLendingPool = { source: readContract("GlowLendingPool.sol"), constructorArgs: [TREASURY], envVar: "NEXT_PUBLIC_LENDING_POOL_ADDRESS" };
  if (which === "stream" || which === "all")
    sources.GlowPaymentStream = { source: readContract("GlowPaymentStream.sol"), constructorArgs: [], envVar: "NEXT_PUBLIC_PAYMENT_STREAM_ADDRESS" };
  if (which === "vault" || which === "all")
    sources.GlowYieldVault = { source: readContract("GlowYieldVault.sol"), constructorArgs: ["USDC Savings Vault", "gUSDC", USDC_ARC], envVar: "NEXT_PUBLIC_YIELD_VAULT_ADDRESS" };

  return NextResponse.json({
    ok: true,
    deployTarget: { rpc: ARC_RPC, chainId: CHAIN_ID, treasury: TREASURY, usdc: USDC_ARC },
    contracts: sources,
    steps: [
      "1. Open /editor, paste each contract source, compile with solc 0.8.20",
      "2. Deploy on Arc Testnet (Chain ID 5042002, RPC: https://rpc.testnet.arc.network)",
      "3. Add to Vercel env vars: NEXT_PUBLIC_LENDING_POOL_ADDRESS, NEXT_PUBLIC_PAYMENT_STREAM_ADDRESS, NEXT_PUBLIC_YIELD_VAULT_ADDRESS",
    ],
  });
}
