"use client";

import { useActionState } from "react";
import { setCommissionAction, type CommissionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const init: CommissionState = {};

export function CommissionForm({
  slug,
  pct,
}: {
  slug: string;
  pct: number; // current rate as a percentage, e.g. 5
}) {
  const action = setCommissionAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="commissionPct" className="text-sm font-medium">
          Setter commission (% of cash collected)
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="commissionPct"
            name="commissionPct"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={pct}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
      {state.ok && <span className="pb-2 text-sm text-sage">Saved.</span>}
      {state.error && (
        <span className="pb-2 text-sm text-destructive">{state.error}</span>
      )}
    </form>
  );
}
