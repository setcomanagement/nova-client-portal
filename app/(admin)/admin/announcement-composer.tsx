"use client";

import { useActionState } from "react";
import { postAnnouncement, type AnnState } from "./announcement-actions";

const init: AnnState = {};

export function AnnouncementComposer({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState(postAnnouncement, init);
  return (
    <form action={action} className="flex flex-col gap-3">
      {current && (
        <div className="flex items-start gap-3 rounded-lg border border-[#e6e3dd] bg-[#f7f7f4] p-3">
          <span className="rounded-full bg-[#eceae4] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#8a6414]">
            live
          </span>
          <span className="text-sm text-[#2f2f33]">{current}</span>
        </div>
      )}
      <textarea
        name="message"
        rows={2}
        defaultValue={current ?? ""}
        placeholder="Message shown on every client & setter page…"
        className="w-full rounded-lg border border-[#e6e3dd] bg-[#f7f7f4] px-3 py-2 text-sm text-[#2f2f33] outline-none focus:border-caramel"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-caramel px-4 text-sm font-semibold text-white hover:bg-[#8a5e30] disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post announcement"}
        </button>
        {state.ok && (
          <span className="text-sm text-[#4f6b34]">
            {state.cleared ? "Banner cleared — no longer shown." : "Posted — live on client pages."}
          </span>
        )}
      </div>
    </form>
  );
}
