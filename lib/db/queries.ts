import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "./index";
import {
  announcements,
  auditLog,
  bookings,
  calendlyTrackedEvents,
  callRecaps,
  clients,
  eodSubmissions,
  feedback,
  integrations,
  kpiWeekly,
  leads,
  moduleProgress,
  modules,
  recapJobs,
  users,
  webhookEvents,
} from "./schema";
import type {
  BookingOutcome,
  CalendlyAnswer,
  Chapter,
  IntegrationProvider,
  IntegrationStatus,
} from "./schema";
import { isNull } from "drizzle-orm";
import type { UserRole } from "@/lib/auth/jwt";

export type LeadRow = typeof leads.$inferSelect;
export type BookingRow = typeof bookings.$inferSelect;
export type AnnouncementRow = typeof announcements.$inferSelect;
export type IntegrationRow = typeof integrations.$inferSelect;
export type FeedbackRow = typeof feedback.$inferSelect;

/* ---- Announcements ---- */
export async function getActiveAnnouncement(): Promise<AnnouncementRow | null> {
  const rows = await db
    .select()
    .from(announcements)
    .where(eq(announcements.active, true))
    .orderBy(desc(announcements.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function setActiveAnnouncement(message: string): Promise<void> {
  await db.update(announcements).set({ active: false });
  await db.insert(announcements).values({ message, audience: "all", active: true });
}

/** Take down the live banner without posting a new one. */
export async function clearActiveAnnouncement(): Promise<void> {
  await db.update(announcements).set({ active: false });
}

/* ---- Leads ---- */
export async function listLeads(clientId: string): Promise<LeadRow[]> {
  return db.select().from(leads).where(eq(leads.clientId, clientId)).orderBy(desc(leads.createdAt));
}
export async function getLeadForClient(id: string, clientId: string): Promise<LeadRow | null> {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}
export interface LeadInput {
  name: string;
  email?: string | null;
  source?: string | null;
  stage?: string;
  ownerUserId?: string | null;
  notes?: string | null;
}
export async function createLead(clientId: string, input: LeadInput): Promise<LeadRow> {
  const rows = await db
    .insert(leads)
    .values({
      clientId,
      name: input.name,
      email: input.email ?? null,
      source: input.source ?? null,
      stage: input.stage ?? "new",
      ownerUserId: input.ownerUserId ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return rows[0];
}
export async function updateLead(
  id: string,
  clientId: string,
  input: LeadInput,
): Promise<void> {
  await db
    .update(leads)
    .set({
      name: input.name,
      email: input.email ?? null,
      source: input.source ?? null,
      stage: input.stage ?? "new",
      ownerUserId: input.ownerUserId ?? null,
      notes: input.notes ?? null,
    })
    .where(and(eq(leads.id, id), eq(leads.clientId, clientId)));
}
export async function deleteLead(id: string, clientId: string): Promise<void> {
  await db.delete(leads).where(and(eq(leads.id, id), eq(leads.clientId, clientId)));
}

/* ---- Bookings ---- */
export async function listBookings(clientId: string): Promise<BookingRow[]> {
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.clientId, clientId))
    .orderBy(desc(bookings.scheduledAt));
}
/** Every booking across all clients (operator funnel). */
export async function listAllBookings(): Promise<BookingRow[]> {
  return db.select().from(bookings).orderBy(desc(bookings.scheduledAt));
}
export async function listBookingsForLead(leadId: string, clientId: string): Promise<BookingRow[]> {
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.leadId, leadId), eq(bookings.clientId, clientId)))
    .orderBy(desc(bookings.scheduledAt));
}
export async function getBookingForClient(id: string, clientId: string): Promise<BookingRow | null> {
  const rows = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}
export async function setBookingOutcome(
  id: string,
  clientId: string,
  status: string,
  outcome: BookingOutcome,
): Promise<void> {
  await db
    .update(bookings)
    .set({ status, outcome })
    .where(and(eq(bookings.id, id), eq(bookings.clientId, clientId)));
}

export type ClientRow = typeof clients.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type RecapRow = typeof callRecaps.$inferSelect;
export type ModuleRow = typeof modules.$inferSelect;
export type KpiRow = typeof kpiWeekly.$inferSelect;
export type EodRow = typeof eodSubmissions.$inferSelect;
export type EodInsert = typeof eodSubmissions.$inferInsert;

