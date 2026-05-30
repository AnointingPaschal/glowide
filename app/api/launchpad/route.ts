export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

function getSupabase() {
  const url  = (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "").trim();
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !sKey) throw new Error("Supabase env vars missing");
  return { url, sKey };
}

function headers(sKey: string, extra: Record<string,string> = {}) {
  return {
    "Content-Type":  "application/json",
    "apikey":        sKey,
    "Authorization": `Bearer ${sKey}`,
    ...extra,
  };
}

// GET /api/launchpad — list all tokens (append-only, never deleted)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offset = searchParams.get("offset") ?? "0";
  const limit  = searchParams.get("limit")  ?? "24";
  const search = searchParams.get("q")?.toLowerCase();
  const creator = searchParams.get("creator")?.toLowerCase();

  try {
    const { url, sKey } = getSupabase();
    let qs = `select=*&order=launched_at.desc&offset=${offset}&limit=${limit}`;
    if (creator) qs += `&creator_address=ilike.${creator}`;
    if (search)  qs += `&or=(name.ilike.*${search}*,symbol.ilike.*${search}*)`;

    const res = await fetch(`${url}/rest/v1/launchpad_tokens?${qs}`, {
      headers: headers(sKey),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[launchpad GET]", res.status, text.slice(0, 200));
      return NextResponse.json({ tokens: [], error: `DB error ${res.status}` });
    }
    const data = await res.json();
    return NextResponse.json({ tokens: Array.isArray(data) ? data : [] });
  } catch (err) {
    console.error("[launchpad GET]", err);
    return NextResponse.json({ tokens: [], error: String(err) });
  }
}

// POST /api/launchpad — record a new token launch
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.tokenAddress || !body.creator || !body.name) {
      return NextResponse.json({ error: "tokenAddress, creator, name required" }, { status: 400 });
    }

    const { url, sKey } = getSupabase();

    const row = {
      token_address:      (body.tokenAddress as string).toLowerCase(),
      creator_address:    (body.creator as string).toLowerCase(),
      pair_address:       body.pairAddress ? (body.pairAddress as string).toLowerCase() : null,
      name:               body.name,
      symbol:             body.symbol ?? "",
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

    const res = await fetch(`${url}/rest/v1/launchpad_tokens?on_conflict=token_address`, {
      method: "POST",
      headers: headers(sKey, { "Prefer": "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(row),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[launchpad POST]", res.status, text.slice(0, 300));
      // Try without on_conflict (table might not have the constraint yet)
      const res2 = await fetch(`${url}/rest/v1/launchpad_tokens`, {
        method: "POST",
        headers: headers(sKey, { "Prefer": "return=representation" }),
        body: JSON.stringify(row),
        cache: "no-store",
      });
      if (!res2.ok) {
        const text2 = await res2.text();
        return NextResponse.json({
          error: `DB insert failed: ${text2.slice(0, 200)}`,
          hint: "Run this SQL in Supabase: ALTER TABLE launchpad_tokens DISABLE ROW LEVEL SECURITY; GRANT ALL ON launchpad_tokens TO service_role;",
        }, { status: 500 });
      }
      const data2 = await res2.json();
      return NextResponse.json({ success: true, token: Array.isArray(data2) ? data2[0] : data2 });
    }

    const data = await res.json();
    console.log("[launchpad POST] saved:", row.token_address);
    return NextResponse.json({ success: true, token: Array.isArray(data) ? data[0] : data });
  } catch (err) {
    console.error("[launchpad POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
