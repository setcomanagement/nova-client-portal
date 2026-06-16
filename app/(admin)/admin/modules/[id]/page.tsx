import Link from "next/link";
import { notFound } from "next/navigation";
import { getGlobalModuleById } from "@/lib/db/queries";
import type { Chapter } from "@/lib/db/schema";
import { DEFAULT_MODULE_CATEGORY } from "@/lib/constants";
import { isUuid } from "@/lib/utils";
import { CourseBuilder } from "./course-builder";

export default async function ModuleBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const mod = await getGlobalModuleById(id);
  if (!mod) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-[#9c886a]">
        <Link href="/admin/modules" className="text-caramel hover:underline">
          Modules
        </Link>{" "}
        · {mod.title}
      </div>
      <CourseBuilder
        id={mod.id}
        initialTitle={mod.title}
        initialDescription={mod.description ?? ""}
        initialCategory={mod.category ?? DEFAULT_MODULE_CATEGORY}
        initialChapters={(mod.chapters ?? []) as Chapter[]}
      />
    </div>
  );
}
