"use client";

import { useActionState } from "react";
import { setMilestonesAction, type MilestoneState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const init: MilestoneState = {};

export function SetMilestonesForm({
  slug,
  targets,
}: {
  slug: string;
  targets: Record<string, number>;
}) {
  const action = setMilestonesAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);
  const fields: [string, string][] = [
    ["callsBooked", "Calls booked"],
    ["showUps", "Show-ups"],
    ["closes", "Closes"],
    ["cash", "Cash ($)"],
  ];
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {fields.map(([k, label]) => (
        <div key={k} className="flex flex-col gap-1.5">
          <Label htmlFor={k}>{label}</Label>
          <Input id={k} name={k} type="number" defaultValue={targets[k] ?? 0} />
        </div>
      ))}
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving..." : "Save milestones"}
        </Button>
        {state.ok && <span className="text-sm text-sage">Saved.</span>}
        {state.error && (
          <span className="text-sm text-destructive">{state.error}</span>
        )}
      </div>
    </form>
  );
}
