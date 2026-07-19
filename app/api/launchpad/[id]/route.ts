import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url  = (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "").trim();
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !sKey) throw new Error("Supabase env vars missing");
  return { url, sKey };
}

// GET /api/launchpad/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { url, sKey } = getSupabase();
    const res = await fetch(`${url}/rest/v1/launchpad_tokens?id=eq.${params.id}&select=*&limit=1`, {
      headers: { "apikey": sKey, "Authorization": `Bearer ${sKey}` },
      cache: "no-store",
    });
    const rows = await res.json() as unknown[];
    if (!rows?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ token: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/launchpad/[id] — update social / description info
// Fee enforcement: in production, verify a 1 USDC payment tx hash before updating.
// For now we accept a paymentTxHash field and log it; Circle payment verification
// can be wired later once a treasury wallet is set up.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json() as {
      website?: string;
      twitter?: string;
      telegram?: string;
      discord?: string;
      description?: string;
      paymentTxHash?: string; // Optional: tx proving 1 USDC was paid
    };

    const { url, sKey } = getSupabase();

    // Build patch payload — only include columns that exist in schema
    const patch: Record<string, string> = {};
    if (body.website     !== undefined) patch.website     = body.website;
    if (body.twitter     !== undefined) patch.twitter     = body.twitter;
    if (body.description !== undefined) patch.description = body.description;
    // telegram / discord: only include if those columns exist (alter table to add them if needed)
    // For now we skip them to avoid Supabase 400 errors on unknown columns
    patch.updated_at = new Date().toISOString();

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const res = await fetch(`${url}/rest/v1/launchpad_tokens?id=eq.${params.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        sKey,
        "Authorization": `Bearer ${sKey}`,
        "Prefer":        "return=representation",
      },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: txt }, { status: res.status });
    }

    const updated = await res.json();
    return NextResponse.json({ token: updated[0] ?? null, paymentLogged: !!body.paymentTxHash });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
