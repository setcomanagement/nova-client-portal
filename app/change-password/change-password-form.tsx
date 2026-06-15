"use client";

import { useActionState } from "react";
import { setNewPasswordAction, type ChangePwState } from "./actions";

const init: ChangePwState = {};
const field =
  "w-full rounded-lg border border-border bg-bone px-3 py-2 text-sm outline-none focus:border-accent";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(setNewPasswordAction, init);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">New password</span>
        <input type="password" name="password" autoComplete="new-password" placeholder="At least 8 characters" className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Confirm new password</span>
        <input type="password" name="confirm" autoComplete="new-password" placeholder="Repeat it" className={field} />
      </label>
      {state.error && (
        <p className="text-sm" style={{ color: "var(--clay)" }}>
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set password & continue"}
      </button>
    </form>
  );
}
