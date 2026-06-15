import { listAllIntegrations } from "@/lib/db/queries";
import type { IntegrationRow } from "@/lib/db/queries";

const COLS = ["calendly", "discord", "notion", "google"] as const;
const COL_LABEL: Record<(typeof COLS)[number], string> = {
  calendly: "Calendly",
  discord: "Discord",
  notion: "Notion",
  google: "Google",
};

function StatusPill({ status }: { status: string | undefined }) {
  if (status === "connected")
    return <span className="rounded-md bg-[#243016] px-2 py-0.5 font-mono text-[11px] text-[#8fb36a]">connected</span>;
  if (status === "coming_soon")
    return <span className="rounded-md bg-[#2a2415] px-2 py-0.5 font-mono text-[11px] text-[#d6a94e]">phase 2</span>;
  return <span className="font-mono text-[11px] text-[#6b5a45]">—</span>;
}

function lastSync(rows: IntegrationRow[]): string {
  const dates = rows
    .map((r) => r.connectedAt)
    .filter((d): d is Date => !!d)
    .map((d) => new Date(d).getTime());
  if (!dates.length) return "—";
  return new Date(Math.max(...dates)).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminIntegrationsPage() {
  const groups = await listAllIntegrations();

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-caramel">
          nova / integrations
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Connections</h1>
        <p className="mt-1 text-sm text-[#9c886a]">
          Cross-client connection status. Clients manage their own from the portal.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#3a2a1c]">
        <table className="w-full text-sm">
          <thead className="bg-[#1c130a] font-mono text-[11px] uppercase tracking-wide text-[#9c886a]">
            <tr>
              <th className="px-4 py-3 text-left">Client</th>
              {COLS.map((c) => (
                <th key={c} className="px-4 py-3 text-left">
                  {COL_LABEL[c]}
                </th>
              ))}
              <th className="px-4 py-3 text-left">Last sync</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ client, integrations }) => {
              const map = new Map(integrations.map((i) => [i.provider, i]));
              return (
                <tr key={client.id} className="border-t border-[#3a2a1c] bg-[#251910]">
                  <td className="px-4 py-3 font-semibold text-white">{client.name}</td>
                  {COLS.map((c) => (
                    <td key={c} className="px-4 py-3">
                      <StatusPill status={map.get(c)?.status} />
                    </td>
                  ))}
                  <td className="px-4 py-3 font-mono text-xs text-[#9c886a]">
                    {lastSync(integrations)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
