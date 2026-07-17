export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { circleAPI, getEntitySecretCiphertext, idempotencyKey } from "@/lib/circle-api";
import type { CircleWallet, CircleBalance } from "@/lib/circle-api";

// GET /api/circle/wallets?userToken=...&action=list|balances&walletId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userToken = searchParams.get("userToken");
  const action    = searchParams.get("action") ?? "list";
  const walletId  = searchParams.get("walletId");

  if (!userToken) return NextResponse.json({ error: "userToken required" }, { status: 400 });

  if (action === "balances" && walletId) {
    const { data, error } = await circleAPI<{ tokenBalances: CircleBalance[] }>(
      "GET", `/wallets/${walletId}/balances?includeAll=true`, undefined, userToken
    );
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(data);
  }

  // List all wallets for this user
  const { data, error } = await circleAPI<{ wallets: CircleWallet[] }>(
    "GET", `/wallets?pageSize=20`, undefined, userToken
  );
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}

// POST /api/circle/wallets — create wallet or restore
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      userToken: string; action?: string;
      name?: string; refId?: string; walletSetId?: string; count?: number;
    };
    const { userToken, action, name, refId, walletSetId, count } = body;

    if (action === "create-set") {
      // First create a wallet set
      const ciphertext = await getEntitySecretCiphertext();
      const { data, error } = await circleAPI<{ walletSet: { id: string } }>(
        "POST", "/developer/walletSets", {
          entitySecretCiphertext: ciphertext,
          idempotencyKey: idempotencyKey(),
          name: name ?? "GlowIDE WalletSet",
        }
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    if (!userToken) return NextResponse.json({ error: "userToken required" }, { status: 400 });

    // Create wallet within existing flow (user-controlled PIN flow)
    const blockchains = ["ETH-SEPOLIA", "ETH", "MATIC", "AVAX", "ARB", "BASE", "OP"];
    const { data, error } = await circleAPI<{ challengeId: string }>(
      "POST", "/user/wallets", {
        idempotencyKey: idempotencyKey(),
        accountType: "SCA",
        blockchains,
        metadata: [{ name: name ?? "GlowIDE Wallet", refId: refId ?? `glow-${Date.now()}` }],
      },
      userToken
    );
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
