"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { resolveClientAccess, setWeeklyTargets } from "@/lib/db/queries";
import type { UserRole } from "@/lib/auth/jwt";

const MANAGERIAL: UserRole[] = ["client", "manager", "admin", "super_admin"];

export interface MilestoneState {
  ok?: boolean;
  error?: string;
}

/** Set this week's KPI targets. Managerial roles only. */
export async function setMilestonesAction(
  slug: string,
  _prev: MilestoneState,
  formData: FormData,
): Promise<MilestoneState> {
  const session = await requireSession();
  if (!MANAGERIAL.includes(session.role)) {
    return { error: "Only managers and clients can set milestones." };
  }
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) return { error: "Not authorised for this org." };

  const num = (k: string) => Math.max(0, Math.round(Number(formData.get(k)) || 0));
  await setWeeklyTargets(client.id, {
    callsBooked: num("callsBooked"),
    showUps: num("showUps"),
    closes: num("closes"),
    cash: num("cash"),
  });
  revalidatePath(`/${slug}/milestones`);
  return { ok: true };
}
