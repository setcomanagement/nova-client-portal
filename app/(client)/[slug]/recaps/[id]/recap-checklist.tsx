"use client";

import { useState, useTransition } from "react";
import { toggleRecapItem } from "./actions";
import type { ActionItem } from "@/lib/db/queries";

export function RecapChecklist({
  slug,
  recapId,
  items,
}: {
  slug: string;
  recapId: string;
  items: ActionItem[];
}) {
  const [list, setList] = useState(items);
  const [, startTransition] = useTransition();
  const done = list.filter((i) => i.done).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;

  function toggle(i: number) {
    const next = list.map((it, idx) =>
      idx === i ? { ...it, done: !it.done } : it,
    );
    setList(next);
    startTransition(() => {
      void toggleRecapItem(slug, recapId, i, !!next[i].done);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#ece1cf]">
          <div
            className="h-full rounded-full bg-sage transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="whitespace-nowrap text-[13px] font-semibold text-sage">
          {done} / {list.length} done
        </span>
      </div>
      <ul className="flex flex-col">
        {list.map((it, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => toggle(i)}
              className="flex w-full items-start gap-3 border-b border-[color:var(--border)] py-3 text-left last:border-0 hover:bg-[#faf4ea]"
            >
              <span
                className={`mt-0.5 grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] border-2 transition ${
                  it.done
                    ? "border-sage bg-sage text-white"
                    : "border-[color:var(--rule)] text-transparent"
                }`}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span
                className={`text-[15px] ${it.done ? "text-muted-foreground line-through" : ""}`}
              >
                {it.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
