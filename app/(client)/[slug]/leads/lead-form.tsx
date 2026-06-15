"use client";

import { useActionState } from "react";
import {
  createLeadAction,
  updateLeadAction,
  type LeadFormState,
} from "./actions";

const init: LeadFormState = {};
const field =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent";
const STAGES = ["new", "booked", "showed", "closed", "lost"];

export interface LeadFormValues {
  id?: string;
  name?: string;
  email?: string | null;
  source?: string | null;
  stage?: string;
  ownerUserId?: string | null;
  notes?: string | null;
}

export function LeadForm({
  slug,
  members,
  lead,
}: {
  slug: string;
  members: { id: string; name: string }[];
  lead?: LeadFormValues;
}) {
  const isEdit = Boolean(lead?.id);
  const action = isEdit
    ? updateLeadAction.bind(null, slug, lead!.id!)
    : createLeadAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Name</span>
          <input name="name" defaultValue={lead?.name ?? ""} placeholder="Lead name" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <input name="email" defaultValue={lead?.email ?? ""} placeholder="name@email.com" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Source</span>
          <input name="source" defaultValue={lead?.source ?? ""} placeholder="Webinar, IG DM, Referral…" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Stage</span>
          <select name="stage" defaultValue={lead?.stage ?? "new"} className={`${field} capitalize`}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Owner</span>
          <select name="ownerUserId" defaultValue={lead?.ownerUserId ?? ""} className={field}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <textarea name="notes" rows={3} defaultValue={lead?.notes ?? ""} placeholder="Context, qualifiers, reminders…" className={field} />
      </label>
      {state.error && (
        <p className="text-sm" style={{ color: "var(--clay)" }}>
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : isEdit ? "Save lead" : "Add lead"}
        </button>
      </div>
    </form>
  );
}
