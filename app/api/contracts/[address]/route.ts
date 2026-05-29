export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  const addr = params.address?.toLowerCase();
  if (!addr) return NextResponse.json({ error: "Address required" }, { status: 400 });

  const { data, error } = await supabaseREST("GET", "deployed_contracts", undefined, `address=ilike.${addr}&limit=1`);

  const rows = Array.isArray(data) ? data : [];
  if (error || rows.length === 0) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const c = rows[0] as Record<string,unknown>;
  return NextResponse.json({
    contract: {
      ...c,
      abi: typeof c.abi === "string" ? (() => { try { return JSON.parse(c.abi as string); } catch { return []; } })() : (c.abi ?? []),
    }
  });
}
