"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { resolveClientAccess, setClientCommissionPct } from "@/lib/db/queries";
import type { UserRole } from "@/lib/auth/jwt";

const MANAGERIAL: UserRole[] = ["client", "manager", "admin", "super_admin"];

export interface CommissionState {
  ok?: boolean;
  error?: string;
}

/** Set the appointment-setter commission rate (entered as a %). Managerial only. */
export async function setCommissionAction(
  slug: string,
  _prev: CommissionState,
  formData: FormData,
): Promise<CommissionState> {
  const session = await requireSession();
  if (!MANAGERIAL.includes(session.role)) {
    return { error: "Only managers and clients can change the commission rate." };
  }
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) return { error: "Not authorised for this org." };

  const pctInput = Number(formData.get("commissionPct"));
  if (!Number.isFinite(pctInput) || pctInput < 0 || pctInput > 100) {
    return { error: "Enter a commission between 0 and 100." };
  }
  // The form collects a percentage (e.g. 5); we store the fraction (0.05).
  await setClientCommissionPct(client.id, pctInput / 100);
  revalidatePath(`/${slug}/statistics`);
  return { ok: true };
}
