"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markCompleteAction } from "./actions";
import type { Chapter } from "@/lib/db/schema";

export function ModuleCourse({
  slug,
  moduleId,
  chapters,
  completed,
}: {
  slug: string;
  moduleId: string;
  chapters: Chapter[];
  completed: boolean;
}) {
  // Flat list of lessons with chapter context, for selection.
  const flat = chapters.flatMap((c, ci) =>
    c.lessons.map((l, li) => ({ ...l, ci, li })),
  );
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(completed);
  const [, start] = useTransition();
  const lesson = flat[active] ?? flat[0];

  function complete() {
    setDone(true);
    start(() => void markCompleteAction(slug, moduleId));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5">
        <div
          className="grid aspect-video place-items-center rounded-2xl"
          style={{ background: "radial-gradient(120% 130% at 30% 0%, #4a3526, #241910)" }}
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-espresso">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>
        <Card className="p-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{lesson?.title}</h3>
          </div>
          <p className="text-sm text-[color:var(--ink)]/75">{lesson?.summary}</p>
          {lesson?.links && lesson.links.length > 0 && (
            <div className="mt-4 border-t border-[color:var(--line)] pt-3">
              <p className="eyebrow mb-2 block">Resources &amp; links</p>
              {lesson.links.map((lk, i) => (
                <div key={i} className="py-1.5 text-sm">
                  <a className="text-accent hover:underline">{lk.label}</a>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="h-fit p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow block">Curriculum</p>
          {done && <span className="badge badge-good">Completed</span>}
        </div>
        <div className="flex flex-col gap-1">
          {chapters.map((c, ci) => (
            <div key={ci}>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent first:mt-0">
                {c.title}
              </div>
              {c.lessons.map((l, li) => {
                const idx = flat.findIndex((f) => f.ci === ci && f.li === li);
                const isActive = idx === active;
                return (
                  <button
                    key={li}
                    type="button"
                    onClick={() => setActive(idx)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${
                      isActive ? "bg-secondary font-medium text-ink" : "hover:bg-secondary/60"
                    }`}
                  >
                    <span className="grid h-5 w-5 flex-none place-items-center rounded-md border border-[color:var(--rule)] text-[11px] text-muted-foreground">
                      {idx + 1}
                    </span>
                    {l.title}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant={done ? "outline" : "accent"}
          size="sm"
          className="mt-4 w-full"
          onClick={complete}
        >
          {done ? "Completed ✓" : "Mark complete"}
        </Button>
      </Card>
    </div>
  );
}
