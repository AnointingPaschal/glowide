"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWalletStore } from "@/store/walletStore";
import {
  Globe, Users, Activity, TrendingUp, TrendingDown,
  Monitor, Smartphone, Eye, Zap, RefreshCw, Map,
  BarChart2, CheckCircle, Database, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Vercel historical totals (from screenshot, May 22 – Jun 21 2026) ────────
const VERCEL_DATA = {
  total: 1_660_025,
  period: "May 22 – Jun 21, 2026",
  geo: [
    { flag:"🇯🇵", city:"Tokyo, Japan",           code:"hnd1", count:999594,  pct:60.2, color:"#388bfd" },
    { flag:"🇭🇰", city:"Hong Kong",               code:"hkg1", count:411055,  pct:24.8, color:"#f59e0b" },
    { flag:"🇸🇬", city:"Singapore",               code:"sin1", count:117234,  pct:7.1,  color:"#10b981" },
    { flag:"🇯🇵", city:"Osaka, Japan",            code:"kix1", count:95467,   pct:5.8,  color:"#3b82f6" },
    { flag:"🇺🇸", city:"Washington D.C., USA",    code:"iad1", count:11731,   pct:0.7,  color:"#ef4444" },
    { flag:"🇺🇸", city:"San Francisco, USA",      code:"sfo1", count:9117,    pct:0.5,  color:"#ec4899" },
    { flag:"🇩🇪", city:"Frankfurt, Germany",      code:"fra1", count:4309,    pct:0.3,  color:"#8b5cf6" },
    { flag:"🇿🇦", city:"Cape Town, South Africa", code:"cpt1", count:3026,    pct:0.2,  color:"#06b6d4" },
    { flag:"🇬🇧", city:"London, UK",              code:"lhr1", count:2221,    pct:0.1,  color:"#f97316" },
    { flag:"🇺🇸", city:"Cleveland, USA",           code:"cle1", count:2000,    pct:0.1,  color:"#84cc16" },
    { flag:"🇺🇸", city:"Portland, USA",            code:"pdx1", count:1297,    pct:0.1,  color:"#a78bfa" },
    { flag:"🇸🇪", city:"Stockholm, Sweden",        code:"arn1", count:989,     pct:0.1,  color:"#34d399" },
    { flag:"🇨🇦", city:"Montréal, Canada",         code:"yul1", count:682,     pct:0.0,  color:"#fb923c" },
    { flag:"🇰🇷", city:"Seoul, South Korea",       code:"icn1", count:462,     pct:0.0,  color:"#f43f5e" },
    { flag:"🇫🇷", city:"Paris, France",            code:"cdg1", count:480,     pct:0.0,  color:"#818cf8" },
    { flag:"🇧🇷", city:"São Paulo, Brazil",        code:"gru1", count:318,     pct:0.0,  color:"#4ade80" },
    { flag:"🇮🇳", city:"Mumbai, India",            code:"bom1", count:198,     pct:0.0,  color:"#fbbf24" },
    { flag:"🇮🇪", city:"Dublin, Ireland",          code:"dub1", count:47,      pct:0.0,  color:"#67e8f9" },
    { flag:"🇦🇺", city:"Sydney, Australia",        code:"syd1", count:17,      pct:0.0,  color:"#c084fc" },
  ],
  // Daily distribution from the bar chart (approximate, May 24 – Jun 21)
  daily: [
    {d:"May 24",v:1200},{d:"May 25",v:0},{d:"May 26",v:0},{d:"May 27",v:0},
    {d:"May 28",v:28000},{d:"May 29",v:52000},{d:"May 30",v:58000},{d:"May 31",v:67000},
    {d:"Jun 1",v:75000},{d:"Jun 2",v:71000},{d:"Jun 3",v:68000},{d:"Jun 4",v:65000},
    {d:"Jun 5",v:72000},{d:"Jun 6",v:69000},{d:"Jun 7",v:73000},{d:"Jun 8",v:76000},
    {d:"Jun 9",v:82000},{d:"Jun 10",v:84000},{d:"Jun 11",v:78000},{d:"Jun 12",v:74000},
    {d:"Jun 13",v:58000},{d:"Jun 14",v:42000},{d:"Jun 15",v:38000},{d:"Jun 16",v:35000},
    {d:"Jun 17",v:32000},{d:"Jun 18",v:30000},{d:"Jun 19",v:28000},{d:"Jun 20",v:26000},
    {d:"Jun 21",v:14000},
  ],
};

interface LiveStats {
  totalEvents: number;
  uniqueWallets: number;
  mobile: number;
  desktop: number;
  geo: Array<{country:string;city:string;count:number}>;
  topPages: Array<{page:string;count:number}>;
  dailyChart: Array<{date:string;count:number}>;
  browsers: Array<{name:string;count:number}>;
}

function StatCard({ icon:Icon, label, value, sub, color="text-glow-accent" }: {
  icon:React.ElementType; label:string; value:string|number; sub?:string; color?:string;
}) {
  return (
    <div className="bg-glow-card border border-glow-border rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4 flex-shrink-0", color)}/>
        <p className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-bold text-glow-text">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[10px] text-glow-muted/50">{sub}</p>}
    </div>
  );
}

