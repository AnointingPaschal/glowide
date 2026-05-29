export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

// GET /api/launchpad — list all tokens (append-only, never delete)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offset  = parseInt(searchParams.get("offset") ?? "0");
  const limit   = parseInt(searchParams.get("limit")  ?? "20");
  const creator = searchParams.get("creator")?.toLowerCase();
  const search  = searchParams.get("q")?.toLowerCase();

  let query = `select=*&order=launched_at.desc&offset=${offset}&limit=${limit}`;
  if (creator) query += `&creator_address=ilike.${creator}`;
  if (search)  query += `&or=(name.ilike.*${search}*,symbol.ilike.*${search}*)`;

  const { data, error } = await supabaseREST("GET", "launchpad_tokens", undefined, query);
  if (error) return NextResponse.json({ tokens: [], error }, { status: 200 });

  return NextResponse.json({ tokens: Array.isArray(data) ? data : [] });
}

// POST /api/launchpad — record a new token launch
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const row = {
      token_address:      body.tokenAddress?.toLowerCase(),
      creator_address:    body.creator?.toLowerCase(),
      pair_address:       body.pairAddress?.toLowerCase() ?? null,
      name:               body.name,
      symbol:             body.symbol,
      decimals:           body.decimals ?? 18,
      total_supply:       String(body.totalSupply ?? "0"),
      description:        body.description ?? "",
      website:            body.website ?? "",
      twitter:            body.twitter ?? "",
      token_uri:          body.tokenURI ?? "",
      image_url:          body.imageUrl ?? "",
      lp_amount:          String(body.lpAmount ?? "0"),
      lp_unlock_time:     body.lpUnlockTime ?? 0,
      lock_duration_days: body.lockDurationDays ?? 0,
      tx_hash:            body.txHash ?? "",
      block_number:       body.blockNumber ?? 0,
      chain_id:           5042002,
      launched_at:        new Date().toISOString(),
    };

    if (!row.token_address || !row.creator_address || !row.name) {
      return NextResponse.json({ error: "tokenAddress, creator, name required" }, { status: 400 });
    }

    const { data, error } = await supabaseREST("POST", "launchpad_tokens", row);
    if (error) {
      console.error("[launchpad POST]", error);
      return NextResponse.json({ error }, { status: 500 });
    }
    return NextResponse.json({ success: true, token: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
