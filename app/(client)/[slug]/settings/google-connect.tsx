"use client";

import { useTransition } from "react";
import { setIntegrationStatusAction } from "../integrations/actions";

export function GoogleConnect({
  slug,
  connected,
}: {
  slug: string;
  connected: boolean;
}) {
  const [pending, start] = useTransition();
  function toggle() {
    start(async () => {
      await setIntegrationStatusAction(
        slug,
        "google",
        connected ? "disconnected" : "connected",
      );
    });
  }
  return (
    <div className="flex items-center gap-3">
      <span className={`badge ${connected ? "badge-good" : "badge-neutral"}`}>
        {connected ? "Connected" : "Not connected"}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold transition disabled:opacity-50 ${
          connected
            ? "border border-border text-foreground hover:bg-[#f0e7d8]"
            : "bg-accent text-white hover:opacity-90"
        }`}
      >
        {pending ? "…" : connected ? "Disconnect" : "Connect Google"}
      </button>
    </div>
  );
}
