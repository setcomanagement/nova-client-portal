"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import {
  createRecapJob,
  deleteRecapJob,
  setRecapJobStatus,
} from "@/lib/db/queries";

export interface RecapJobState {
  error?: string;
  ok?: boolean;
}

export async function createRecapJobAction(
  _prev: RecapJobState,
  formData: FormData,
): Promise<RecapJobState> {
  const session = await requireAdmin();
  const clientId = formData.get("clientId")?.toString() ?? "";
  const fathomRef = (formData.get("fathomRef")?.toString() ?? "").trim();
  const note = (formData.get("note")?.toString() ?? "").trim() || null;
  if (!clientId) return { error: "Pick a client." };
  if (!fathomRef) return { error: "Paste the Fathom link / call id (or 'my last call with …')." };
  await createRecapJob({
    clientId,
    fathomRef,
    note,
    requestedByUserId: session.userId,
  });
  revalidatePath("/admin/recaps");
  return { ok: true };
}

export async function markRecapJobDoneAction(id: string): Promise<void> {
  await requireAdmin();
  await setRecapJobStatus(id, "done");
  revalidatePath("/admin/recaps");
}

export async function reopenRecapJobAction(id: string): Promise<void> {
  await requireAdmin();
  await setRecapJobStatus(id, "pending");
  revalidatePath("/admin/recaps");
}

export async function deleteRecapJobAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteRecapJob(id);
  revalidatePath("/admin/recaps");
}