/** Insert a setter's end-of-day submission. */
export async function insertEod(input: EodInsert): Promise<void> {
  await db.insert(eodSubmissions).values(input);
}

/** Every user (operator-only views). */
export async function listAllUsers(): Promise<UserRow[]> {
  return db.select().from(users).orderBy(asc(users.name));
}

/** Every EOD submission across all setters (operator analytics). */
export async function listAllEod(): Promise<EodRow[]> {
  return db.select().from(eodSubmissions).orderBy(desc(eodSubmissions.submissionDate));
}

/** All EOD submissions for one setter, newest first. */
export async function listEodForUser(userId: string): Promise<EodRow[]> {
  return db
    .select()
    .from(eodSubmissions)
    .where(eq(eodSubmissions.setterUserId, userId))
    .orderBy(desc(eodSubmissions.submissionDate));
}

/**
 * Per-setter KPI totals for one client, summed from EOD submissions on/after
 * `weekStart` (YYYY-MM-DD). eod_submissions has no client_id, so we resolve the
 * owning client through the setter's users row. Returns one row per setter that
 * has any EOD in the window — the four metrics the milestone tracker grades on.
 */
export interface SetterWeekKpi {
  setterUserId: string;
  setterName: string;
  callsBooked: number;
  showUps: number;
  closes: number;
  cash: number;
}
export async function listSetterWeekKpis(
  clientId: string,
  weekStart: string,
): Promise<SetterWeekKpi[]> {
  const rows = await db
    .select({
      setterUserId: eodSubmissions.setterUserId,
      setterName: users.name,
      callsBooked: sql<number>`coalesce(sum(${eodSubmissions.callsBooked}), 0)::int`,
      showUps: sql<number>`coalesce(sum(${eodSubmissions.showUps}), 0)::int`,
      closes: sql<number>`coalesce(sum(${eodSubmissions.closes}), 0)::int`,
      cash: sql<number>`coalesce(sum(${eodSubmissions.cashCollected}), 0)::float`,
    })
    .from(eodSubmissions)
    .innerJoin(users, eq(users.id, eodSubmissions.setterUserId))
    .where(
      and(
        eq(users.clientId, clientId),
        gte(eodSubmissions.submissionDate, weekStart),
      ),
    )
    .groupBy(eodSubmissions.setterUserId, users.name)
    .orderBy(desc(sql`coalesce(sum(${eodSubmissions.cashCollected}), 0)`));
  return rows;
}

/**
 * Per-day KPI aggregates for one client, summed across that client's setters,
 * for every day on/after `since` (YYYY-MM-DD). eod_submissions has no client_id,
 * so we resolve the owning client through the setter's users row. One row per
 * day that has any EOD — powers the statistics page's scorecards, trend charts,
 * and funnel. `submissions` is the count of EOD rows that day (the divisor for
 * per-setter-day averages).
 */
export interface DailyKpi {
  date: string;
  submissions: number;
  outbound: number;
  inbound: number;
  followUps: number;
  totalConvos: number;
  callsPitched: number;
  callsBooked: number;
  qualifiedBooked: number;
  showUps: number;
  closes: number;
  cashCollected: number;
}
export async function listClientDailyKpis(
  clientId: string,
  since: string,
  setterUserId?: string,
): Promise<DailyKpi[]> {
  const sum = (col: AnyColumn) => sql<number>`coalesce(sum(${col}), 0)::int`;
  const rows = await db
    .select({
      date: eodSubmissions.submissionDate,
      submissions: sql<number>`count(*)::int`,
      outbound: sum(eodSubmissions.outbound),
      inbound: sum(eodSubmissions.inbound),
      followUps: sum(eodSubmissions.followUps),
      totalConvos: sum(eodSubmissions.totalConvos),
      callsPitched: sum(eodSubmissions.callsPitched),
      callsBooked: sum(eodSubmissions.callsBooked),
      qualifiedBooked: sum(eodSubmissions.qualifiedBooked),
      showUps: sum(eodSubmissions.showUps),
      closes: sum(eodSubmissions.closes),
      cashCollected: sql<number>`coalesce(sum(${eodSubmissions.cashCollected}), 0)::float`,
    })
    .from(eodSubmissions)
    .innerJoin(users, eq(users.id, eodSubmissions.setterUserId))
    .where(
      and(
        eq(users.clientId, clientId),
        gte(eodSubmissions.submissionDate, since),
        // Segregation: when set, only this setter's own rows (sales-rep view).
        setterUserId ? eq(eodSubmissions.setterUserId, setterUserId) : undefined,
      ),
    )
    .groupBy(eodSubmissions.submissionDate)
    .orderBy(asc(eodSubmissions.submissionDate));
  return rows;
}

