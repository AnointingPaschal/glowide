import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deployer = searchParams.get("deployer");
  try {
    const supabase = createServerSupabaseClient();
    let q = supabase.from("deployed_contracts").select("*").order("created_at", { ascending: false });
    if (deployer) q = q.ilike("deployer", deployer);
    const { data, error } = await q;
    if (error) throw error;
    const contracts = (data ?? []).map(c => ({
      ...c,
      abi: typeof c.abi === "string" ? JSON.parse(c.abi) : (c.abi ?? []),
      deployedAt: c.created_at,
      network: "Arc Testnet",
    }));
    return NextResponse.json({ contracts });
  } catch (err) {
    return NextResponse.json({ contracts: [], error: String(err) });
  }
}
