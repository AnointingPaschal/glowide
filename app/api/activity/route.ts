export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { wallet_address, action, details } = await req.json();
    if (!action) return NextResponse.json({ ok: false });
    const supabase = createServerSupabaseClient();
    await supabase.from("activity_logs").insert({
      wallet_address: wallet_address ?? null,
      action,
      details: details ?? {},
      ip_address: req.headers.get("x-forwarded-for") ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
