export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

function getDB() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("Supabase env vars missing");
  return { url, key };
}
function hdrs(k: string, e: Record<string,string> = {}) {
  return { "Content-Type":"application/json", apikey:k, Authorization:`Bearer ${k}`, ...e };
}

// ── POST: track a page visit ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json().catch(() => ({})) as Record<string,unknown>;
    const { page, wallet, event } = body as { page?:string; wallet?:string; event?:string };

    // Vercel edge geo headers
    const country = (req.headers.get("x-vercel-ip-country") ?? "").trim();
    const region  = (req.headers.get("x-vercel-ip-country-region") ?? "").trim();
    const city    = decodeURIComponent(req.headers.get("x-vercel-ip-city") ?? "").trim();
    const ip      = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ua      = req.headers.get("user-agent") ?? "";
    const referer = req.headers.get("referer") ?? "";

    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    const browser  =
      ua.includes("Edg")     ? "Edge"    :
      ua.includes("Chrome")  ? "Chrome"  :
      ua.includes("Firefox") ? "Firefox" :
      ua.includes("Safari")  ? "Safari"  : "Other";

    const { url: dbUrl, key } = getDB();

    const row = {
      page:       page || "/",
      event:      event || "pageview",
      wallet:     wallet || null,
      country:    country || null,
      region:     region  || null,
      city:       city    || null,
      ip:         ip      || null,
      browser:    browser,
      is_mobile:  isMobile,
      referer:    referer || null,
      created_at: new Date().toISOString(),
    };

    const res = await fetch(`${dbUrl}/rest/v1/analytics_events`, {
      method:  "POST",
      headers: hdrs(key, { Prefer: "return=minimal" }),
      body:    JSON.stringify(row),
      cache:   "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[analytics POST]", res.status, text.slice(0, 200));
      // Return ok:false but don't throw — tracking should never break the app
      return NextResponse.json({ ok: false, error: `DB ${res.status}`, hint: "Run SQL: CREATE TABLE analytics_events ..." });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[analytics POST]", err);
    return NextResponse.json({ ok: false, error: String(err) });
  }
}

// ── GET: fetch analytics summary ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { url: dbUrl, key } = getDB();
    const sp   = req.nextUrl.searchParams;
    const days = parseInt(sp.get("days") ?? "30");
    const from = sp.get("from"); // ISO date override
    const to   = sp.get("to");

    // Date range
    const sinceDate = from
      ? new Date(from).toISOString()
      : new Date(Date.now() - days * 86_400_000).toISOString();
    const untilDate = to
      ? new Date(to + "T23:59:59Z").toISOString()
      : new Date().toISOString();

    const base = `${dbUrl}/rest/v1/analytics_events`;
    const dateFilter = `created_at=gte.${sinceDate}&created_at=lte.${untilDate}`;

    const [evRes, geoRes, pgRes, dayRes] = await Promise.all([
      fetch(`${base}?${dateFilter}&select=id,event,is_mobile,browser,wallet&limit=5000`,           { headers: hdrs(key), cache: "no-store" }),
      fetch(`${base}?${dateFilter}&select=country,city&not.country.is.null&limit=5000`,            { headers: hdrs(key), cache: "no-store" }),
      fetch(`${base}?${dateFilter}&select=page&limit=5000`,                                        { headers: hdrs(key), cache: "no-store" }),
      fetch(`${base}?${dateFilter}&select=created_at&event=eq.pageview&limit=10000`,               { headers: hdrs(key), cache: "no-store" }),
    ]);

    const events = evRes.ok  ? await evRes.json()  as Array<Record<string,unknown>> : [];
    const geoAll = geoRes.ok ? await geoRes.json() as Array<Record<string,unknown>> : [];
    const pages  = pgRes.ok  ? await pgRes.json()  as Array<Record<string,unknown>> : [];
    const daily  = dayRes.ok ? await dayRes.json() as Array<Record<string,unknown>> : [];

    // Geo
    const geoMap: Record<string,{country:string;city:string;count:number}> = {};
    for (const e of geoAll) {
      const k = `${e.country}|${e.city}`;
      if (!geoMap[k]) geoMap[k] = { country:String(e.country??""), city:String(e.city??""), count:0 };
      geoMap[k].count++;
    }

    // Pages
    const pageMap: Record<string,number> = {};
    for (const e of pages) { const p = String(e.page??"/"); pageMap[p] = (pageMap[p]??0)+1; }

    // Daily
    const dayMap: Record<string,number> = {};
    for (const e of daily) {
      const d = String(e.created_at??"").slice(0,10);
      dayMap[d] = (dayMap[d]??0)+1;
    }

    // Unique wallets
    const wallets = new Set(events.filter(e=>e.wallet).map(e=>String(e.wallet)));

    // Browsers
    const bMap: Record<string,number> = {};
    for (const e of events) { const b = String(e.browser??"Other"); bMap[b] = (bMap[b]??0)+1; }

    const mobile  = events.filter(e=>e.is_mobile).length;
    const desktop = events.length - mobile;

    return NextResponse.json({
      totalEvents:   events.length,
      uniqueWallets: wallets.size,
      mobile, desktop,
      geo:        Object.values(geoMap).sort((a,b)=>b.count-a.count).slice(0,25),
      topPages:   Object.entries(pageMap).sort(([,a],[,b])=>b-a).slice(0,10).map(([page,count])=>({page,count})),
      dailyChart: Object.entries(dayMap).sort(([a],[b])=>a.localeCompare(b)).map(([date,count])=>({date,count})),
      browsers:   Object.entries(bMap).sort(([,a],[,b])=>b-a).map(([name,count])=>({name,count})),
      range: { from: sinceDate, to: untilDate, days },
    });
  } catch (err) {
    console.error("[analytics GET]", err);
    return NextResponse.json({ error: String(err), totalEvents:0, uniqueWallets:0, mobile:0, desktop:0, geo:[], topPages:[], dailyChart:[], browsers:[] });
  }
}
