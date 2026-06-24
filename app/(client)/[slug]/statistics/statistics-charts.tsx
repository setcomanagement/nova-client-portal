"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  date: string;
  convos: number;
  booked: number;
  pitchToBook: number; // %
  convoToBook: number; // %
}

const CARAMEL = "#a0703c";
const INK = "#20160e";
const LINE = "#e6d9c4";

function fmtAxisDate(d: string): string {
  // d is YYYY-MM-DD; render as "Jun 9" without constructing a TZ-shifted Date.
  const [, m, day] = d.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${day}`;
}

function ChartTip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-[color:var(--ink)]">
        {label ? fmtAxisDate(label) : ""}
      </div>
      <div className="mt-0.5 text-muted-foreground">
        {payload[0].value}
        {suffix ?? ""}
      </div>
    </div>
  );
}

function TrendCard({
  title,
  data,
  dataKey,
  suffix,
  area,
}: {
  title: string;
  data: TrendPoint[];
  dataKey: keyof TrendPoint;
  suffix?: string;
  area?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-card p-5">
      <h4 className="mb-4 text-center text-sm font-semibold text-[color:var(--ink)]">
        {title}
      </h4>
      <div className="h-[220px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data in this range yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {area ? (
              <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={`g-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CARAMEL} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CARAMEL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtAxisDate}
                  tick={{ fontSize: 11, fill: "#9c886a" }}
                  stroke={LINE}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9c886a" }}
                  stroke={LINE}
                  width={40}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTip suffix={suffix} />} />
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke={CARAMEL}
                  strokeWidth={2}
                  fill={`url(#g-${String(dataKey)})`}
                  dot={false}
                />
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtAxisDate}
                  tick={{ fontSize: 11, fill: "#9c886a" }}
                  stroke={LINE}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9c886a" }}
                  stroke={LINE}
                  width={40}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTip suffix={suffix} />} />
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke={INK}
                  strokeWidth={1.75}
                  dot={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function StatisticsCharts({ data }: { data: TrendPoint[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <TrendCard title="Conversations Had over time" data={data} dataKey="convos" area />
      <TrendCard title="Calls Booked over time" data={data} dataKey="booked" area />
      <TrendCard title="Pitch → Book over time" data={data} dataKey="pitchToBook" suffix="%" />
      <TrendCard title="Conversations → Booked over time" data={data} dataKey="convoToBook" suffix="%" />
    </div>
  );
}
