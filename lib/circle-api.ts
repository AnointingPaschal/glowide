// Server-only — never imported by client bundles
import "server-only";
/**
 * Circle Programmable Wallets — server-side API client
 * All calls are server-only (API key + entity secret never reach the browser).
 *
 * Docs: https://developers.circle.com/wallets/user-controlled
 * API:  https://api.circle.com/v1/w3s
 */
const crypto = require("crypto") as typeof import("crypto");

export const CIRCLE_BASE = "https://api.circle.com/v1/w3s";
export const API_KEY     = process.env.CIRCLE_API_KEY ?? "";
const ENTITY_SECRET      = process.env.CIRCLE_ENTITY_SECRET ?? "";

// ── RSA-encrypt entity secret with Circle's public key ───────────────────────
let _pubKey: string | null = null;

async function getCirclePublicKey(): Promise<string> {
  if (_pubKey) return _pubKey;
  const res = await fetch(`${CIRCLE_BASE}/config/entity/publicKey`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
  });
  const d = await res.json() as { data?: { publicKey?: string } };
  _pubKey = d.data?.publicKey ?? "";
  return _pubKey;
}

export async function getEntitySecretCiphertext(): Promise<string> {
  const pubKey = await getCirclePublicKey();
  // Circle expects: RSA-OAEP + SHA-256, result base64url-encoded
  const encrypted = crypto.publicEncrypt(
    { key: pubKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(ENTITY_SECRET, "hex")
  );
  return encrypted.toString("base64");
}

// ── Generic Circle API helper ─────────────────────────────────────────────────
export async function circleAPI<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
  userToken?: string          // session token for user-scoped calls
): Promise<{ data: T | null; error: string | null; raw?: unknown }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    };
    if (userToken) headers["X-User-Token"] = userToken;

    const res = await fetch(`${CIRCLE_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const json = await res.json() as { data?: T; message?: string; code?: number };

    if (!res.ok) {
      return { data: null, error: json.message ?? `Circle API error ${res.status}`, raw: json };
    }
    return { data: json.data as T ?? null, error: null, raw: json };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ── Idempotency key helper ────────────────────────────────────────────────────
export function idempotencyKey(): string {
  return crypto.randomUUID();
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface CircleUser {
  id: string;
  status: "ENABLED" | "PENDING_ACTIVATION";
}

export interface CircleWallet {
  id: string;
  address: string;
  blockchain: string;
  accountType: "EOA" | "SCA";
  state: "LIVE" | "FROZEN";
  custodyType: "ENDUSER";
  name?: string;
  refId?: string;
}

export interface CircleToken {
  id: string;
  address?: string;
  symbol: string;
  name: string;
  decimals: number;
  blockchain: string;
  isNative?: boolean;
}

export interface CircleBalance {
  token: CircleToken;
  amount: string;
  updateDate: string;
}

export interface CircleTransaction {
  id: string;
  blockchain: string;
  walletId: string;
  tokenId?: string;
  destinationAddress?: string;
  amounts?: string[];
  txHash?: string;
  state: "INITIATED" | "PENDING_RISK_SCREENING" | "DENIED" | "APPROVED" | "SENT" | "CONFIRMED" | "COMPLETE" | "FAILED" | "CANCELLED";
  transactionType: "INBOUND" | "OUTBOUND";
  networkFee?: string;
  errorReason?: string;
  createDate: string;
  updateDate: string;
}

export interface CircleChallenge {
  challengeId: string;
  status: string;
  correlationId?: string;
  userId?: string;
  userToken?: string;
  encryptionKey?: string;
}

// ── Blockchain ID mapping for Circle API ─────────────────────────────────────
export const CHAIN_TO_CIRCLE: Record<number, string> = {
  1:       "ETH",
  5:       "ETH-GOERLI",
  11155111:"ETH-SEPOLIA",
  137:     "MATIC",
  80001:   "MATIC-MUMBAI",
  43114:   "AVAX",
  43113:   "AVAX-FUJI",
  42161:   "ARB",
  421614:  "ARB-SEPOLIA",
  10:      "OP",
  11155420:"OP-SEPOLIA",
  8453:    "BASE",
  84532:   "BASE-SEPOLIA",
  5042002: "ETH",           // Arc Testnet uses ETH-compatible — defaults to ETH in Circle sandbox
};

export function chainToCircleBlockchain(chainId: number): string {
  return CHAIN_TO_CIRCLE[chainId] ?? "ETH";
}
