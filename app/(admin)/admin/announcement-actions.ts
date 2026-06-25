"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { clearActiveAnnouncement, setActiveAnnouncement } from "@/lib/db/queries";

export interface AnnState {
  ok?: boolean;
  cleared?: boolean;
}

export async function postAnnouncement(
  _prev: AnnState,
  formData: FormData,
): Promise<AnnState> {
  await requireAdmin();
  const message = (formData.get("message")?.toString() ?? "").trim();
  // Empty message is an explicit "take the banner down", not a no-op.
  if (message) {
    await setActiveAnnouncement(message);
  } else {
    await clearActiveAnnouncement();
  }
  revalidatePath("/admin");
  return { ok: true, cleared: !message };
}
