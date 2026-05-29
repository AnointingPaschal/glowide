export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const PUBLIC_KEYS = ["deployment_fee","fee_recipient","fees_enabled","available_models","default_model","free_deployments"];

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from("system_settings").select("key,value").in("key", PUBLIC_KEYS);
    const settings = Object.fromEntries((data ?? []).map((s: { key: string; value: string }) => [s.key, s.value]));
    return NextResponse.json(settings);
  } catch { return NextResponse.json({}); }
}
