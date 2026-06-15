"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  getBookingForClient,
  resolveClientAccess,
  setBookingOutcome,
} from "@/lib/db/queries";
import type { BookingOutcome } from "@/lib/db/schema";

export async function logOutcomeAction(
  slug: string,
  bookingId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) return;
  const booking = await getBookingForClient(bookingId, client.id);
  if (!booking) return;

  const showedUp = formData.get("showedUp") === "yes";
  const closed = formData.get("closed") === "yes";
  const outcome: BookingOutcome = {
    showedUp,
    notes: formData.get("notes")?.toString() || undefined,
  };
  if (showedUp) {
    outcome.closed = closed;
    if (closed) outcome.dealValue = Math.max(0, Number(formData.get("dealValue")) || 0);
    else {
      outcome.reason = formData.get("reason")?.toString() || undefined;
      outcome.secondCall = formData.get("secondCall") === "on";
    }
  } else {
    outcome.reason = formData.get("noShowReason")?.toString() || undefined;
  }
  const status = showedUp ? "completed" : "no_show";
  await setBookingOutcome(bookingId, client.id, status, outcome);
  revalidatePath(`/${slug}/calendar/${bookingId}`);
  revalidatePath(`/${slug}/calendar`);
}
