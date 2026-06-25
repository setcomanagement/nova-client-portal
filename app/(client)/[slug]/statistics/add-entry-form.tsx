"use client";

import { useActionState } from "react";
import { addStatsEntryAction, type StatsEntryState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const init: StatsEntryState = {};

const NUM_FIELDS: [string, string][] = [
  ["outbound", "Outreach"],
  ["totalConvos", "Conversations"],
  ["followUps", "Follow-ups"],
  ["callsPitched", "Calls pitched"],
  ["callsBooked", "Calls booked"],
  ["qualifiedBooked", "Qualified booked"],
  ["showUps", "Showed up"],
  ["closes", "Closes"],
];

export function AddEntryForm({
  slug,
  members,
  today,
}: {
  slug: string;
  members: { id: string; name: string }[];
  today: string;
}) {
  const action = addStatsEntryAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="setterUserId">Team member</Label>
          <Select id="setterUserId" name="setterUserId" defaultValue={members[0]?.id ?? ""}>
            {members.length === 0 && <option value="">No members</option>}
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entryDate">Date</Label>
          <Input id="entryDate" name="submissionDate" type="date" defaultValue={today} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {NUM_FIELDS.map(([k, label]) => (
          <div key={k} className="flex flex-col gap-1.5">
            <Label htmlFor={k} className="text-xs text-muted-foreground">{label}</Label>
            <Input id={k} name={k} type="number" min="0" defaultValue={0} />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cashCollected" className="text-xs text-muted-foreground">Cash collected ($)</Label>
          <Input id="cashCollected" name="cashCollected" type="number" min="0" step="0.01" defaultValue={0} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="revenue" className="text-xs text-muted-foreground">Revenue ($)</Label>
          <Input id="revenue" name="revenue" type="number" min="0" step="0.01" defaultValue={0} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="accent" disabled={pending || members.length === 0}>
          {pending ? "Adding..." : "Add to statistics"}
        </Button>
        {state.ok && <span className="text-sm text-sage">Added.</span>}
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
