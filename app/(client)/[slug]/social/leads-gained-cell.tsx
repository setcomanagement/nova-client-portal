"use client";

import { useActionState, useRef } from "react";
import { setLeadsGainedAction, type SocialState } from "./actions";

const init: SocialState = {};

/** Inline editable "leads gained" — submits on blur when the value changed. */
export function LeadsGainedCell({
  slug,
  contentId,
  value,
  editable,
}: {
  slug: string;
  contentId: string;
  value: number;
  editable: boolean;
}) {
  const action = setLeadsGainedAction.bind(null, slug);
  const [, formAction, pending] = useActionState(action, init);
  const formRef = useRef<HTMLFormElement>(null);

  if (!editable) return <span className="num">{value}</span>;

  return (
    <form action={formAction} ref={formRef} className="inline-flex">
      <input type="hidden" name="contentId" value={contentId} />
      <input
        name="leadsGained"
        type="number"
        min="0"
        defaultValue={value}
        disabled={pending}
        onBlur={(e) => {
          if (Number(e.target.value) !== value) formRef.current?.requestSubmit();
        }}
        className="w-16 rounded-md border border-border bg-card px-2 py-1 text-sm tabular-nums focus:border-accent focus:outline-none"
      />
    </form>
  );
}
