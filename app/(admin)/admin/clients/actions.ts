"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import {
  createClient,
  createInvitedUser,
  deleteClientBySlug,
  emailExists,
  getClientBySlug,
} from "@/lib/db/queries";
import { slugify } from "@/lib/utils";
import { hashPassword } from "@/lib/auth/password";
import { buildInviteLink, inviteExpiry, newInviteToken } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().min(2, "Name is too short").max(80),
  slug: z.string().max(60).optional(),
  ownerName: z.string().min(2, "Owner name is too short").max(80),
  ownerEmail: z.string().email("Enter a valid owner email"),
  notionUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export interface ClientFormState {
  error?: string;
  ok?: boolean;
  slug?: string;
  clientName?: string;
  inviteLink?: string;
  emailed?: boolean;
  to?: string;
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireAdmin();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    notionUrl: formData.get("notionUrl") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) return { error: "Could not derive a slug from that name." };
  if (await getClientBySlug(slug))
    return { error: `A client with slug "${slug}" already exists.` };
  if (await emailExists(parsed.data.ownerEmail))
    return { error: "That owner email already has an account." };

  const client = await createClient({
    name: parsed.data.name,
    slug,
    notionUrl: parsed.data.notionUrl ? parsed.data.notionUrl : null,
  });

  // Create the owner login as an email invite — they set their own password.
  const token = newInviteToken();
  await createInvitedUser({
    email: parsed.data.ownerEmail,
    name: parsed.data.ownerName,
    role: "client",
    clientId: client.id,
    passwordHash: await hashPassword(newInviteToken()),
    inviteToken: token,
    inviteExpiresAt: inviteExpiry(),
  });
  const link = await buildInviteLink(token);
  const { sent } = await sendInviteEmail({
    to: parsed.data.ownerEmail,
    name: parsed.data.ownerName,
    orgName: client.name,
    link,
  });

  revalidatePath("/admin/clients");
  return {
    ok: true,
    slug,
    clientName: client.name,
    inviteLink: link,
    emailed: sent,
    to: parsed.data.ownerEmail,
  };
}

/**
 * Delete a client org and all of its members/recaps/modules (cascade).
 * Admin-only; destructive. Confirmed client-side before this runs.
 */
export async function deleteClientAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();
  if (slug) {
    await deleteClientBySlug(slug);
  }
  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}
