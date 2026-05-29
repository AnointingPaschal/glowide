export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const result: Record<string, unknown> = {
    NEXT_PUBLIC_SUPABASE_URL: {
      set:            supabaseUrl.length > 0,
      length:         supabaseUrl.length,
      preview:        supabaseUrl.slice(0, 45),
      starts_https:   supabaseUrl.startsWith("https://"),
      has_supabase:   supabaseUrl.includes(".supabase.co"),
      has_whitespace: supabaseUrl !== supabaseUrl.trim(),
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      set:    anonKey.length > 0,
      length: anonKey.length,
      prefix: anonKey.slice(0, 8),
      is_jwt: anonKey.startsWith("eyJ"),
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      set:             serviceKey.length > 0,
      length:          serviceKey.length,
      prefix:          serviceKey.slice(0, 8),
      is_jwt:          serviceKey.startsWith("eyJ"),
      longer_than_anon: serviceKey.length > anonKey.length,
      same_as_anon:    serviceKey === anonKey,
    },
    VERCEL_ENV: process.env.VERCEL_ENV ?? "local",
    NODE_ENV:   process.env.NODE_ENV,
  };

  const issues: string[] = [];
  if (!supabaseUrl)                                 issues.push("NEXT_PUBLIC_SUPABASE_URL is empty");
  if (!supabaseUrl.startsWith("https://"))          issues.push("URL must start with https://");
  if (!supabaseUrl.includes(".supabase.co"))        issues.push("URL must contain .supabase.co");
  if (supabaseUrl !== supabaseUrl.trim())           issues.push("URL has whitespace — re-paste in Vercel");
  if (!serviceKey)                                  issues.push("SUPABASE_SERVICE_ROLE_KEY is empty");
  if (serviceKey && !serviceKey.startsWith("eyJ")) issues.push("service_role key doesn't look like JWT");
  if (serviceKey && serviceKey === anonKey)         issues.push("service_role and anon keys are identical — wrong key pasted");
  if (serviceKey && serviceKey.length < 100)        issues.push(`service_role key only ${serviceKey.length} chars — probably pasted anon key. Service role is 200+ chars.`);

  result.issues = issues.length ? issues : ["No format issues found"];

  if (issues.length === 0) {
    try {
      const url = supabaseUrl.trim();
      const key = serviceKey.trim();
      const res = await fetch(`${url}/rest/v1/system_settings?select=key&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      const body = await res.text();
      result.live_test = {
        status: res.status,
        ok: res.ok,
        sample: body.slice(0, 80),
        diagnosis:
          res.status === 200 ? "✅ CONNECTED — Supabase is working" :
          res.status === 401 ? "❌ Wrong key — use service_role from Supabase → Project Settings → API" :
          res.status === 403 ? "❌ RLS — run: ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;" :
          res.status === 404 ? "❌ Table missing — run supabase/schema.sql in SQL Editor" :
          `Unexpected status ${res.status}: ${body.slice(0,60)}`,
      };
    } catch (e) {
      result.live_test = { error: String(e) };
      result.fix = [
        "Env vars look correct but network failed.",
        "MOST LIKELY: Vercel env vars not applied to current deployment.",
        "→ Vercel Dashboard → Deployments → (latest deploy) → ⋯ → Redeploy",
        "→ Make sure env vars are set for 'Production' (not just Preview/Development)",
      ];
    }
  }

  return NextResponse.json(result);
}
