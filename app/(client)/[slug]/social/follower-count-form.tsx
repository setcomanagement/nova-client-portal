"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setFollowerCountAction, type SocialState } from "./actions";

const init: SocialState = {};

export function FollowerCountForm({ slug, today }: { slug: string; today: string }) {
  const action = setFollowerCountAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fc-count">Followers today</Label>
        <Input id="fc-count" name="count" type="number" min="0" defaultValue={0} className="w-36" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fc-date">As of</Label>
        <Input id="fc-date" name="capturedOn" type="date" defaultValue={today} />
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving…" : "Log followers"}
      </Button>
      {state.ok && <span className="pb-2 text-sm text-sage">Saved.</span>}
      {state.error && <span className="pb-2 text-sm text-destructive">{state.error}</span>}
    </form>
  );
}
