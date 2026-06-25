import { notFound } from "next/navigation";
import { requireIntegrationsAccess } from "@/lib/auth/session";
import { listBookings, listIntegrations, resolveClientAccess } from "@/lib/db/queries";
import type { IntegrationStatus } from "@/lib/db/schema";
import { calendlyConfigured } from "@/lib/calendly";
import { IntegrationCard, type ProviderMeta } from "./integration-card";
import { CalendlyCard } from "./calendly-card";

// Discord/Notion stay simple "coming soon" toggles; Calendly is the real OAuth card.
const COMING: ProviderMeta[] = [
  {
    provider: "discord",
    name: "Discord",
    blurb: "Booking + recap alerts to your server.",
    glyph: "D",
    glyphColor: "#5865F2",
  },
  {
    provider: "notion",
    name: "Notion",
    blurb: "Push recaps to a Notion database.",
    glyph: "N",
    glyphColor: "#111111",
  },
];

function fmt(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function IntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ calendly?: string }>;
}) {
  const { slug } = await params;
  const { calendly: notice } = await searchParams;
  const session = await requireIntegrationsAccess();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const [rows, bookings] = await Promise.all([
    listIntegrations(client.id),
    listBookings(client.id),
  ]);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const cal = byProvider.get("calendly");
  const calBookings = bookings.filter((b) => b.calendlyInviteeUri).length;
  // Dev-only preview mode: render the management modal without a live connection.
  const mock = process.env.CALENDLY_MOCK === "1";

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="eyebrow">NOVA · integrations</p>
        <h1 className="mt-2 text-3xl font-semibold">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect the tools your calls run on.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <CalendlyCard
          slug={slug}
          connected={mock || cal?.status === "connected"}
          configured={mock || calendlyConfigured()}
          connectedAt={mock ? "preview" : fmt(cal?.connectedAt ?? null)}
          bookingCount={calBookings}
          notice={notice ?? null}
        />
        {COMING.map((meta) => {
          const row = byProvider.get(meta.provider);
          const status = (row?.status ?? "disconnected") as IntegrationStatus;
          return (
            <IntegrationCard
              key={meta.provider}
              slug={slug}
              meta={meta}
              status={status}
              connectedAt={fmt(row?.connectedAt ?? null)}
            />
          );
        })}
      </div>
    </div>
  );
}
