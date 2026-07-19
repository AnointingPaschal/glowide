export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { circleAPI, getEntitySecretCiphertext, idempotencyKey } from "@/lib/circle-api";
import type { CircleUser, CircleChallenge } from "@/lib/circle-api";

// POST /api/circle/users  — create or get session token for a user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { action: string; userId?: string; email?: string };
    const { action, userId, email } = body;

    if (action === "create") {
      // Create new user
      const ciphertext = await getEntitySecretCiphertext();
      const ref = email ?? `user-${Date.now()}`;
      const { data, error } = await circleAPI<{ user: CircleUser }>("POST", "/users", {
        userId: userId ?? crypto.randomUUID(),
        idempotencyKey: idempotencyKey(),
        entitySecretCiphertext: ciphertext,
        refId: ref,
      });
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json({ user: (data as { user?: CircleUser })?.user ?? data });
    }

    if (action === "token") {
      // Acquire session token for existing user
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      const ciphertext = await getEntitySecretCiphertext();
      const { data, error } = await circleAPI<{ userToken: string; encryptionKey: string }>(
        "POST", `/users/token`, {
          userId,
          entitySecretCiphertext: ciphertext,
        }
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    if (action === "initialize") {
      // Initialize user (generate PIN challenge)
      const { userToken } = body as unknown as { userToken: string };
      if (!userToken) return NextResponse.json({ error: "userToken required" }, { status: 400 });
      // TEST API key only supports testnet blockchains (never MAINNET names)
      const blockchains = ["ETH-SEPOLIA", "MATIC-AMOY", "ARB-SEPOLIA", "AVAX-FUJI", "SOL-DEVNET", "UNI-SEPOLIA"];
      const { data, error } = await circleAPI<{ challengeId: string }>(
        "POST", `/user/initialize`, {
          idempotencyKey: idempotencyKey(),
          accountType: "SCA",
          blockchains,
        },
        userToken
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/circle/users?userId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const { data, error } = await circleAPI<{ user: CircleUser }>("GET", `/users/${userId}`);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}
