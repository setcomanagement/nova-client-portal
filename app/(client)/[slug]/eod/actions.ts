"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { insertEod } from "@/lib/db/queries";

export async function submitEod(slug: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  // Only the setter themselves logs an EOD, scoped to their own org.
  if (session.role !== "sales_rep" || !session.clientId) {
    redirect("/home");
  }
  const i = (k: string) => Math.max(0, Math.round(Number(formData.get(k)) || 0));
  const s = (k: string) => (formData.get(k)?.toString() ?? "").trim() || null;
  const today = new Date().toISOString().slice(0, 10);

  await insertEod({
    setterUserId: session.userId,
    submissionDate: (formData.get("submissionDate")?.toString() || today),
    outbound: i("outbound"),
    inbound: i("inbound"),
    followUps: i("followUps"),
    totalConvos: i("totalConvos"),
    callsPitched: i("callsPitched"),
    callsBooked: i("callsBooked"),
    qualifiedBooked: i("qualifiedBooked"),
    callsDeclined: i("callsDeclined"),
    showUps: i("showUps"),
    closes: i("closes"),
    revenue: String(i("revenue")),
    cashCollected: String(i("cashCollected")),
    performanceRating: i("performanceRating") || null,
    skillRating: i("skillRating") || null,
    wentWell: s("wentWell"),
    goneBetter: s("goneBetter"),
    tomorrowDifferent: s("tomorrowDifferent"),
    leadQuality: s("leadQuality"),
    bottleneck: s("bottleneck"),
    topObjection: s("topObjection"),
    objectionOther: s("objectionOther"),
    missedAnything: s("missedAnything"),
    managerRequest: s("managerRequest"),
    accuracyConfirmed: formData.get("accuracyConfirmed") === "on",
  });

  redirect(`/${slug}/rep?logged=1`);
}