/**
 * Most recent EOD submission_date for a client (across its setters), or null
 * when the client has no EODs at all. Lets the dashboard fall back to the last
 * week that actually has activity instead of showing zeroes for an empty week.
 */
export async function getLatestEodDate(clientId: string): Promise<string | null> {
  const rows = await db
    .select({ date: eodSubmissions.submissionDate })
    .from(eodSubmissions)
    .innerJoin(users, eq(users.id, eodSubmissions.setterUserId))
    .where(eq(users.clientId, clientId))
    .orderBy(desc(eodSubmissions.submissionDate))
    .limit(1);
  return rows[0]?.date ?? null;
}

/**
 * Every individual EOD submission for a client on/after `since` (YYYY-MM-DD),
 * newest first, with the submitting setter's name. Optionally scoped to a single
 * setter (sales-rep segregation, same as the aggregate view). Unlike
 * listClientDailyKpis (which collapses a day's submissions into one row), this
 * returns one row per submission so the statistics page can list every entry.
 */
export interface ClientEodEntry {
  id: string;
  date: string;
  setterUserId: string;
  setterName: string;
  outbound: number;
  totalConvos: number;
  callsPitched: number;
  callsBooked: number;
  showUps: number;
  closes: number;
  cashCollected: number;
}
export async function listClientEodEntries(
  clientId: string,
  since: string,
  setterUserId?: string,
): Promise<ClientEodEntry[]> {
  const rows = await db
    .select({
      id: eodSubmissions.id,
      date: eodSubmissions.submissionDate,
      setterUserId: eodSubmissions.setterUserId,
      setterName: users.name,
      outbound: eodSubmissions.outbound,
      totalConvos: eodSubmissions.totalConvos,
      callsPitched: eodSubmissions.callsPitched,
      callsBooked: eodSubmissions.callsBooked,
      showUps: eodSubmissions.showUps,
      closes: eodSubmissions.closes,
      cashCollected: sql<number>`${eodSubmissions.cashCollected}::float`,
    })
    .from(eodSubmissions)
    .innerJoin(users, eq(users.id, eodSubmissions.setterUserId))
    .where(
      and(
        eq(users.clientId, clientId),
        gte(eodSubmissions.submissionDate, since),
        setterUserId ? eq(eodSubmissions.setterUserId, setterUserId) : undefined,
      ),
    )
    .orderBy(desc(eodSubmissions.submissionDate), asc(users.name));
  return rows;
}

/** Set a client's appointment-setter commission rate (fraction, e.g. 0.05). */
export async function setClientCommissionPct(
  clientId: string,
  pct: number,
): Promise<void> {
  await db
    .update(clients)
    .set({ commissionPct: pct.toString() })
    .where(eq(clients.id, clientId));
}

/** Most recent weekly KPI row for a client (targets + actuals). */
export async function getLatestKpi(clientId: string): Promise<KpiRow | null> {
  const rows = await db
    .select()
    .from(kpiWeekly)
    .where(eq(kpiWeekly.clientId, clientId))
    .orderBy(desc(kpiWeekly.weekStart))
    .limit(1);
  return rows[0] ?? null;
}

/** Call recaps for a client, newest first. */
export async function listRecaps(clientId: string): Promise<RecapRow[]> {
  return db
    .select()
    .from(callRecaps)
    .where(eq(callRecaps.clientId, clientId))
    .orderBy(desc(callRecaps.callDate));
}

export type ActionItem = { text: string; owner?: string; done?: boolean };

/* ---- Recap jobs (super-admin after-call worklist) ---- */
export type RecapJobRow = typeof recapJobs.$inferSelect;
export interface RecapJobWithClient extends RecapJobRow {
  clientName: string;
  clientSlug: string;
}

