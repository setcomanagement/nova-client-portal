"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { logOutcomeAction } from "./actions";
import type { BookingOutcome } from "@/lib/db/schema";

export function DispositionForm({
  slug,
  bookingId,
  current,
}: {
  slug: string;
  bookingId: string;
  current: BookingOutcome | null;
}) {
  const [showed, setShowed] = useState<boolean | null>(
    current?.showedUp ?? null,
  );
  const [closed, setClosed] = useState<boolean | null>(
    current?.closed ?? null,
  );

  return (
    <form action={logOutcomeAction.bind(null, slug, bookingId)} className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">Showed up?</Label>
        <div className="flex gap-2">
          {[["yes", "Yes", true], ["no", "No", false]].map(([v, l, b]) => (
            <label key={v as string} className="flex-1">
              <input
                type="radio"
                name="showedUp"
                value={v as string}
                defaultChecked={current?.showedUp === b}
                onChange={() => setShowed(b as boolean)}
                className="peer sr-only"
              />
              <span className="block cursor-pointer rounded-lg border border-rule bg-white py-2.5 text-center text-sm font-medium peer-checked:border-espresso peer-checked:bg-espresso peer-checked:text-cream">
                {l as string}
              </span>
            </label>
          ))}
        </div>
      </div>

      {showed === true && (
        <div className="border-l-2 border-rule pl-4">
          <Label className="mb-2 block">Closed?</Label>
          <div className="flex gap-2">
            {[["yes", "Yes", true], ["no", "No", false]].map(([v, l, b]) => (
              <label key={v as string} className="flex-1">
                <input
                  type="radio"
                  name="closed"
                  value={v as string}
                  defaultChecked={current?.closed === b}
                  onChange={() => setClosed(b as boolean)}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-lg border border-rule bg-white py-2.5 text-center text-sm font-medium peer-checked:border-sage peer-checked:bg-sage peer-checked:text-white">
                  {l as string}
                </span>
              </label>
            ))}
          </div>
          {closed === true && (
            <div className="mt-3">
              <Label htmlFor="dealValue">Deal value ($)</Label>
              <Input id="dealValue" name="dealValue" type="number" defaultValue={current?.dealValue ?? ""} placeholder="4000" />
            </div>
          )}
          {closed === false && (
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <Label htmlFor="reason">Reason no close</Label>
                <Select id="reason" name="reason" defaultValue={current?.reason ?? "Price"}>
                  <option>Price</option>
                  <option>Time</option>
                  <option>Already in another program</option>
                  <option>Not the right fit</option>
                  <option>Needs spousal approval</option>
                  <option>Wanted to think</option>
                  <option>Other</option>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="secondCall" defaultChecked={current?.secondCall} />
                Second call booked?
              </label>
            </div>
          )}
        </div>
      )}

      {showed === false && (
        <div className="border-l-2 border-rule pl-4">
          <Label htmlFor="noShowReason">Reason for no-show</Label>
          <Select id="noShowReason" name="noShowReason" defaultValue={current?.reason ?? "Forgot"}>
            <option>Forgot</option>
            <option>Rescheduled</option>
            <option>Ghosted</option>
            <option>Other</option>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={current?.notes ?? ""}
          className="flex w-full rounded-md border border-input bg-bone px-3 py-2 text-sm"
        />
      </div>

      <Button type="submit" variant="accent" disabled={showed === null} className="self-start">
        Save disposition
      </Button>
    </form>
  );
}
