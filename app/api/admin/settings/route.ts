import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const adminKey = process.env.ADMIN_SECRET_KEY;
  if (!adminKey) return true; // Skip in dev if not set
  return auth === `Bearer ${adminKey}`;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from("system_settings").select("*").order("key");
    if (error) throw error;
    return NextResponse.json({ settings: data || [] });
  } catch (err) {
    return NextResponse.json({ settings: [], error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { settings } = await req.json();
    const supabase = createServerSupabaseClient();
    const upserts = Object.entries(settings as Record<string, string>).map(([key, value]) => ({
      key,
      value: String(value),
      is_public: !["openrouter_api_key", "admin_secret"].includes(key),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("system_settings").upsert(upserts, { onConflict: "key" });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
