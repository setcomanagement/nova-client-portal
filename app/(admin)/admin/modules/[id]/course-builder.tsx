"use client";

import { useState, useTransition } from "react";
import type { Chapter, Lesson } from "@/lib/db/schema";
import { deleteModuleAction, saveModuleAction } from "../actions";

const field =
  "w-full rounded-lg border border-[#3a2a1c] bg-[#1c130a] px-3 py-2 text-sm text-[#e7d8c4] outline-none focus:border-caramel placeholder:text-[#6b5a45]";
const ghost =
  "inline-flex items-center gap-1 rounded-md border border-[#3a2a1c] px-2.5 py-1 font-mono text-[11px] text-[#9c886a] transition hover:border-caramel hover:text-caramel";

function emptyLesson(): Lesson {
  return { title: "", videoUrl: "", summary: "", links: [] };
}

export function CourseBuilder({
  id,
  initialTitle,
  initialDescription,
  initialChapters,
}: {
  id: string;
  initialTitle: string;
  initialDescription: string;
  initialChapters: Chapter[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [chapters, setChapters] = useState<Chapter[]>(
    initialChapters.length ? initialChapters : [],
  );
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalLessons = chapters.reduce((s, c) => s + c.lessons.length, 0);

  // --- chapter ops ---
  function addChapter() {
    setChapters((cs) => [...cs, { title: "", lessons: [emptyLesson()] }]);
  }
  function removeChapter(ci: number) {
    setChapters((cs) => cs.filter((_, i) => i !== ci));
  }
  function setChapterTitle(ci: number, v: string) {
    setChapters((cs) => cs.map((c, i) => (i === ci ? { ...c, title: v } : c)));
  }
  function moveChapter(ci: number, dir: -1 | 1) {
    setChapters((cs) => {
      const j = ci + dir;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[ci], next[j]] = [next[j], next[ci]];
      return next;
    });
  }

  // --- lesson ops ---
  function addLesson(ci: number) {
    setChapters((cs) =>
      cs.map((c, i) =>
        i === ci ? { ...c, lessons: [...c.lessons, emptyLesson()] } : c,
      ),
    );
  }
  function removeLesson(ci: number, li: number) {
    setChapters((cs) =>
      cs.map((c, i) =>
        i === ci ? { ...c, lessons: c.lessons.filter((_, k) => k !== li) } : c,
      ),
    );
  }
  function setLesson(ci: number, li: number, patch: Partial<Lesson>) {
    setChapters((cs) =>
      cs.map((c, i) =>
        i === ci
          ? {
              ...c,
              lessons: c.lessons.map((l, k) => (k === li ? { ...l, ...patch } : l)),
            }
          : c,
      ),
    );
  }

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await saveModuleAction(id, { title, description, chapters });
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Could not save.");
    });
  }

  function remove() {
    if (!confirm(`Delete "${title}"? This removes it from the playbook for every client.`))
      return;
    start(async () => {
      await deleteModuleAction(id);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* header / meta */}
      <div className="rounded-xl border border-[#3a2a1c] bg-[#251910] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-caramel">
              NOVA playbook · course
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Module title"
              className="mt-2 w-full border-0 bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-[#6b5a45]"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="One line on what this module covers."
              className="mt-1 w-full border-0 bg-transparent text-sm text-[#c9b79c] outline-none placeholder:text-[#6b5a45]"
            />
          </div>
        </div>
        <div className="mt-3 font-mono text-xs text-[#9c886a]">
          {chapters.length} chapters · {totalLessons} lessons
        </div>
      </div>

      {/* chapters */}
      <div className="flex flex-col gap-5">
        {chapters.map((ch, ci) => (
          <div
            key={ci}
            className="rounded-xl border border-[#3a2a1c] bg-[#251910] p-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-caramel font-mono text-xs font-bold text-white">
                {ci + 1}
              </span>
              <input
                value={ch.title}
                onChange={(e) => setChapterTitle(ci, e.target.value)}
                placeholder={`Chapter ${ci + 1} title`}
                className="flex-1 border-0 border-b border-transparent bg-transparent pb-1 text-lg font-semibold text-white outline-none focus:border-[#3a2a1c] placeholder:text-[#6b5a45]"
              />
              <button type="button" onClick={() => moveChapter(ci, -1)} className={ghost}>
                ↑
              </button>
              <button type="button" onClick={() => moveChapter(ci, 1)} className={ghost}>
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeChapter(ci)}
                className={`${ghost} hover:border-[#7a3a2a] hover:text-[#d98a6a]`}
              >
                remove
              </button>
            </div>

            {/* lessons */}
            <div className="mt-4 flex flex-col gap-3 border-l border-[#3a2a1c] pl-4">
              {ch.lessons.map((ls, li) => (
                <div
                  key={li}
                  className="rounded-lg border border-[#33241733] bg-[#1c130a] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[#9c886a]">
                      {ci + 1}.{li + 1}
                    </span>
                    <input
                      value={ls.title}
                      onChange={(e) => setLesson(ci, li, { title: e.target.value })}
                      placeholder="Lesson title"
                      className="flex-1 border-0 bg-transparent text-sm font-medium text-white outline-none placeholder:text-[#6b5a45]"
                    />
                    <button
                      type="button"
                      onClick={() => removeLesson(ci, li)}
                      className={`${ghost} hover:border-[#7a3a2a] hover:text-[#d98a6a]`}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      value={ls.videoUrl ?? ""}
                      onChange={(e) => setLesson(ci, li, { videoUrl: e.target.value })}
                      placeholder="Video URL (Loom / YouTube)"
                      className={field}
                    />
                    <input
                      value={ls.links?.[0]?.label ?? ""}
                      onChange={(e) =>
                        setLesson(ci, li, {
                          links: e.target.value
                            ? [{ label: e.target.value, url: ls.links?.[0]?.url }]
                            : [],
                        })
                      }
                      placeholder="Resource label (optional)"
                      className={field}
                    />
                  </div>
                  <textarea
                    value={ls.summary ?? ""}
                    onChange={(e) => setLesson(ci, li, { summary: e.target.value })}
                    rows={2}
                    placeholder="Lesson summary / notes (optional)"
                    className={`${field} mt-2`}
                  />
                </div>
              ))}
              <button type="button" onClick={() => addLesson(ci)} className={ghost}>
                + add lesson
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addChapter}
          className="rounded-xl border border-dashed border-[#3a2a1c] p-4 font-mono text-sm text-[#9c886a] transition hover:border-caramel hover:text-caramel"
        >
          + add chapter
        </button>
      </div>

      {/* footer actions */}
      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-xl border border-[#3a2a1c] bg-[#251910] p-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex h-10 items-center rounded-lg bg-caramel px-5 text-sm font-semibold text-white hover:bg-[#8a5e30] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save course"}
          </button>
          {saved && <span className="text-sm text-[#8fb36a]">Saved.</span>}
          {error && <span className="text-sm text-[#d98a6a]">{error}</span>}
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="font-mono text-[11px] text-[#9c886a] transition hover:text-[#d98a6a] disabled:opacity-50"
        >
          delete module
        </button>
      </div>
    </div>
  );
}
