import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  createLead,
  findActiveTrackedEventByUri,
  findLeadByEmail,
  getIntegrationById,
  recordWebhookEvent,
  upsertCalendlyBooking,
  webhookEventSeen,
} from "@/lib/db/queries";
import type { CalendlyAnswer } from "@/lib/db/schema";

export const runtime = "nodejs";

/**
 * Calendly webhook receiver. Verifies the HMAC signature, dedupes redeliveries,
 * and ONLY writes bookings for event types present in calendly_tracked_events
 * (active) — the tracked-event lookup is also how we route the org-scoped
 * webhook to the right NOVA client.
 */
function verifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  // Header format: "t=<ts>,v1=<hmac>"
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=").map((s) => s.trim()) as [string, string]),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

interface CalendlyWebhookBody {
  event: string; // invitee.created | invitee.canceled
  payload: {
    uri: string;
    email?: string;
    name?: string;
    status?: string;
    no_show?: { uri: string } | null;
    questions_and_answers?: { question: string; answer: string }[];
    scheduled_event?: {
      uri: string;
      name?: string | null;
      status?: string;
      start_time: string;
      event_type?: string;
      location?: { join_url?: string; location?: string } | null;
    };
  };
}

export async function POST(req: Request) {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("calendly-webhook-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: CalendlyWebhookBody;
  try {
    body = JSON.parse(raw) as CalendlyWebhookBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const inv = body.payload;
  const ev = inv?.scheduled_event;
  if (!ev?.event_type || !inv?.uri) return NextResponse.json({ ok: true, skipped: "incomplete" });

  // Route + gate: only tracked event types create bookings.
  const tracked = await findActiveTrackedEventByUri(ev.event_type);
  if (!tracked) return NextResponse.json({ ok: true, skipped: "not_tracked" });
  const integration = await getIntegrationById(tracked.integrationId);
  if (!integration) return NextResponse.json({ ok: true, skipped: "no_integration" });
  const clientId = integration.clientId;

  // Idempotency — dedupe redeliveries of the same invitee event.
  const eventId = `${body.event}:${inv.uri}`;
  if (await webhookEventSeen(eventId)) return NextResponse.json({ ok: true, deduped: true });
  await recordWebhookEvent("calendly", eventId);

  const past = new Date(ev.start_time).getTime() < Date.now();
  const canceled = body.event === "invitee.canceled" || ev.status === "canceled" || inv.status === "canceled";
  const status = canceled ? "canceled" : inv.no_show ? "no_show" : past ? "completed" : "scheduled";
  const answers: CalendlyAnswer[] = (inv.questions_and_answers ?? [])
    .filter((qa) => qa.answer)
    .map((qa) => ({ q: qa.question, a: qa.answer }));

  // Only SALES calls become leads; client calls / others are bookings only.
  let leadId: string | null = null;
  if (tracked.category === "sales_call" && inv.email) {
    const existing = await findLeadByEmail(clientId, inv.email);
    if (existing) leadId = existing.id;
    else {
      const lead = await createLead(clientId, {
        name: inv.name || inv.email,
        email: inv.email,
        source: "Calendly",
        stage: status === "completed" ? "showed" : canceled ? "lost" : "booked",
      });
      leadId = lead.id;
    }
  }

  await upsertCalendlyBooking({
    clientId,
    leadId,
    calendlyEventUri: ev.uri,
    calendlyInviteeUri: inv.uri,
    callType: ev.name ?? tracked.name,
    scheduledAt: new Date(ev.start_time),
    status,
    meetingUrl: ev.location?.join_url ?? ev.location?.location ?? null,
    calendlyAnswers: answers,
    inviteeName: inv.name ?? null,
    inviteeEmail: inv.email ?? null,
  });

  return NextResponse.json({ ok: true });
}
