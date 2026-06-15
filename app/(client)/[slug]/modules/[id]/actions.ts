"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  getModuleForClient,
  markModuleComplete,
  resolveClientAccess,
} from "@/lib/db/queries";

export async function markCompleteAction(
  slug: string,
  moduleId: string,
): Promise<void> {
  const session = await requireSession();
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) return;
  const mod = await getModuleForClient(moduleId, client.id);
  if (!mod) return;
  await markModuleComplete(session.userId, moduleId);
  revalidatePath(`/${slug}/modules/${moduleId}`);
  revalidatePath(`/${slug}/modules`);
}
