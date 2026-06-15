"use client";

import { useTransition } from "react";
import { deleteLeadAction } from "../actions";

export function DeleteLeadButton({
  slug,
  id,
  name,
}: {
  slug: string;
  id: string;
  name: string;
}) {
  const [pending, start] = useTransition();
  function remove() {
    if (!confirm(`Delete lead "${name}"? This can't be undone.`)) return;
    start(async () => {
      await deleteLeadAction(slug, id);
    });
  }
  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="text-sm font-medium text-muted-foreground transition hover:text-[color:var(--clay)] disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete lead"}
    </button>
  );
}