export async function createRecapJob(input: {
  clientId: string;
  fathomRef: string;
  note?: string | null;
  requestedByUserId?: string | null;
}): Promise<RecapJobRow> {
  const rows = await db
    .insert(recapJobs)
    .values({
      clientId: input.clientId,
      fathomRef: input.fathomRef,
      note: input.note ?? null,
      requestedByUserId: input.requestedByUserId ?? null,
    })
    .returning();
  return rows[0];
}

export async function listRecapJobs(): Promise<RecapJobWithClient[]> {
  const rows = await db
    .select({
      id: recapJobs.id,
      clientId: recapJobs.clientId,
      fathomRef: recapJobs.fathomRef,
      note: recapJobs.note,
      status: recapJobs.status,
      requestedByUserId: recapJobs.requestedByUserId,
      recapId: recapJobs.recapId,
      createdAt: recapJobs.createdAt,
      completedAt: recapJobs.completedAt,
      clientName: clients.name,
      clientSlug: clients.slug,
    })
    .from(recapJobs)
    .leftJoin(clients, eq(recapJobs.clientId, clients.id))
    .orderBy(desc(recapJobs.createdAt));
  return rows.map((r) => ({
    ...r,
    clientName: r.clientName ?? "—",
    clientSlug: r.clientSlug ?? "",
  }));
}

export async function setRecapJobStatus(
  id: string,
  status: "pending" | "done",
  recapId?: string | null,
): Promise<void> {
  await db
    .update(recapJobs)
    .set({
      status,
      recapId: recapId ?? null,
      completedAt: status === "done" ? new Date() : null,
    })
    .where(eq(recapJobs.id, id));
}

export async function deleteRecapJob(id: string): Promise<void> {
  await db.delete(recapJobs).where(eq(recapJobs.id, id));
}

/** Insert a recap (used by the skill ingestion endpoint). Returns the new id. */
export async function createRecap(
  clientId: string,
  input: {
    title: string;
    tldr?: string | null;
    fathomUrl?: string | null;
    callDate?: string | null;
    decisions?: string[];
    actionItems?: { text: string; owner?: string }[];
  },
): Promise<RecapRow> {
  const rows = await db
    .insert(callRecaps)
    .values({
      clientId,
      title: input.title,
      tldr: input.tldr ?? null,
      fathomUrl: input.fathomUrl ?? null,
      callDate: input.callDate ?? null,
      decisionsLocked: input.decisions ?? [],
      actionItems: (input.actionItems ?? []).map((a) => ({
        text: a.text,
        owner: a.owner,
        done: false,
      })),
    })
    .returning();
  return rows[0];
}

