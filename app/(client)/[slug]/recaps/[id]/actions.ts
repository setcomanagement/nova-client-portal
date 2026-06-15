"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  getRecapForClient,
  resolveClientAccess,
  updateRecapActionItems,
  type ActionItem,
} from "@/lib/db/queries";

/** Toggle one action item's done state, tenant-guarded by slug + session. */
export async function toggleRecapItem(
  slug: string,
  recapId: string,
  index: number,
  done: boolean,
): Promise<void> {
  const session = await requireSession();
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) return; // not authorised for this org — no-op

  const recap = await getRecapForClient(recapId, client.id);
  if (!recap) return;

  const items = [...((recap.actionItems ?? []) as ActionItem[])];
  if (!items[index]) return;
  items[index] = { ...items[index], done };
  await updateRecapActionItems(recapId, client.id, items);
  revalidatePath(`/${slug}/recaps/${recapId}`);
}
