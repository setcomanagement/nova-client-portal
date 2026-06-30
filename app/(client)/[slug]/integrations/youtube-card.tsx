"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  connectYoutubeAction,
  disconnectYoutubeAction,
  type YoutubeConnectState,
} from "./youtube-actions";

const init: YoutubeConnectState = {};

export function YoutubeCard({
  slug,
  configured,
  connected,
  channelName,
  connectedAt,
}: {
  slug: string;
  configured: boolean;
  connected: boolean;
  channelName: string | null;
  connectedAt: string | null;
}) {
  const connect = connectYoutubeAction.bind(null, slug);
  const disconnect = disconnectYoutubeAction.bind(null, slug);
  const [state, connectAction, pending] = useActionState(connect, init);
  const [, disconnectFormAction, disconnecting] = useActionState(disconnect, init);

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ background: "#FF0000" }}
        >
          ▶
        </span>
        <span className="rounded border border-caramel px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-caramel">
          Social
        </span>
      </div>
      <div>
        <b className="text-[15px] font-medium">YouTube</b>
        <p className="text-xs text-muted-foreground">
          Track subscribers &amp; per-video performance in Social
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: connected ? "#4F7A4A" : "#B5A48E" }}
        />
        <span className="text-muted-foreground">
          {connected
            ? `Connected${channelName ? ` · ${channelName}` : ""}${connectedAt ? ` · ${connectedAt}` : ""}`
            : "Not connected"}
        </span>
      </div>

      {!configured ? (
        <p className="mt-auto text-xs text-muted-foreground">
          YouTube isn&apos;t configured on the server yet.
        </p>
      ) : connected ? (
        <form action={disconnectFormAction} className="mt-auto">
          <Button type="submit" variant="outline" disabled={disconnecting} className="w-full">
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </Button>
        </form>
      ) : (
        <form action={connectAction} className="mt-auto flex flex-col gap-2">
          <Input
            name="handle"
            placeholder="youtube.com/@yourchannel"
            aria-label="YouTube channel URL or handle"
          />
          <Button type="submit" variant="accent" disabled={pending} className="w-full">
            {pending ? "Connecting…" : "Connect"}
          </Button>
          {state.error && <span className="text-xs text-destructive">{state.error}</span>}
        </form>
      )}
    </Card>
  );
}
