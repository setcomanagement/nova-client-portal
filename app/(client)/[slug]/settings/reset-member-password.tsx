"use client";

import { useActionState, useState } from "react";
import { resetMemberPasswordAction, type ResetPwState } from "./actions";

const init: ResetPwState = {};

export function ResetMemberPassword({
  slug,
  memberId,
}: {
  slug: string;
  memberId: string;
}) {
  const [open, setOpen] = useState(false);
  const action = resetMemberPasswordAction.bind(null, slug, memberId);
  const [state, formAction, pending] = useActionState(action, init);

  if (state.ok) {
    return <span className="text-xs text-sage">Reset · they set a new one next login.</span>;
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-accent hover:underline"
      >
        Reset password
      </button>
    );
  }
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        type="text"
        name="temp"
        placeholder="temp password (8+)"
        className="h-8 w-40 rounded-md border border-border bg-bone px-2 text-xs outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "…" : "Set"}
      </button>
      {state.error && (
        <span className="text-xs" style={{ color: "var(--clay)" }}>
          {state.error}
        </span>
      )}
    </form>
  );
}
