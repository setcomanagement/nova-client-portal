"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const init: ChangePasswordState = {};
const field =
  "w-full rounded-lg border border-border bg-bone px-3 py-2 text-sm outline-none focus:border-accent";

export function ChangePasswordForm({ slug }: { slug: string }) {
  const action = changePasswordAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);
  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Current password</span>
        <input type="password" name="current" autoComplete="current-password" className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">New password</span>
          <input type="password" name="password" autoComplete="new-password" placeholder="8+ characters" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Confirm</span>
          <input type="password" name="confirm" autoComplete="new-password" className={field} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Change password"}
        </button>
        {state.ok && <span className="text-sm text-sage">Password updated.</span>}
        {state.error && (
          <span className="text-sm" style={{ color: "var(--clay)" }}>
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
