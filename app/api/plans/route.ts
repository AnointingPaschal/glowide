import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const PLAN_CONFIGS = {
  free:       { tokens_limit: 50000,   storage_limit_bytes: 52428800,   deployments_limit: 3,   name: "Free"       },
  pro:        { tokens_limit: 500000,  storage_limit_bytes: 524288000,  deployments_limit: 50,  name: "Pro"        },
  enterprise: { tokens_limit: 5000000, storage_limit_bytes: 5368709120, deployments_limit: 500, name: "Enterprise" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("user_plans").select("*").eq("wallet_address", wallet.toLowerCase()).single();

  if (!data) {
    // Auto-create free plan
    const { data: newPlan } = await supabase.from("user_plans").insert({
      wallet_address: wallet.toLowerCase(),
      plan: "free",
      ...PLAN_CONFIGS.free,
    }).select().single();
    return NextResponse.json({ plan: newPlan ?? { wallet_address: wallet, plan: "free", ...PLAN_CONFIGS.free, tokens_used: 0 } });
  }
  return NextResponse.json({ plan: data });
}

export async function POST(req: NextRequest) {
  try {
    const { wallet, plan, tx_hash } = await req.json();
    if (!wallet || !plan) return NextResponse.json({ error: "wallet and plan required" }, { status: 400 });
    if (!PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS]) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const config = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS];
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from("user_plans").upsert({
      wallet_address: wallet.toLowerCase(),
      plan,
      ...config,
      subscription_tx: tx_hash ?? null,
      subscription_start: new Date().toISOString(),
      subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "wallet_address" }).select().single();

    return NextResponse.json({ success: true, plan: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
