"use client";

import { useState } from "react";

/** Shows a generated invite link with a copy button + email-delivery status. */
export function InviteLink({
  link,
  emailed,
  to,
  dark = false,
}: {
  link: string;
  emailed: boolean;
  to: string;
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  const box = dark
    ? "border-[#3a2a1c] bg-[#1c130a] text-[#e7d8c4]"
    : "border-border bg-bone text-foreground";
  const sub = dark ? "text-[#9c886a]" : "text-muted-foreground";
  return (
    <div className="flex flex-col gap-1.5">
      <p className={`text-xs ${sub}`}>
        {emailed
          ? `✓ Invite emailed to ${to}. They set their own password from the link.`
          : `Send this setup link to ${to} — they choose their own password and sign in:`}
      </p>
      <div className={`flex items-center gap-2 rounded-lg border p-2 ${box}`}>
        <code className="flex-1 truncate font-mono text-xs">{link}</code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 shrink-0 items-center rounded-md bg-accent px-3 text-xs font-semibold text-white hover:opacity-90"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
    </div>
  );
}
