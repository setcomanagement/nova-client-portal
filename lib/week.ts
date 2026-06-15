/**
 * Week boundaries for the sales-team KPI tracker.
 * The milestone tracker runs Monday → Sunday ("resets Sunday 11:59pm"), so the
 * week start is the most recent Monday. Computed in UTC for determinism across
 * server regions — the tracker is weekly-grained, so TZ drift at the edges is
 * acceptable and consistent for every viewer.
 */
export function weekStartISO(d: Date = new Date()): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = dt.getUTCDay(); // 0 Sun … 6 Sat
  const sinceMonday = dow === 0 ? 6 : dow - 1;
  dt.setUTCDate(dt.getUTCDate() - sinceMonday);
  return dt.toISOString().slice(0, 10);
}

/** Human label for the current week, e.g. "Week of Jun 9, 2026". */
export function weekLabel(d: Date = new Date()): string {
  const start = new Date(`${weekStartISO(d)}T00:00:00Z`);
  return `Week of ${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}
