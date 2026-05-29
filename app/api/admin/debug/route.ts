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

  const rawUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const rawKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  // Strip any hidden whitespace/newlines that break URLs
  const url = rawUrl.trim().replace(/\s+/g, "");
  const key = rawKey.trim().replace(/\s+/g, "");

  const results: Record<string, unknown> = {
    // Show enough to diagnose format issues without exposing credentials
    url_raw_length:   rawUrl.length,
    url_trimmed:      url.slice(0, 50) + (url.length > 50 ? "…" : ""),
    url_starts_https: url.startsWith("https://"),
    url_has_supabase: url.includes(".supabase.co"),
    key_length:       key.length,
    key_prefix:       key.slice(0, 8) + "…",
    admin_wallet:     process.env.NEXT_PUBLIC_ADMIN_WALLET || "(any)",
  };

  // ── Sanity checks ─────────────────────────────────────────────────────────
  if (!url) {
    results.diagnosis = "❌ NEXT_PUBLIC_SUPABASE_URL is empty. Add it in Vercel → Project → Settings → Environment Variables then REDEPLOY.";
    return NextResponse.json(results);
  }
  if (!url.startsWith("https://")) {
    results.diagnosis = `❌ URL does not start with https://. Current value starts with: "${url.slice(0,20)}". Fix in Vercel env vars.`;
    return NextResponse.json(results);
  }
  if (!url.includes(".supabase.co")) {
    results.diagnosis = `❌ URL does not contain '.supabase.co'. Got: "${url.slice(0,40)}". Check your Supabase project URL.`;
    return NextResponse.json(results);
  }
  if (rawUrl !== url) {
    results.whitespace_warning = `⚠️ URL had hidden whitespace removed (raw length ${rawUrl.length} → trimmed length ${url.length}). Update the env var in Vercel to fix permanently.`;
  }

  // ── Test 1: General internet access ──────────────────────────────────────
  try {
    const g = await fetch("https://1.1.1.1", { method: "HEAD", signal: AbortSignal.timeout(3000) });
    results.internet_access = { ok: true, status: g.status };
  } catch (e) {
    results.internet_access = { error: String(e) };
    results.diagnosis = "❌ Vercel function cannot reach the internet at all. Check Vercel project network settings.";
    return NextResponse.json(results);
  }

  // ── Test 2: DNS — can we resolve the Supabase hostname? ──────────────────
  const supabaseHost = url.replace("https://", "").split("/")[0];
  results.supabase_host = supabaseHost;
  try {
    const dns = await fetch(`https://${supabaseHost}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    results.dns_resolve = { ok: true, status: dns.status };
  } catch (e) {
    results.dns_resolve = { error: String(e) };
    results.diagnosis = `❌ Cannot resolve Supabase hostname "${supabaseHost}". Check:\n1. Is the project URL correct? Go to Supabase → Project Settings → API → URL\n2. Copy the URL exactly (including https://) into Vercel env var\n3. Redeploy Vercel after changing env vars`;
    return NextResponse.json(results);
  }

  // ── Test 3: Supabase REST health ──────────────────────────────────────────
  try {
    const health = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const healthText = await health.text().catch(() => "");
    results.rest_health = { status: health.status, ok: health.ok, body: healthText.slice(0, 100) };
  } catch (e) {
    results.rest_health = { error: String(e) };
    results.diagnosis = `❌ REST API unreachable. Supabase hostname resolved but REST endpoint failed. Try: curl -H "apikey: YOUR_ANON_KEY" ${url}/rest/v1/ from your local machine.`;
    return NextResponse.json(results);
  }

  // ── Test 4: SELECT from system_settings ──────────────────────────────────
  try {
    const sel = await fetch(`${url}/rest/v1/system_settings?select=key&limit=3`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const selData = await sel.json().catch(() => null);
    if (sel.ok) {
      results.select = { ok: true, rows: Array.isArray(selData) ? selData.length : "?" };
    } else {
      results.select = { error: selData?.message ?? sel.statusText, status: sel.status };
      if (sel.status === 404) results.select_hint = "Table 'system_settings' does not exist. Run schema.sql in Supabase SQL Editor.";
      if (sel.status === 401) results.select_hint = "API key rejected. Use the service_role key (not anon key) for SUPABASE_SERVICE_ROLE_KEY.";
      if (sel.status === 403) results.select_hint = "RLS blocking. Run: ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;";
    }
  } catch (e) { results.select = { error: String(e) }; }

  // ── Test 5: UPSERT ────────────────────────────────────────────────────────
  try {
    const ups = await fetch(`${url}/rest/v1/system_settings?on_conflict=key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key, Authorization: `Bearer ${key}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ key: "_debug_test", value: String(Date.now()), is_secret: false }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const upsText = await ups.text().catch(() => "");
    results.upsert = ups.ok
      ? { ok: true }
      : { error: upsText.slice(0, 200), status: ups.status };
  } catch (e) { results.upsert = { error: String(e) }; }

  // ── Final diagnosis ───────────────────────────────────────────────────────
  const allOk = (results.select as Record<string,unknown>)?.ok === true &&
                (results.upsert as Record<string,unknown>)?.ok === true;

  if (allOk) {
    results.diagnosis = "✅ All checks passed — Supabase is connected. Admin settings should save correctly.";
  } else if ((results.select as Record<string,unknown>)?.status === 404) {
    results.diagnosis = "❌ Table missing. Run the full supabase/schema.sql in Supabase SQL Editor → Run.";
  } else if ((results.select as Record<string,unknown>)?.status === 401) {
    results.diagnosis = "❌ Wrong API key. SUPABASE_SERVICE_ROLE_KEY should be the 'service_role' JWT (not anon). Find it in Supabase → Project Settings → API → service_role secret.";
  } else if ((results.select as Record<string,unknown>)?.status === 403) {
    results.diagnosis = "❌ Row Level Security blocking. Run in Supabase SQL Editor:\nALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;\nGRANT ALL ON system_settings TO service_role;";
  } else {
    results.diagnosis = "⚠️ Partial issues. Check individual test results above.";
  }

  return NextResponse.json(results);
}
