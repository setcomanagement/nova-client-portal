"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import {
  createInvitedUser,
  emailExists,
  getClientBySlug,
} from "@/lib/db/queries";
import { hashPassword } from "@/lib/auth/password";
import { buildInviteLink, inviteExpiry, newInviteToken } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";

const schema = z.object({
  slug: z.string().min(1),
  name: z.string().min(2, "Name is too short").max(80),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["client", "manager", "sales_rep", "team_member"]),
});

export interface MemberFormState {
  error?: string;
  success?: string;
  inviteLink?: string;
  emailed?: boolean;
  to?: string;
}

export async function addMemberAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  await requireAdmin();

  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const client = await getClientBySlug(parsed.data.slug);
  if (!client) {
    return { error: "Client not found." };
  }
  if (await emailExists(parsed.data.email)) {
    return { error: "A user with that email already exists." };
  }

  const token = newInviteToken();
  await createInvitedUser({
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    clientId: client.id,
    passwordHash: await hashPassword(newInviteToken()),
    inviteToken: token,
    inviteExpiresAt: inviteExpiry(),
  });
  const link = await buildInviteLink(token);
  const { sent } = await sendInviteEmail({
    to: parsed.data.email,
    name: parsed.data.name,
    orgName: client.name,
    link,
  });

  revalidatePath(`/admin/clients/${client.slug}`);
  return {
    success: `Invited ${parsed.data.name}.`,
    inviteLink: link,
    emailed: sent,
    to: parsed.data.email,
  };
}
