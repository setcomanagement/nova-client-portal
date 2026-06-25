"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  getUserById,
  insertEod,
  resolveClientAccess,
  setClientCommissionPct,
} from "@/lib/db/queries";
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

export interface StatsEntryState {
  ok?: boolean;
  error?: string;
}

/**
 * Let a client/manager add a stats entry into the analytics, attributed to a
 * team member. Writes an eod_submissions row (same source the stats read from),
 * so it flows into both the combined view and that member's segregated view.
 */
export async function addStatsEntryAction(
  slug: string,
  _prev: StatsEntryState,
  formData: FormData,
): Promise<StatsEntryState> {
  const session = await requireSession();
  if (!MANAGERIAL.includes(session.role)) {
    return { error: "Only managers and clients can add statistics." };
  }
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) return { error: "Not authorised for this org." };

  // Attribution: the member the numbers belong to must be in this client.
  const setterUserId = formData.get("setterUserId")?.toString() ?? "";
  const member = setterUserId ? await getUserById(setterUserId) : null;
  if (!member || member.clientId !== client.id) {
    return { error: "Pick a team member in this organisation." };
  }

  const date = formData.get("submissionDate")?.toString() || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Enter a valid date." };
  }
  const i = (k: string) => Math.max(0, Math.round(Number(formData.get(k)) || 0));
  const money = (k: string) => Math.max(0, Number(formData.get(k)) || 0).toFixed(2);

  await insertEod({
    setterUserId: member.id,
    submissionDate: date,
    outbound: i("outbound"),
    followUps: i("followUps"),
    totalConvos: i("totalConvos"),
    callsPitched: i("callsPitched"),
    callsBooked: i("callsBooked"),
    qualifiedBooked: i("qualifiedBooked"),
    showUps: i("showUps"),
    closes: i("closes"),
    revenue: money("revenue"),
    cashCollected: money("cashCollected"),
    accuracyConfirmed: true,
  });
  revalidatePath(`/${slug}/statistics`);
  return { ok: true };
}
