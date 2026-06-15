"use client";

import { useActionState } from "react";
import { sendFeedbackAction, type FeedbackState } from "./actions";

const init: FeedbackState = {};

export function FeedbackForm({ slug }: { slug: string }) {
  const action = sendFeedbackAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, init);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="message"
        rows={3}
        placeholder="Tell us what's slowing you down or what you'd change…"
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send feedback"}
        </button>
        {state.ok && <span className="text-sm text-sage">Thanks — sent to the NOVA team.</span>}
        {state.error && (
          <span className="text-sm" style={{ color: "var(--clay)" }}>
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
