import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from("files").select("*").eq("project_id", projectId).order("path");
    if (error) throw error;
    return NextResponse.json({ files: data || [] });
  } catch (err) {
    return NextResponse.json({ files: [], error: String(err) });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { fileId, content } = await req.json();
    if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("files").update({ content, updated_at: new Date().toISOString() }).eq("id", fileId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
