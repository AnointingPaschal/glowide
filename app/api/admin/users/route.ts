import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const key = process.env.ADMIN_SECRET_KEY;
  if (!key) return true;
  return auth === `Bearer ${key}`;
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createServerSupabaseClient();
    const { data: plans } = await supabase.from("user_plans").select("*").order("created_at", { ascending: false });
    const { data: logs } = await supabase.from("activity_logs").select("wallet_address, action, created_at").order("created_at", { ascending: false }).limit(200);
    const { count: totalDeployments } = await supabase.from("deployed_contracts").select("*", { count: "exact", head: true });

    // Aggregate activity per user
    const userActivity: Record<string, { actions: number; lastSeen: string; actions_list: string[] }> = {};
    for (const log of (logs ?? [])) {
      if (!log.wallet_address) continue;
      if (!userActivity[log.wallet_address]) userActivity[log.wallet_address] = { actions: 0, lastSeen: log.created_at, actions_list: [] };
      userActivity[log.wallet_address].actions++;
      if (userActivity[log.wallet_address].actions_list.length < 5) userActivity[log.wallet_address].actions_list.push(log.action);
    }

    return NextResponse.json({
      users: plans ?? [],
      activity: userActivity,
      stats: { totalUsers: (plans ?? []).length, totalDeployments: totalDeployments ?? 0, proUsers: (plans ?? []).filter(p => p.plan !== "free").length },
    });
  } catch (err) {
    console.error("[admin/users]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
