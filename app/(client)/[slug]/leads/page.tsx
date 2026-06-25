import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { listBookings, listLeads, resolveClientAccess } from "@/lib/db/queries";

const EDITOR_ROLES = ["client", "manager", "admin", "super_admin"];

const STAGE: Record<string, string> = {
  new: "badge-neutral",
  booked: "badge-up",
  showed: "badge-up",
  closed: "badge-good",
  lost: "badge-bad",
};

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

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">NOVA · pipeline</p>
          <h1 className="mt-2 text-3xl font-semibold">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every booking ties to a lead.
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
      <Card className="px-2 py-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Calls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l) => (
              <TableRow key={l.id} className="clickable">
                <TableCell className="font-medium">
                  <Link href={`/${slug}/leads/${l.id}`} className="hover:underline">
                    {l.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{l.email}</TableCell>
                <TableCell>{l.source}</TableCell>
                <TableCell>
                  <span className={`badge ${STAGE[l.stage] ?? "badge-neutral"}`}>
                    {l.stage}
                  </span>
                </TableCell>
                <TableCell className="text-right num">{callCount(l.id)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
