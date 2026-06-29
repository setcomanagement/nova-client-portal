"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import {
  createLead,
  deleteLead,
  resolveClientAccess,
  setLeadPipelineStage,
  setLeadType,
  updateLead,
} from "@/lib/db/queries";
import { LEAD_TYPE_KEYS, PIPELINE_KEYS } from "./pipeline";

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
  const pipelineRaw = formData.get("pipelineStage")?.toString() ?? "cold";
  const pipelineStage = PIPELINE_KEYS.includes(pipelineRaw) ? pipelineRaw : "cold";
  const typeRaw = formData.get("leadType")?.toString() ?? "inbound";
  const leadType = LEAD_TYPE_KEYS.includes(typeRaw) ? typeRaw : "inbound";
  const ownerUserId = (formData.get("ownerUserId")?.toString() ?? "").trim() || null;
  const notes = (formData.get("notes")?.toString() ?? "").trim() || null;
  return { name, email, source, stage, pipelineStage, leadType, ownerUserId, notes };
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

export interface MoveResult {
  ok: boolean;
  error?: string;
}

/** Kanban drag — move a lead to a new conversation stage. */
export async function moveLeadStageAction(
  slug: string,
  id: string,
  pipelineStage: string,
): Promise<MoveResult> {
  const client = await requireEditableClient(slug);
  if (!PIPELINE_KEYS.includes(pipelineStage)) {
    return { ok: false, error: "Unknown stage." };
  }
  await setLeadPipelineStage(id, client.id, pipelineStage);
  revalidatePath(`/${slug}/leads`);
  return { ok: true };
}

/** Inline card toggle — switch a lead between inbound and outbound. */
export async function setLeadTypeAction(
  slug: string,
  id: string,
  leadType: string,
): Promise<MoveResult> {
  const client = await requireEditableClient(slug);
  if (!LEAD_TYPE_KEYS.includes(leadType)) {
    return { ok: false, error: "Unknown lead type." };
  }
  await setLeadType(id, client.id, leadType);
  revalidatePath(`/${slug}/leads`);
  return { ok: true };
}

export async function deleteLeadAction(slug: string, id: string): Promise<void> {
  const client = await requireEditableClient(slug);
  await deleteLead(id, client.id);
  revalidatePath(`/${slug}/leads`);
  redirect(`/${slug}/leads`);
}
