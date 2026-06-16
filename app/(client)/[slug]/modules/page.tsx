import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireClientContentAccess } from "@/lib/auth/session";
import {
  getClientBySlug,
  getCompletedModuleIds,
  listGlobalModules,
  type ModuleRow,
} from "@/lib/db/queries";
import type { Chapter } from "@/lib/db/schema";
import { MODULE_CATEGORIES, DEFAULT_MODULE_CATEGORY } from "@/lib/constants";

/** A single module card — shared across category sections. */
function ModuleCard({
  m,
  slug,
  isDone,
}: {
  m: ModuleRow;
  slug: string;
  isDone: boolean;
}) {
  const chapters = (m.chapters ?? []) as Chapter[];
  const lessons = chapters.reduce((s, c) => s + c.lessons.length, 0);
  return (
    <Link href={`/${slug}/modules/${m.id}`}>
      <Card className="h-full overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md">
        <div
          className="grid h-28 place-items-center"
          style={{ background: "radial-gradient(120% 130% at 30% 0%, #4a3526, #241910)" }}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-espresso">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>
        <div className="p-5">
          <span className={`badge ${isDone ? "badge-good" : "badge-up"}`}>
            {isDone ? "Completed" : "Start"}
          </span>
          <h3 className="mt-2 text-lg font-semibold">{m.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {chapters.length} chapters · {lessons} lessons
          </p>
        </div>
      </Card>
    </Link>
  );
}

/**
 * Order categories: those listed in MODULE_CATEGORIES first (in that order),
 * any others alphabetically after them.
 */
function orderCategories(present: string[]): string[] {
  const known = MODULE_CATEGORIES as readonly string[];
  return [...present].sort((a, b) => {
    const ia = known.indexOf(a);
    const ib = known.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

export default async function ModulesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireClientContentAccess();
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const [mods, completed] = await Promise.all([
    listGlobalModules(),
    session ? getCompletedModuleIds(session.userId) : Promise.resolve(new Set<string>()),
  ]);

  // Group by category — null/empty falls back to the default category.
  const groups = new Map<string, ModuleRow[]>();
  for (const m of mods) {
    const key = m.category?.trim() || DEFAULT_MODULE_CATEGORY;
    const arr = groups.get(key);
    if (arr) arr.push(m);
    else groups.set(key, [m]);
  }
  const orderedCategories = orderCategories([...groups.keys()]);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="eyebrow">NOVA · training</p>
        <h1 className="mt-2 text-3xl font-semibold">Modules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Watch, apply, and track your progress.
        </p>
      </div>

      {mods.length === 0 ? (
        <p className="text-sm text-muted-foreground">No modules yet.</p>
      ) : (
        orderedCategories.map((category) => {
          const list = groups.get(category) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={category} className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">{category}</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((m) => (
                  <ModuleCard
                    key={m.id}
                    m={m}
                    slug={slug}
                    isDone={completed.has(m.id)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
