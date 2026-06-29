import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { listBookings, listLeads, resolveClientAccess } from "@/lib/db/queries";
import { LeadsBoard, type BoardLead } from "./leads-board";

const EDITOR_ROLES = ["client", "manager", "admin", "super_admin"];

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireSession();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const canEdit = EDITOR_ROLES.includes(session.role);
  const [leads, bookings] = await Promise.all([
    listLeads(client.id),
    listBookings(client.id),
  ]);
  const callCount = (leadId: string) =>
    bookings.filter((b) => b.leadId === leadId).length;

  const boardLeads: BoardLead[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    source: l.source,
    stage: l.stage,
    pipelineStage: l.pipelineStage,
    leadType: l.leadType,
    calls: callCount(l.id),
  }));

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">NOVA · pipeline</p>
          <h1 className="mt-2 text-3xl font-semibold">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag leads through the sales conversation funnel.
          </p>
        </div>
        {canEdit && (
          <Link
            href={`/${slug}/leads/new`}
            className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            + Add lead
          </Link>
        )}
      </div>

      {boardLeads.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--rule)] bg-card/40 px-6 py-16 text-center text-sm text-muted-foreground">
          No leads yet. {canEdit && "Add one to start building the pipeline."}
        </div>
      ) : (
        <LeadsBoard slug={slug} leads={boardLeads} canEdit={canEdit} />
      )}
    </div>
  );
}
