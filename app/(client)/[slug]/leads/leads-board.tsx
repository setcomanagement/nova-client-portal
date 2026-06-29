"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { moveLeadStageAction } from "./actions";
import { LEAD_TYPES, PIPELINE_STAGES } from "./pipeline";

export interface BoardLead {
  id: string;
  name: string;
  email: string | null;
  source: string | null;
  stage: string;
  pipelineStage: string;
  leadType: string;
  calls: number;
}

const LIFECYCLE: Record<string, string> = {
  new: "badge-neutral",
  booked: "badge-up",
  showed: "badge-up",
  closed: "badge-good",
  lost: "badge-bad",
};

const TYPE_BADGE: Record<string, string> = {
  inbound: "badge-good",
  outbound: "badge-warn",
};

type Filter = "all" | "inbound" | "outbound";

export function LeadsBoard({
  slug,
  leads: initial,
  canEdit,
}: {
  slug: string;
  leads: BoardLead[];
  canEdit: boolean;
}) {
  const [leads, setLeads] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(
    () => (filter === "all" ? leads : leads.filter((l) => l.leadType === filter)),
    [leads, filter],
  );

  const byStage = useMemo(() => {
    const map: Record<string, BoardLead[]> = {};
    for (const s of PIPELINE_STAGES) map[s.key] = [];
    for (const l of visible) (map[l.pipelineStage] ?? (map[l.pipelineStage] = [])).push(l);
    return map;
  }, [visible]);

  function move(id: string, toStage: string) {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.pipelineStage === toStage) return;
    const prev = lead.pipelineStage;
    // Optimistic — snap the card immediately, revert on failure.
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, pipelineStage: toStage } : l)));
    startTransition(async () => {
      const res = await moveLeadStageAction(slug, id, toStage);
      if (!res.ok) {
        setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, pipelineStage: prev } : l)));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {(["all", "inbound", "outbound"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "bg-accent text-white"
                : "border border-border text-muted-foreground hover:bg-card"
            }`}
          >
            {f === "all" ? "All leads" : f}
            <span className="ml-2 text-xs opacity-70">
              {f === "all"
                ? leads.length
                : leads.filter((l) => l.leadType === f).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((s) => {
          const items = byStage[s.key] ?? [];
          const isOver = overStage === s.key;
          return (
            <div
              key={s.key}
              onDragOver={(e) => {
                if (!canEdit || !dragId) return;
                e.preventDefault();
                setOverStage(s.key);
              }}
              onDragLeave={() => setOverStage((cur) => (cur === s.key ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                if (canEdit && dragId) move(dragId, s.key);
                setDragId(null);
                setOverStage(null);
              }}
              className={`flex min-h-[160px] flex-col gap-2 rounded-xl border p-2.5 transition-colors ${
                isOver
                  ? "border-accent bg-accent/5"
                  : "border-[color:var(--rule)] bg-card/40"
              }`}
            >
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[13px] font-semibold">{s.label}</span>
                <span className="num rounded-full bg-[color:var(--rule)]/40 px-2 text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>

              {items.map((l) => (
                <div
                  key={l.id}
                  draggable={canEdit}
                  onDragStart={() => setDragId(l.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStage(null);
                  }}
                  className={`group rounded-lg border border-border bg-card p-3 shadow-sm ${
                    canEdit ? "cursor-grab active:cursor-grabbing" : ""
                  } ${dragId === l.id ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/${slug}/leads/${l.id}`}
                      className="font-medium leading-tight hover:underline"
                      draggable={false}
                    >
                      {l.name}
                    </Link>
                    <span className={`badge ${TYPE_BADGE[l.leadType] ?? "badge-neutral"} shrink-0`}>
                      {l.leadType}
                    </span>
                  </div>
                  {l.email && (
                    <div className="mt-1 truncate text-xs text-muted-foreground">{l.email}</div>
                  )}
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className={`badge ${LIFECYCLE[l.stage] ?? "badge-neutral"}`}>
                      {l.stage}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {l.source ?? "—"}
                      {l.calls > 0 && <span className="num"> · {l.calls} call{l.calls > 1 ? "s" : ""}</span>}
                    </span>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="flex flex-1 items-center justify-center px-2 py-6 text-center text-xs text-muted-foreground/60">
                  {canEdit ? "Drop leads here" : "—"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <p className="text-xs text-muted-foreground">
          Drag a lead between columns to update its conversation stage. Lifecycle
          badges ({LEAD_TYPES.map((t) => t.label).join(" / ")} type, booked/showed/closed)
          stay in sync with Calendly.
        </p>
      )}
    </div>
  );
}
