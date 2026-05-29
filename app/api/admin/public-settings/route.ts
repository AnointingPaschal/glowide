export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

const PUBLIC_KEYS = [
  "deployment_fee", "fee_recipient", "fees_enabled",
  "available_models", "default_model", "free_deployments",
  "site_name", "site_tagline", "site_description", "logo_url", "primary_color",
];

export async function GET() {
  try {
    const { data, error } = await supabaseREST(
      "GET",
      "system_settings",
      undefined,
      `select=key,value&key=in.(${PUBLIC_KEYS.map(k => `"${k}"`).join(",")})`
    );

    if (!error && Array.isArray(data) && data.length > 0) {
      const settings = Object.fromEntries(
        (data as { key: string; value: string }[]).map(s => [s.key, s.value])
      );
      return NextResponse.json(settings);
    }
  } catch { /* fall through to defaults */ }

  // Fallback defaults if Supabase unreachable
  return NextResponse.json({
    deployment_fee:  "0",
    fees_enabled:    "false",
    free_deployments:"3",
    default_model:   "anthropic/claude-3.5-sonnet",
  });
}
