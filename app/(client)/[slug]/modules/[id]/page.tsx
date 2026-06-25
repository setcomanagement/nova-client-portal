import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClientContentAccess } from "@/lib/auth/session";
import {
  getCompletedModuleIds,
  getGlobalModuleById,
  resolveClientAccess,
} from "@/lib/db/queries";
import type { Chapter } from "@/lib/db/schema";
import { isUuid } from "@/lib/utils";
import { ModuleCourse } from "./module-course";

export default async function ModuleDetail({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await requireClientContentAccess();
  if (!isUuid(id)) notFound();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const mod = await getGlobalModuleById(id);
  if (!mod) notFound();

  const completed = session
    ? (await getCompletedModuleIds(session.userId)).has(mod.id)
    : false;
  const chapters = (mod.chapters ?? []) as Chapter[];
  const lessons = chapters.reduce((s, c) => s + c.lessons.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${slug}/modules`} className="text-accent hover:underline">
          Modules
        </Link>{" "}
        · {mod.title}
      </div>
      <div>
        <p className="eyebrow">NOVA · module</p>
        <h1 className="mt-2 text-3xl font-semibold">{mod.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {chapters.length} chapters · {lessons} lessons · {mod.description}
        </p>
      </div>
      {chapters.length ? (
        <ModuleCourse
          slug={slug}
          moduleId={mod.id}
          chapters={chapters}
          completed={completed}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          This module has no chapters yet.
        </p>
      )}
    </div>
  );
}