/** A single recap by id, scoped to a client (tenant guard). */
export async function getRecapForClient(
  id: string,
  clientId: string,
): Promise<RecapRow | null> {
  const rows = await db
    .select()
    .from(callRecaps)
    .where(and(eq(callRecaps.id, id), eq(callRecaps.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Replace a recap's action items (used by the interactive checklist). */
export async function updateRecapActionItems(
  id: string,
  clientId: string,
  items: ActionItem[],
): Promise<void> {
  await db
    .update(callRecaps)
    .set({ actionItems: items })
    .where(and(eq(callRecaps.id, id), eq(callRecaps.clientId, clientId)));
}

/** Set this week's KPI targets for a client (upsert the latest week row). */
export async function setWeeklyTargets(
  clientId: string,
  targets: Record<string, number>,
): Promise<void> {
  const existing = await getLatestKpi(clientId);
  if (existing) {
    await db
      .update(kpiWeekly)
      .set({ targets })
      .where(eq(kpiWeekly.id, existing.id));
  } else {
    await db.insert(kpiWeekly).values({
      clientId,
      weekStart: "2026-06-01",
      targets,
      actuals: {},
    });
  }
}

/** Training modules for a client, in order. (Legacy per-client; prefer global.) */
export async function listModules(clientId: string): Promise<ModuleRow[]> {
  return db
    .select()
    .from(modules)
    .where(eq(modules.clientId, clientId))
    .orderBy(asc(modules.orderIndex));
}

/** The single global module catalog (the NOVA playbook), in order. */
export async function listGlobalModules(): Promise<ModuleRow[]> {
  return db
    .select()
    .from(modules)
    .where(isNull(modules.clientId))
    .orderBy(asc(modules.orderIndex));
}

/** A global module by id (clientId IS NULL). */
export async function getGlobalModuleById(id: string): Promise<ModuleRow | null> {
  const rows = await db
    .select()
    .from(modules)
    .where(and(eq(modules.id, id), isNull(modules.clientId)))
    .limit(1);
  return rows[0] ?? null;
}

/** A module by id, scoped to a client. */
export async function getModuleForClient(
  id: string,
  clientId: string,
): Promise<ModuleRow | null> {
  const rows = await db
    .select()
    .from(modules)
    .where(and(eq(modules.id, id), eq(modules.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Module ids the user has marked complete. */
export async function getCompletedModuleIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ moduleId: moduleProgress.moduleId })
    .from(moduleProgress)
    .where(eq(moduleProgress.userId, userId));
  return new Set(rows.map((r) => r.moduleId));
}

/** Mark a module complete for a user (idempotent). */
export async function markModuleComplete(
  userId: string,
  moduleId: string,
): Promise<void> {
  const existing = await db
    .select({ id: moduleProgress.id })
    .from(moduleProgress)
    .where(
      and(eq(moduleProgress.userId, userId), eq(moduleProgress.moduleId, moduleId)),
    )
    .limit(1);
  if (existing.length) {
    await db
      .update(moduleProgress)
      .set({ completedAt: new Date() })
      .where(eq(moduleProgress.id, existing[0].id));
  } else {
    await db
      .insert(moduleProgress)
      .values({ userId, moduleId, completedAt: new Date() });
  }
}

/** A module by id, not scoped to a client (admin course-builder). */
export async function getModuleById(id: string): Promise<ModuleRow | null> {
  const rows = await db.select().from(modules).where(eq(modules.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Create a GLOBAL module (clientId null). Appends to the end of the catalog. */
export async function createModule(input: {
  title: string;
  description?: string | null;
  category?: string | null;
  chapters?: Chapter[];
}): Promise<ModuleRow> {
  const existing = await db
    .select({ orderIndex: modules.orderIndex })
    .from(modules)
    .where(isNull(modules.clientId))
    .orderBy(desc(modules.orderIndex))
    .limit(1);
  const nextOrder = existing.length ? existing[0].orderIndex + 1 : 0;
  const rows = await db
    .insert(modules)
    .values({
      clientId: null,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      chapters: input.chapters ?? [],
      orderIndex: nextOrder,
    })
    .returning();
  return rows[0];
}

/** Update a module's title/description/category/chapters. */
export async function updateModule(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    category?: string | null;
    chapters?: Chapter[];
  },
): Promise<void> {
  await db.update(modules).set(input).where(eq(modules.id, id));
}

/** Delete a module (progress rows cascade via FK). */
export async function deleteModule(id: string): Promise<void> {
  await db.delete(modules).where(eq(modules.id, id));
}

/** Set a user's password hash and the must-change flag. */
export async function setUserPassword(
  userId: string,
  passwordHash: string,
  mustChange: boolean,
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: mustChange })
    .where(eq(users.id, userId));
}

/** Update a user's editable profile fields. */
export async function updateUserProfile(
  userId: string,
  input: { name?: string; timezone?: string | null },
): Promise<void> {
  await db.update(users).set(input).where(eq(users.id, userId));
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/* ---- Email-onboarding invites ---- */
export interface InvitedUserInput {
  email: string;
  name: string;
  role: Extract<UserRole, "client" | "manager" | "sales_rep" | "team_member">;
  clientId: string;
  passwordHash: string; // random/unusable until they set one via the invite
  inviteToken: string;
  inviteExpiresAt: Date;
}
export async function createInvitedUser(input: InvitedUserInput): Promise<UserRow> {
  const rows = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name,
      role: input.role,
      clientId: input.clientId,
      mustChangePassword: true,
      inviteToken: input.inviteToken,
      inviteExpiresAt: input.inviteExpiresAt,
    })
    .returning();
  return rows[0];
}

export async function getUserByInviteToken(token: string): Promise<UserRow | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.inviteToken, token))
    .limit(1);
  return rows[0] ?? null;
}

/** Set a new invite token (new invite or resend). */
export async function setInviteToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await db
    .update(users)
    .set({ inviteToken: token, inviteExpiresAt: expiresAt, mustChangePassword: true })
    .where(eq(users.id, userId));
}

