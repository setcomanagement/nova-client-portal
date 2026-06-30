"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addInstagramPostAction, type SocialState } from "./actions";

const init: SocialState = {};

const NUM_FIELDS: [string, string][] = [
  ["reach", "Reach"],
  ["likes", "Likes"],
  ["comments", "Comments"],
  ["leadsGained", "Leads gained"],
];

export function AddInstagramForm({ slug, today }: { slug: string; today: string }) {
  const action = addInstagramPostAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ig-date">Date posted</Label>
          <Input id="ig-date" name="publishedAt" type="date" defaultValue={today} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ig-title">Caption / label</Label>
          <Input id="ig-title" name="title" placeholder="Reel: 3 cold-DM mistakes" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ig-url">Link (optional)</Label>
        <Input id="ig-url" name="url" placeholder="https://instagram.com/p/…" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {NUM_FIELDS.map(([k, label]) => (
          <div key={k} className="flex flex-col gap-1.5">
            <Label htmlFor={`ig-${k}`} className="text-xs text-muted-foreground">{label}</Label>
            <Input id={`ig-${k}`} name={k} type="number" min="0" defaultValue={0} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Adding…" : "Add post"}
        </Button>
        {state.ok && <span className="text-sm text-sage">Added.</span>}
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
