import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import {
  getBookingForClient,
  getLeadForClient,
  resolveClientAccess,
} from "@/lib/db/queries";
import type { BookingOutcome, CalendlyAnswer } from "@/lib/db/schema";
import { isUuid } from "@/lib/utils";
import { DispositionForm } from "./disposition-form";

export default async function BookingDetail({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  if (!isUuid(id)) notFound();
  const session = await requireSession();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const booking = await getBookingForClient(id, client.id);
  if (!booking) notFound();
  const lead = booking.leadId ? await getLeadForClient(booking.leadId, client.id) : null;

  const answers = (booking.calendlyAnswers ?? []) as CalendlyAnswer[];
  const outcome = (booking.outcome ?? null) as BookingOutcome | null;
  const when = new Date(booking.scheduledAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${slug}/calendar`} className="text-accent hover:underline">
          Calendar
        </Link>{" "}
        · {lead?.name ?? "Booking"}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">NOVA · booking</p>
          <h1 className="mt-2 text-3xl font-semibold">{lead?.name ?? "Booking"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.callType ?? "Call"} ·{" "}
            {when.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · via
            Calendly
          </p>
        </div>
        {booking.meetingUrl && (
          <a
            href={booking.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "accent" })}
          >
            Join Meet
          </a>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-sans text-[15px] font-semibold">
                Booking form · Calendly answers
              </h3>
              <span className="badge badge-up">{answers.length} responses</span>
            </div>
            {answers.length ? (
              <div className="divide-y divide-[color:var(--line)]">
                {answers.map((qa, i) => (
                  <div key={i} className="flex justify-between gap-6 py-2.5 text-sm">
                    <span className="max-w-[55%] text-muted-foreground">{qa.q}</span>
                    <span className="max-w-[45%] text-right font-medium">{qa.a}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No intake answers captured for this booking.
              </p>
            )}
          </Card>
          <Card className="p-6">
            <h3 className="mb-4 font-sans text-[15px] font-semibold">
              {outcome ? "Update outcome" : "Log outcome"}
            </h3>
            <DispositionForm slug={slug} bookingId={booking.id} current={outcome} />
          </Card>
        </div>

        <Card className="h-fit p-6">
          <h4 className="eyebrow mb-3 block">Lead context</h4>
          <div className="flex flex-col text-sm">
            <Row k="Email" v={lead?.email ?? "—"} />
            <Row k="Source" v={lead?.source ?? "—"} />
            <Row k="Stage" v={lead?.stage ?? "—"} />
            <Row k="Status" v={booking.status} />
          </div>
          {lead && (
            <Link
              href={`/${slug}/leads/${lead.id}`}
              className="mt-4 block w-full text-center text-sm font-medium text-accent hover:underline"
            >
              Full lead history →
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-[color:var(--line)] py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium capitalize">{v}</span>
    </div>
  );
}
