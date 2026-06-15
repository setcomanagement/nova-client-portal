import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireClientContentAccess } from "@/lib/auth/session";
import {
  getClientBySlug,
  getCompletedModuleIds,
  listGlobalModules,
} from "@/lib/db/queries";
import type { Chapter } from "@/lib/db/schema";

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

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="eyebrow">NOVA · training</p>
        <h1 className="mt-2 text-3xl font-semibold">Modules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The NOVA playbook — watch, apply, track your progress.
        </p>
      </div>

      {mods.length === 0 ? (
        <p className="text-sm text-muted-foreground">No modules yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mods.map((m) => {
            const chapters = (m.chapters ?? []) as Chapter[];
            const lessons = chapters.reduce((s, c) => s + c.lessons.length, 0);
            const isDone = completed.has(m.id);
            return (
              <Link key={m.id} href={`/${slug}/modules/${m.id}`}>
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
          })}
        </div>
      )}
    </div>
  );
}
