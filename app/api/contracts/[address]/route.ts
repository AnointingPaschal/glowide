import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  const { address } = params;
  if (!address) return NextResponse.json({ error: "Address required" }, { status: 400 });
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from("deployed_contracts").select("*").ilike("address", address).single();
    if (!data) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    return NextResponse.json({ contract: { ...data, abi: typeof data.abi === "string" ? JSON.parse(data.abi) : (data.abi ?? []) } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
