import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

function cssVar(name: string, fallback = "#888"): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `rgb(${v})` : fallback;
}

function useColors() {
  const [, force] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => force((n) => n + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return {
    grid: cssVar("--line"), tick: cssVar("--muted"), surface: cssVar("--surface"),
    line: cssVar("--line-strong"), ink: cssVar("--ink"),
  };
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const tipStyle = (c: ReturnType<typeof useColors>) => ({
  background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono",
  boxShadow: "0 8px 24px rgb(0 0 0 / .12)", color: c.ink,
});

export function TrendArea({ data, keys, height = 240 }: { data: any[]; keys: { k: string; label: string; color: string }[]; height?: number }) {
  const c = useColors();
  if (!useMounted()) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          {keys.map((s) => (
            <linearGradient key={s.k} id={`g-${s.k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: c.tick, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: c.tick, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={42} />
        <Tooltip contentStyle={tipStyle(c)} />
        {keys.map((s) => <Area key={s.k} type="monotone" dataKey={s.k} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.k})`} />)}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MiniBars({ data, dataKey = "value", color, height = 240, horizontal = false }: { data: any[]; dataKey?: string; color?: string; height?: number; horizontal?: boolean }) {
  const c = useColors();
  if (!useMounted()) return <div style={{ height }} />;
  const fill = color ?? cssVar("--primary");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: horizontal ? 8 : -16, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fill: c.tick, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" tick={{ fill: c.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={{ fill: c.tick, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: c.tick, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={36} />
          </>
        )}
        <Tooltip contentStyle={tipStyle(c)} cursor={{ fill: "rgb(127 127 127 / .08)" }} />
        <Bar dataKey={dataKey} fill={fill} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 240, center }: { data: { label: string; value: number; color: string }[]; height?: number; center?: string }) {
  const c = useColors();
  if (!useMounted()) return <div style={{ height }} />;
  return (
    <div style={{ position: "relative" }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke={c.surface} strokeWidth={2}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={tipStyle(c)} />
        </PieChart>
      </ResponsiveContainer>
      {center && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 20 }}>{center}</div>}
    </div>
  );
}

export function Sparkline({ data, dataKey = "v", color, height = 40 }: { data: any[]; dataKey?: string; color?: string; height?: number }) {
  if (!useMounted()) return <div style={{ height }} />;
  const stroke = color ?? cssVar("--primary");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
