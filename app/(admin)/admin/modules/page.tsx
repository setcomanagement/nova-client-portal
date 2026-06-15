import Link from "next/link";
import { listGlobalModules } from "@/lib/db/queries";
import type { Chapter } from "@/lib/db/schema";

export default async function AdminModulesPage() {
  const mods = await listGlobalModules();
  const totalLessons = mods.reduce(
    (s, m) => s + ((m.chapters ?? []) as Chapter[]).reduce((x, c) => x + c.lessons.length, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-caramel">
            nova / training
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">The NOVA playbook</h1>
          <p className="mt-1 text-sm text-[#9c886a]">
            One shared catalog every client sees in their feed · {mods.length} module
            {mods.length === 1 ? "" : "s"} · {totalLessons} lessons. Open one to edit
            its chapters and lessons.
          </p>
        </div>
        <Link
          href="/admin/modules/new"
          className="inline-flex h-10 items-center rounded-lg bg-caramel px-4 text-sm font-semibold text-white hover:bg-[#8a5e30]"
        >
          + New module
        </Link>
      </div>

      {mods.length === 0 ? (
        <div className="rounded-xl border border-[#3a2a1c] bg-[#251910] p-5 text-sm text-[#9c886a]">
          No modules yet. Add the first one to the playbook.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mods.map((m) => {
            const chapters = (m.chapters ?? []) as Chapter[];
            const lessons = chapters.reduce((s, c) => s + c.lessons.length, 0);
            return (
              <Link key={m.id} href={`/admin/modules/${m.id}`}>
                <div className="rounded-xl border border-[#3a2a1c] bg-[#251910] p-5 transition hover:border-caramel">
                  <b className="text-white">{m.title}</b>
                  <p className="mt-1 text-sm text-[#9c886a]">{m.description}</p>
                  <div className="mt-3 font-mono text-xs text-[#9c886a]">
                    {chapters.length} chapters · {lessons} lessons
                  </div>
                  <div className="mt-3 font-mono text-xs text-caramel">edit course →</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
