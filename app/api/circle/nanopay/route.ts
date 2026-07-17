export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { idempotencyKey } from "@/lib/circle-api";

// Circle Gateway Nanopayments — gas-free USDC micropayments via x402 protocol
// https://developers.circle.com/gateway/nanopayments

const GW_BASE = "https://api.circle.com/v1/gateway";
const API_KEY = process.env.CIRCLE_API_KEY ?? "";

async function gwPost<T>(path: string, body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${GW_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = await res.json() as { data?: T; message?: string };
    if (!res.ok) return { data: null, error: json.message ?? `NanoPay error ${res.status}` };
    return { data: json.data as T, error: null };
  } catch (e) { return { data: null, error: String(e) }; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: string;
      paymentAuthorization?: string;  // signed EIP-3009 authorization from buyer
      amount?: string;
      payerAddress?: string;
      payeeAddress?: string;
      validAfter?: number;
      validBefore?: number;
      nonce?: string;
      v?: number; r?: string; s?: string;
    };

    const { action } = body;

    if (action === "settle") {
      // Settle a signed x402 payment authorization
      const { data, error } = await gwPost<{ settlementId: string; state: string }>(
        "/x402/settle", {
          idempotencyKey: idempotencyKey(),
          paymentAuthorization: body.paymentAuthorization,
          payerAddress:  body.payerAddress,
          payeeAddress:  body.payeeAddress,
          amount:        body.amount,
          validAfter:    body.validAfter,
          validBefore:   body.validBefore,
          nonce:         body.nonce,
          v: body.v, r: body.r, s: body.s,
        }
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    if (action === "deposit-address") {
      // Get Gateway Wallet contract address for buyer to deposit USDC
      const { data, error } = await gwPost<{ depositAddress: string }>(
        "/x402/deposit-address", { userAddress: body.payerAddress }
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET — check nanopayment balance for an address
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  try {
    const res = await fetch(`${GW_BASE}/x402/balance/${address}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });
    const json = await res.json() as { data?: unknown; message?: string };
    if (!res.ok) return NextResponse.json({ error: json.message }, { status: 400 });
    return NextResponse.json(json.data ?? { balance: "0", address });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
