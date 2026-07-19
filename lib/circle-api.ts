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
  const d = await res.json() as { data?: { publicKey?: string }; code?: number; message?: string };
  if (!res.ok || !d.data?.publicKey) {
    throw new Error(`Circle API key fetch failed (${res.status}): ${d.message ?? JSON.stringify(d)}`);
  }
  _pubKey = d.data.publicKey.trim();
  return _pubKey;
}

export async function getEntitySecretCiphertext(): Promise<string> {
  const pubKeyPem = await getCirclePublicKey();
  const secretBuf = Buffer.from(ENTITY_SECRET, "hex");

  // Extract raw DER bytes from PEM (strips headers + whitespace)
  const pemBody = pubKeyPem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Buffer.from(pemBody, "base64");

  // Try DER with explicit types — bypasses PEM DECODER entirely (fixes OpenSSL 3 / Node 24 compat)
  type KeyObject = ReturnType<typeof crypto.createPublicKey>;
  const attempts: Array<() => KeyObject> = [
    () => crypto.createPublicKey({ key: der, format: "der", type: "spki"   }),
    () => crypto.createPublicKey({ key: der, format: "der", type: "pkcs1"  }),
    () => crypto.createPublicKey({ key: pubKeyPem, format: "pem" }),
  ];

  let keyObj: KeyObject | null = null;
  let lastErr: unknown;
  for (const attempt of attempts) {
    try { keyObj = attempt(); break; } catch (e) { lastErr = e; }
  }
  if (!keyObj) throw new Error(`Circle RSA key parse failed: ${lastErr}`);

  // Encrypt with RSA-OAEP + SHA-256
  const encrypted = crypto.publicEncrypt(
    { key: keyObj, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    secretBuf
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
