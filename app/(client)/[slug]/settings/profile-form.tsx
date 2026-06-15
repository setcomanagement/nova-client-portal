"use client";

import { useActionState } from "react";
import { saveProfileAction, type ProfileState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const TZS: [string, string][] = [
  ["PT", "(GMT-08:00) Pacific — PT"],
  ["MT", "(GMT-07:00) Mountain — MT"],
  ["CT", "(GMT-06:00) Central — CT"],
  ["ET", "(GMT-05:00) Eastern — ET"],
  ["GMT", "(GMT+00:00) London — GMT"],
  ["CET", "(GMT+01:00) Central Europe — CET"],
  ["SGT", "(GMT+08:00) Singapore — SGT"],
  ["AET", "(GMT+10:00) Sydney — AET"],
];

const init: ProfileState = {};

export function ProfileForm({
  slug,
  name,
  email,
  role,
  org,
  timezone,
}: {
  slug: string;
  name: string;
  email: string;
  role: string;
  org: string;
  timezone: string | null;
}) {
  const action = saveProfileAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" defaultValue={name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" defaultValue={email} disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Role</Label>
        <Input defaultValue={role} disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Business / organisation</Label>
        <Input defaultValue={org} disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timezone">Timezone — call times show in this zone</Label>
        <Select id="timezone" name="timezone" defaultValue={timezone ?? "PT"}>
          {TZS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-end gap-3">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving..." : "Save profile"}
        </Button>
        {state.ok && <span className="text-sm text-sage">Saved.</span>}
      </div>
    </form>
  );
}
