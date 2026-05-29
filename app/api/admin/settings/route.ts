export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Wallet ")) {
    const w = auth.slice(7).toLowerCase();
    return ADMIN_WALLET ? w === ADMIN_WALLET : true;
  }
  const key = process.env.ADMIN_SECRET_KEY;
  if (!key) return true;
  return auth === `Bearer ${key}`;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error, status } = await supabaseREST(
    "GET",
    "system_settings",
    undefined,
    "select=key,value,updated_at&order=key"
  );

  if (error) {
    console.error("[settings GET]", error);
    return NextResponse.json({ settings: [], error }, { status: status || 500 });
  }

  return NextResponse.json({ settings: Array.isArray(data) ? data : [] });
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let settings: Record<string, string>;
  try {
    const body = await req.json();
    settings = body.settings;
    if (!settings || typeof settings !== "object") throw new Error("invalid");
  } catch {
    return NextResponse.json({ error: "Expected { settings: Record<string,string> }" }, { status: 400 });
  }

  const entries = Object.entries(settings).filter(([k, v]) => k && v !== undefined);
  if (entries.length === 0) return NextResponse.json({ success: true, saved: 0 });

  let saved = 0;
  const errors: string[] = [];

  for (const [key, value] of entries) {
    const row = {
      key,
      value: String(value),
      is_secret: key === "openrouter_api_key",
      updated_at: new Date().toISOString(),
    };

    // Try PATCH (update) first
    const patchResult = await supabaseREST(
      "PATCH",
      "system_settings",
      { value: String(value), updated_at: new Date().toISOString() },
      `key=eq.${encodeURIComponent(key)}`
    );

    if (!patchResult.error) {
      saved++;
      continue;
    }

    // PATCH failed — try POST (insert)
    const insertResult = await supabaseREST("POST", "system_settings", row);
    if (!insertResult.error) {
      saved++;
      continue;
    }

    // Both failed — upsert via POST with Prefer: resolution=merge-duplicates
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && sKey) {
      try {
        const upsertRes = await fetch(`${url}/rest/v1/system_settings?on_conflict=key`, {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "apikey":        sKey,
            "Authorization": `Bearer ${sKey}`,
            "Prefer":        "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(row),
          cache: "no-store",
        });
        if (upsertRes.ok) { saved++; continue; }
        const errText = await upsertRes.text();
        errors.push(`${key}: ${errText.slice(0, 120)}`);
        console.error(`[settings] upsert failed "${key}":`, errText.slice(0, 200));
      } catch (e) {
        errors.push(`${key}: ${String(e)}`);
      }
    } else {
      errors.push(`${key}: ${insertResult.error}`);
    }
  }

  console.log(`[settings POST] saved=${saved}/${entries.length} errors=${errors.length}`);

  if (saved === 0 && errors.length > 0) {
    return NextResponse.json({ success: false, saved: 0, errors }, { status: 500 });
  }
  if (errors.length > 0) {
    return NextResponse.json({ success: false, saved, errors }, { status: 207 });
  }
  return NextResponse.json({ success: true, saved });
}
