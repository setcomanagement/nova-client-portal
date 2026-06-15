"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireIntegrationsAccess } from "@/lib/auth/session";
import { resolveClientAccess, setIntegrationStatus } from "@/lib/db/queries";
import type { IntegrationProvider, IntegrationStatus } from "@/lib/db/schema";

const PROVIDERS: IntegrationProvider[] = ["calendly", "discord", "notion", "google"];
const STATUSES: IntegrationStatus[] = ["connected", "disconnected", "coming_soon"];

/** Connect/disconnect a provider for a client (tenant- + role-guarded). */
export async function setIntegrationStatusAction(
  slug: string,
  provider: string,
  status: string,
): Promise<void> {
  const session = await requireIntegrationsAccess();
  if (!PROVIDERS.includes(provider as IntegrationProvider)) notFound();
  if (!STATUSES.includes(status as IntegrationStatus)) notFound();
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) notFound();
  await setIntegrationStatus(
    client.id,
    provider as IntegrationProvider,
    status as IntegrationStatus,
  );
  revalidatePath(`/${slug}/integrations`);
  revalidatePath(`/${slug}/settings`);
}
