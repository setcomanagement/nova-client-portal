"use client";

import { useState } from "react";

export function AnnouncementBanner({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3"
      style={{ background: "var(--honey-bg)", borderColor: "#ecd9ad" }}
    >
      <span className="rounded-full border border-[#ecd9ad] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-honey">
        Announcement
      </span>
      <span className="flex-1 text-sm font-medium text-[#6d4f17]">{message}</span>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="text-lg leading-none text-[#9b7a3a] hover:text-[#6d4f17]"
      >
        ×
      </button>
    </div>
  );
}
