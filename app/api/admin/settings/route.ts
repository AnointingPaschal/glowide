export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();

function verifyAdmin(req: NextRequest): boolean {
  // Support both wallet-address auth and legacy key auth
  const auth = req.headers.get("authorization") ?? "";
  // Wallet auth: "Wallet 0x..."
  if (auth.startsWith("Wallet ")) {
    const wallet = auth.slice(7).toLowerCase();
    return ADMIN_WALLET ? wallet === ADMIN_WALLET : true;
  }
  // Legacy key auth
  const adminKey = process.env.ADMIN_SECRET_KEY;
  if (!adminKey) return true;
  return auth === `Bearer ${adminKey}`;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("key,value,updated_at")
      .order("key");
    if (error) {
      console.error("[settings GET] Supabase error:", error);
      return NextResponse.json({ settings: [], error: error.message }, { status: 500 });
    }
    return NextResponse.json({ settings: data ?? [] });
  } catch (err) {
    console.error("[settings GET] Exception:", err);
    return NextResponse.json({ settings: [], error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const settings = body.settings as Record<string, string>;
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Invalid payload: expected { settings: Record<string,string> }" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const SECRET_KEYS = new Set(["openrouter_api_key"]);
    const entries = Object.entries(settings).filter(([, v]) => v !== undefined && v !== null);

    // Batch upsert using INSERT ... ON CONFLICT DO UPDATE
    const rows = entries.map(([key, value]) => ({
      key,
      value: String(value),
      is_secret: SECRET_KEYS.has(key),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("system_settings")
      .upsert(rows, { onConflict: "key", ignoreDuplicates: false });

    if (error) {
      console.error("[settings POST] Supabase upsert error:", error);
      // Try one-by-one as fallback
      const errors: string[] = [];
      for (const row of rows) {
        const { error: e2 } = await supabase
          .from("system_settings")
          .upsert(row, { onConflict: "key" });
        if (e2) errors.push(`${row.key}: ${e2.message}`);
      }
      if (errors.length) return NextResponse.json({ success: false, errors, saved: rows.length - errors.length }, { status: 207 });
    }

    return NextResponse.json({ success: true, saved: rows.length });
  } catch (err) {
    console.error("[settings POST] Exception:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
