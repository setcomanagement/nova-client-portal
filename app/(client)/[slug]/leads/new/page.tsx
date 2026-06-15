import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { getClientBySlug, listClientMembers } from "@/lib/db/queries";
import { LeadForm } from "../lead-form";

const EDITOR_ROLES = ["client", "manager", "admin", "super_admin"];

export default async function NewLeadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireSession();
  if (!EDITOR_ROLES.includes(session.role)) notFound();
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const members = await listClientMembers(client.id);

  return (
    <div className="flex max-w-2xl flex-col gap-7">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${slug}/leads`} className="text-accent hover:underline">
          Leads
        </Link>{" "}
        · New
      </div>
      <div>
        <p className="eyebrow">NOVA · pipeline</p>
        <h1 className="mt-2 text-3xl font-semibold">Add a lead</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture a lead manually — bookings will tie back to it.
        </p>
      </div>
      <Card className="p-6">
        <LeadForm
          slug={slug}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
        />
      </Card>
    </div>
  );
}
