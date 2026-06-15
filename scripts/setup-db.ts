/*
  Migrate + seed, driver-aware.
    no DATABASE_URL  -> PGlite (./.pglite)
    DATABASE_URL set -> postgres-js (Neon)

  Run with: pnpm db:setup
*/
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import * as schema from "../lib/db/schema";
import { resolveMigrationUrl } from "../lib/db/url";
import { hashPassword } from "../lib/auth/password";

// Load .env.local if present (Node 20.12+/24 builtin).
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fall back to ambient env (e.g. CI / Vercel)
}

const MIGRATIONS = "./drizzle";

const ADMIN = {
  email: "matthewbryanchuang@gmail.com",
  password: "admin123",
  name: "Matt Chuang",
} as const;

type AnyDb = ReturnType<typeof drizzlePglite<typeof schema>>;

async function seed(db: AnyDb): Promise<void> {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, ADMIN.email));

  if (existing.length > 0) {
    // Ensure the seeded owner is super_admin even on previously-seeded DBs.
    await db
      .update(schema.users)
      .set({ role: "super_admin" })
      .where(eq(schema.users.email, ADMIN.email));
    console.log(`Admin ${ADMIN.email} exists — ensured role super_admin.`);
    return;
  }

  // Prod: set a strong password via ADMIN_PASSWORD. Local: falls back to the
  // dev default. The super_admin is the only account seeded in production.
  const adminPassword = process.env.ADMIN_PASSWORD || ADMIN.password;
  const passwordHash = await hashPassword(adminPassword);
  await db.insert(schema.users).values({
    email: ADMIN.email,
    passwordHash,
    role: "super_admin",
    name: ADMIN.name,
    clientId: null,
  });
  console.log(
    `Seeded super_admin: ${ADMIN.email}` +
      (process.env.ADMIN_PASSWORD ? " (password from ADMIN_PASSWORD)" : " (dev default password)"),
  );
}

