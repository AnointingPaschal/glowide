export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Wallet ")) {
    const wallet = auth.slice(7).toLowerCase();
    return ADMIN_WALLET ? wallet === ADMIN_WALLET : true;
  }
  // Legacy key fallback
  const key = process.env.ADMIN_SECRET_KEY;
  if (!key) return true;
  return auth === `Bearer ${key}`;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value, updated_at")
      .order("key");
    if (error) {
      console.error("[settings GET]", error.message, error.details);
      return NextResponse.json({ settings: [], error: error.message }, { status: 500 });
    }
    return NextResponse.json({ settings: data ?? [] });
  } catch (err) {
    console.error("[settings GET] exception:", err);
    return NextResponse.json({ settings: [], error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { settings: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { settings } = body;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return NextResponse.json({ error: "Expected { settings: Record<string,string> }" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const entries = Object.entries(settings).filter(([k, v]) => k && v !== undefined && v !== null);

  if (entries.length === 0) {
    return NextResponse.json({ success: true, saved: 0, message: "Nothing to save" });
  }

  let saved = 0;
  const errors: string[] = [];

  for (const [key, value] of entries) {
    // Use a raw SQL upsert via rpc to avoid column mismatch issues
    // Falls back to: try UPDATE first, then INSERT
    const strVal = String(value);

    // First try UPDATE (key already exists)
    const { error: updateErr } = await supabase
      .from("system_settings")
      .update({ value: strVal, updated_at: new Date().toISOString() })
      .eq("key", key);

    if (updateErr) {
      // UPDATE failed - try INSERT
      const { error: insertErr } = await supabase
        .from("system_settings")
        .insert({
          key,
          value: strVal,
          is_secret: key === "openrouter_api_key",
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

      if (insertErr) {
        // Both failed — try minimal upsert with only key+value
        const { error: upsertErr } = await supabase
          .from("system_settings")
          .upsert({ key, value: strVal }, { onConflict: "key" });

        if (upsertErr) {
          errors.push(`${key}: ${upsertErr.message}`);
          console.error(`[settings] failed to save "${key}":`, upsertErr.message);
        } else {
          saved++;
        }
      } else {
        saved++;
      }
    } else {
      saved++;
    }
  }

  console.log(`[settings POST] saved=${saved} errors=${errors.length} total=${entries.length}`);

  if (errors.length > 0 && saved === 0) {
    return NextResponse.json({ success: false, errors, saved: 0 }, { status: 500 });
  }
  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors, saved }, { status: 207 });
  }
  return NextResponse.json({ success: true, saved });
}
