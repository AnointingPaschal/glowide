import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const adminKey = process.env.ADMIN_SECRET_KEY;
  if (!adminKey) return true;
  return auth === `Bearer ${adminKey}`;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from("system_settings").select("key,value,is_secret,updated_at").order("key");
    if (error) throw error;
    return NextResponse.json({ settings: data ?? [] });
  } catch (err) {
    console.error("[admin/settings GET]", err);
    return NextResponse.json({ settings: [], error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const settings = body.settings as Record<string, string>;
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const SECRET_KEYS = new Set(["openrouter_api_key", "admin_secret"]);

    // Upsert one by one to avoid schema mismatch issues
    const errors: string[] = [];
    for (const [key, value] of Object.entries(settings)) {
      const { error } = await supabase.from("system_settings").upsert(
        { key, value: String(value ?? ""), is_secret: SECRET_KEYS.has(key), updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) errors.push(`${key}: ${error.message}`);
    }

    if (errors.length) {
      console.error("[admin/settings POST] partial errors:", errors);
      return NextResponse.json({ success: false, errors }, { status: 207 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/settings POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
