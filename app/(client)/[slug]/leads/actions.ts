"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import {
  createLead,
  deleteLead,
  resolveClientAccess,
  updateLead,
} from "@/lib/db/queries";

const EDITOR_ROLES = ["client", "manager", "admin", "super_admin"];
const STAGES = ["new", "booked", "showed", "closed", "lost"];

async function requireEditableClient(slug: string) {
  const session = await requireSession();
  if (!EDITOR_ROLES.includes(session.role)) notFound();
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) notFound();
  return client;
}

function parseLead(formData: FormData) {
  const name = (formData.get("name")?.toString() ?? "").trim();
  const email = (formData.get("email")?.toString() ?? "").trim() || null;
  const source = (formData.get("source")?.toString() ?? "").trim() || null;
  const stageRaw = formData.get("stage")?.toString() ?? "new";
  const stage = STAGES.includes(stageRaw) ? stageRaw : "new";
  const ownerUserId = (formData.get("ownerUserId")?.toString() ?? "").trim() || null;
  const notes = (formData.get("notes")?.toString() ?? "").trim() || null;
  return { name, email, source, stage, ownerUserId, notes };
}

export interface LeadFormState {
  error?: string;
}

export async function createLeadAction(
  slug: string,
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const client = await requireEditableClient(slug);
  const input = parseLead(formData);
  if (!input.name) return { error: "Lead name is required." };
  await createLead(client.id, input);
  revalidatePath(`/${slug}/leads`);
  redirect(`/${slug}/leads`);
}

export async function updateLeadAction(
  slug: string,
  id: string,
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const client = await requireEditableClient(slug);
  const input = parseLead(formData);
  if (!input.name) return { error: "Lead name is required." };
  await updateLead(id, client.id, input);
  revalidatePath(`/${slug}/leads`);
  revalidatePath(`/${slug}/leads/${id}`);
  redirect(`/${slug}/leads/${id}`);
}

export async function deleteLeadAction(slug: string, id: string): Promise<void> {
  const client = await requireEditableClient(slug);
  await deleteLead(id, client.id);
  revalidatePath(`/${slug}/leads`);
  redirect(`/${slug}/leads`);
}
