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

  try {
    const [plansRes, logsRes, deploysRes] = await Promise.allSettled([
      supabaseREST("GET", "user_plans",       undefined, "select=*&order=created_at.desc&limit=200"),
      supabaseREST("GET", "activity_logs",    undefined, "select=wallet_address,action,created_at&order=created_at.desc&limit=500"),
      supabaseREST("GET", "deployed_contracts", undefined, "select=id&limit=1&offset=0"),
    ]);

    const plans   = plansRes.status   === "fulfilled" && Array.isArray(plansRes.value.data)   ? plansRes.value.data   : [];
    const logs    = logsRes.status    === "fulfilled" && Array.isArray(logsRes.value.data)    ? logsRes.value.data    : [];

    // Count deployments via a separate count query
    let totalDeployments = 0;
    try {
      const countRes = await supabaseREST("GET", "deployed_contracts", undefined, "select=id");
      if (Array.isArray(countRes.data)) totalDeployments = countRes.data.length;
    } catch { /* silent */ }

    // Aggregate activity
    const activity: Record<string, { actions: number; lastSeen: string; actions_list: string[] }> = {};
    for (const log of logs as Array<{ wallet_address: string; action: string; created_at: string }>) {
      if (!log.wallet_address) continue;
      if (!activity[log.wallet_address]) activity[log.wallet_address] = { actions: 0, lastSeen: log.created_at, actions_list: [] };
      activity[log.wallet_address].actions++;
      if (activity[log.wallet_address].actions_list.length < 5) activity[log.wallet_address].actions_list.push(log.action);
    }

    const usersArr = plans as Array<{ plan?: string; wallet_address?: string }>;

    return NextResponse.json({
      users: usersArr,
      activity,
      stats: {
        totalUsers:       usersArr.length,
        totalDeployments,
        proUsers:         usersArr.filter(p => p.plan && p.plan !== "free").length,
      },
    });
  } catch (err) {
    console.error("[admin/users]", err);
    return NextResponse.json({
      users: [], activity: {},
      stats: { totalUsers: 0, totalDeployments: 0, proUsers: 0 },
      error: String(err),
    });
  }
}
