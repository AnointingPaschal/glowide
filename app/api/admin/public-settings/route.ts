export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 min edge cache — logos rarely change
import { NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

const PUBLIC_KEYS = [
  "deployment_fee","launchpad_fee","fee_recipient","fees_enabled",
  "available_models","default_model","free_deployments",
  "site_name","site_tagline","site_description","logo_url","primary_color",
  "usdc_logo_url","eurc_logo_url","cirbtc_logo_url","arc_logo_url","usyc_logo_url",
  "treasury_address","launchpad_factory",
  "lending_pool_address","payment_stream_address","yield_vault_address",
];

export async function GET() {
  const headers = {
    "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
  };
  try {
    const keyList = PUBLIC_KEYS.map(k => `"${k}"`).join(",");
    const { data, error } = await supabaseREST(
      "GET", "system_settings", undefined,
      `select=key,value&key=in.(${keyList})`
    );
    if (!error && Array.isArray(data) && data.length > 0) {
      const settings = Object.fromEntries(
        (data as { key: string; value: string }[]).map(s => [s.key, s.value])
      );
      return NextResponse.json(settings, { headers });
    }
  } catch { /* fallthrough */ }
  return NextResponse.json({
    deployment_fee: "0", fees_enabled: "false", free_deployments: "3",
    default_model: "anthropic/claude-3.5-sonnet",
    usdc_logo_url: "https://www.circle.com/hubfs/USDC/USDC_icon_1.svg",
    eurc_logo_url: "https://www.circle.com/hubfs/EURC/EURC_icon.svg",
    cirbtc_logo_url: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
  }, { headers });
}
