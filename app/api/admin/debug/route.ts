export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const adminWallet = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();
  if (auth.startsWith("Wallet ")) {
    const w = auth.slice(7).toLowerCase();
    return adminWallet ? w === adminWallet : true;
  }
  return !process.env.ADMIN_SECRET_KEY;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "";

  const results: Record<string, unknown> = {
    supabase_url:  url  ? `set (${url.slice(0, 30)}…)` : "❌ MISSING",
    service_key:   key  ? `set (${key.slice(0, 12)}…)` : "❌ MISSING",
    admin_wallet:  adminWallet || "(any — dev mode)",
    url_format:    url.startsWith("https://") && url.includes(".supabase.co") ? "✓ valid" : "❌ should be https://xxxx.supabase.co",
  };

  if (!url || !key) {
    results.diagnosis = "❌ Environment variables missing. Add them in Vercel → Project Settings → Environment Variables.";
    return NextResponse.json(results);
  }

  // ── Step 1: Raw DNS / TCP check — just fetch the Supabase health endpoint ──
  try {
    const healthRes = await fetch(`${url}/rest/v1/`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` },
      cache: "no-store",
    });
    results.connectivity = { status: healthRes.status, ok: healthRes.ok };
  } catch (e) {
    results.connectivity = { error: String(e) };
    results.diagnosis = "❌ Cannot reach Supabase. Most likely cause: your Supabase project is PAUSED (free tier pauses after 7 days). Go to supabase.com → your project → click 'Resume'.";
    return NextResponse.json(results);
  }

  // ── Step 2: SELECT ─────────────────────────────────────────────────────────
  try {
    const selRes = await fetch(`${url}/rest/v1/system_settings?select=key,value&limit=3`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` },
      cache: "no-store",
    });
    const selData = await selRes.json();
    results.select = selRes.ok
      ? { ok: true, rows: Array.isArray(selData) ? selData.length : 0 }
      : { error: selData?.message ?? JSON.stringify(selData), status: selRes.status };
  } catch (e) { results.select = { error: String(e) }; }

  // ── Step 3: PATCH (update) ─────────────────────────────────────────────────
  try {
    const patchRes = await fetch(`${url}/rest/v1/system_settings?key=eq.maintenance_mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "apikey": key, "Authorization": `Bearer ${key}`, "Prefer": "return=minimal" },
      body: JSON.stringify({ value: "false", updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    const patchText = await patchRes.text();
    results.patch = patchRes.ok
      ? { ok: true }
      : { error: patchText.slice(0, 200), status: patchRes.status };
  } catch (e) { results.patch = { error: String(e) }; }

  // ── Step 4: POST upsert ────────────────────────────────────────────────────
  try {
    const upsertRes = await fetch(`${url}/rest/v1/system_settings?on_conflict=key`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key, "Authorization": `Bearer ${key}`, "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key: "_debug_test", value: String(Date.now()), is_secret: false, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    const upsertText = await upsertRes.text();
    results.upsert = upsertRes.ok
      ? { ok: true }
      : { error: upsertText.slice(0, 200), status: upsertRes.status };
  } catch (e) { results.upsert = { error: String(e) }; }

  // ── Diagnosis ──────────────────────────────────────────────────────────────
  const allOk = ["select","patch","upsert"].every(k => (results[k] as Record<string,unknown>)?.ok === true);
  if (allOk) {
    results.diagnosis = "✓ All checks passed — admin settings should save correctly.";
  } else if ((results.select as Record<string,unknown>)?.status === 403 || (results.upsert as Record<string,unknown>)?.status === 403) {
    results.diagnosis = "❌ Row Level Security is blocking writes. Run in Supabase SQL Editor:\n  ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;\n  GRANT ALL ON system_settings TO service_role;";
  } else if ((results.select as Record<string,unknown>)?.status === 404) {
    results.diagnosis = "❌ Table 'system_settings' not found. Run the full schema.sql in Supabase SQL Editor.";
  } else {
    results.diagnosis = "⚠️ Some checks failed. Check individual errors above.";
  }

  return NextResponse.json(results);
}
