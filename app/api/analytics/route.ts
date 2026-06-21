export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

function getDB() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("Supabase env vars missing");
  return { url, key };
}
function hdrs(key: string, extra: Record<string, string> = {}) {
  return { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

// POST — track a page visit
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const { url, page, wallet, event } = body as { url?:string; page?:string; wallet?:string; event?:string };

    // Gather geo / device info from request headers
    const ip      = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const country = req.headers.get("x-vercel-ip-country") ?? "";
    const region  = req.headers.get("x-vercel-ip-country-region") ?? "";
    const city    = req.headers.get("x-vercel-ip-city") ?? "";
    const ua      = req.headers.get("user-agent") ?? "";
    const referer = req.headers.get("referer") ?? "";

    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    const browser  = ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : ua.includes("Edge") ? "Edge" : "Other";

    const { url: dbUrl, key } = getDB();
    const row = {
      page:       page ?? url ?? "/",
      event:      event ?? "pageview",
      wallet:     wallet ?? null,
      country:    country || null,
      region:     region  || null,
      city:       city    || null,
      ip:         ip      || null,
      browser:    browser || null,
      is_mobile:  isMobile,
      referer:    referer || null,
      created_at: new Date().toISOString(),
    };

    await fetch(`${dbUrl}/rest/v1/analytics_events`, {
      method: "POST",
      headers: hdrs(key, { Prefer: "return=minimal" }),
      body: JSON.stringify(row),
      cache: "no-store",
    });

    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }); }
}

// GET — fetch analytics summary for admin
export async function GET(req: NextRequest) {
  try {
    const { url: dbUrl, key } = getDB();
    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30");
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Parallel fetches
    const [eventsRes, geoRes, pagesRes, dailyRes] = await Promise.all([
      // Total events count
      fetch(`${dbUrl}/rest/v1/analytics_events?created_at=gte.${since}&select=id,event,is_mobile,browser,wallet,country&limit=5000`, {
        headers: hdrs(key), cache: "no-store",
      }),
      // Geo breakdown
      fetch(`${dbUrl}/rest/v1/analytics_events?created_at=gte.${since}&select=country,city&not.country.is.null&limit=5000`, {
        headers: hdrs(key), cache: "no-store",
      }),
      // Top pages
      fetch(`${dbUrl}/rest/v1/analytics_events?created_at=gte.${since}&select=page&limit=5000`, {
        headers: hdrs(key), cache: "no-store",
      }),
      // Daily visits for chart
      fetch(`${dbUrl}/rest/v1/analytics_events?created_at=gte.${since}&select=created_at&event=eq.pageview&limit=10000`, {
        headers: hdrs(key), cache: "no-store",
      }),
    ]);

    const events = eventsRes.ok ? await eventsRes.json() as Array<Record<string,unknown>> : [];
    const geoAll = geoRes.ok   ? await geoRes.json()   as Array<Record<string,unknown>> : [];
    const pages  = pagesRes.ok ? await pagesRes.json()  as Array<Record<string,unknown>> : [];
    const daily  = dailyRes.ok ? await dailyRes.json()  as Array<Record<string,unknown>> : [];

    // Process geo
    const geoMap: Record<string, { country:string; city:string; count:number }> = {};
    for (const e of geoAll) {
      const key2 = `${e.country}|${e.city}`;
      if (!geoMap[key2]) geoMap[key2] = { country: String(e.country ?? ""), city: String(e.city ?? ""), count: 0 };
      geoMap[key2].count++;
    }
    const geo = Object.values(geoMap).sort((a,b) => b.count - a.count).slice(0, 25);

    // Process pages
    const pageMap: Record<string, number> = {};
    for (const e of pages) { const p = String(e.page ?? "/"); pageMap[p] = (pageMap[p] ?? 0) + 1; }
    const topPages = Object.entries(pageMap).sort(([,a],[,b]) => b-a).slice(0, 10).map(([page, count]) => ({ page, count }));

    // Process daily chart (group by day)
    const dayMap: Record<string, number> = {};
    for (const e of daily) {
      const d = String(e.created_at ?? "").slice(0, 10);
      dayMap[d] = (dayMap[d] ?? 0) + 1;
    }
    const dailyChart = Object.entries(dayMap).sort(([a],[b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

    // Unique wallets
    const wallets = new Set(events.filter(e => e.wallet).map(e => String(e.wallet)));

    // Browser breakdown
    const browserMap: Record<string, number> = {};
    for (const e of events) { const b = String(e.browser ?? "Other"); browserMap[b] = (browserMap[b] ?? 0) + 1; }

    // Mobile vs desktop
    const mobile  = events.filter(e => e.is_mobile).length;
    const desktop = events.length - mobile;

    return NextResponse.json({
      totalEvents:   events.length,
      uniqueWallets: wallets.size,
      mobile,
      desktop,
      geo,
      topPages,
      dailyChart,
      browsers: Object.entries(browserMap).sort(([,a],[,b]) => b-a).map(([name,count]) => ({ name, count })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
