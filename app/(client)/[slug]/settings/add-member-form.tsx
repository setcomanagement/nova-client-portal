"use client";

import { useActionState } from "react";
import { addMemberAction, type AddMemberState } from "./actions";
import { InviteLink } from "@/components/invite-link";

const init: AddMemberState = {};
const field =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent";

export function AddMemberForm({ slug }: { slug: string }) {
  const action = addMemberAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Full name</span>
          <input name="name" placeholder="Jordan Lee" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Email (they set their own password)</span>
          <input name="email" type="email" placeholder="jordan@org.co" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          <select name="role" defaultValue="sales_rep" className={field}>
            <option value="sales_rep">Setter</option>
            <option value="manager">Manager</option>
            <option value="team_member">Team member</option>
            <option value="client">Client owner</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending invite…" : "+ Invite member"}
        </button>
        {state.error && (
          <span className="text-sm" style={{ color: "var(--clay)" }}>
            {state.error}
          </span>
        )}
      </div>
      {state.ok && state.inviteLink && (
        <InviteLink link={state.inviteLink} emailed={!!state.emailed} to={state.to ?? ""} />
      )}
    </form>
  );
}
