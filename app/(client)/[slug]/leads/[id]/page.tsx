import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import {
  getLeadForClient,
  listBookingsForLead,
  listClientMembers,
  resolveClientAccess,
} from "@/lib/db/queries";
import type { BookingOutcome } from "@/lib/db/schema";
import { isUuid } from "@/lib/utils";
import { LeadForm } from "../lead-form";
import { DeleteLeadButton } from "./delete-lead-button";

const EDITOR_ROLES = ["client", "manager", "admin", "super_admin"];

export default async function LeadDetail({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  if (!isUuid(id)) notFound();
  const session = await requireSession();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const lead = await getLeadForClient(id, client.id);
  if (!lead) notFound();
  const canEdit = EDITOR_ROLES.includes(session.role);
  const [bookings, members] = await Promise.all([
    listBookingsForLead(lead.id, client.id),
    canEdit ? listClientMembers(client.id) : Promise.resolve([]),
  ]);
  const owner = members.find((m) => m.id === lead.ownerUserId);

  // Build a timeline from bookings + their outcomes (newest first).
  const events: { when: Date; what: string; meta?: string }[] = [];
  for (const b of bookings) {
    const o = (b.outcome ?? null) as BookingOutcome | null;
    const when = new Date(b.scheduledAt);
    if (b.status === "completed" && o?.closed) {
      events.push({ when, what: `Closed — deal $${(o.dealValue ?? 0).toLocaleString()}`, meta: o.notes });
    } else if (b.status === "completed") {
      events.push({ when, what: "Showed up · no close", meta: o?.reason ? `Reason: ${o.reason}${o?.secondCall ? " · second call booked" : ""}` : undefined });
    } else if (b.status === "no_show") {
      events.push({ when, what: "No-show", meta: o?.reason });
    } else {
      events.push({ when, what: `${b.callType ?? "Call"} booked`, meta: "via Calendly" });
    }
  }
  events.push({ when: new Date(lead.createdAt), what: "Lead created", meta: `Source: ${lead.source ?? "—"}` });
  const deal = bookings
    .map((b) => (b.outcome as BookingOutcome | null)?.dealValue ?? 0)
    .reduce((a, c) => Math.max(a, c), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${slug}/leads`} className="text-accent hover:underline">
          Leads
        </Link>{" "}
        · {lead.name}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">NOVA · lead</p>
          <h1 className="mt-2 text-3xl font-semibold">{lead.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.email} · {lead.source} · {lead.stage}
            {deal ? ` · $${deal.toLocaleString()}` : ""}
          </p>
        </div>
        {canEdit && <DeleteLeadButton slug={slug} id={lead.id} name={lead.name} />}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <h3 className="mb-5 font-sans text-[15px] font-semibold">This lead&apos;s history</h3>
          <ol className="relative ml-1 border-l-2 border-[color:var(--rule)] pl-6">
            {events.map((e, i) => (
              <li key={i} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-card bg-accent" />
                <div className="text-xs text-muted-foreground">
                  {e.when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div className="font-serif font-semibold">{e.what}</div>
                {e.meta && <div className="mt-0.5 text-sm text-muted-foreground">{e.meta}</div>}
              </li>
            ))}
          </ol>
        </Card>
        <Card className="h-fit p-6">
          <h4 className="eyebrow mb-3 block">Lead</h4>
          <div className="flex flex-col text-sm">
            <Row k="Stage" v={lead.stage} />
            <Row k="Owner" v={owner?.name ?? "Unassigned"} />
            <Row k="Bookings" v={String(bookings.length)} />
            <Row k="Deal value" v={deal ? `$${deal.toLocaleString()}` : "—"} />
          </div>
          {lead.notes && (
            <>
              <h4 className="eyebrow mb-2 mt-5 block">Notes</h4>
              <p className="text-sm text-muted-foreground">{lead.notes}</p>
            </>
          )}
        </Card>
      </div>

      {canEdit && (
        <Card className="p-6">
          <h3 className="mb-5 font-sans text-[15px] font-semibold">Edit lead</h3>
          <LeadForm
            slug={slug}
            members={members.map((m) => ({ id: m.id, name: m.name }))}
            lead={{
              id: lead.id,
              name: lead.name,
              email: lead.email,
              source: lead.source,
              stage: lead.stage,
              ownerUserId: lead.ownerUserId,
              notes: lead.notes,
            }}
          />
        </Card>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-[color:var(--line)] py-2 capitalize last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
