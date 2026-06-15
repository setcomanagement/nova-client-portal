"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  Unlink,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  disconnectCalendlyAction,
  loadCalendlyManageData,
  setTrackedCategoryAction,
  syncCalendlyAction,
  updateTrackedEventsAction,
  type ManageData,
} from "./calendly-actions";
import type { EventType } from "@/lib/calendly";

const HAIR = "border-b border-[rgba(26,19,13,0.08)]";
const errToast = (m: string) => toast.error(m, { icon: <AlertCircle className="h-4 w-4" /> });

const CATEGORIES = [
  { value: "sales_call", label: "Sales call" },
  { value: "client_call", label: "Client call" },
  { value: "other", label: "Other" },
];

function SectionHead({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-[#B5A48E]">{eyebrow}</p>
        <h3 className="mt-1 text-sm font-medium text-[color:var(--ink)]">{title}</h3>
        {subtitle && <p className="mt-1 text-[11px] text-[color:var(--mute)]">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function CalendlyManageDialog({
  slug,
  open,
  onOpenChange,
  bookingCount,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ManageData | null>(null);
  const [allTypes, setAllTypes] = useState<EventType[]>([]);
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirm, setConfirm] = useState<null | "disconnect" | "removeAll" | "discard">(null);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await loadCalendlyManageData(slug);
    setData(d);
    if (d.ok && !d.reauth) setAllTypes([...(d.tracked ?? []), ...(d.available ?? [])]);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    if (open) load();
    else {
      setPendingAdd(new Set());
      setPendingRemove(new Set());
      setQuery("");
    }
  }, [open, load]);

  const tracked = data?.tracked ?? [];
  const available = data?.available ?? [];
  const pendingCount = pendingAdd.size + pendingRemove.size;
  const isDirty = pendingCount > 0;
  const canSave = isDirty && !saving;

  const effectiveSelected: EventType[] = [...tracked, ...available.filter((a) => pendingAdd.has(a.uri))];
  const effectiveAvailable: EventType[] = available.filter(
    (a) => !pendingAdd.has(a.uri) && a.name.toLowerCase().includes(query.toLowerCase()),
  );

  function requestClose(v: boolean) {
    if (!v && isDirty) setConfirm("discard");
    else onOpenChange(v);
  }
  function addEvent(uri: string) { setPendingAdd((s) => new Set(s).add(uri)); }
  function undoAdd(uri: string) { setPendingAdd((s) => { const n = new Set(s); n.delete(uri); return n; }); }
  function removeEvent(uri: string) {
    if (pendingAdd.has(uri)) undoAdd(uri);
    else setPendingRemove((s) => new Set(s).add(uri));
  }
  function undoRemove(uri: string) { setPendingRemove((s) => { const n = new Set(s); n.delete(uri); return n; }); }

  async function changeCategory(uri: string, category: string) {
    // optimistic
    setData((d) => (d ? { ...d, tracked: (d.tracked ?? []).map((t) => (t.uri === uri ? { ...t, category } : t)) } : d));
    const res = await setTrackedCategoryAction(slug, uri, category);
    if (!res.ok) { errToast(res.error ?? "Could not update category."); load(); }
    else { router.refresh(); }
  }

  async function save() {
    setSaving(true);
    const additions = available.filter((a) => pendingAdd.has(a.uri));
    const removals = [...pendingRemove];
    const res = await updateTrackedEventsAction(slug, additions, removals);
    setSaving(false);
    if (!res.ok || !res.tracked) { errToast(res.error ?? "Could not save."); return; }
    const newTracked = res.tracked;
    const trackedUris = new Set(newTracked.map((t) => t.uri));
    setData((d) => (d ? { ...d, tracked: newTracked, available: allTypes.filter((t) => !trackedUris.has(t.uri)) } : d));
    setPendingAdd(new Set());
    setPendingRemove(new Set());
    toast.success("Tracked events updated");
    router.refresh();
  }

  async function syncNow() {
    setSyncing(true);
    const res = await syncCalendlyAction(slug, {}, new FormData());
    setSyncing(false);
    if (res.ok) { toast.success(res.msg ?? "Synced"); router.refresh(); }
    else errToast(res.msg ?? "Sync failed.");
  }
  async function disconnect() {
    setConfirm(null);
    const res = await disconnectCalendlyAction(slug);
    if (res.ok) { toast.success("Calendly disconnected"); onOpenChange(false); router.refresh(); }
    else errToast(res.error ?? "Could not disconnect.");
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="flex max-h-[85vh] max-w-[580px] flex-col p-0">
        <DialogTitle className="sr-only">Manage Calendly</DialogTitle>

        {/* sticky header */}
        <div className={`flex shrink-0 items-center gap-3 px-7 pb-[18px] pt-[22px] ${HAIR}`}>
          <span className="grid h-8 w-8 place-items-center rounded-[7px] bg-[#1A130D] font-serif text-white">C</span>
          <div className="flex-1">
            <p className="font-serif text-[18px] font-medium tracking-[-0.02em]">Calendly</p>
            <p className="text-[11px] text-[color:var(--mute)]">Manage your connection and tracked events</p>
          </div>
          <button type="button" onClick={() => requestClose(false)} className="grid h-7 w-7 place-items-center rounded-md border border-[rgba(26,19,13,0.12)] hover:bg-[rgba(26,19,13,0.04)]" aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-3 p-7">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !data?.ok ? (
            <div className="p-7 text-sm text-[color:var(--mute)]">{data?.error ?? "Couldn't load Calendly."}</div>
          ) : data.reauth ? (
            <ReauthBanner slug={slug} />
          ) : (
            <>
              {/* SECTION 1 — account */}
              <section className={`px-7 py-6 ${HAIR}`}>
                <SectionHead
                  eyebrow="Section one"
                  title="Connected account"
                  right={
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={syncNow} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--ink)] px-2.5 py-[5px] text-[11px] text-[color:var(--ink)] hover:bg-[rgba(26,19,13,0.04)] disabled:opacity-50">
                        {syncing ? <Loader2 className="h-[13px] w-[13px] animate-spin" /> : <RefreshCw className="h-[13px] w-[13px]" />}
                        Sync now
                      </button>
                      <button type="button" onClick={() => setConfirm("disconnect")} className="inline-flex items-center gap-1.5 rounded-md border border-[#9C3B2E] px-2.5 py-[5px] text-[11px] text-[#9C3B2E] hover:bg-[rgba(156,59,46,0.06)]">
                        <Unlink className="h-[13px] w-[13px]" /> Disconnect
                      </button>
                    </div>
                  }
                />
                <div className="flex items-center gap-3 rounded-lg bg-[#F2EBDF] px-4 py-[14px]">
                  <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[color:var(--ink)] text-[12px] font-medium text-[color:var(--cream)]">
                    {(data.account?.name ?? "C").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[color:var(--ink)]">{data.account?.name ?? "Calendly user"}</div>
                    <div className="truncate text-[11px] text-[color:var(--mute)]">
                      {data.account?.email}{data.account?.organizationSlug ? ` · organization: ${data.account.organizationSlug}` : ""}
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] text-[#4F7A4A]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4F7A4A]" /> Active
                  </span>
                </div>
              </section>

              {/* SECTION 2 — selected */}
              <section className={`px-7 py-6 ${HAIR}`}>
                <SectionHead
                  eyebrow="Section two"
                  title="Tracked events"
                  subtitle="Only these create NOVA bookings. Set each one's type: sales calls become leads, client calls don't."
                  right={effectiveSelected.length > 0 ? (
                    <button type="button" onClick={() => setConfirm("removeAll")} className="rounded-md border border-[color:var(--ink)] px-2.5 py-[5px] text-[11px] text-[color:var(--ink)] hover:bg-[rgba(26,19,13,0.04)]">Remove all</button>
                  ) : undefined}
                />
                <EventTable
                  rows={effectiveSelected}
                  empty="No events tracked yet. Add one from the list below."
                  actionsWidth="28px"
                  renderState={(uri) => (pendingRemove.has(uri) ? "remove" : pendingAdd.has(uri) ? "add" : "active")}
                  onCategoryChange={changeCategory}
                  renderAction={(uri) =>
                    pendingRemove.has(uri) ? (
                      <button type="button" onClick={() => undoRemove(uri)} aria-label="Undo remove"><Undo2 className="h-[13px] w-[13px] text-[#B5A48E]" /></button>
                    ) : (
                      <button type="button" onClick={() => removeEvent(uri)} aria-label="Remove"><Trash2 className="h-[13px] w-[13px] text-[#9C3B2E]" /></button>
                    )
                  }
                />
              </section>

              {/* SECTION 3 — available */}
              <section className="px-7 py-6">
                <SectionHead
                  eyebrow="Section three"
                  title="Available events"
                  subtitle="Add events from your Calendly to start tracking them"
                  right={effectiveAvailable.length > 0 ? (
                    <button type="button" onClick={() => setPendingAdd((s) => { const n = new Set(s); effectiveAvailable.forEach((e) => n.add(e.uri)); return n; })} className="rounded-md border border-[color:var(--ink)] px-2.5 py-[5px] text-[11px] text-[color:var(--ink)] hover:bg-[rgba(26,19,13,0.04)]">Add all</button>
                  ) : undefined}
                />
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[color:var(--mute)]" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events…" className="w-full rounded-md border border-[rgba(26,19,13,0.12)] bg-white py-2 pl-8 pr-3 text-[12px] outline-none focus:border-accent placeholder:text-[#B5A48E]" />
                </div>
                <EventTable
                  rows={effectiveAvailable}
                  empty={available.length === 0 ? "All event types are already being tracked." : query ? `No events match "${query}".` : "No events available."}
                  actionsWidth="50px"
                  renderState={() => "active"}
                  renderAction={(uri) => (
                    <button type="button" onClick={() => addEvent(uri)} className="rounded-[5px] border border-caramel px-2.5 py-[3px] text-[11px] text-caramel hover:bg-[rgba(160,112,60,0.06)]">Add</button>
                  )}
                />
              </section>
            </>
          )}
        </div>

        {/* sticky footer */}
        {!loading && data?.ok && !data.reauth && (
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-b-xl border-t border-[rgba(26,19,13,0.08)] bg-[#F2EBDF] px-7 py-4">
            <span className="text-[11px] text-[color:var(--mute)]">
              {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} pending · click save to apply` : `${bookingCount} bookings synced`}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => requestClose(false)} className="px-3.5 py-[7px] text-[12px] text-[color:var(--ink)]">Cancel</button>
              <button type="button" onClick={save} disabled={!canSave} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-[7px] text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
              </button>
            </div>
          </div>
        )}
      </DialogContent>

      <ConfirmDialog open={confirm === "disconnect"} onClose={() => setConfirm(null)} title="Disconnect Calendly?" body="This stops event tracking and removes the connection. Past bookings and dispositions are kept." confirmLabel="Disconnect" danger onConfirm={disconnect} />
      <ConfirmDialog open={confirm === "removeAll"} onClose={() => setConfirm(null)} title="Remove all tracked events?" body="This marks every event type for removal. Nothing is deleted until you click Save changes." confirmLabel="Remove all" danger onConfirm={() => { setPendingRemove((s) => { const n = new Set(s); tracked.forEach((t) => n.add(t.uri)); return n; }); setPendingAdd(new Set()); setConfirm(null); }} />
      <ConfirmDialog open={confirm === "discard"} onClose={() => setConfirm(null)} title="Discard unsaved changes?" body="You have changes that haven't been saved." confirmLabel="Discard" danger cancelLabel="Keep editing" onConfirm={() => { setConfirm(null); onOpenChange(false); }} />
    </Dialog>
  );
}

function ReauthBanner({ slug }: { slug: string }) {
  return (
    <div className="m-7 rounded-lg bg-[#FAEEDA] p-4">
      <p className="text-[13px] text-[#854F0B]">Reconnection required. Your Calendly tokens have expired.</p>
      <a href={`/api/calendly/authorize?slug=${slug}`} className="mt-3 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90">Reconnect</a>
    </div>
  );
}

function EventTable({
  rows,
  empty,
  actionsWidth,
  renderState,
  renderAction,
  onCategoryChange,
}: {
  rows: EventType[];
  empty: string;
  actionsWidth: string;
  renderState: (uri: string) => "active" | "add" | "remove";
  renderAction: (uri: string) => React.ReactNode;
  onCategoryChange?: (uri: string, category: string) => void;
}) {
  const cols = `1.7fr 0.9fr 0.6fr 0.9fr ${actionsWidth}`;
  if (rows.length === 0) {
    return <p className="rounded-lg border border-[rgba(26,19,13,0.08)] px-4 py-5 text-center text-[12px] text-[color:var(--mute)]">{empty}</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-[rgba(26,19,13,0.08)]">
      <div className="grid bg-[#F2EBDF] px-[14px] py-[9px] text-[10px] uppercase tracking-[0.06em] text-[color:var(--mute)]" style={{ gridTemplateColumns: cols }}>
        <span>Event</span><span>{onCategoryChange ? "Category" : "Type"}</span><span>Duration</span><span>Status</span><span />
      </div>
      {rows.map((r) => {
        const state = renderState(r.uri);
        const rowBg = state === "remove" ? "bg-[rgba(156,59,46,0.04)]" : state === "add" ? "bg-[rgba(160,112,60,0.06)]" : "";
        const muted = state === "remove";
        const showCat = !!onCategoryChange && r.category !== undefined && state !== "remove";
        return (
          <div key={r.uri} className={`grid items-center border-t border-[rgba(26,19,13,0.08)] px-[14px] py-[10px] text-[12px] ${rowBg}`} style={{ gridTemplateColumns: cols }}>
            <span className={muted ? "truncate text-[#B5A48E] line-through" : "truncate text-[color:var(--ink)]"}>{r.name} · {r.duration} min</span>
            <span>
              {showCat ? (
                <select
                  value={r.category}
                  onChange={(e) => onCategoryChange!(r.uri, e.target.value)}
                  className="w-full rounded border border-[rgba(26,19,13,0.15)] bg-white px-1.5 py-1 text-[11px] outline-none focus:border-accent"
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              ) : (
                <span className="text-[color:var(--mute)]">{r.kind === "solo" ? "User" : "Team"}</span>
              )}
            </span>
            <span className="text-[color:var(--mute)]">{r.duration} min</span>
            <span>
              {state === "remove" ? (
                <span className="rounded bg-[rgba(156,59,46,0.1)] px-2 py-[3px] text-[11px] text-[#9C3B2E]">pending remove</span>
              ) : state === "add" ? (
                <span className="rounded bg-[#FAEEDA] px-2 py-[3px] text-[11px] text-[#854F0B]">pending add</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-[#EAF3DE] px-2 py-[3px] text-[11px] text-[#3B6D11]"><span className="h-[5px] w-[5px] rounded-full bg-[#3B6D11]" /> active</span>
              )}
            </span>
            <span className="flex justify-end">
              {state === "add" ? <Check className="h-3.5 w-3.5 text-[#A0703C]" /> : renderAction(r.uri)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ConfirmDialog({ open, onClose, title, body, confirmLabel, cancelLabel = "Cancel", danger, onConfirm }: {
  open: boolean; onClose: () => void; title: string; body: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[400px] p-6">
        <DialogTitle className="font-serif text-[16px] font-medium">{title}</DialogTitle>
        <p className="mt-2 text-[13px] text-[color:var(--mute)]">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} className="rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90" style={{ background: danger ? "#9C3B2E" : "var(--accent)" }}>{confirmLabel}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
