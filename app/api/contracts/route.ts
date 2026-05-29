export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deployer = searchParams.get("deployer")?.toLowerCase();

  const query = deployer
    ? `select=*&deployer=ilike.${encodeURIComponent(deployer)}&order=created_at.desc`
    : `select=*&order=created_at.desc&limit=100`;

  const { data, error } = await supabaseREST("GET", "deployed_contracts", undefined, query);

  if (error) {
    console.error("[contracts GET]", error);
    return NextResponse.json({ contracts: [], error }, { status: 200 }); // return empty, not 500
  }

  const contracts = (Array.isArray(data) ? data : []).map((c: Record<string,unknown>) => ({
    ...c,
    abi: typeof c.abi === "string" ? (() => { try { return JSON.parse(c.abi as string); } catch { return []; } })() : (c.abi ?? []),
    deployedAt: c.created_at,
    network: "Arc Testnet",
  }));

  return NextResponse.json({ contracts });
}
