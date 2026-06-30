"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface CountPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

const CARAMEL = "#a0703c";
const LINE = "#e6d9c4";

function fmtAxisDate(d: string): string {
  // d is YYYY-MM-DD; render as "Jun 9" without a TZ-shifted Date.
  const [, m, day] = d.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${day}`;
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-[color:var(--ink)]">{label ? fmtAxisDate(label) : ""}</div>
      <div className="mt-0.5 text-muted-foreground">{payload[0].value.toLocaleString()}</div>
    </div>
  );
}

export function FollowerTrend({ title, data }: { title: string; data: CountPoint[] }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-card p-5">
      <h4 className="mb-4 text-center text-sm font-semibold text-[color:var(--ink)]">{title}</h4>
      <div className="h-[220px] w-full">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Not enough data yet — needs at least two days of numbers to chart growth.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="g-followers" x1="0" y1="0" x2="0" y2="1">
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
              <YAxis tick={{ fontSize: 11, fill: "#9c886a" }} stroke={LINE} width={48} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={CARAMEL}
                strokeWidth={2}
                fill="url(#g-followers)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
