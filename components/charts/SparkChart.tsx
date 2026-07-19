"use client";
// Lightweight custom SVG chart — no external dependencies
// Used in Launchpad Discover and token pages

interface Point { time: number; price: number; }

interface SparkChartProps {
  data: Point[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  className?: string;
}

function normalize(pts: Point[], w: number, h: number, pad = 8) {
  if (!pts.length) return [];
  const prices = pts.map(p => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const n = pts.length;
  return pts.map((p, i) => ({
    x: pad + (i / (n - 1 || 1)) * (w - pad * 2),
    y: pad + (1 - (p.price - min) / range) * (h - pad * 2),
    price: p.price,
    time:  p.time,
  }));
}

export function SparkChart({ data, width = 300, height = 80, color = "#7c3aed", fill = true, showGrid = false, showLabels = false, className = "" }: SparkChartProps) {
  if (!data.length) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <span className="text-[10px] text-glow-muted/40">No data</span>
      </div>
    );
  }

  const pts = normalize(data, width, height);
  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = pts.length > 0
    ? `M${pts[0].x.toFixed(1)},${height} ` +
      pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
      ` L${pts[pts.length-1].x.toFixed(1)},${height} Z`
    : "";

  const isUp = data[data.length - 1]?.price >= data[0]?.price;
  const lineColor = color === "auto" ? (isUp ? "#10b981" : "#ef4444") : color;
  const fillId = `spark-fill-${Math.random().toString(36).slice(2,6)}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%" height={height}
      className={className}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02"/>
        </linearGradient>
      </defs>

      {showGrid && (
        <>
          <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          <line x1="0" y1={height/4} x2={width} y2={height/4} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
          <line x1="0" y1={height*3/4} x2={width} y2={height*3/4} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
        </>
      )}

      {fill && areaPath && (
        <path d={areaPath} fill={`url(#${fillId})`}/>
      )}

      <polyline
        points={polyline}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Endpoint dot */}
      {pts.length > 0 && (
        <circle
          cx={pts[pts.length-1].x}
          cy={pts[pts.length-1].y}
          r="3"
          fill={lineColor}
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="1.5"
        />
      )}

      {showLabels && (
        <>
          <text x="4" y={height - 4} fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
            ${Math.min(...data.map(d=>d.price)).toFixed(4)}
          </text>
          <text x="4" y="12" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
            ${Math.max(...data.map(d=>d.price)).toFixed(4)}
          </text>
        </>
      )}
    </svg>
  );
}

// ── Mini volume bars ──────────────────────────────────────────────────────────
export function VolumeChart({ volumes, color = "#7c3aed", height = 40, className = "" }:
  { volumes: number[]; color?: string; height?: number; className?: string }) {
  if (!volumes.length) return null;
  const max = Math.max(...volumes, 1);
  const w = 300;
  const barW = w / volumes.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} className={className}>
      {volumes.map((v, i) => {
        const bh = (v / max) * height;
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={height - bh}
            width={barW}
            height={bh}
            fill={color}
            opacity="0.4"
            rx="1"
          />
        );
      })}
    </svg>
  );
}
