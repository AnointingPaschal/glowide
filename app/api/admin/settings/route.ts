export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Wallet ")) {
    const w = auth.slice(7).toLowerCase();
    return ADMIN_WALLET ? w === ADMIN_WALLET : true;
  }
  const key = process.env.ADMIN_SECRET_KEY;
  if (!key) return true;
  return auth === `Bearer ${key}`;
}

function getSupabase() {
  const url  = (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "").trim();
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !sKey) throw new Error("Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return { url, sKey };
}

// GET — return all settings
export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { url, sKey } = getSupabase();
    const res = await fetch(`${url}/rest/v1/system_settings?select=key,value,updated_at&order=key`, {
      headers: { "apikey": sKey, "Authorization": `Bearer ${sKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[settings GET]", res.status, text.slice(0, 200));
      return NextResponse.json({ settings: [], error: `DB error ${res.status}: ${text.slice(0,100)}` }, { status: 200 });
    }
    const data = await res.json();
    return NextResponse.json({ settings: Array.isArray(data) ? data : [] });
  } catch (err) {
    console.error("[settings GET]", err);
    return NextResponse.json({ settings: [], error: String(err) });
  }
}

// POST — bulk upsert all settings in ONE request (on_conflict=key)
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let settings: Record<string, string>;
  try {
    const body = await req.json();
    settings = body.settings;
    if (!settings || typeof settings !== "object") throw new Error("invalid");
  } catch {
    return NextResponse.json({ error: "Expected { settings: Record<string,string> }" }, { status: 400 });
  }

  const entries = Object.entries(settings).filter(([k, v]) => k && v !== undefined && v !== null);
  if (entries.length === 0) return NextResponse.json({ success: true, saved: 0 });

  try {
    const { url, sKey } = getSupabase();
    const now = new Date().toISOString();

    const rows = entries.map(([key, value]) => ({
      key,
      value: String(value ?? ""),
      is_secret: key === "openrouter_api_key",
      updated_at: now,
    }));

    // Single bulk upsert — much more reliable than PATCH-then-POST loop
    const res = await fetch(`${url}/rest/v1/system_settings?on_conflict=key`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        sKey,
        "Authorization": `Bearer ${sKey}`,
        "Prefer":        "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[settings POST] upsert failed:", res.status, text.slice(0, 300));
      return NextResponse.json({
        success: false, saved: 0,
        error: `DB upsert failed (${res.status}): ${text.slice(0, 200)}`,
        hint: "Run this in Supabase SQL Editor: ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY; GRANT ALL ON system_settings TO service_role;",
      }, { status: 500 });
    }

    console.log(`[settings POST] bulk upserted ${rows.length} settings`);
    return NextResponse.json({ success: true, saved: rows.length });

  } catch (err) {
    console.error("[settings POST]", err);
    return NextResponse.json({ success: false, saved: 0, error: String(err) }, { status: 500 });
  }
}