/** Invitee sets their first password — clears the token and the must-change flag. */
export async function consumeInvite(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      inviteToken: null,
      inviteExpiresAt: null,
    })
    .where(eq(users.id, userId));
}

export async function listClients(): Promise<ClientRow[]> {
  return db.select().from(clients).orderBy(asc(clients.name));
}

export async function getClientBySlug(
  slug: string,
): Promise<ClientRow | null> {
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getClientById(id: string): Promise<ClientRow | null> {
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createClient(input: {
  name: string;
  slug: string;
  notionUrl?: string | null;
}): Promise<ClientRow> {
  const rows = await db
    .insert(clients)
    .values({
      name: input.name,
      slug: input.slug,
      notionUrl: input.notionUrl ?? null,
    })
    .returning();
  return rows[0];
}

/** Delete a client and everything under it (members, recaps, modules cascade via FK). */
export async function deleteClientBySlug(slug: string): Promise<void> {
  await db.delete(clients).where(eq(clients.slug, slug));
}

/** Members of a client, optionally filtered by role. Excludes admins. */
export async function listClientMembers(
  clientId: string,
): Promise<UserRow[]> {
  return db
    .select()
    .from(users)
    .where(eq(users.clientId, clientId))
    .orderBy(asc(users.name));
}

export async function emailExists(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows.length > 0;
}

export async function createMember(input: {
  email: string;
  passwordHash: string;
  name: string;
  role: Extract<
    UserRole,
    "client" | "manager" | "sales_rep" | "team_member"
  >;
  clientId: string;
}): Promise<UserRow> {
  const rows = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name,
      role: input.role,
      clientId: input.clientId,
      // Created with a temp password by an admin/manager → force a change.
      mustChangePassword: true,
    })
    .returning();
  return rows[0];
}

/**
 * Verify a slug resolves to a client AND that the given non-admin user belongs
 * to it. Returns the client when access is allowed, otherwise null (callers
 * translate null into a 404 so client existence is not revealed).
 */
export async function resolveClientAccess(input: {
  slug: string;
  role: UserRole;
  clientId: string | null;
}): Promise<ClientRow | null> {
  const client = await getClientBySlug(input.slug);
  if (!client) return null;
  if (input.role === "admin" || input.role === "super_admin") return client;
  if (input.clientId && input.clientId === client.id) return client;
  return null;
}

export async function countMembersByRole(
  clientId: string,
  role: UserRole,
): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clientId, clientId), eq(users.role, role)));
  return rows.length;
}

/* ---- Integrations ---- */
export async function listIntegrations(clientId: string): Promise<IntegrationRow[]> {
  return db
    .select()
    .from(integrations)
    .where(eq(integrations.clientId, clientId))
    .orderBy(asc(integrations.provider));
}

/** A single integration row for a client + provider. */
export async function getIntegration(
  clientId: string,
  provider: IntegrationProvider,
): Promise<IntegrationRow | null> {
  const rows = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.clientId, clientId), eq(integrations.provider, provider)))
    .limit(1);
  return rows[0] ?? null;
}

/** Set status + meta (e.g. encrypted OAuth tokens) for a provider. */
export async function setIntegrationConnection(
  clientId: string,
  provider: IntegrationProvider,
  status: IntegrationStatus,
  meta: Record<string, string> | null,
): Promise<void> {
  const existing = await getIntegration(clientId, provider);
  const connectedAt = status === "connected" ? new Date() : null;
  if (existing) {
    await db
      .update(integrations)
      .set({ status, meta, connectedAt })
      .where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({ clientId, provider, status, meta, connectedAt });
  }
}

/* ---- Calendly tracked events ---- */
export type TrackedEventRow = typeof calendlyTrackedEvents.$inferSelect;

/** Active tracked event types for an integration. */
export async function listTrackedEvents(integrationId: string): Promise<TrackedEventRow[]> {
  return db
    .select()
    .from(calendlyTrackedEvents)
    .where(
      and(
        eq(calendlyTrackedEvents.integrationId, integrationId),
        eq(calendlyTrackedEvents.active, true),
      ),
    )
    .orderBy(asc(calendlyTrackedEvents.name));
}

