/**
 * GET /api/contracts/selector?sig=transfer(address,uint256)
 * Computes the real 4-byte Ethereum function selector (keccak256 of the
 * signature, first 4 bytes) via ethers.js — NOT guessed, NOT Node's
 * built-in sha3 (which is NIST SHA-3, a different algorithm that produces
 * different hashes than Ethereum's Keccak-256 variant).
 */
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { id } from "ethers";

export async function GET(req: NextRequest) {
  const sig = req.nextUrl.searchParams.get("sig");
  if (!sig) return NextResponse.json({ error: "sig required" }, { status: 400 });
  try {
    const hash = id(sig); // ethers' keccak256(toUtf8Bytes(sig))
    return NextResponse.json({ selector: hash.slice(2, 10), signature: sig });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
