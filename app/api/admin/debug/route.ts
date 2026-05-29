export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

  const results: Record<string, unknown> = {
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING",
    service_key:  process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
    admin_wallet: process.env.NEXT_PUBLIC_ADMIN_WALLET || "(any)",
  };

  try {
    const supabase = createServerSupabaseClient();

    // Test SELECT
    const { data: selectData, error: selectErr } = await supabase
      .from("system_settings")
      .select("key, value")
      .limit(3);
    results.select = selectErr ? { error: selectErr.message, code: selectErr.code } : { ok: true, rows: selectData?.length };

    // Test UPDATE on existing row
    const { error: updateErr } = await supabase
      .from("system_settings")
      .update({ value: "debug_test_" + Date.now() })
      .eq("key", "maintenance_mode");
    results.update = updateErr ? { error: updateErr.message, code: updateErr.code } : { ok: true };

    // Test INSERT (will fail if key exists - that's fine, shows constraint works)
    const { error: insertErr } = await supabase
      .from("system_settings")
      .insert({ key: `_debug_${Date.now()}`, value: "test", is_secret: false });
    results.insert = insertErr ? { error: insertErr.message, code: insertErr.code } : { ok: true };

    // Test minimal upsert
    const { error: upsertErr } = await supabase
      .from("system_settings")
      .upsert({ key: "maintenance_mode", value: "false" }, { onConflict: "key" });
    results.upsert = upsertErr ? { error: upsertErr.message, code: upsertErr.code } : { ok: true };

  } catch (err) {
    results.exception = String(err);
  }

  return NextResponse.json(results);
}
