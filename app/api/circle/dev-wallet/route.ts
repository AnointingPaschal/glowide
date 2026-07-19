/**
 * /api/circle/dev-wallet — Developer-Controlled Wallets
 * No PIN, no SDK popup, no user tokens needed.
 * Server signs with entity secret directly.
 * Perfect for testnet development.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { circleAPI, getEntitySecretCiphertext, idempotencyKey } from "@/lib/circle-api";

const DEV_WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID ?? "";

async function ensureWalletSet(): Promise<string> {
  if (DEV_WALLET_SET_ID) return DEV_WALLET_SET_ID;
  // Create a wallet set if not configured
  const ciphertext = await getEntitySecretCiphertext();
  const { data, error } = await circleAPI<{ walletSet: { id: string } }>(
    "POST", "/developer/walletSets",
    { idempotencyKey: idempotencyKey(), entitySecretCiphertext: ciphertext, name: "GlowIDE Default" }
  );
  if (error) throw new Error(`WalletSet create failed: ${error}`);
  const ws = data as { walletSet?: { id: string } };
  return ws.walletSet?.id ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: string; walletId?: string; to?: string; amount?: string; tokenAddress?: string;
      contractAddress?: string; abiFunctionSignature?: string; abiParameters?: unknown[];
      value?: string; blockchain?: string; id?: string;
    };
    const ciphertext = await getEntitySecretCiphertext();
    const chain = body.blockchain ?? "ETH-SEPOLIA";

    if (body.action === "create") {
      const walletSetId = await ensureWalletSet();
      const { data, error } = await circleAPI<{ wallets: Array<{ id: string; address: string; blockchain: string; state: string }> }>(
        "POST", "/developer/wallets",
        {
          idempotencyKey: idempotencyKey(),
          entitySecretCiphertext: ciphertext,
          walletSetId,
          blockchains: ["ETH-SEPOLIA"],
          count: 1,
          metadata: [{ name: "GlowIDE Wallet", refId: `glowaide-${Date.now()}` }],
        }
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      const ws = data as { wallets?: Array<{ id: string; address: string; blockchain: string; state: string }> };
      return NextResponse.json({ wallet: ws.wallets?.[0] ?? null });
    }

    if (body.action === "list") {
      const walletSetId = await ensureWalletSet();
      const { data, error } = await circleAPI<{ wallets: unknown[] }>(
        "GET", `/developer/wallets?walletSetId=${walletSetId}&pageSize=10`
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    if (body.action === "balances" && body.walletId) {
      const { data, error } = await circleAPI<{ tokenBalances: unknown[] }>(
        "GET", `/developer/wallets/${body.walletId}/balances`
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    if (body.action === "transfer" && body.walletId && body.to && body.amount) {
      const { data, error } = await circleAPI<{ id: string; state: string }>(
        "POST", "/developer/transactions/transfer",
        {
          idempotencyKey: idempotencyKey(),
          entitySecretCiphertext: ciphertext,
          walletId: body.walletId,
          destinationAddress: body.to,
          amounts: [body.amount],
          blockchain: chain,
          tokenAddress: body.tokenAddress ?? "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
          feeLevel: "MEDIUM",
        }
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    // Real on-chain contract execution — used by AI chat tool calls
    // (circle_contract_execute, circle_cctp_bridge) on Developer-Controlled wallets.
    if (body.action === "contract" && body.walletId && body.contractAddress && body.abiFunctionSignature) {
      const { data, error } = await circleAPI<{ id: string; state: string }>(
        "POST", "/developer/transactions/contractExecution",
        {
          idempotencyKey: idempotencyKey(),
          entitySecretCiphertext: ciphertext,
          walletId: body.walletId,
          contractAddress: body.contractAddress,
          abiFunctionSignature: body.abiFunctionSignature,
          abiParameters: body.abiParameters ?? [],
          amount: body.value ?? "0",
          blockchain: chain,
          feeLevel: "MEDIUM",
        }
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    // Poll transaction status by ID (Developer-Controlled txs execute immediately,
    // no PIN challenge — this lets the UI show confirmed/failed state)
    if (body.action === "status" && body.id) {
      const { data, error } = await circleAPI<{ transaction: { id: string; state: string; txHash?: string } }>(
        "GET", `/developer/transactions/${body.id}`
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