/** Active tracked event by its Calendly event-type URI (routes a webhook to a
 *  client + gates untracked events). URIs are globally unique in Calendly. */
export async function findActiveTrackedEventByUri(
  eventTypeUri: string,
): Promise<TrackedEventRow | null> {
  const rows = await db
    .select()
    .from(calendlyTrackedEvents)
    .where(
      and(
        eq(calendlyTrackedEvents.eventTypeUri, eventTypeUri),
        eq(calendlyTrackedEvents.active, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** An integration by id (webhook → integration → client). */
export async function getIntegrationById(id: string): Promise<IntegrationRow | null> {
  const rows = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Set of active tracked event-type URIs (webhook/sync gate). */
export async function activeTrackedUris(integrationId: string): Promise<Set<string>> {
  const rows = await listTrackedEvents(integrationId);
  return new Set(rows.map((r) => r.eventTypeUri));
}

/** Add (or re-activate) a tracked event type with its NOVA category. */
export async function upsertTrackedEvent(
  integrationId: string,
  input: { eventTypeUri: string; name: string; kind: string; duration: number; schedulingUrl: string; category?: string },
): Promise<void> {
  const existing = await db
    .select({ id: calendlyTrackedEvents.id, category: calendlyTrackedEvents.category })
    .from(calendlyTrackedEvents)
    .where(
      and(
        eq(calendlyTrackedEvents.integrationId, integrationId),
        eq(calendlyTrackedEvents.eventTypeUri, input.eventTypeUri),
      ),
    )
    .limit(1);
  if (existing.length) {
    await db
      .update(calendlyTrackedEvents)
      .set({
        active: true,
        name: input.name,
        kind: input.kind,
        duration: input.duration,
        schedulingUrl: input.schedulingUrl,
        category: input.category ?? existing[0].category,
        updatedAt: new Date(),
      })
      .where(eq(calendlyTrackedEvents.id, existing[0].id));
  } else {
    await db.insert(calendlyTrackedEvents).values({
      integrationId,
      eventTypeUri: input.eventTypeUri,
      name: input.name,
      kind: input.kind,
      duration: input.duration,
      schedulingUrl: input.schedulingUrl,
      category: input.category ?? "sales_call",
    });
  }
}

/** Update just the category of a tracked event. */
export async function setTrackedEventCategory(
  integrationId: string,
  eventTypeUri: string,
  category: string,
): Promise<void> {
  await db
    .update(calendlyTrackedEvents)
    .set({ category, updatedAt: new Date() })
    .where(
      and(
        eq(calendlyTrackedEvents.integrationId, integrationId),
        eq(calendlyTrackedEvents.eventTypeUri, eventTypeUri),
      ),
    );
}

/** Soft-delete (deactivate) tracked event types by URI. */
export async function deactivateTrackedEvents(
  integrationId: string,
  uris: string[],
): Promise<void> {
  for (const uri of uris) {
    await db
      .update(calendlyTrackedEvents)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(calendlyTrackedEvents.integrationId, integrationId),
          eq(calendlyTrackedEvents.eventTypeUri, uri),
        ),
      );
  }
}

/* ---- Webhook idempotency + audit ---- */
export async function webhookEventSeen(eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, eventId))
    .limit(1);
  return rows.length > 0;
}
export async function recordWebhookEvent(provider: string, eventId: string): Promise<void> {
  await db.insert(webhookEvents).values({ provider, eventId }).onConflictDoNothing();
}
export async function insertAudit(input: {
  clientId: string | null;
  userId: string | null;
  action: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLog).values({
    clientId: input.clientId,
    userId: input.userId,
    action: input.action,
    detail: input.detail ?? null,
  });
}

/** Replace just the meta jsonb on an integration (keeps status/connectedAt). */
export async function updateIntegrationMeta(
  clientId: string,
  provider: IntegrationProvider,
  meta: Record<string, string>,
): Promise<void> {
  await db
    .update(integrations)
    .set({ meta })
    .where(and(eq(integrations.clientId, clientId), eq(integrations.provider, provider)));
}

/** Mark an integration as needing reconnection (refresh failed). */
export async function setIntegrationReauth(clientId: string): Promise<void> {
  await db
    .update(integrations)
    .set({ status: "reauth_required" })
    .where(and(eq(integrations.clientId, clientId), eq(integrations.provider, "calendly")));
}

/** Find a lead by email within a client (Calendly dedup). */
export async function findLeadByEmail(
  clientId: string,
  email: string,
): Promise<LeadRow | null> {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.clientId, clientId), eq(leads.email, email.toLowerCase())))
    .limit(1);
  return rows[0] ?? null;
}

