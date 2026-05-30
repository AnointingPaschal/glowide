export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Wallet ")) {
    const w = auth.slice(7).toLowerCase();
    return ADMIN_WALLET ? w === ADMIN_WALLET : true;
  }
  return !process.env.ADMIN_SECRET_KEY;
}

function getSupabase() {
  const url  = (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "").trim();
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !sKey) throw new Error("Supabase env vars missing");
  return { url, sKey };
}
function hdrs(sKey: string, extra: Record<string,string> = {}) {
  return { "Content-Type":"application/json", "apikey":sKey, "Authorization":`Bearer ${sKey}`, ...extra };
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { url, sKey } = getSupabase();
    const res = await fetch(
      `${url}/rest/v1/ai_training_examples?select=*&order=created_at.desc`,
      { headers: hdrs(sKey), cache: "no-store" }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error("[training GET]", res.status, text.slice(0,200));
      return NextResponse.json({ examples: [], error: `DB error ${res.status}` });
    }
    const data = await res.json();
    return NextResponse.json({ examples: Array.isArray(data) ? data : [] });
  } catch (err) {
    console.error("[training GET]", err);
    return NextResponse.json({ examples: [], error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { examples } = await req.json();
    if (!Array.isArray(examples)) return NextResponse.json({ error: "examples must be array" }, { status: 400 });
    const { url, sKey } = getSupabase();

    // Delete all existing training examples first
    await fetch(`${url}/rest/v1/ai_training_examples?id=not.is.null`, {
      method: "DELETE",
      headers: hdrs(sKey),
      cache: "no-store",
    });

    if (!examples.length) return NextResponse.json({ success: true, count: 0 });

    // Insert all new ones
    const rows = examples.map((ex: { user_message:string; assistant_response:string; category?:string; enabled?:boolean }) => ({
      user_message:       ex.user_message ?? "",
      assistant_response: ex.assistant_response ?? "",
      category:           ex.category ?? "general",
      enabled:            ex.enabled !== false,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    }));

    const insertRes = await fetch(`${url}/rest/v1/ai_training_examples`, {
      method: "POST",
      headers: hdrs(sKey, { "Prefer": "return=minimal" }),
      body: JSON.stringify(rows),
      cache: "no-store",
    });

    if (!insertRes.ok) {
      const text = await insertRes.text();
      console.error("[training POST insert]", insertRes.status, text.slice(0,300));
      return NextResponse.json({
        error: `Insert failed: ${text.slice(0,150)}`,
        hint: "Run: CREATE TABLE ai_training_examples (...); ALTER TABLE ai_training_examples DISABLE ROW LEVEL SECURITY; GRANT ALL ON ai_training_examples TO service_role;",
      }, { status: 500 });
    }

    console.log(`[training POST] saved ${rows.length} examples`);
    return NextResponse.json({ success: true, count: rows.length });
  } catch (err) {
    console.error("[training POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
