export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { circleAPI, idempotencyKey, chainToCircleBlockchain } from "@/lib/circle-api";
import type { CircleTransaction } from "@/lib/circle-api";

// GET — list transactions for a wallet
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userToken = searchParams.get("userToken");
  const walletId  = searchParams.get("walletId");
  if (!userToken || !walletId) return NextResponse.json({ error: "userToken + walletId required" }, { status: 400 });
  const { data, error } = await circleAPI<{ transactions: CircleTransaction[] }>(
    "GET", `/transactions?walletIds=${walletId}&pageSize=20`, undefined, userToken
  );
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}

// POST — initiate transfer, contract execution, or sign message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: string; userToken: string;
      walletId?: string; amounts?: string[]; destinationAddress?: string;
      tokenId?: string; blockchain?: string; chainId?: number;
      // contract execution
      contractAddress?: string; abiFunctionSignature?: string; abiParameters?: unknown[];
      value?: string;
      // message signing
      message?: string; typedDataPayload?: unknown;
      // fee level
      fee?: { type: string; config: Record<string, string> };
    };
    const { action, userToken, walletId, amounts, destinationAddress, tokenId,
            blockchain, chainId, contractAddress, abiFunctionSignature, abiParameters,
            value, message, typedDataPayload, fee } = body;

    const chain = blockchain ?? (chainId ? chainToCircleBlockchain(chainId) : "ETH");

    if (action === "transfer") {
      // ERC-20 or native token transfer — returns challengeId for PIN confirmation
      const { data, error } = await circleAPI<{ challengeId: string }>(
        "POST", "/user/transactions/transfer", {
          idempotencyKey: idempotencyKey(),
          userId: undefined,
          sourceWalletId: walletId,
          blockchain: chain,
          tokenId,
          destinationAddress,
          amounts,
          fee: fee ?? { type: "level", config: { feeLevel: "MEDIUM" } },
        }, userToken
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    if (action === "contract") {
      // Smart contract execution (deploy or call)
      const { data, error } = await circleAPI<{ challengeId: string }>(
        "POST", "/user/transactions/contractExecution", {
          idempotencyKey: idempotencyKey(),
          sourceWalletId: walletId,
          blockchain: chain,
          contractAddress,
          abiFunctionSignature,
          abiParameters: abiParameters ?? [],
          amount: value ?? "0",
          fee: fee ?? { type: "level", config: { feeLevel: "MEDIUM" } },
        }, userToken
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    if (action === "sign-message") {
      const { data, error } = await circleAPI<{ challengeId: string }>(
        "POST", "/user/sign/message", {
          walletId,
          message,
        }, userToken
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    if (action === "sign-typed-data") {
      const { data, error } = await circleAPI<{ challengeId: string }>(
        "POST", "/user/sign/typedData", {
          walletId,
          typedDataPayload,
        }, userToken
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
