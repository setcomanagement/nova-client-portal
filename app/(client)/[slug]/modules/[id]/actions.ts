"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  getGlobalModuleById,
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
  // Modules are a single GLOBAL catalog (clientId IS NULL), so validate against
  // the global lookup — getModuleForClient would never match and the completion
  // would silently never persist.
  const mod = await getGlobalModuleById(moduleId);
  if (!mod) return;
  await markModuleComplete(session.userId, moduleId);
  revalidatePath(`/${slug}/modules/${moduleId}`);
  revalidatePath(`/${slug}/modules`);
}
