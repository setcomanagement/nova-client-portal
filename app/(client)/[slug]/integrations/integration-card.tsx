"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import type { IntegrationStatus } from "@/lib/db/schema";
import { setIntegrationStatusAction } from "./actions";

export interface ProviderMeta {
  provider: string;
  name: string;
  blurb: string;
  glyph: string;
  glyphColor: string;
}

export function IntegrationCard({
  slug,
  meta,
  status,
  connectedAt,
}: {
  slug: string;
  meta: ProviderMeta;
  status: IntegrationStatus;
  connectedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const comingSoon = status === "coming_soon";
  const connected = status === "connected";

  function toggle() {
    const next: IntegrationStatus = connected ? "disconnected" : "connected";
    start(async () => {
      await setIntegrationStatusAction(slug, meta.provider, next);
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-white text-lg font-bold"
          style={{ color: meta.glyphColor }}
        >
          {meta.glyph}
        </span>
        <div className="flex-1">
          <b>{meta.name}</b>
          <p className="text-sm text-muted-foreground">{meta.blurb}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between">
        {comingSoon ? (
          <span className="badge badge-neutral">Coming Phase 2</span>
        ) : connected ? (
          <span className="badge badge-good">
            Connected{connectedAt ? ` · ${connectedAt}` : ""}
          </span>
        ) : (
          <span className="badge badge-neutral">Not connected</span>
        )}
        <button
          type="button"
          onClick={toggle}
          disabled={comingSoon || pending}
          className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold transition disabled:opacity-50 ${
            connected
              ? "border border-border text-foreground hover:bg-[#f0e7d8]"
              : "bg-accent text-white hover:opacity-90"
          }`}
        >
          {pending ? "…" : comingSoon ? "Connect" : connected ? "Disconnect" : "Connect"}
        </button>
      </div>
    </Card>
  );
}
