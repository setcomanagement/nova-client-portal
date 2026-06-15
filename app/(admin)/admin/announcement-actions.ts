"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { setActiveAnnouncement } from "@/lib/db/queries";

export interface AnnState {
  ok?: boolean;
}

export async function postAnnouncement(
  _prev: AnnState,
  formData: FormData,
): Promise<AnnState> {
  await requireAdmin();
  const message = (formData.get("message")?.toString() ?? "").trim();
  if (message) await setActiveAnnouncement(message);
  revalidatePath("/admin");
  return { ok: true };
}
