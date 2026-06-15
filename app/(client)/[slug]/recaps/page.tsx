import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireClientContentAccess } from "@/lib/auth/session";
import {
  getClientBySlug,
  listRecaps,
  type ActionItem,
} from "@/lib/db/queries";

export default async function RecapsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireClientContentAccess();
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const recaps = await listRecaps(client.id);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="eyebrow">NOVA · recaps</p>
        <h1 className="mt-2 text-3xl font-semibold">Call recaps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every NOVA call — action items, decisions, and the recording.
        </p>
      </div>

      {recaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recaps yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recaps.map((r) => {
            const items = (r.actionItems ?? []) as ActionItem[];
            const done = items.filter((i) => i.done).length;
            const pct = items.length
              ? Math.round((done / items.length) * 100)
              : 0;
            const badge =
              pct === 100
                ? { cls: "badge-good", text: "Done" }
                : pct === 0
                  ? { cls: "badge-up", text: "New" }
                  : { cls: "badge-warn", text: `${items.length - done} to do` };
            return (
              <Link key={r.id} href={`/${slug}/recaps/${r.id}`}>
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`badge ${badge.cls}`}>{badge.text}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.callDate}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">{r.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {r.tldr}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#ece1cf]">
                      <div
                        className="h-full rounded-full bg-sage"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-sage">
                      {pct}%
                    </span>
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
