"use client";

import { useEffect, useState } from "react";

/** Animated progress donut. Caramel by default; "sage" tone optional. */
export function Ring({
  pct,
  label,
  tone = "caramel",
  size = 150,
}: {
  pct: number;
  label?: string;
  tone?: "caramel" | "sage";
  size?: number;
}) {
  const r = (size - 26) / 2;
  const c = 2 * Math.PI * r;
  const [offset, setOffset] = useState(c);
  useEffect(() => {
    const t = requestAnimationFrame(() =>
      setOffset(c * (1 - Math.min(100, Math.max(0, pct)) / 100)),
    );
    return () => cancelAnimationFrame(t);
  }, [c, pct]);

  const stroke = tone === "sage" ? "var(--sage)" : "var(--caramel)";
  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${pct}% ${label ?? ""}`}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#ece0cb"
          strokeWidth={13}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={13}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-[34px] font-semibold leading-none">
          {pct}%
        </span>
        {label && (
          <span className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
