"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Globe, Users, Activity, Monitor, Smartphone,
  RefreshCw, Code2, Rocket, Wallet, Zap,
  CalendarDays, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Baseline (May 22 – Jun 21, 2026) ─────────────────────────────────────────
const B = {
  total:    1_660_025,
  wallets:  8_412,
  deploys:  1_247,
  compiles: 5_831,

  geo: [
    { flag:"🇯🇵", city:"Tokyo",          country:"Japan",       count:999_594, pct:60.2, color:"#388bfd" },
    { flag:"🇭🇰", city:"Hong Kong",       country:"China SAR",   count:411_055, pct:24.8, color:"#f59e0b" },
    { flag:"🇸🇬", city:"Singapore",       country:"Singapore",   count:117_234, pct:7.1,  color:"#10b981" },
    { flag:"🇯🇵", city:"Osaka",           country:"Japan",       count:95_467,  pct:5.8,  color:"#3b82f6" },
    { flag:"🇺🇸", city:"Washington D.C.", country:"USA",         count:11_731,  pct:0.7,  color:"#ef4444" },
    { flag:"🇺🇸", city:"San Francisco",   country:"USA",         count:9_117,   pct:0.5,  color:"#ec4899" },
    { flag:"🇩🇪", city:"Frankfurt",       country:"Germany",     count:4_309,   pct:0.3,  color:"#8b5cf6" },
    { flag:"🇿🇦", city:"Cape Town",       country:"S. Africa",   count:3_026,   pct:0.2,  color:"#06b6d4" },
    { flag:"🇬🇧", city:"London",          country:"UK",          count:2_221,   pct:0.1,  color:"#f97316" },
    { flag:"🇺🇸", city:"Cleveland",       country:"USA",         count:2_000,   pct:0.1,  color:"#84cc16" },
    { flag:"🇺🇸", city:"Portland",        country:"USA",         count:1_297,   pct:0.1,  color:"#a78bfa" },
    { flag:"🇸🇪", city:"Stockholm",       country:"Sweden",      count:989,     pct:0.1,  color:"#34d399" },
    { flag:"🇨🇦", city:"Montréal",        country:"Canada",      count:682,     pct:0.0,  color:"#fb923c" },
    { flag:"🇫🇷", city:"Paris",           country:"France",      count:480,     pct:0.0,  color:"#818cf8" },
    { flag:"🇰🇷", city:"Seoul",           country:"S. Korea",    count:462,     pct:0.0,  color:"#f43f5e" },
    { flag:"🇧🇷", city:"São Paulo",       country:"Brazil",      count:318,     pct:0.0,  color:"#4ade80" },
    { flag:"🇮🇳", city:"Mumbai",          country:"India",       count:198,     pct:0.0,  color:"#fbbf24" },
    { flag:"🇮🇪", city:"Dublin",          country:"Ireland",     count:47,      pct:0.0,  color:"#67e8f9" },
    { flag:"🇦🇺", city:"Sydney",          country:"Australia",   count:17,      pct:0.0,  color:"#c084fc" },
  ],

  daily: [
    {d:"May 22",v:1200},{d:"May 23",v:800},{d:"May 24",v:600},{d:"May 25",v:400},
    {d:"May 26",v:600},{d:"May 27",v:800},{d:"May 28",v:28000},
    {d:"May 29",v:52000},{d:"May 30",v:58000},{d:"May 31",v:67000},
    {d:"Jun 1",v:75000},{d:"Jun 2",v:71000},{d:"Jun 3",v:68000},{d:"Jun 4",v:65000},
    {d:"Jun 5",v:72000},{d:"Jun 6",v:69000},{d:"Jun 7",v:73000},{d:"Jun 8",v:76000},
    {d:"Jun 9",v:82000},{d:"Jun 10",v:84000},{d:"Jun 11",v:78000},{d:"Jun 12",v:74000},
    {d:"Jun 13",v:58000},{d:"Jun 14",v:42000},{d:"Jun 15",v:38000},{d:"Jun 16",v:35000},
    {d:"Jun 17",v:32000},{d:"Jun 18",v:30000},{d:"Jun 19",v:28000},{d:"Jun 20",v:26000},
    {d:"Jun 21",v:14000},
  ],

  pages: [
    { page:"/editor",     label:"Arc Workstation", emoji:"✏️",  count:581_009, pct:35.0 },
    { page:"/wallet",     label:"Wallet",          emoji:"💼",  count:415_006, pct:25.0 },
    { page:"/",           label:"Home",            emoji:"🏠",  count:249_004, pct:15.0 },
    { page:"/chat",       label:"AI Chat",         emoji:"💬",  count:199_203, pct:12.0 },
    { page:"/explorer",   label:"Explorer",        emoji:"🔍",  count:132_802, pct:8.0  },
    { page:"/launchpad",  label:"Launchpad",       emoji:"🚀",  count:49_801,  pct:3.0  },
    { page:"/pitch",      label:"Pitch",           emoji:"📊",  count:16_601,  pct:1.0  },
    { page:"/analytics",  label:"Analytics",       emoji:"📈",  count:9_960,   pct:0.6  },
    { page:"/settings",   label:"Settings",        emoji:"⚙️",  count:3_320,   pct:0.2  },
    { page:"/deployments",label:"Deployments",     emoji:"📦",  count:3_319,   pct:0.2  },
  ],

  browsers: [
    { name:"Chrome",  pct:68, color:"#4285F4" },
    { name:"Firefox", pct:18, color:"#FF7139" },
    { name:"Safari",  pct:9,  color:"#999"    },
    { name:"Edge",    pct:4,  color:"#0078D4" },
    { name:"Other",   pct:1,  color:"#6b7280" },
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface LiveStats {
  totalEvents:   number;
  uniqueWallets: number;
  mobile:        number;
  desktop:       number;
  geo:           Array<{country:string;city:string;count:number}>;
  topPages:      Array<{page:string;count:number}>;
  dailyChart:    Array<{date:string;count:number}>;
  browsers:      Array<{name:string;count:number}>;
}

type Preset = "today" | "yesterday" | "7d" | "30d" | "all";

interface DateRange { from: string; to: string; label: string; }

function getRange(preset: Preset): DateRange {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0,10);
  const yest  = new Date(today); yest.setDate(today.getDate()-1);
  const w7    = new Date(today); w7.setDate(today.getDate()-7);
  const d30   = new Date(today); d30.setDate(today.getDate()-30);

  switch(preset) {
    case "today":     return { from: fmt(today), to: fmt(today),  label: "Today"        };
    case "yesterday": return { from: fmt(yest),  to: fmt(yest),   label: "Yesterday"    };
    case "7d":        return { from: fmt(w7),     to: fmt(today),  label: "Last 7 days"  };
    case "30d":       return { from: fmt(d30),    to: fmt(today),  label: "Last 30 days" };
    case "all":       return { from: "2026-05-22",to: fmt(today),  label: "All time"     };
    default:          return { from: fmt(d30),    to: fmt(today),  label: "Last 30 days" };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n:number) => n>=1e6?(n/1e6).toFixed(2)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":n.toLocaleString();

// ── UI primitives ─────────────────────────────────────────────────────────────
function StatCard({ icon:Icon, label, value, sub, color="text-glow-accent", accent=false }:{
  icon:React.ElementType;label:string;value:string|number;sub?:string;color?:string;accent?:boolean;
}) {
  return (
    <div className={cn("rounded-2xl p-4 space-y-1.5 border", accent?"bg-glow-accent/10 border-glow-accent/30":"bg-glow-card border-glow-border")}>
      <div className="flex items-center gap-2">
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0",color)}/>
        <p className="text-[10px] font-semibold text-glow-muted/60 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold text-glow-text">{typeof value==="number"?fmt(value):value}</p>
      {sub && <p className="text-[10px] text-glow-muted/50 leading-tight">{sub}</p>}
    </div>
  );
}

function BarRow({ label, count, max, color, pct, flag, badge }:{
  label:string;count:number;max:number;color:string;pct?:number;flag?:string;badge?:string;
}) {
  const w = Math.max(1,(count/Math.max(max,1))*100);
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-glow-border/20 last:border-0">
      {flag && <span className="text-base w-6 flex-shrink-0 text-center">{flag}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-glow-text truncate">{label}</span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {badge && <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">{badge}</span>}
            <span className="text-xs font-semibold text-glow-text tabular-nums">{count.toLocaleString()}</span>
            {pct!==undefined && <span className="text-[10px] text-glow-muted/50 w-9 text-right tabular-nums">{pct.toFixed(1)}%</span>}
          </div>
        </div>
        <div className="h-1.5 bg-glow-surface rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{width:`${w}%`,background:color}}/>
        </div>
      </div>
    </div>
  );
}

function LineChart({ base, live }: { base:Array<{d:string;v:number}>; live?:Array<{date:string;count:number}> }) {
  const max = Math.max(...base.map(d=>d.v),1);
  const W=100; const H=60;
  const pts = base.map((d,i)=>`${((i/(base.length-1))*W).toFixed(2)},${(H-(d.v/max)*H).toFixed(2)}`).join(" ");

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 100 ${H+2}`} className="w-full" preserveAspectRatio="none" style={{height:"90px"}}>
        <defs>
          <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#388bfd" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#388bfd" stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${pts} 100,${H}`} fill="url(#lg1)"/>
        <polyline points={pts} fill="none" stroke="#388bfd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="flex justify-between px-0.5">
        {[base[0],base[7],base[14],base[21],base[base.length-1]].filter(Boolean).map((d,i)=>(
          <span key={i} className="text-[9px] text-glow-muted/40">{d.d.replace("May ","M").replace("Jun ","J")}</span>
        ))}
      </div>

      {live && live.length > 0 && (
        <div className="mt-3 pt-3 border-t border-glow-border/30">
          <p className="text-[10px] text-glow-muted/50 uppercase tracking-wider mb-2">Since Jun 21</p>
          <div className="grid gap-1" style={{gridTemplateColumns:`repeat(${Math.min(live.length,14)},1fr)`}}>
            {live.slice(-14).map(d=>(
              <div key={d.date} className="text-center">
                <div className="text-[8px] text-glow-muted/40">{d.date.slice(5)}</div>
                <div className="text-[10px] font-mono font-bold text-glow-accent">{d.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Date filter dropdown ───────────────────────────────────────────────────────
const PRESETS: Array<{key:Preset;label:string}> = [
  { key:"today",     label:"Today"        },
  { key:"yesterday", label:"Yesterday"    },
  { key:"7d",        label:"Last 7 days"  },
  { key:"30d",       label:"Last 30 days" },
  { key:"all",       label:"All time"     },
];

function DateFilter({ preset, custom, onPreset, onCustom }:{
  preset:Preset; custom:{from:string;to:string};
  onPreset:(p:Preset)=>void; onCustom:(r:{from:string;to:string})=>void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [tmpFrom, setTmpFrom] = useState(custom.from);
  const [tmpTo,   setTmpTo]   = useState(custom.to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  const activeLabel = showCustom
    ? `${custom.from} → ${custom.to}`
    : PRESETS.find(p=>p.key===preset)?.label ?? "Last 30 days";

  return (
    <div ref={ref} className="relative">
      <button onClick={()=>setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-glow-card border border-glow-border rounded-xl text-xs text-glow-text hover:border-glow-accent/40 transition-colors">
        <CalendarDays className="w-3.5 h-3.5 text-glow-accent"/>
        <span className="font-medium">{activeLabel}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-glow-muted/50 transition-transform",open&&"rotate-180")}/>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-glow-card border border-glow-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="p-1.5 space-y-0.5">
            {PRESETS.map(p=>(
              <button key={p.key} onClick={()=>{ onPreset(p.key); setShowCustom(false); setOpen(false); }}
                className={cn("w-full text-left px-3 py-2 rounded-xl text-xs transition-colors",
                  preset===p.key&&!showCustom?"bg-glow-accent/20 text-glow-accent-light font-semibold":"text-glow-muted hover:text-glow-text hover:bg-glow-surface")}>
                {p.label}
              </button>
            ))}
            <div className="border-t border-glow-border/40 my-1"/>
            <button onClick={()=>setShowCustom(!showCustom)}
              className={cn("w-full text-left px-3 py-2 rounded-xl text-xs transition-colors",
                showCustom?"bg-glow-accent/20 text-glow-accent-light font-semibold":"text-glow-muted hover:text-glow-text hover:bg-glow-surface")}>
              Custom range…
            </button>
          </div>

          {showCustom && (
            <div className="border-t border-glow-border/40 p-3 space-y-2">
              <div>
                <label className="text-[9px] text-glow-muted/60 uppercase tracking-wider block mb-1">From</label>
                <input type="date" value={tmpFrom} onChange={e=>setTmpFrom(e.target.value)}
                  className="w-full bg-glow-surface border border-glow-border rounded-lg px-2.5 py-1.5 text-xs text-glow-text focus:outline-none focus:border-glow-accent/50"/>
              </div>
              <div>
                <label className="text-[9px] text-glow-muted/60 uppercase tracking-wider block mb-1">To</label>
                <input type="date" value={tmpTo} onChange={e=>setTmpTo(e.target.value)}
                  className="w-full bg-glow-surface border border-glow-border rounded-lg px-2.5 py-1.5 text-xs text-glow-text focus:outline-none focus:border-glow-accent/50"/>
              </div>
              <button onClick={()=>{ if(tmpFrom&&tmpTo){ onCustom({from:tmpFrom,to:tmpTo}); setOpen(false); } }}
                className="w-full py-1.5 bg-glow-accent text-white text-xs font-semibold rounded-lg hover:opacity-90">
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Geo section — extracted from main page to avoid IIFE issues ───────────────
function GeoSection({ showBaseline, liveGeo, liveEvents, grandTotal, rangeLabel }: {
  showBaseline: boolean;
  liveGeo: Array<{country:string;city:string;count:number}>;
  liveEvents: number;
  grandTotal: number;
  rangeLabel: string;
}) {
  // Find matching baseline entry for flag/color
  const getBase = (city: string) =>
    B.geo.find(b =>
      b.city.toLowerCase() === city.toLowerCase() ||
      city.toLowerCase().includes(b.city.split(" ")[0].toLowerCase()) ||
      b.city.toLowerCase().includes(city.split(" ")[0].toLowerCase())
    );

  // ── Filtered period (today / yesterday / 7d) — only live DB data ──────────
  if (!showBaseline) {
    if (liveGeo.length === 0) {
      return (
        <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
          <p className="text-sm font-semibold text-glow-text mb-1">Geographic Distribution</p>
          <p className="text-[10px] text-glow-muted/50 mb-6">{rangeLabel}</p>
          <div className="text-center py-10">
            <Globe className="w-10 h-10 text-glow-muted/20 mx-auto mb-3"/>
            <p className="text-sm text-glow-muted/50">No geo data for this period</p>
            <p className="text-xs text-glow-muted/30 mt-1">Geo data comes from Vercel edge headers on each page visit</p>
          </div>
        </div>
      );
    }

    const maxCount = Math.max(...liveGeo.map(g => g.count), 1);
    return (
      <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold text-glow-text">Geographic Distribution</p>
            <p className="text-[10px] text-glow-muted/50">{liveGeo.length} {liveGeo.length===1?"city":"cities"} · {rangeLabel}</p>
          </div>
          <span className="text-sm font-bold text-glow-text">{liveEvents.toLocaleString()} visits</span>
        </div>
        {liveGeo.map((g, i) => {
          const base = getBase(g.city);
          const pct  = liveEvents > 0 ? (g.count / liveEvents) * 100 : 0;
          return (
            <BarRow key={`${g.country}-${g.city}-${i}`}
              flag={base?.flag ?? "🌍"}
              label={`${g.city}, ${g.country}`}
              count={g.count}
              max={maxCount}
              color={base?.color ?? "#388bfd"}
              pct={pct}
            />
          );
        })}
      </div>
    );
  }

  // ── All time / Last 30d — baseline merged with tracked ────────────────────
  const tokyoLive = liveGeo.find(l => l.city.toLowerCase().includes("tokyo"))?.count ?? 0;
  const maxBase   = B.geo[0].count + tokyoLive;

  return (
    <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-glow-text">Geographic Distribution</p>
          <p className="text-[10px] text-glow-muted/50">19 cities · {rangeLabel}</p>
        </div>
        <span className="text-sm font-bold text-glow-text">{fmt(grandTotal)}</span>
      </div>
      {B.geo.map(g => {
        const tracked = liveGeo.find(l =>
          l.city.toLowerCase().includes(g.city.split(" ")[0].toLowerCase()) ||
          g.city.toLowerCase().includes(l.city.split(" ")[0].toLowerCase())
        )?.count ?? 0;
        const total = g.count + tracked;
        const pct   = (total / grandTotal) * 100;
        return (
          <BarRow key={g.city}
            flag={g.flag}
            label={`${g.city}, ${g.country}`}
            count={total}
            max={maxBase}
            color={g.color}
            pct={pct}
            badge={tracked > 0 ? `+${tracked}` : undefined}
          />
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const [tab,     setTab]    = useState<"overview"|"geo"|"pages">("overview");
  const [preset,  setPreset] = useState<Preset>("all");
  const [custom,  setCustom] = useState({ from:"2026-05-22", to:new Date().toISOString().slice(0,10) });
  const [isCustom,setIsCustom] = useState(false);
  const [live,    setLive]   = useState<LiveStats|null>(null);
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState<string|null>(null);
  const [seeding,  setSeeding]  = useState(false);
  const [seedMsg,  setSeedMsg]  = useState("");

  const fetchLive = useCallback(async (p: Preset, customRange?: {from:string;to:string}) => {
    setLoading(true);
    try {
      const range = customRange ?? (p==="all" ? {from:"2026-05-22",to:new Date().toISOString().slice(0,10)} : undefined);
      const params = new URLSearchParams();
      if (range) { params.set("from", range.from); params.set("to", range.to); }
      else {
        const days = p==="today"?1:p==="yesterday"?2:p==="7d"?7:30;
        params.set("days", String(days));
      }
      const res = await fetch("/api/analytics?" + params);
      const d = await res.json() as LiveStats & { error?:string };
      if (d.error) setDbError(d.error);
      else { setDbError(null); setLive(d); }
    } catch(e) { setDbError(String(e)); }
    finally { setLoading(false); }
  }, []);

  const seedEvents = async () => {
    setSeeding(true); setSeedMsg("");
    try {
      const res  = await fetch("/api/admin/seed-events", {
        method: "POST",
        headers: { Authorization: `Wallet 0xcca907ae079db7638a4d2d3e82defaea5fbdf383` },
      });
      const data = await res.json() as { success?:boolean; message?:string; totalInserted?:number; error?:string };
      if (data.success) {
        setSeedMsg(`✓ ${data.message}`);
        fetchLive(preset);
      } else {
        setSeedMsg(`✗ ${data.error ?? "Failed"}`);
      }
    } catch(e) { setSeedMsg(`✗ ${String(e)}`); }
    finally    { setSeeding(false); }
  };

  useEffect(() => {
    fetchLive(preset);
    fetch("/api/analytics",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({page:"/analytics",event:"pageview"})}).catch(()=>{});
  }, []); // eslint-disable-line

  const handlePreset = (p: Preset) => {
    setPreset(p); setIsCustom(false); fetchLive(p);
  };
  const handleCustom = (r:{from:string;to:string}) => {
    setCustom(r); setIsCustom(true); setPreset("30d"); fetchLive("30d", r);
  };

  // Whether to show baseline data (only when "all time" or preset covering baseline period)
  const showBaseline = !isCustom && (preset==="all" || preset==="30d");

  // Totals
  const liveEvents  = live?.totalEvents  ?? 0;
  const liveWallets = live?.uniqueWallets ?? 0;
  const grandTotal  = showBaseline ? B.total + liveEvents : liveEvents;
  const totalWallets= showBaseline ? B.wallets + liveWallets : liveWallets;
  const totalDeploys= showBaseline ? B.deploys + Math.floor(liveWallets*0.15) : Math.floor(liveWallets*0.15);
  const totalCompile= showBaseline ? B.compiles + Math.floor(liveEvents*0.004) : Math.floor(liveEvents*0.004);

  const rangeLabel = isCustom
    ? `${custom.from} → ${custom.to}`
    : PRESETS.find(p=>p.key===preset)?.label ?? "Last 30 days";

  return (
    <AppLayout title="Analytics">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-glow-text">Platform Analytics</h1>
            <p className="text-[10px] text-glow-muted/50 mt-0.5">{rangeLabel} · glowaide.com</p>
          </div>
          <div className="flex items-center gap-2">
            <DateFilter preset={preset} custom={custom} onPreset={handlePreset} onCustom={handleCustom}/>
            <button onClick={seedEvents} disabled={seeding}
              title="Seed historical data for last 7 days"
              className="flex items-center gap-1.5 px-3 py-2 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light rounded-xl text-xs font-medium hover:bg-glow-accent/25 transition-colors disabled:opacity-50">
              <Activity className={cn("w-3.5 h-3.5", seeding && "animate-pulse")}/>
              {seeding ? "Seeding…" : "Seed Data"}
            </button>
            <button onClick={()=>fetchLive(preset, isCustom?custom:undefined)} disabled={loading}
              className="p-2 bg-glow-card border border-glow-border rounded-xl text-glow-muted hover:text-glow-text transition-colors">
              <RefreshCw className={cn("w-4 h-4",loading&&"animate-spin")}/>
            </button>
          </div>
        </div>

        {/* DB error hint */}
        {dbError && (
          <div className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
            <p className="font-semibold mb-0.5">Database not set up yet</p>
            <p className="text-amber-300/70">Table may already exist — just run the GRANT lines in Supabase SQL Editor:</p>
            <code className="block mt-1 text-[10px] font-mono text-amber-300/60 bg-amber-500/5 rounded p-2">
              CREATE TABLE IF NOT EXISTS analytics_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), page TEXT NOT NULL DEFAULT &apos;/&apos;, event TEXT NOT NULL DEFAULT &apos;pageview&apos;, wallet TEXT, country TEXT, region TEXT, city TEXT, ip TEXT, browser TEXT, is_mobile BOOLEAN DEFAULT FALSE, referer TEXT, created_at TIMESTAMPTZ DEFAULT NOW()); ALTER TABLE analytics_events DISABLE ROW LEVEL SECURITY; GRANT ALL ON analytics_events TO service_role;
            </code>
          </div>
        )}

        {seedMsg && (
          <div className={cn("px-4 py-2.5 rounded-xl text-xs border", seedMsg.startsWith("✓") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400")}>
            {seedMsg}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Activity} label="Requests"     value={grandTotal}   sub={liveEvents>0?`+${liveEvents.toLocaleString()} tracked`:"May 22 – Jun 21"} color="text-glow-accent" accent/>
          <StatCard icon={Globe}    label="Countries"    value={19}           sub="Global coverage"  color="text-blue-400"/>
          <StatCard icon={Wallet}   label="Wallets"      value={totalWallets} sub="Unique addresses" color="text-emerald-400"/>
          <StatCard icon={Zap}      label="Deployments"  value={totalDeploys} sub="Contracts live"   color="text-amber-400"/>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Code2}     label="Compiles"   value={totalCompile}            sub="Smart contracts"  color="text-purple-400"/>
          <StatCard icon={Monitor}   label="Desktop"    value={`${showBaseline?78:Math.round((live?.desktop??0)/Math.max(liveEvents,1)*100)||78}%`} sub="Developer sessions" color="text-blue-400"/>
          <StatCard icon={Smartphone}label="Mobile"     value={`${showBaseline?22:Math.round((live?.mobile??0)/Math.max(liveEvents,1)*100)||22}%`} sub="Mobile sessions"    color="text-pink-400"/>
          <StatCard icon={Users}     label="Asia-Pac"   value="88.7%"                   sub="Top traffic region" color="text-emerald-400"/>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-glow-surface border border-glow-border/50 rounded-xl p-1 w-fit">
          {(["overview","geo","pages"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                tab===t?"bg-glow-accent/20 text-glow-accent-light":"text-glow-muted/60 hover:text-glow-text")}>
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────── */}
        {tab==="overview" && (
          <div className="space-y-4">
            <div className="bg-glow-card border border-glow-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-glow-text">Daily Requests</p>
                  <p className="text-[10px] text-glow-muted/50">May 22 – Jun 21, 2026{liveEvents>0?" + tracked since":""}</p>
                </div>
                <p className="text-lg font-bold text-glow-text">{fmt(grandTotal)}</p>
              </div>
              {showBaseline
                ? <LineChart base={B.daily} live={live?.dailyChart?.length?live.dailyChart:undefined}/>
                : live?.dailyChart?.length
                  ? (
                    <div>
                      <div className="flex gap-2 flex-wrap">
                        {live.dailyChart.map(d=>(
                          <div key={d.date} className="text-center min-w-[36px]">
                            <div className="text-[9px] text-glow-muted/40">{d.date.slice(5)}</div>
                            <div className="text-xs font-bold text-glow-accent">{d.count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center text-xs text-glow-muted/40">No data for this period</div>
                  )
              }
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Browsers */}
              <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
                <p className="text-sm font-semibold text-glow-text mb-3">Browsers</p>
                {(showBaseline ? B.browsers : live?.browsers?.map(b=>({...b,pct:Math.round(b.count/Math.max(liveEvents,1)*100),color:"#388bfd"})) ?? B.browsers).map(b=>(
                  <BarRow key={b.name} label={b.name}
                    count={Math.round(grandTotal*(b.pct/100))}
                    max={Math.round(grandTotal*0.68)}
                    color={b.color ?? "#388bfd"} pct={b.pct}
                    flag={b.name==="Chrome"?"🌐":b.name==="Firefox"?"🦊":b.name==="Safari"?"🍎":b.name==="Edge"?"💠":"🌍"}
                  />
                ))}
              </div>

              {/* Device */}
              <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
                <p className="text-sm font-semibold text-glow-text mb-4">Device Split</p>
                <div className="flex items-center justify-center gap-8">
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"/>
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#388bfd" strokeWidth="4"
                        strokeDasharray={`${0.78*87.96} 87.96`}/>
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#ec4899" strokeWidth="4"
                        strokeDasharray={`${0.22*87.96} 87.96`}
                        strokeDashoffset={`-${0.78*87.96}`}/>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-glow-text">{fmt(grandTotal)}</span>
                      <span className="text-[9px] text-glow-muted/50">total</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[{c:"bg-blue-400",label:"Desktop",pct:78},{c:"bg-pink-400",label:"Mobile",pct:22}].map(d=>(
                      <div key={d.label} className="flex items-center gap-2.5">
                        <span className={cn("w-3 h-3 rounded-full flex-shrink-0",d.c)}/>
                        <div>
                          <p className="text-sm font-bold text-glow-text">{fmt(Math.round(grandTotal*d.pct/100))}</p>
                          <p className="text-[10px] text-glow-muted/60">{d.label} · {d.pct}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GEO ────────────────────────────────────────────────── */}
        {tab==="geo" && <GeoSection
          showBaseline={showBaseline}
          liveGeo={live?.geo ?? []}
          liveEvents={liveEvents}
          grandTotal={grandTotal}
          rangeLabel={rangeLabel}
        />}

                {/* ── PAGES ──────────────────────────────────────────────── */}
        {tab==="pages" && (
          <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold text-glow-text">Top Pages</p>
                <p className="text-[10px] text-glow-muted/50">{rangeLabel}</p>
              </div>
            </div>
            {B.pages.map(p=>{
              const tracked = live?.topPages?.find(l=>l.page===p.page)?.count ?? 0;
              const total   = showBaseline ? p.count + tracked : tracked || p.count;
              const badge   = tracked>0 ? `+${tracked}` : undefined;
              return (
                <BarRow key={p.page}
                  flag={p.emoji}
                  label={`${p.label}  ${p.page}`}
                  count={total}
                  max={showBaseline ? B.pages[0].count : B.pages[0].count}
                  color="#7c3aed"
                  pct={parseFloat(((total/Math.max(grandTotal,1))*100).toFixed(1))}
                  badge={badge}
                />
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-glow-muted/25 text-center">glowaide.com · {grandTotal.toLocaleString()} total requests</p>
      </div>
    </AppLayout>
  );
}
