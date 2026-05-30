export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();
function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Wallet ")) {
    const w = auth.slice(7).toLowerCase();
    return ADMIN_WALLET ? w === ADMIN_WALLET : true;
  }
  return !process.env.ADMIN_SECRET_KEY;
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS launchpad_tokens (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address        TEXT NOT NULL UNIQUE,
  creator_address      TEXT NOT NULL,
  pair_address         TEXT,
  name                 TEXT NOT NULL,
  symbol               TEXT NOT NULL DEFAULT '',
  decimals             INTEGER DEFAULT 18,
  total_supply         TEXT NOT NULL DEFAULT '0',
  description          TEXT DEFAULT '',
  website              TEXT DEFAULT '',
  twitter              TEXT DEFAULT '',
  token_uri            TEXT DEFAULT '',
  image_url            TEXT DEFAULT '',
  lp_amount            TEXT DEFAULT '0',
  lp_unlock_time       BIGINT DEFAULT 0,
  lock_duration_days   INTEGER DEFAULT 0,
  liquidity_withdrawn  BOOLEAN DEFAULT FALSE,
  tx_hash              TEXT DEFAULT '',
  block_number         BIGINT DEFAULT 0,
  chain_id             INTEGER DEFAULT 5042002,
  launched_at          TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE launchpad_tokens DISABLE ROW LEVEL SECURITY;
GRANT ALL ON launchpad_tokens TO service_role;
GRANT ALL ON launchpad_tokens TO anon;
GRANT ALL ON launchpad_tokens TO authenticated;
`;

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url  = (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "").trim();
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !sKey) return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });

  // Extract project ref from URL: https://xxxx.supabase.co
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match?.[1];

  const results: Record<string, string> = {};

  // 1. Check if table already exists
  const checkRes = await fetch(`${url}/rest/v1/launchpad_tokens?select=id&limit=1`, {
    headers: { "apikey": sKey, "Authorization": `Bearer ${sKey}` },
    cache: "no-store",
  });

  if (checkRes.ok) {
    results.launchpad_tokens = "✓ Already exists and accessible";
    return NextResponse.json({ success: true, results, message: "Table already exists!" });
  }

  const checkText = await checkRes.text();
  results.launchpad_tokens = `✗ ${checkRes.status}: ${checkText.slice(0, 100)}`;

  // 2. Try Supabase Management API SQL execution
  if (projectRef) {
    // Try via management API (requires service role with elevated access)
    const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sKey}`,
      },
      body: JSON.stringify({ query: CREATE_SQL }),
      cache: "no-store",
    });

    if (mgmtRes.ok) {
      results.creation = "✓ Table created via Management API";
      return NextResponse.json({ success: true, results, message: "Table created successfully!" });
    }

    const mgmtText = await mgmtRes.text();
    results.mgmt_api = `✗ ${mgmtRes.status}: ${mgmtText.slice(0, 150)}`;
  }

  // 3. Table doesn't exist and we can't create it programmatically
  // Return the SQL for manual creation
  return NextResponse.json({
    success: false,
    results,
    needsManualSQL: true,
    sql: CREATE_SQL.trim(),
    instructions: [
      "1. Open your Supabase project: https://supabase.com/dashboard",
      "2. Go to SQL Editor (left sidebar)",
      "3. Click 'New Query'",
      "4. Paste the SQL below and click Run",
      "5. Come back and click 'Run Setup' again to verify",
    ],
  });
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url  = (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "").trim();
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !sKey) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  const tables = ["launchpad_tokens", "system_settings", "user_plans", "deployed_contracts"];
  const status: Record<string, string> = {};

  for (const table of tables) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { "apikey": sKey, "Authorization": `Bearer ${sKey}` },
      cache: "no-store",
    });
    status[table] = res.ok ? "✓ OK" : `✗ ${res.status}`;
  }

  return NextResponse.json({ tables: status });
}
