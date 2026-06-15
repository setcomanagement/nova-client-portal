"use client";

import { useActionState } from "react";
import { postAnnouncement, type AnnState } from "./announcement-actions";

const init: AnnState = {};

export function AnnouncementComposer({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState(postAnnouncement, init);
  return (
    <form action={action} className="flex flex-col gap-3">
      {current && (
        <div className="flex items-start gap-3 rounded-lg border border-[#3a2a1c] bg-[#1c130a] p-3">
          <span className="rounded-full bg-[#3a3119] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#d6a94e]">
            live
          </span>
          <span className="text-sm text-[#e7d8c4]">{current}</span>
        </div>
      )}
      <textarea
        name="message"
        rows={2}
        defaultValue={current ?? ""}
        placeholder="Message shown on every client & setter page…"
        className="w-full rounded-lg border border-[#3a2a1c] bg-[#1c130a] px-3 py-2 text-sm text-[#e7d8c4] outline-none focus:border-caramel"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-caramel px-4 text-sm font-semibold text-white hover:bg-[#8a5e30] disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post announcement"}
        </button>
        {state.ok && <span className="text-sm text-[#8fb36a]">Posted — live on client pages.</span>}
      </div>
    </form>
  );
}