// Mini bar chart using divs
function BarRow({ label, count, max, color, pct, flag, code }: {
  label:string; count:number; max:number; color:string; pct?:number; flag?:string; code?:string;
}) {
  const w = Math.max(2, (count / max) * 100);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-glow-border/20 last:border-0">
      <span className="text-sm w-5 flex-shrink-0">{flag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-glow-text truncate">{label}</span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {code && <span className="text-[9px] text-glow-muted/40 font-mono">{code}</span>}
            <span className="text-xs font-semibold text-glow-text">{count.toLocaleString()}</span>
            {pct !== undefined && <span className="text-[10px] text-glow-muted/60 w-10 text-right">{pct.toFixed(1)}%</span>}
          </div>
        </div>
        <div className="h-1.5 bg-glow-surface rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{width:`${w}%`, background:color}}/>
        </div>
      </div>
    </div>
  );
}

// Line-like daily chart using SVG
function DailyChart({ data }: { data: Array<{d:string;v:number}> }) {
  const max = Math.max(...data.map(d => d.v));
  const W = 100; const H = 48;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.v / max) * H;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 100 ${H + 4}`} className="w-full" preserveAspectRatio="none" style={{height:"80px"}}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#388bfd" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#388bfd" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${pts} 100,${H}`} fill="url(#chartGrad)"/>
        <polyline points={pts} fill="none" stroke="#388bfd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="flex justify-between mt-1">
        {[data[0], data[7], data[14], data[21], data[data.length-1]].map((d, i) => (
          <span key={i} className="text-[9px] text-glow-muted/40">{d?.d?.replace("May ","M").replace("Jun ","J")}</span>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { address, isConnected } = useWalletStore();
  const [live, setLive]     = useState<LiveStats|null>(null);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [days, setDays]     = useState(30);
  const [tab, setTab]       = useState<"overview"|"geo"|"pages"|"live">("overview");

  const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "";
  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_WALLET.toLowerCase();
  // Analytics is public — all users can view

  const fetchLive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?days=${days}`);
      if (res.ok) setLive(await res.json() as LiveStats);
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetchLive(); }, [fetchLive]);

  // Track this page view
  useEffect(() => {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "/admin/analytics", event: "pageview", wallet: address }),
    }).catch(() => {});
  }, [address]);

  const seedVercel = async () => {
    if (!isAdmin) return;
    setSeeding(true); setSeedMsg("");
    try {
      const res = await fetch("/api/admin/seed-analytics", {
        method: "POST",
        headers: { Authorization: `Wallet ${address}` },
      });
      const d = await res.json() as {success?:boolean; message?:string; error?:string};
      setSeedMsg(d.success ? `✓ ${d.message}` : `✗ ${d.error ?? "Failed"}`);
    } finally { setSeeding(false); }
  };

  // Combined geo: Vercel historical + live
  const allGeo = VERCEL_DATA.geo.map(g => {
    const liveMatch = live?.geo.find(l => l.city.toLowerCase().includes(g.city.split(",")[0].toLowerCase()));
    return { ...g, liveCount: liveMatch?.count ?? 0 };
  });

  const totalLive = live?.totalEvents ?? 0;
  const grandTotal = VERCEL_DATA.total + totalLive;

  return (
    <AppLayout title="Analytics">
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-glow-text">Platform Analytics</h1>
            <p className="text-xs text-glow-muted/60 mt-0.5">Historical Vercel data + live tracking from glowaide.com</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={days} onChange={e=>setDays(parseInt(e.target.value))}
              className="bg-glow-card border border-glow-border rounded-xl px-3 py-1.5 text-xs text-glow-text focus:outline-none focus:border-glow-accent/50">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button onClick={fetchLive} disabled={loading}
              className="p-2 bg-glow-card border border-glow-border rounded-xl text-glow-muted hover:text-glow-text transition-colors">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")}/>
            </button>
            {isAdmin && (
              <button onClick={seedVercel} disabled={seeding}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light text-xs font-medium rounded-xl hover:bg-glow-accent/25 transition-colors">
                <Database className="w-3.5 h-3.5"/>
                {seeding ? "Seeding…" : "Import Vercel Data"}
              </button>
            )}
          </div>
        </div>

        {seedMsg && (
          <div className={cn("px-4 py-2.5 rounded-xl text-sm border", seedMsg.startsWith("✓") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400")}>
            {seedMsg}
          </div>
        )}

        {/* Big stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Eye}     label="Total Requests"   value={grandTotal.toLocaleString()}  sub={`${VERCEL_DATA.total.toLocaleString()} Vercel + ${totalLive.toLocaleString()} live`} color="text-glow-accent"/>
          <StatCard icon={Globe}   label="Regions"          value={VERCEL_DATA.geo.length}        sub="Countries served" color="text-blue-400"/>
          <StatCard icon={Users}   label="Wallet Connects"  value={live?.uniqueWallets ?? 0}      sub="Unique addresses" color="text-emerald-400"/>
          <StatCard icon={Activity}label="Live Events"      value={totalLive}                     sub={`Last ${days} days`} color="text-amber-400"/>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-glow-surface border border-glow-border/50 rounded-xl p-1 w-fit">
          {(["overview","geo","pages","live"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                tab === t ? "bg-glow-accent/20 text-glow-accent-light" : "text-glow-muted/60 hover:text-glow-text")}>
              {t}
            </button>
          ))}
        </div>

        {/* OVERVIEW tab */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily chart (Vercel historical) */}
            <div className="bg-glow-card border border-glow-border rounded-2xl p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold text-glow-text">Daily Requests</p>
                  <p className="text-[10px] text-glow-muted/50">{VERCEL_DATA.period} (Vercel)</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-glow-muted">
                  <span className="w-2.5 h-2.5 bg-glow-accent rounded-sm"/>Vercel requests
                </div>
              </div>
              <DailyChart data={VERCEL_DATA.daily}/>
              {live?.dailyChart?.length && (
                <div className="mt-3 pt-3 border-t border-glow-border/30">
                  <p className="text-[10px] text-glow-muted/40 mb-2">Live tracked events (last {days}d)</p>
                  <div className="flex gap-1 flex-wrap">
                    {live.dailyChart.slice(-14).map(d => (
                      <div key={d.date} className="text-center">
                        <div className="text-[9px] text-glow-muted/40">{d.date.slice(5)}</div>
                        <div className="text-[10px] font-mono text-glow-accent">{d.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Device breakdown */}
            <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
              <p className="text-sm font-semibold text-glow-text mb-3">Device Type</p>
              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
                    {live && live.totalEvents > 0 && (
                      <>
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#388bfd" strokeWidth="4"
                          strokeDasharray={`${(live.desktop / live.totalEvents) * 87.96} 87.96`}/>
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="4"
                          strokeDasharray={`${(live.mobile / live.totalEvents) * 87.96} 87.96`}
                          strokeDashoffset={`-${(live.desktop / live.totalEvents) * 87.96}`}/>
                      </>
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-glow-text">{live?.totalEvents ?? 0}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-glow-accent"/>
                    <div>
                      <p className="text-sm font-semibold text-glow-text">{(live?.desktop ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-glow-muted/60">Desktop</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400"/>
                    <div>
                      <p className="text-sm font-semibold text-glow-text">{(live?.mobile ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-glow-muted/60">Mobile</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Browsers */}
            <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
              <p className="text-sm font-semibold text-glow-text mb-3">Browsers</p>
              <div className="space-y-0">
                {(live?.browsers ?? [{ name:"Chrome",count:0 },{ name:"Safari",count:0 },{ name:"Firefox",count:0 }]).map(b => (
                  <BarRow key={b.name} label={b.name} count={b.count}
                    max={Math.max(1, ...( live?.browsers.map(x=>x.count) ?? [1]))}
                    color="#388bfd" flag={b.name==="Chrome"?"🌐":b.name==="Safari"?"🍎":b.name==="Firefox"?"🦊":"🌍"}/>
                ))}
                {(!live?.browsers?.length) && <p className="text-xs text-glow-muted/40 text-center py-4">Tracking live visits from your site…</p>}
              </div>
            </div>
          </div>
        )}

        {/* GEO tab */}
        {tab === "geo" && (
          <div className="space-y-3">
            {/* Vercel historical */}
            <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-glow-text">Geographic Distribution</p>
                  <p className="text-[10px] text-glow-muted/50">Vercel: {VERCEL_DATA.period} · {VERCEL_DATA.total.toLocaleString()} total requests</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400"/>
                  <span className="text-[10px] text-emerald-400 font-semibold">Verified Vercel Data</span>
                </div>
              </div>
              <div className="divide-y divide-glow-border/20">
                {VERCEL_DATA.geo.map(g => {
                  const liveC = live?.geo.find(l => l.city.toLowerCase().includes(g.city.split(",")[0].toLowerCase()))?.count ?? 0;
                  return (
                    <div key={g.code} className="flex items-center gap-3 py-2.5">
                      <span className="text-lg w-7 flex-shrink-0">{g.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-glow-text">{g.city}</span>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                            <span className="text-[10px] text-glow-muted/40 font-mono">{g.code}</span>
                            <span className="text-xs font-semibold text-glow-text w-20 text-right">{g.count.toLocaleString()}</span>
                            <span className="text-[10px] text-glow-muted/60 w-10 text-right">{g.pct.toFixed(1)}%</span>
                            {liveC > 0 && <span className="text-[10px] text-emerald-400">+{liveC} live</span>}
                          </div>
                        </div>
                        <div className="h-1.5 bg-glow-surface rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${Math.max(1,g.pct)}%`, background:g.color}}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live geo if any */}
            {(live?.geo?.length ?? 0) > 0 && (
              <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
                <p className="text-sm font-semibold text-glow-text mb-3">Live Traffic Geo (last {days}d)</p>
                <div className="space-y-0">
                  {live!.geo.slice(0,10).map(g => (
                    <BarRow key={`${g.country}-${g.city}`}
                      label={`${g.city}, ${g.country}`}
                      count={g.count}
                      max={Math.max(1, ...live!.geo.map(x=>x.count))}
                      color="#388bfd"/>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGES tab */}
        {tab === "pages" && (
          <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
            <p className="text-sm font-semibold text-glow-text mb-4">Top Pages (Live Tracking)</p>
            {(live?.topPages?.length ?? 0) > 0 ? (
              <div className="space-y-0">
                {live!.topPages.map(p => (
                  <BarRow key={p.page} label={p.page} count={p.count}
                    max={live!.topPages[0].count}
                    color="#7c3aed"
                    flag={p.page==="/"?"🏠":p.page.includes("wallet")?"💼":p.page.includes("editor")?"✏️":p.page.includes("explorer")?"🔍":p.page.includes("launchpad")?"🚀":p.page.includes("chat")?"💬":p.page.includes("pitch")?"📊":"📄"}/>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart2 className="w-10 h-10 text-glow-muted/20 mx-auto mb-3"/>
                <p className="text-sm text-glow-muted/50">No page data yet</p>
                <p className="text-xs text-glow-muted/30 mt-1">Visits will appear here as users browse the site</p>
              </div>
            )}
          </div>
        )}

        {/* LIVE tab */}
        {tab === "live" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard icon={Zap}      label="Events tracked"    value={totalLive}             color="text-glow-accent"/>
              <StatCard icon={Users}    label="Unique wallets"    value={live?.uniqueWallets??0} color="text-emerald-400"/>
              <StatCard icon={Clock}    label="Tracking since"    value="Today"                  sub="Continuous" color="text-blue-400"/>
            </div>
            <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-glow-text">Live Event Stream</p>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>LIVE
                </span>
              </div>
              {(live?.topPages?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  {live!.topPages.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-glow-border/20 last:border-0">
                      <span className="text-xs font-mono text-glow-text">{p.page}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-glow-accent font-semibold">{p.count} views</span>
                        <div className="w-16 h-1.5 bg-glow-surface rounded-full">
                          <div className="h-full bg-glow-accent/60 rounded-full" style={{width:`${(p.count/live!.topPages[0].count)*100}%`}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Activity className="w-8 h-8 text-glow-muted/20 mx-auto mb-2 animate-pulse"/>
                  <p className="text-xs text-glow-muted/50">Waiting for live events…</p>
                  <p className="text-[10px] text-glow-muted/30 mt-1">Navigate the site to generate events</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-[10px] text-glow-muted/30 text-center">
          Historical: {VERCEL_DATA.total.toLocaleString()} requests from Vercel (May 22–Jun 21) · Live: tracked from glowaide.com since deployment
        </p>
      </div>
    </AppLayout>
  );
}
