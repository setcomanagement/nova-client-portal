"use client";

import { useActionState } from "react";
import { addMemberAction, type MemberFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { InviteLink } from "@/components/invite-link";

const initialState: MemberFormState = {};

export function AddMemberForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(
    addMemberAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="m-name">Full name</Label>
        <Input id="m-name" name="name" required placeholder="Jordan Lee" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="m-email">Email</Label>
        <Input
          id="m-email"
          name="email"
          type="email"
          required
          placeholder="jordan@company.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="m-role">Role</Label>
        <Select id="m-role" name="role" defaultValue="sales_rep" required>
          <option value="client">Client (account owner)</option>
          <option value="manager">Manager (sales-team manager)</option>
          <option value="sales_rep">Sales rep</option>
          <option value="team_member">Team member</option>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        They&apos;ll get an email (or you share the link) to set their own password — no temporary password needed.
      </p>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-accent" role="status">
          {state.success}
        </p>
      )}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Inviting..." : "Invite member"}
      </Button>
      {state.inviteLink && (
        <InviteLink link={state.inviteLink} emailed={!!state.emailed} to={state.to ?? ""} />
      )}
    </form>
  );
}
