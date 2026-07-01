import { listClients, listRecapJobs } from "@/lib/db/queries";
import { NewRecapJobForm } from "./new-recap-job-form";
import { RecapJobRow, type JobView } from "./recap-job-row";

export default async function AdminRecapsPage() {
  const [clients, jobs] = await Promise.all([listClients(), listRecapJobs()]);
  const pending = jobs.filter((j) => j.status !== "done");
  const done = jobs.filter((j) => j.status === "done");

  const toView = (j: (typeof jobs)[number]): JobView => ({
    id: j.id,
    clientName: j.clientName,
    clientSlug: j.clientSlug,
    fathomRef: j.fathomRef,
    note: j.note,
    status: j.status,
    createdAt: new Date(j.createdAt).toISOString(),
  });

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-caramel">
          nova / after-call
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Recap launcher</h1>
        <p className="mt-1 text-sm text-[#6b6b70]">
          Queue a recap for a client after a call, copy the command, and run it in
          Claude Code. The finished recap auto-lands in that client&apos;s Recaps tab.
        </p>
      </div>

      <div className="rounded-xl border border-[#e6e3dd] bg-[#ffffff] p-6">
        <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-caramel">
          queue a recap
        </p>
        <NewRecapJobForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </div>

      <div>
        <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-caramel">
          pending · {pending.length}
        </p>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-[#e6e3dd] bg-[#ffffff] p-5 text-sm text-[#6b6b70]">
            Nothing queued. Add a call above after your next client call.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((j) => (
              <RecapJobRow key={j.id} job={toView(j)} />
            ))}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[#a3a3a8]">
            done · {done.length}
          </p>
          <div className="flex flex-col gap-3 opacity-70">
            {done.map((j) => (
              <RecapJobRow key={j.id} job={toView(j)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
