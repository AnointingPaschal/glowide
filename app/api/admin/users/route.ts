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
    const [plansRes, logsRes, txRes, balRes, connRes] = await Promise.allSettled([
      supabaseREST("GET", "user_plans",          undefined, "select=*&order=created_at.desc&limit=200"),
      supabaseREST("GET", "activity_logs",       undefined, "select=wallet_address,action,created_at&order=created_at.desc&limit=500"),
      supabaseREST("GET", "transactions",        undefined, "select=*&order=created_at.desc&limit=50"),
      supabaseREST("GET", "wallet_balances",     undefined, "select=*&order=updated_at.desc&limit=100"),
      supabaseREST("GET", "wallet_connections",  undefined, "select=*&order=connected_at.desc&limit=100"),
    ]);

    const plans    = plansRes.status === "fulfilled"  && Array.isArray(plansRes.value.data)  ? plansRes.value.data  : [];
    const logs     = logsRes.status === "fulfilled"   && Array.isArray(logsRes.value.data)   ? logsRes.value.data   : [];
    const txs      = txRes.status === "fulfilled"     && Array.isArray(txRes.value.data)     ? txRes.value.data     : [];
    const balances = balRes.status === "fulfilled"    && Array.isArray(balRes.value.data)    ? balRes.value.data    : [];
    const conns    = connRes.status === "fulfilled"   && Array.isArray(connRes.value.data)   ? connRes.value.data   : [];

    // Count deployments
    let totalDeployments = 0;
    try {
      const countRes = await supabaseREST("GET", "deployed_contracts", undefined, "select=id");
      if (Array.isArray(countRes.data)) totalDeployments = countRes.data.length;
    } catch { /* silent */ }

    // Aggregate activity per wallet
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
      transactions: txs,
      walletBalances: balances,
      walletConnections: conns,
      stats: {
        totalUsers:        usersArr.length,
        totalDeployments,
        proUsers:          usersArr.filter((p) => p.plan && p.plan !== "free").length,
        totalConnections:  conns.length,
        totalTransactions: txs.length,
      },
    });
  } catch (err) {
    console.error("[admin/users]", err);
    return NextResponse.json({
      users: [], activity: {}, transactions: [], walletBalances: [], walletConnections: [],
      stats: { totalUsers: 0, totalDeployments: 0, proUsers: 0, totalConnections: 0, totalTransactions: 0 },
    });
  }
}
