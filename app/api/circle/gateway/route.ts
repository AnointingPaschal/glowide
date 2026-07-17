export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { circleAPI, idempotencyKey } from "@/lib/circle-api";

// Circle Gateway — Unified crosschain USDC balance
// Docs: https://developers.circle.com/gateway

const GATEWAY_BASE = "https://api.circle.com/v1/gateway";

async function gatewayAPI<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${GATEWAY_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CIRCLE_API_KEY ?? ""}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const json = await res.json() as { data?: T; message?: string };
    if (!res.ok) return { data: null, error: json.message ?? `Gateway error ${res.status}` };
    return { data: json.data as T, error: null };
  } catch (e) { return { data: null, error: String(e) }; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action  = searchParams.get("action") ?? "balance";
  const address = searchParams.get("address");

  if (action === "balance" && address) {
    // Get unified balance across all blockchains
    const { data, error } = await gatewayAPI<{ balance: { amount: string; blockchain: string }[] }>(
      "GET", `/wallets/${address}/balance`
    );
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(data);
  }

  if (action === "blockchains") {
    // Supported blockchains
    const { data, error } = await gatewayAPI<{ blockchains: string[] }>("GET", "/blockchains");
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: string;
      sourceAddress: string; destinationAddress: string;
      amount: string; sourceBlockchain: string; destinationBlockchain: string;
      signature?: string;
    };
    const { action, sourceAddress, destinationAddress, amount, sourceBlockchain, destinationBlockchain } = body;

    if (action === "transfer") {
      // Instant crosschain USDC transfer via Gateway (<500ms after balance established)
      const { data, error } = await gatewayAPI<{ transactionId: string; state: string }>(
        "POST", "/transfers", {
          idempotencyKey: idempotencyKey(),
          sourceAddress,
          destinationAddress,
          amount,
          sourceBlockchain,
          destinationBlockchain,
          tokenSymbol: "USDC",
        }
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    if (action === "deposit-address") {
      // Get deposit address (Gateway Wallet contract) for a blockchain
      const { data, error } = await gatewayAPI<{ depositAddress: string; blockchain: string }>(
        "POST", "/deposit-addresses", {
          userAddress: sourceAddress,
          blockchain: sourceBlockchain,
        }
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
