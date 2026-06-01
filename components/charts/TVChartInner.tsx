"use client";
import { useEffect, useRef } from "react";
import {
  createChart, ColorType,
  CandlestickSeries, LineSeries, AreaSeries,
  type IChartApi, type Time,
} from "lightweight-charts";

interface OhlcvBar  { time:number; open:number; high:number; low:number; close:number; volume:number; }
interface LinePoint { time:number; value:number; }

interface Props {
  data: OhlcvBar[] | LinePoint[];
  type: "line" | "candlestick";
}

export default function TVChartInner({ data, type }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi|null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const el = containerRef.current;
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor:  "#6b7280",
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        fontSize:   11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(124,58,237,0.6)", width: 1, style: 1 },
        horzLine: { color: "rgba(124,58,237,0.6)", width: 1, style: 1 },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", textColor: "#6b7280" },
      timeScale:       { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      width:  el.clientWidth  || 400,
      height: el.clientHeight || 256,
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    if (type === "candlestick") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor:         "#10b981",
        downColor:       "#ef4444",
        borderUpColor:   "#10b981",
        borderDownColor: "#ef4444",
        wickUpColor:     "#10b981",
        wickDownColor:   "#ef4444",
      });
      series.setData((data as OhlcvBar[]).map(b => ({
        time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close,
      })));
    } else {
      // Area fill
      const area = chart.addSeries(AreaSeries, {
        lineColor:   "#7c3aed",
        topColor:    "rgba(124,58,237,0.18)",
        bottomColor: "rgba(124,58,237,0.01)",
        lineWidth:   2,
        crosshairMarkerVisible:         true,
        crosshairMarkerRadius:          4,
        crosshairMarkerBorderColor:     "#7c3aed",
        crosshairMarkerBackgroundColor: "#7c3aed",
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineColor:   "rgba(124,58,237,0.35)",
      });
      area.setData((data as LinePoint[]).map(p => ({ time: p.time as Time, value: p.value })));
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (chartRef.current && el) {
        chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [data, type]);

  return <div ref={containerRef} className="w-full h-full"/>;
}
