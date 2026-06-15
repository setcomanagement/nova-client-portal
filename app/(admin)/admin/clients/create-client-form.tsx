"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createClientAction, type ClientFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteLink } from "@/components/invite-link";

const initialState: ClientFormState = {};

export function CreateClientForm() {
  const [state, formAction, pending] = useActionState(
    createClientAction,
    initialState,
  );

  if (state.ok && state.inviteLink) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-accent">
          {state.clientName} created with owner {state.to}.
        </p>
        <InviteLink link={state.inviteLink} emailed={!!state.emailed} to={state.to ?? ""} />
        <div className="flex gap-3">
          <Link
            href={`/admin/clients/${state.slug}`}
            className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            Open {state.clientName} →
          </Link>
          <Link
            href="/admin/clients"
            className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary"
          >
            All clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Client / business name</Label>
        <Input id="name" name="name" required placeholder="Akira" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Slug (optional)</Label>
        <Input id="slug" name="slug" placeholder="akira" />
        <p className="text-xs text-muted-foreground">
          Leave blank to derive from the name. Used in the URL: /slug/dashboard
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ownerName">Owner name</Label>
          <Input id="ownerName" name="ownerName" required placeholder="Jordan Lee" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ownerEmail">Owner email</Label>
          <Input id="ownerEmail" name="ownerEmail" type="email" required placeholder="jordan@akira.co" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        The owner gets an invite to set their own password — no temporary password needed.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notionUrl">Notion URL (optional)</Label>
        <Input id="notionUrl" name="notionUrl" type="url" placeholder="https://notion.so/..." />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Creating..." : "Create client + invite owner"}
      </Button>
    </form>
  );
}
