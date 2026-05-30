export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

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
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet) return NextResponse.json({ sessions: [] });
  try {
    const { url, sKey } = getSupabase();
    const sessRes = await fetch(
      `${url}/rest/v1/chat_sessions?wallet_address=eq.${wallet}&order=updated_at.desc&limit=50&select=*`,
      { headers: hdrs(sKey), cache: "no-store" }
    );
    if (!sessRes.ok) { const t=await sessRes.text(); console.error("[chat sessions GET]",t.slice(0,200)); return NextResponse.json({ sessions: [] }); }
    const sessions = await sessRes.json() as Array<Record<string, unknown>>;
    if (!sessions.length) return NextResponse.json({ sessions: [] });
    const ids = sessions.map(s => `"${s.id}"`).join(",");
    const msgRes = await fetch(
      `${url}/rest/v1/chat_messages?session_id=in.(${ids})&order=created_at.asc&limit=2000&select=*`,
      { headers: hdrs(sKey), cache: "no-store" }
    );
    const messages = msgRes.ok ? await msgRes.json() as Array<Record<string, unknown>> : [];
    const result = sessions.map(s => ({ ...s, messages: messages.filter(m => m.session_id === s.id) }));
    return NextResponse.json({ sessions: result });
  } catch (err) { console.error("[chat sessions GET]", err); return NextResponse.json({ sessions: [] }); }
}

export async function POST(req: NextRequest) {
  try {
    const { session, wallet } = await req.json();
    if (!session?.id || !wallet) return NextResponse.json({ ok: false });
    const { url, sKey } = getSupabase();
    const sessRow = { id:session.id, wallet_address:wallet.toLowerCase(), title:session.title||"New Chat", model:session.model||"", updated_at:new Date().toISOString(), created_at:session.created_at||new Date().toISOString() };
    await fetch(`${url}/rest/v1/chat_sessions?on_conflict=id`, {
      method:"POST", headers:hdrs(sKey, {"Prefer":"resolution=merge-duplicates,return=minimal"}),
      body:JSON.stringify(sessRow), cache:"no-store",
    });
    if (session.messages?.length) {
      const msgRows = session.messages.map((m: Record<string,unknown>) => ({ id:m.id, session_id:session.id, role:m.role, content:m.content, created_at:m.created_at||new Date().toISOString() }));
      await fetch(`${url}/rest/v1/chat_messages?on_conflict=id`, {
        method:"POST", headers:hdrs(sKey, {"Prefer":"resolution=merge-duplicates,return=minimal"}),
        body:JSON.stringify(msgRows), cache:"no-store",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) { console.error("[chat sessions POST]", err); return NextResponse.json({ ok:false, error:String(err) }); }
}
