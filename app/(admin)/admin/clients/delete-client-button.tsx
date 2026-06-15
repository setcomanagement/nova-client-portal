"use client";

import { deleteClientAction } from "./actions";
import { Button } from "@/components/ui/button";

/**
 * Destructive delete with a native confirm. Submits the server action only
 * after the admin confirms; cancelling prevents submission.
 */
export function DeleteClientButton({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  return (
    <form
      action={deleteClientAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete "${name}" and all of its members, recaps and modules? This cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" variant="destructive" size="sm">
        Delete
      </Button>
    </form>
  );
}
