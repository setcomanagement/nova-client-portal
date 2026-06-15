"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import {
  createModule,
  deleteModule,
  getModuleById,
  updateModule,
} from "@/lib/db/queries";
import type { Chapter } from "@/lib/db/schema";

export interface ModuleFormState {
  error?: string;
}

/** Create a shell module for a client, then jump into the builder. */
export async function createModuleAction(
  _prev: ModuleFormState,
  formData: FormData,
): Promise<ModuleFormState> {
  await requireAdmin();
  const title = (formData.get("title")?.toString() ?? "").trim();
  const description = (formData.get("description")?.toString() ?? "").trim();
  if (!title) return { error: "Give the module a title." };
  const mod = await createModule({
    title,
    description: description || null,
    chapters: [],
  });
  revalidatePath("/admin/modules");
  redirect(`/admin/modules/${mod.id}`);
}

/** Persist the full module (title, description, chapters JSON) from the builder. */
export async function saveModuleAction(
  id: string,
  payload: { title: string; description: string; chapters: Chapter[] },
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const existing = await getModuleById(id);
  if (!existing) return { ok: false, error: "Module not found." };
  const title = payload.title.trim();
  if (!title) return { ok: false, error: "Title can't be empty." };
  // Drop blank chapters/lessons so the client view stays clean.
  const chapters: Chapter[] = (payload.chapters ?? [])
    .map((c) => ({
      title: c.title.trim(),
      lessons: (c.lessons ?? [])
        .filter((l) => l.title.trim())
        .map((l) => ({
          title: l.title.trim(),
          videoUrl: l.videoUrl?.trim() || undefined,
          summary: l.summary?.trim() || undefined,
          links: (l.links ?? [])
            .filter((x) => x.label?.trim())
            .map((x) => ({ label: x.label.trim(), url: x.url?.trim() || undefined })),
        })),
    }))
    .filter((c) => c.title || c.lessons.length);
  await updateModule(id, {
    title,
    description: payload.description.trim() || null,
    chapters,
  });
  revalidatePath("/admin/modules");
  revalidatePath(`/admin/modules/${id}`);
  return { ok: true };
}

export async function deleteModuleAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteModule(id);
  revalidatePath("/admin/modules");
  redirect("/admin/modules");
}