/** Insert or update a booking keyed by its Calendly invitee URI. Preserves any
 *  manually-logged disposition (outcome) on update. */
export async function upsertCalendlyBooking(input: {
  clientId: string;
  leadId: string | null;
  calendlyEventUri: string;
  calendlyInviteeUri: string;
  callType: string | null;
  scheduledAt: Date;
  status: string;
  meetingUrl: string | null;
  calendlyAnswers: CalendlyAnswer[];
  inviteeName: string | null;
  inviteeEmail: string | null;
}): Promise<"inserted" | "updated"> {
  const existing = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.calendlyInviteeUri, input.calendlyInviteeUri))
    .limit(1);
  if (existing.length) {
    await db
      .update(bookings)
      .set({
        leadId: input.leadId,
        callType: input.callType,
        scheduledAt: input.scheduledAt,
        status: input.status,
        meetingUrl: input.meetingUrl,
        calendlyAnswers: input.calendlyAnswers,
        calendlyEventUri: input.calendlyEventUri,
        inviteeName: input.inviteeName,
        inviteeEmail: input.inviteeEmail,
      })
      .where(eq(bookings.id, existing[0].id));
    return "updated";
  }
  await db.insert(bookings).values({
    clientId: input.clientId,
    leadId: input.leadId,
    callType: input.callType,
    scheduledAt: input.scheduledAt,
    status: input.status,
    meetingUrl: input.meetingUrl,
    calendlyAnswers: input.calendlyAnswers,
    calendlyEventUri: input.calendlyEventUri,
    calendlyInviteeUri: input.calendlyInviteeUri,
    inviteeName: input.inviteeName,
    inviteeEmail: input.inviteeEmail,
  });
  return "inserted";
}

/** Upsert a provider's status for a client. */
export async function setIntegrationStatus(
  clientId: string,
  provider: IntegrationProvider,
  status: IntegrationStatus,
): Promise<void> {
  const existing = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(eq(integrations.clientId, clientId), eq(integrations.provider, provider)),
    )
    .limit(1);
  const connectedAt = status === "connected" ? new Date() : null;
  if (existing.length) {
    await db
      .update(integrations)
      .set({ status, connectedAt })
      .where(eq(integrations.id, existing[0].id));
  } else {
    await db
      .insert(integrations)
      .values({ clientId, provider, status, connectedAt });
  }
}

export interface ClientIntegrations {
  client: ClientRow;
  integrations: IntegrationRow[];
}
/** Every client with their integration rows (admin cross-client view). */
export async function listAllIntegrations(): Promise<ClientIntegrations[]> {
  const allClients = await listClients();
  const rows = await db.select().from(integrations);
  return allClients.map((client) => ({
    client,
    integrations: rows.filter((r) => r.clientId === client.id),
  }));
}

/* ---- Feedback ---- */
export async function insertFeedback(
  userId: string,
  clientId: string | null,
  message: string,
): Promise<void> {
  await db.insert(feedback).values({ userId, clientId, message });
}

export interface FeedbackWithUser extends FeedbackRow {
  userName: string;
  userRole: UserRole;
}
export async function listFeedback(): Promise<FeedbackWithUser[]> {
  const rows = await db
    .select({
      id: feedback.id,
      userId: feedback.userId,
      clientId: feedback.clientId,
      message: feedback.message,
      createdAt: feedback.createdAt,
      userName: users.name,
      userRole: users.role,
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.userId, users.id))
    .orderBy(desc(feedback.createdAt));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    clientId: r.clientId,
    message: r.message,
    createdAt: r.createdAt,
    userName: r.userName ?? "Unknown",
    userRole: (r.userRole ?? "team_member") as UserRole,
  }));
}
