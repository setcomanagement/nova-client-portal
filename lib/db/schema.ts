import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  numeric,
  boolean,
  jsonb,
  date,
  index,
  unique,
} from "drizzle-orm/pg-core";

/*
  Role model (4 roles, single users table):
    admin        -> Matt; sees everything, creates clients
    client       -> the account login (Akira / Tone / Alex); manages their own org
    sales_rep    -> a setter that belongs to one client
    team_member  -> other team member that belongs to one client

  Every non-admin user belongs to exactly one client via users.client_id.
  Admin rows have client_id = null.
*/
export const userRole = pgEnum("user_role", [
  "admin",
  "client",
  "sales_rep",
  "team_member",
  "super_admin",
  "manager",
]);

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  brandColor: text("brand_color").notNull().default("#A0703C"),
  notionUrl: text("notion_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull(),
    name: text("name").notNull(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    timezone: text("timezone"),
    // true after an admin/manager creates or resets the account with a temp
    // password; the user is forced to set their own before using the app.
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    // Email-onboarding: a one-time token the invitee uses to set their first
    // password at /invite/<token>. Cleared once consumed.
    inviteToken: text("invite_token").unique(),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("users_client_id_idx").on(t.clientId)],
);

export type Lesson = {
  title: string;
  videoUrl?: string;
  summary?: string;
  links?: { label: string; url?: string }[];
};
export type Chapter = { title: string; lessons: Lesson[] };

export const callRecaps = pgTable(
  "call_recaps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    fathomUrl: text("fathom_url"),
    title: text("title").notNull(),
    tldr: text("tldr"),
    decisionsLocked: jsonb("decisions_locked").$type<string[]>(),
    actionItems: jsonb("action_items").$type<
      { text: string; owner?: string; done?: boolean }[]
    >(),
    callDate: date("call_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("call_recaps_client_date_idx").on(t.clientId, t.callDate)],
);

// Modules are a single GLOBAL catalog (the NOVA playbook). client_id is
// nullable: NULL = global (shown to every client). Per-user completion lives
// in module_progress, so progress stays individual even though content is shared.
export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  chapters: jsonb("chapters").$type<Chapter[]>(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const moduleProgress = pgTable("module_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const kpiWeekly = pgTable("kpi_weekly", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  targets: jsonb("targets").$type<Record<string, number>>(),
  actuals: jsonb("actuals").$type<Record<string, number>>(),
});

/*
  EOD submissions — spec §6. The brief sketch lists 22 columns; §6 states 23
  fields. The spec file (nova-client-portal-spec.md) is not yet in the repo, so
  the 23rd field is unknown. These 22 match the brief; reconcile against §6
  before building the EOD form (Day 2).
*/
export const eodSubmissions = pgTable(
  "eod_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    setterUserId: uuid("setter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    submissionDate: date("submission_date").notNull(),
    outbound: integer("outbound").notNull().default(0),
    inbound: integer("inbound").notNull().default(0),
    followUps: integer("follow_ups").notNull().default(0),
    totalConvos: integer("total_convos").notNull().default(0),
    callsPitched: integer("calls_pitched").notNull().default(0),
    callsBooked: integer("calls_booked").notNull().default(0),
    qualifiedBooked: integer("qualified_booked").notNull().default(0),
    callsDeclined: integer("calls_declined").notNull().default(0),
    showUps: integer("show_ups").notNull().default(0),
    closes: integer("closes").notNull().default(0),
    revenue: numeric("revenue", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    cashCollected: numeric("cash_collected", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    performanceRating: integer("performance_rating"),
    skillRating: integer("skill_rating"),
    wentWell: text("went_well"),
    goneBetter: text("gone_better"),
    tomorrowDifferent: text("tomorrow_different"),
    leadQuality: text("lead_quality"),
    bottleneck: text("bottleneck"),
    topObjection: text("top_objection"),
    objectionOther: text("objection_other"),
    missedAnything: text("missed_anything"),
    managerRequest: text("manager_request"),
    accuracyConfirmed: boolean("accuracy_confirmed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("eod_setter_date_idx").on(t.setterUserId, t.submissionDate),
  ],
);

/* Announcements — admin posts; shown as a banner on org pages. */
export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  message: text("message").notNull(),
  audience: text("audience").notNull().default("all"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* Leads — every booking ties to a lead (per client). */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    source: text("source"),
    stage: text("stage").notNull().default("new"), // new|booked|showed|closed|lost
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("leads_client_idx").on(t.clientId)],
);

/* Integrations — per-client connection state. UI + persisted status now; real
   OAuth wired at deploy. provider: calendly|discord|notion|google.
   status: connected|disconnected|coming_soon. */
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("disconnected"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    meta: jsonb("meta").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("integrations_client_provider_idx").on(t.clientId, t.provider)],
);

/* Feedback — "help us improve" box; surfaces in admin Insights inbox. */
export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type IntegrationProvider = "calendly" | "discord" | "notion" | "google";
export type IntegrationStatus =
  | "connected"
  | "disconnected"
  | "coming_soon"
  | "reauth_required";

/* Calendly event types the client has chosen to track — only these create
   NOVA bookings (the webhook + manual sync skip everything else). */
export const calendlyTrackedEvents = pgTable(
  "calendly_tracked_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    eventTypeUri: text("event_type_uri").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // solo | group | collective
    // How this event maps into NOVA: sales_call → creates a lead; client_call
    // → existing client (no lead); other → booking only, no lead.
    category: text("category").notNull().default("sales_call"),
    duration: integer("duration").notNull(),
    schedulingUrl: text("scheduling_url").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("tracked_events_integration_uri").on(t.integrationId, t.eventTypeUri),
    index("tracked_events_active_idx").on(t.integrationId, t.active),
  ],
);

/* Idempotency ledger for inbound provider webhooks (dedupe redeliveries). */
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull().unique(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/* Append-only audit trail for sensitive integration mutations. */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/*
  Recap jobs — the super-admin "after-call" worklist. Each row is a queued
  intent to produce a recap for a client from a Fathom call. The actual recap
  is generated by the nova-recap-publish skill (run in Claude Code) and lands
  back via POST /api/recaps; the operator marks the job done (or it auto-links).
*/
export const recapJobs = pgTable(
  "recap_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    fathomRef: text("fathom_ref").notNull(), // link / call id / "my last call with X"
    note: text("note"),
    status: text("status").notNull().default("pending"), // pending | done
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    recapId: uuid("recap_id").references(() => callRecaps.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("recap_jobs_status_idx").on(t.status, t.createdAt)],
);

export type CalendlyAnswer = { q: string; a: string };
export type BookingOutcome = {
  showedUp?: boolean;
  closed?: boolean;
  dealValue?: number;
  reason?: string;
  secondCall?: boolean;
  notes?: string;
};

/* Bookings — Calendly events synced into the portal. */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    setterUserId: uuid("setter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    callType: text("call_type"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"), // scheduled|completed|no_show|canceled
    meetingUrl: text("meeting_url"),
    calendlyAnswers: jsonb("calendly_answers").$type<CalendlyAnswer[]>(),
    outcome: jsonb("outcome").$type<BookingOutcome>(),
    // Calendly sync provenance — idempotent upsert key (one invitee = one booking).
    calendlyEventUri: text("calendly_event_uri"),
    calendlyInviteeUri: text("calendly_invitee_uri").unique(),
    // The invitee's name/email — always set from Calendly so the calendar +
    // agenda can show the person even when no lead is created (client/other).
    inviteeName: text("invitee_name"),
    inviteeEmail: text("invitee_email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bookings_client_sched_idx").on(t.clientId, t.scheduledAt)],
);
