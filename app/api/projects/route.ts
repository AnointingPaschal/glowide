import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const supabase = createServerSupabaseClient();
    let query = supabase.from("projects").select("*").order("updated_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ projects: data || [] });
  } catch (err) {
    return NextResponse.json({ projects: [], error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from("projects").insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ project: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
