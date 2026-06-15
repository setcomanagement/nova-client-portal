"use client";

import { useState, useTransition } from "react";
import {
  deleteRecapJobAction,
  markRecapJobDoneAction,
  reopenRecapJobAction,
} from "./actions";

export interface JobView {
  id: string;
  clientName: string;
  clientSlug: string;
  fathomRef: string;
  note: string | null;
  status: string;
  createdAt: string;
}

export function RecapJobRow({ job }: { job: JobView }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const command = `/nova-recap-publish ${job.fathomRef}`;
  const done = job.status === "done";

  function copy() {
    navigator.clipboard?.writeText(command).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <div className="rounded-xl border border-[#3a2a1c] bg-[#251910] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <b className="text-white">{job.clientName}</b>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                done ? "bg-[#243016] text-[#8fb36a]" : "bg-[#2a2415] text-[#d6a94e]"
              }`}
            >
              {done ? "done" : "pending"}
            </span>
          </div>
          <div className="mt-1 truncate font-mono text-xs text-[#9c886a]">{job.fathomRef}</div>
          {job.note && <div className="mt-1 text-sm text-[#c9b79c]">{job.note}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-[11px]">
          {done ? (
            <button
              type="button"
              onClick={() => start(() => reopenRecapJobAction(job.id))}
              disabled={pending}
              className="text-[#9c886a] hover:text-caramel disabled:opacity-50"
            >
              reopen
            </button>
          ) : (
            <button
              type="button"
              onClick={() => start(() => markRecapJobDoneAction(job.id))}
              disabled={pending}
              className="text-[#8fb36a] hover:underline disabled:opacity-50"
            >
              mark done
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm("Remove this recap job?")) start(() => deleteRecapJobAction(job.id));
            }}
            disabled={pending}
            className="text-[#9c886a] hover:text-[#d98a6a] disabled:opacity-50"
          >
            remove
          </button>
        </div>
      </div>

      {/* one-click launch command */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#3a2a1c] bg-[#1c130a] p-2.5">
        <code className="flex-1 truncate font-mono text-xs text-[#e7d8c4]">{command}</code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 shrink-0 items-center rounded-md bg-caramel px-3 font-mono text-[11px] font-semibold text-white hover:bg-[#8a5e30]"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <p className="mt-2 font-mono text-[10px] text-[#6b5a45]">
        Run this in Claude Code · the recap auto-lands in {job.clientName}&apos;s portal Recaps tab.
      </p>
    </div>
  );
}