/** Demo org so the portal renders real content out of the box. */
async function seedDemo(db: AnyDb): Promise<void> {
  const existing = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(eq(schema.clients.slug, "tone"));
  if (existing.length > 0) {
    console.log("Demo org 'tone' already exists — skipping demo seed.");
    return;
  }

  const [tone] = await db
    .insert(schema.clients)
    .values({ slug: "tone", name: "Tone", brandColor: "#A0703C" })
    .returning();
  const [akira] = await db
    .insert(schema.clients)
    .values([
      { slug: "akira", name: "Akira", brandColor: "#A0703C" },
      { slug: "alex", name: "Alex", brandColor: "#A0703C" },
    ])
    .returning();

  const pw = await hashPassword("demo123");
  await db.insert(schema.users).values([
    { email: "owner@tone.co", passwordHash: pw, role: "client", name: "Tone Owner", clientId: tone.id },
    { email: "jordan@tone.co", passwordHash: pw, role: "manager", name: "Jordan Méndez", clientId: tone.id },
  ]);
  const [rep1] = await db
    .insert(schema.users)
    .values({ email: "rep1@tone.co", passwordHash: pw, role: "sales_rep", name: "Rep One", clientId: tone.id })
    .returning();
  await db
    .insert(schema.users)
    .values({ email: "rep2@tone.co", passwordHash: pw, role: "sales_rep", name: "Rep Two", clientId: tone.id });

  // A week of EODs for Rep One (Mon–Fri).
  const days = [
    { d: "2026-06-01", ob: 40, ib: 12, fu: 9, pi: 7, bk: 4, ql: 3, dc: 1, rev: "4000", cash: "2000" },
    { d: "2026-06-02", ob: 36, ib: 9, fu: 11, pi: 6, bk: 2, ql: 2, dc: 2, rev: "0", cash: "0" },
    { d: "2026-06-03", ob: 44, ib: 14, fu: 8, pi: 8, bk: 3, ql: 2, dc: 1, rev: "3500", cash: "1500" },
    { d: "2026-06-04", ob: 38, ib: 11, fu: 12, pi: 7, bk: 4, ql: 3, dc: 0, rev: "6000", cash: "3000" },
    { d: "2026-06-05", ob: 30, ib: 8, fu: 7, pi: 5, bk: 1, ql: 1, dc: 1, rev: "0", cash: "0" },
  ];
  await db.insert(schema.eodSubmissions).values(
    days.map((x) => ({
      setterUserId: rep1.id,
      submissionDate: x.d,
      outbound: x.ob,
      inbound: x.ib,
      followUps: x.fu,
      totalConvos: x.ob + x.ib + x.fu,
      callsPitched: x.pi,
      callsBooked: x.bk,
      qualifiedBooked: x.ql,
      callsDeclined: x.dc,
      revenue: x.rev,
      cashCollected: x.cash,
      performanceRating: 8,
      skillRating: 7,
      wentWell: "Strong tonality on the discovery calls.",
      goneBetter: "Ask for the close sooner.",
      tomorrowDifferent: "Pitch the call earlier in the conversation.",
      leadQuality: "Good",
      bottleneck: "Not enough follow-ups",
      topObjection: "Price",
      missedAnything: "No, nothing missed",
      managerRequest: "Updated pricing sheet for the new offer.",
      accuracyConfirmed: true,
    })),
  );

  await db.insert(schema.kpiWeekly).values({
    clientId: tone.id,
    weekStart: "2026-06-01",
    targets: { callsBooked: 20, showUps: 14, closes: 6, cash: 30000 },
    actuals: { callsBooked: 14, showUps: 11, closes: 5, cash: 19000 },
  });

  await db.insert(schema.callRecaps).values([
    {
      clientId: tone.id,
      title: "Strategy call",
      callDate: "2026-05-24",
      fathomUrl: "https://fathom.video/calls/000",
      tldr: "Tighten the offer to one flagship outcome, lead every booked call with the ROI timeline, and ship the case-study one-pager this week.",
      decisionsLocked: [
        "One flagship offer, retire the add-ons",
        "Weekly target raised to 20 booked calls",
        "Case study becomes the standard follow-up",
      ],
      actionItems: [
        { text: "Send the case-study one-pager to Priya & Marcus", done: true },
        { text: "Rewrite the booking-script intro around ROI timeline", done: true },
        { text: "Set the weekly target to 20 booked calls", done: true },
        { text: "Record a 90-sec Loom on the 'spousal approval' objection", done: false },
        { text: "Add the new objection reasons to the EOD form", done: false },
      ],
    },
    {
      clientId: tone.id,
      title: "Onboarding call",
      callDate: "2026-05-17",
      tldr: "Access, tooling, and the first week's targets.",
      decisionsLocked: ["Calendly connected", "First-week target: 15 calls"],
      actionItems: [
        { text: "Connect Calendly", done: true },
        { text: "Invite the two setters", done: true },
      ],
    },
    {
      clientId: tone.id,
      title: "Discovery call",
      callDate: "2026-05-10",
      tldr: "Goals, current funnel, and where NOVA fits.",
      decisionsLocked: ["Engagement starts Monday"],
      actionItems: [
        { text: "Sign the agreement", done: false },
        { text: "Share funnel metrics", done: false },
      ],
    },
  ]);

  await db.insert(schema.modules).values([
    {
      clientId: null,
      title: "Booking-call framework",
      description: "The 5-beat discovery structure.",
      orderIndex: 1,
      chapters: [
        {
          title: "Chapter 1 · Fundamentals",
          lessons: [
            { title: "Frame the call", summary: "Set the frame in the first 30 seconds — who you are, why the call matters, and what happens at the end. Get explicit agreement to the agenda.", links: [{ label: "Frame-setting script (Google Doc)" }, { label: "Example call · first two minutes" }] },
            { title: "Diagnose the gap", summary: "Run the three diagnostic questions to surface the real gap and quantify the cost of staying stuck.", links: [{ label: "Diagnostic question bank" }] },
          ],
        },
        {
          title: "Chapter 2 · The pitch",
          lessons: [
            { title: "Amplify the cost", summary: "Make the cost of inaction concrete and personal before presenting any solution." },
            { title: "Prescribe the offer", summary: "Position the program as the bridge across the gap — prescribe, don't pitch." },
          ],
        },
        {
          title: "Chapter 3 · Closing",
          lessons: [
            { title: "Close & next steps", summary: "Ask for the decision directly, then lock the next step on the call." },
          ],
        },
      ],
    },
    {
      clientId: null,
      title: "Handling price objections",
      description: "Reframe price as ROI timeline.",
      orderIndex: 2,
      chapters: [
        {
          title: "Chapter 1 · The reframe",
          lessons: [
            { title: "Price vs cost-of-inaction", summary: "Anchor the price against the cost they already told you." },
            { title: "The ROI timeline", summary: "Walk them through when the investment pays back." },
          ],
        },
      ],
    },
    {
      clientId: null,
      title: "Follow-up sequences",
      description: "Turn 'let me think' into a booked second call.",
      orderIndex: 3,
      chapters: [
        {
          title: "Chapter 1 · The sequence",
          lessons: [
            { title: "The 48-hour touch", summary: "What to send and when after a no-close." },
            { title: "Booking the second call", summary: "Make the next step concrete and easy to say yes to." },
          ],
        },
      ],
    },
  ]);

  // Leads + bookings (Calendly side)
  const leadRows = await db
    .insert(schema.leads)
    .values([
      { clientId: tone.id, name: "Priya Shah", email: "priya@shah.dev", source: "Webinar", stage: "closed", ownerUserId: rep1.id, notes: "Decision-maker. Responsive over email." },
      { clientId: tone.id, name: "Marcus Reed", email: "marcus@reedco.io", source: "IG DM", stage: "booked", ownerUserId: rep1.id, notes: "Cashflow pressure — lead with ROI." },
      { clientId: tone.id, name: "Jordan Kim", email: "jordan@kim.co", source: "Referral", stage: "lost", ownerUserId: rep1.id },
      { clientId: tone.id, name: "Dana Liu", email: "dana@liu.studio", source: "IG DM", stage: "booked", ownerUserId: rep1.id },
      { clientId: tone.id, name: "Sam Ortiz", email: "sam@ortiz.io", source: "Webinar", stage: "showed", ownerUserId: rep1.id },
    ])
    .returning();
  const L = Object.fromEntries(leadRows.map((r) => [r.name, r.id]));
  await db.insert(schema.bookings).values([
    {
      clientId: tone.id, leadId: L["Marcus Reed"], setterUserId: rep1.id, callType: "Discovery",
      scheduledAt: new Date("2026-06-01T15:00:00"), status: "scheduled",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      calendlyAnswers: [
        { q: "What's your biggest challenge right now?", a: "Cashflow — feast-or-famine months." },
        { q: "Monthly revenue?", a: "$20–40k" },
        { q: "Are you the decision-maker?", a: "Run it by a partner" },
        { q: "How did you hear about us?", a: "Instagram DM" },
        { q: "What do you want from this call?", a: "A clear plan to stabilise revenue." },
      ],
    },
    { clientId: tone.id, leadId: L["Dana Liu"], setterUserId: rep1.id, callType: "Discovery", scheduledAt: new Date("2026-06-02T11:30:00"), status: "scheduled", meetingUrl: "https://meet.google.com/xyz" },
    { clientId: tone.id, leadId: L["Priya Shah"], setterUserId: rep1.id, callType: "Discovery", scheduledAt: new Date("2026-05-30T14:00:00"), status: "completed", outcome: { showedUp: true, closed: true, dealValue: 4000, notes: "Signed after the ROI breakdown." } },
    { clientId: tone.id, leadId: L["Jordan Kim"], setterUserId: rep1.id, callType: "Discovery", scheduledAt: new Date("2026-05-29T16:00:00"), status: "no_show", outcome: { showedUp: false, reason: "Ghosted" } },
    { clientId: tone.id, leadId: L["Sam Ortiz"], setterUserId: rep1.id, callType: "Discovery", scheduledAt: new Date("2026-05-28T13:00:00"), status: "completed", outcome: { showedUp: true, closed: false, reason: "Wanted to think", secondCall: true } },
  ]);

  await db.insert(schema.announcements).values({
    message: "New flagship offer is live — lead every booked call with the ROI timeline.",
    audience: "all",
    active: true,
  });

  // Integrations — Tone has Calendly live; Discord/Notion are Phase 2; Google off.
  await db.insert(schema.integrations).values([
    { clientId: tone.id, provider: "calendly", status: "connected", connectedAt: new Date("2026-06-01T08:00:00") },
    { clientId: tone.id, provider: "discord", status: "coming_soon" },
    { clientId: tone.id, provider: "notion", status: "coming_soon" },
    { clientId: tone.id, provider: "google", status: "disconnected" },
    { clientId: akira.id, provider: "calendly", status: "connected", connectedAt: new Date("2026-06-01T07:00:00") },
  ]);

  // One feedback row so the admin Insights inbox has real content.
  await db.insert(schema.feedback).values({
    userId: rep1.id,
    clientId: tone.id,
    message: "Wish the EOD form remembered yesterday's numbers.",
  });

  console.log("Seeded demo org: tone (+ akira, alex), 4 users, KPIs, 3 recaps, 3 GLOBAL modules, 5 leads, 5 bookings, 1 announcement, 5 integrations, 1 feedback.");
}

async function main(): Promise<void> {
  const url = resolveMigrationUrl();
  // Demo orgs (Tone/Akira/Alex) seed locally for convenience, but NOT against a
  // real database unless SEED_DEMO=true. Production starts with just the
  // super_admin, who provisions real clients through the admin UI.
  const wantDemo = !url || process.env.SEED_DEMO === "true";

  if (url) {
    console.log("Using postgres-js (DATABASE_URL set).");
    const client = postgres(url, { max: 1 });
    const db = drizzlePostgres(client, { schema });
    await migratePostgres(db, { migrationsFolder: MIGRATIONS });
    await seed(db as unknown as AnyDb);
    if (wantDemo) await seedDemo(db as unknown as AnyDb);
    else console.log("Skipping demo seed (production; set SEED_DEMO=true to include it).");
    await client.end();
  } else {
    console.log("Using PGlite (./.pglite) — no DATABASE_URL.");
    const client = new PGlite("./.pglite");
    const db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder: MIGRATIONS });
    await seed(db);
    if (wantDemo) await seedDemo(db);
    await client.close();
  }

  console.log("Database ready.");
}

main().catch((err) => {
  console.error("setup-db failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
