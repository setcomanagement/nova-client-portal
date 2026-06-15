"use client";

import { useState } from "react";

/**
 * Shows a pending member's invite status with a re-copy button so the admin can
 * grab the setup link any time (valid until it expires), then send it manually.
 * Renders nothing once the member has onboarded (token cleared).
 */
export function MemberInvite({
  token,
  expiresAt,
  dark = false,
}: {
  token: string | null;
  expiresAt: string | null;
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!token) {
    return (
      <span className={dark ? "text-[11px] text-[#8fb36a]" : "text-xs text-sage"}>
        Active
      </span>
    );
  }
  const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
  if (expired) {
    return (
      <span className={dark ? "text-[11px] text-[#d98a6a]" : "text-xs"} style={dark ? {} : { color: "var(--clay)" }}>
        Invite expired — remove &amp; re-add
      </span>
    );
  }
  function copy() {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={
        dark
          ? "font-mono text-[11px] text-[#d6a94e] hover:text-caramel"
          : "text-xs font-medium text-accent hover:underline"
      }
      title="Copy this member's invite link to send manually"
    >
      {copied ? "copied ✓" : "Invite pending · copy link"}
    </button>
  );
}
