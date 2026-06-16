"use client";

import { useRef, useState, useTransition } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markCompleteAction } from "./actions";
import type { Chapter } from "@/lib/db/schema";

// Base wrapper for a rendered lesson body — sets the body-brown text on the
// portal's cream surface. Element-level brand styling lives in `mdComponents`.
const mdWrap = "font-sans text-[15px] leading-relaxed text-[color:var(--ink)]/85";

// NOVA-branded renderers for react-markdown. Colours/fonts reuse the portal's
// existing palette tokens (ink/espresso/caramel/bone/secondary/rule) — no new
// colours, no parallel styling system. `node` is dropped so it never hits the DOM.
const mdComponents: Components = {
  // Large serif heading with a short amber underline accent.
  h1: ({ node, ...p }) => (
    <h1
      className="mt-8 mb-4 font-serif text-2xl font-semibold text-ink after:mt-2 after:block after:h-[3px] after:w-[40%] after:bg-caramel after:content-['']"
      {...p}
    />
  ),
  h2: ({ node, ...p }) => (
    <h2 className="mt-6 mb-2 font-serif text-xl font-semibold text-ink" {...p} />
  ),
  // Sans, amber, uppercase — a section accent (matches the portal eyebrow).
  h3: ({ node, ...p }) => (
    <h3
      className="mt-5 mb-2 font-sans text-[12px] font-semibold uppercase tracking-[0.16em] text-caramel"
      {...p}
    />
  ),
  p: ({ node, ...p }) => <p className="my-3" {...p} />,
  a: ({ node, ...p }) => (
    <a
      className="text-caramel no-underline transition-colors hover:text-[color:var(--caramel-d)] hover:underline"
      {...p}
    />
  ),
  // Bold shifts toward a deeper amber (not the bright accent) for brand warmth.
  strong: ({ node, ...p }) => (
    <strong className="font-semibold text-[color:var(--caramel-d)]" {...p} />
  ),
  ul: ({ node, ...p }) => <ul className="my-3 list-disc pl-5" {...p} />,
  ol: ({ node, ...p }) => <ol className="my-3 list-decimal pl-5" {...p} />,
  li: ({ node, ...p }) => (
    <li
      className="my-1.5 leading-relaxed marker:text-caramel [&>ul]:my-1.5 [&>ol]:my-1.5"
      {...p}
    />
  ),
  // NOVA callout panel: warm-cream fill, amber left rule, first line emphasised.
  blockquote: ({ node, ...p }) => (
    <blockquote
      className="my-4 rounded-[5px] border-l-[3px] border-caramel bg-secondary px-4 py-3.5 text-[color:var(--ink)]/90 [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:first-child]:font-medium [&>p:last-child]:mb-0"
      {...p}
    />
  ),
  // Thin amber divider, centred, ~40% width.
  hr: ({ node, ...p }) => (
    <hr
      className="mx-auto my-6 h-px w-2/5 border-0 bg-[color:var(--caramel)]/60"
      {...p}
    />
  ),
  // Inline code — small cream chip, brown text, no border.
  code: ({ node, ...p }) => (
    <code
      className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-espresso"
      {...p}
    />
  ),
  // Code block — dark brown surface, cream text; resets the nested <code> chip.
  pre: ({ node, ...p }) => (
    <pre
      className="my-3 overflow-x-auto rounded-[6px] bg-[#241910] p-4 text-bone [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[0.85em] [&>code]:text-bone"
      {...p}
    />
  ),
  table: ({ node, ...p }) => (
    <div className="my-4 overflow-x-auto">
      <table
        className="w-full border-collapse overflow-hidden rounded-[6px] border border-[color:var(--rule)] text-sm"
        {...p}
      />
    </div>
  ),
  thead: ({ node, ...p }) => <thead {...p} />,
  tbody: ({ node, ...p }) => <tbody {...p} />,
  // Alternating warm-cream rows with a subtle rule between them.
  tr: ({ node, ...p }) => (
    <tr
      className="border-t border-[color:var(--rule)] odd:bg-bone even:bg-secondary"
      {...p}
    />
  ),
  th: ({ node, ...p }) => (
    <th
      className="bg-espresso px-3 py-2.5 text-left font-semibold text-bone"
      {...p}
    />
  ),
  td: ({ node, ...p }) => (
    <td className="px-3 py-2.5 align-top text-[color:var(--ink)]/90" {...p} />
  ),
};

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
  const topRef = useRef<HTMLDivElement>(null);

  function complete() {
    setDone(true);
    start(() => void markCompleteAction(slug, moduleId));
  }

  // Visual un-complete: revert to the active "Mark complete" button within the
  // session. No server action exists for un-completing and the data model is
  // off-limits, so this is client-only — a refresh restores the saved state.
  function uncomplete() {
    setDone(false);
  }

  // Navigate to a lesson and bring its content back to the top of the viewport,
  // clearing the sticky header (~80px) so the reader starts at the lesson head.
  function select(idx: number) {
    if (idx < 0 || idx >= flat.length) return;
    setActive(idx);
    const el = topRef.current;
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  const hasPrev = active > 0;
  const hasNext = active < flat.length - 1;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
      <div ref={topRef} key={active} className="lesson-fade flex flex-col gap-5">
        {lesson?.videoUrl && (
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
        )}
        <Card className="p-6">
          <div className="mb-4">
            <p className="eyebrow">NOVA · Lesson</p>
            <span className="mt-1.5 block h-[2px] w-10 bg-caramel" />
            <h3 className="mt-2 text-xl font-semibold text-ink">{lesson?.title}</h3>
          </div>
          {lesson?.body && (
            <div className={mdWrap}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {lesson.body}
              </ReactMarkdown>
            </div>
          )}
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

        {/* Reading-flow navigation — flat list is ordered across chapters, so
            prev/next naturally cross chapter boundaries. Ends hide their edge. */}
        {(hasPrev || hasNext) && (
          <nav className="flex items-center justify-between gap-3">
            {hasPrev ? (
              <button
                type="button"
                onClick={() => select(active - 1)}
                className="inline-flex max-w-[48%] items-center gap-2 rounded-md border border-[color:var(--caramel)]/50 bg-bone px-4 py-2.5 text-sm font-medium text-espresso transition-colors hover:border-caramel hover:bg-secondary"
              >
                <span aria-hidden>←</span>
                <span className="truncate">Previous lesson</span>
              </button>
            ) : (
              <span />
            )}
            {hasNext && (
              <button
                type="button"
                onClick={() => select(active + 1)}
                className="inline-flex max-w-[48%] items-center gap-2 rounded-md border border-[color:var(--caramel)]/50 bg-bone px-4 py-2.5 text-sm font-medium text-espresso transition-colors hover:border-caramel hover:bg-secondary"
              >
                <span className="truncate">Next lesson</span>
                <span aria-hidden>→</span>
              </button>
            )}
          </nav>
        )}
      </div>

      <Card className="h-fit p-5 lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow relative inline-block after:mt-1 after:block after:h-[2px] after:w-full after:bg-caramel after:content-['']">
            Curriculum
          </p>
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
                    onClick={() => select(idx)}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-left text-sm transition-colors duration-150 ${
                      isActive
                        ? "border-caramel bg-secondary font-semibold text-ink"
                        : "border-transparent text-foreground hover:bg-secondary/60"
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
        {done ? (
          // Quiet "completed" pill — muted amber tint, brand-brown text. Hover
          // hints it's clickable to un-complete (reverts to the active button).
          <button
            type="button"
            onClick={uncomplete}
            title="Click to un-complete"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[color:var(--caramel)]/30 bg-[color:var(--caramel)]/12 px-3 py-2 text-sm font-medium text-espresso transition-colors hover:border-[color:var(--caramel)]/50 hover:bg-[color:var(--caramel)]/20"
          >
            ✓ Completed
          </button>
        ) : (
          <Button
            type="button"
            variant="accent"
            size="sm"
            className="mt-4 w-full"
            onClick={complete}
          >
            Mark complete
          </Button>
        )}
      </Card>
    </div>
  );
}
