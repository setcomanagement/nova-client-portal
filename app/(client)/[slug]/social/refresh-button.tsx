"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { refreshYoutubeAction, type SocialState } from "./actions";

const init: SocialState = {};

export function RefreshButton({ slug }: { slug: string }) {
  const action = refreshYoutubeAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Refreshing…" : "Refresh from YouTube"}
      </Button>
      {state.note && <span className="text-xs text-sage">{state.note}</span>}
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
