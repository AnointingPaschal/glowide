export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();
function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Wallet ") && (!ADMIN_WALLET || auth.slice(7).toLowerCase() === ADMIN_WALLET);
}
function getDB() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("Supabase env vars missing");
  return { url, key };
}
function hdrs(k: string, e: Record<string,string> = {}) {
  return { "Content-Type":"application/json", apikey:k, Authorization:`Bearer ${k}`, ...e };
}
function pick<T>(arr: T[], weights: number[]): T {
  let r = Math.random(), i = 0;
  for (; i < weights.length - 1; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ── Distribution tables (matching Vercel geo breakdown) ───────────────────────
const GEO = [
  { city:"Tokyo",          country:"JP", flag:"🇯🇵", weight:0.602 },
  { city:"Hong Kong",      country:"HK", flag:"🇭🇰", weight:0.248 },
  { city:"Singapore",      country:"SG", flag:"🇸🇬", weight:0.071 },
  { city:"Osaka",          country:"JP", flag:"🇯🇵", weight:0.058 },
  { city:"Washington",     country:"US", flag:"🇺🇸", weight:0.007 },
  { city:"San Francisco",  country:"US", flag:"🇺🇸", weight:0.005 },
  { city:"Frankfurt",      country:"DE", flag:"🇩🇪", weight:0.003 },
  { city:"Cape Town",      country:"ZA", flag:"🇿🇦", weight:0.002 },
  { city:"London",         country:"GB", flag:"🇬🇧", weight:0.001 },
  { city:"Cleveland",      country:"US", flag:"🇺🇸", weight:0.001 },
  { city:"Portland",       country:"US", flag:"🇺🇸", weight:0.001 },
  { city:"Seoul",          country:"KR", flag:"🇰🇷", weight:0.0003 },
  { city:"Paris",          country:"FR", flag:"🇫🇷", weight:0.0003 },
];
const GEO_WEIGHTS = GEO.map(g => g.weight);

const PAGES = [
  { page:"/editor",     weight:0.35 },
  { page:"/wallet",     weight:0.25 },
  { page:"/",           weight:0.15 },
  { page:"/chat",       weight:0.12 },
  { page:"/explorer",   weight:0.08 },
  { page:"/launchpad",  weight:0.03 },
  { page:"/pitch",      weight:0.01 },
  { page:"/analytics",  weight:0.006 },
  { page:"/settings",   weight:0.002 },
  { page:"/deployments",weight:0.002 },
];
const PAGE_WEIGHTS = PAGES.map(p => p.weight);

const BROWSERS = [
  { name:"Chrome",  weight:0.68 },
  { name:"Firefox", weight:0.18 },
  { name:"Safari",  weight:0.09 },
  { name:"Edge",    weight:0.04 },
  { name:"Other",   weight:0.01 },
];
const BROWSER_WEIGHTS = BROWSERS.map(b => b.weight);

// Daily row counts matching the trailing Vercel traffic (scaled to page views)
// Vercel counts include API calls, assets etc. — page views ~2% of requests
const DAILY_COUNTS: Record<string, number> = {
  "-7": 760,  // Jun 14 ~38k requests
  "-6": 700,  // Jun 15 ~35k
  "-5": 640,  // Jun 16 ~32k
  "-4": 600,  // Jun 17 ~30k
  "-3": 560,  // Jun 18 ~28k
  "-2": 520,  // Jun 19 ~26k
  "-1": 280,  // Jun 20 (yesterday) ~14k (half day)
};

function generateRows(dayOffset: number, count: number, baseDate: Date) {
  const rows = [];
  const day = new Date(baseDate);
  day.setDate(day.getDate() + dayOffset);
  const dayStr = day.toISOString().slice(0, 10);

  for (let i = 0; i < count; i++) {
    const geo     = pick(GEO, GEO_WEIGHTS);
    const pg      = pick(PAGES, PAGE_WEIGHTS);
    const br      = pick(BROWSERS, BROWSER_WEIGHTS);
    const mobile  = Math.random() < 0.22;
    // Random hour weighted to Asia timezone (UTC+8/+9) peaks
    const hour    = pick([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
                         [2,2,3,4,5,5,5,6,7,8,8,7,6,5,4,3,3,3,4,5,5,4,3,2].map(v=>v/100));
    const min     = rnd(0, 59);
    const sec     = rnd(0, 59);
    const ts      = `${dayStr}T${String(hour).padStart(2,"0")}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}Z`;

    rows.push({
      page:       pg.page,
      event:      "pageview",
      wallet:     null,
      country:    geo.country,
      city:       geo.city,
      region:     null,
      ip:         null,
      browser:    br.name,
      is_mobile:  mobile,
      referer:    null,
      created_at: ts,
    });
  }
  return rows;
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { url, key } = getDB();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const offsets = Object.entries(DAILY_COUNTS);
    let totalInserted = 0;
    const results: string[] = [];

    for (const [offsetStr, count] of offsets) {
      const offset = parseInt(offsetStr);
      const rows   = generateRows(offset, count, today);

      // Batch insert in chunks of 200 (Supabase REST limit)
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const res   = await fetch(`${url}/rest/v1/analytics_events`, {
          method:  "POST",
          headers: hdrs(key, { Prefer: "return=minimal" }),
          body:    JSON.stringify(chunk),
          cache:   "no-store",
        });
        if (!res.ok) {
          const txt = await res.text();
          return NextResponse.json({ error: `Insert failed day ${offset}: ${txt.slice(0,200)}` }, { status: 500 });
        }
        totalInserted += chunk.length;
      }

      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      results.push(`${d.toISOString().slice(0,10)}: ${count} rows`);
    }

    return NextResponse.json({
      success: true,
      totalInserted,
      breakdown: results,
      message: `Seeded ${totalInserted} page view events across ${offsets.length} days`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const total = Object.values(DAILY_COUNTS).reduce((a,b)=>a+b,0);
  return NextResponse.json({
    willInsert: total,
    days: Object.keys(DAILY_COUNTS).length,
    breakdown: DAILY_COUNTS,
    note: "POST to /api/admin/seed-events to insert data",
  });
}
