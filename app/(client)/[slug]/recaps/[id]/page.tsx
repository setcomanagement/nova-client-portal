import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireClientContentAccess } from "@/lib/auth/session";
import {
  getRecapForClient,
  resolveClientAccess,
  type ActionItem,
} from "@/lib/db/queries";
import { isUuid } from "@/lib/utils";
import { RecapChecklist } from "./recap-checklist";

export default async function RecapDetail({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await requireClientContentAccess();
  if (!isUuid(id)) notFound();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const recap = await getRecapForClient(id, client.id);
  if (!recap) notFound();

  const items = (recap.actionItems ?? []) as ActionItem[];
  const decisions = (recap.decisionsLocked ?? []) as string[];

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${slug}/recaps`} className="text-accent hover:underline">
          Recaps
        </Link>{" "}
        · {recap.title}
      </div>

      {/* Hero */}
      <div
        className="overflow-hidden rounded-2xl p-8 text-[#efe3d2]"
        style={{
          background:
            "radial-gradient(130% 160% at 0% 0%, #4a3526, #241910)",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9b483]">
          NOVA · call recap
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-white">
          {recap.title}
        </h1>
        <p className="mt-2 text-sm text-[#b9a78f]">
          {recap.callDate} · with Matt &amp; the {client.name} team
        </p>
        {recap.fathomUrl && (
          <a
            href={recap.fathomUrl}
            target="_blank"
            rel="noreferrer"
            className={`mt-5 inline-flex ${buttonVariants({ variant: "accent" })}`}
          >
            Watch recording
          </a>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {recap.tldr && (
            <Card className="p-6">
              <h3 className="mb-3 font-sans text-[15px] font-semibold">TL;DR</h3>
              <p className="border-l-[3px] border-accent pl-5 font-serif text-xl leading-relaxed">
                {recap.tldr}
              </p>
            </Card>
          )}
          <Card className="p-6">
            <h3 className="mb-4 font-sans text-[15px] font-semibold">
              Your action items
            </h3>
            {items.length ? (
              <RecapChecklist slug={slug} recapId={recap.id} items={items} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No action items on this recap.
              </p>
            )}
          </Card>
        </div>
        <Card className="h-fit p-6">
          <h4 className="eyebrow mb-3 block">Decisions locked</h4>
          {decisions.length ? (
            <ul className="flex flex-col gap-3">
              {decisions.map((d, i) => (
                <li key={i} className="flex gap-3 text-[15px]">
                  <span className="mt-0.5 text-accent" aria-hidden>
                    ✓
                  </span>
                  {d}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
