/*
  nova-sentinel · seed.ts  (run via: npx tsx scripts/sentinel/seed.ts)
  Wipes eod_submissions and inserts a deterministic multi-client/multi-setter
  dataset, sets commission rates, ensures the Tone role accounts exist, and mints
  session tokens. Emits the full dataset + tokens as JSON to stdout so the stress
  harness can recompute expectations and drive each role.

  Local PGlite only (no DATABASE_URL). Run with the dev server stopped.
*/
import { eq, inArray } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../lib/db/schema";
import { hashPassword } from "../../lib/auth/password";
import { signSession } from "../../lib/auth/jwt";
import type { UserRole } from "../../lib/auth/jwt";

try { process.loadEnvFile(".env.local"); } catch {}

function isoDaysAgo(days: number): string {
  const n = new Date();
  const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function eod(date: string, outbound: number, followUps: number, totalConvos: number, callsPitched: number, callsBooked: number, showUps: number, closes: number, cashCollected: number) {
  return { date, outbound, followUps, totalConvos, callsPitched, callsBooked, showUps, closes, cashCollected };
}
const D0 = isoDaysAgo(0), D5 = isoDaysAgo(5), D40 = isoDaysAgo(40), D100 = isoDaysAgo(100);

const PLAN: Record<string, { commissionPct: number; setters: Record<string, ReturnType<typeof eod>[]> }> = {
  tone: { commissionPct: 0.10, setters: {
    "Anthony Reyes": [eod(D0,30,6,20,8,5,3,2,4000), eod(D5,28,5,18,7,4,3,1,2000), eod(D40,35,7,22,9,6,4,3,6000), eod(D100,20,4,15,5,3,2,1,1500)],
    "Bella Cruz": [eod(D0,25,4,16,6,4,2,1,2500), eod(D40,32,6,19,8,5,4,2,5000)],
  } },
  akira: { commissionPct: 0.05, setters: {
    "Carlos Mehta": [eod(D5,22,3,14,6,3,2,1,1800), eod(D40,27,5,17,7,4,3,2,3600)],
    "Dana Lin": [eod(D0,33,7,21,9,6,5,3,7000), eod(D100,18,2,12,4,2,1,0,0)],
  } },
  alex: { commissionPct: 0.0, setters: {
    "Evan Park": [eod(D5,20,3,13,5,3,2,1,1500)],
  } },
};

// Tone accounts to ensure + mint role tokens for (route sweep / role gates).
const TONE_ROLES: { email: string; name: string; role: Extract<UserRole, "client"|"manager"|"team_member"> }[] = [
  { email: "owner@tone.co", name: "Tone Owner", role: "client" },
  { email: "jordan@tone.co", name: "Jordan Méndez", role: "manager" },
  { email: "team@tone.co", name: "Tone Team", role: "team_member" },
];

async function main() {
  const db = drizzle(new PGlite("./.pglite"), { schema });
  await db.delete(schema.eodSubmissions);

  const clientRows = await db.select().from(schema.clients).where(inArray(schema.clients.slug, ["tone", "akira", "alex"]));
  const bySlug = Object.fromEntries(clientRows.map((c) => [c.slug, c]));
  const pw = await hashPassword("demo123");

  const out: any = { clients: [], eods: [], tokens: {}, dates: { D0, D5, D40, D100 } };
  const repBySlug: Record<string, { name: string; id: string }> = {};

  for (const [slug, cfg] of Object.entries(PLAN)) {
    const client = bySlug[slug];
    await db.update(schema.clients).set({ commissionPct: cfg.commissionPct.toString() }).where(eq(schema.clients.id, client.id));
    const setterMeta: { name: string; id: string }[] = [];
    let first = true;
    for (const [name, eods] of Object.entries(cfg.setters)) {
      const email = name.toLowerCase().replace(/[^a-z]+/g, ".") + "@" + slug + ".co";
      let [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
      if (!u) [u] = await db.insert(schema.users).values({ email, passwordHash: pw, role: "sales_rep", name, clientId: client.id }).returning();
      setterMeta.push({ name, id: u.id });
      if (first) { repBySlug[slug] = { name, id: u.id }; first = false; }
      for (const e of eods) {
        await db.insert(schema.eodSubmissions).values({
          setterUserId: u.id, submissionDate: e.date, outbound: e.outbound, inbound: 0, followUps: e.followUps,
          totalConvos: e.totalConvos, callsPitched: e.callsPitched, callsBooked: e.callsBooked, qualifiedBooked: 0,
          callsDeclined: 0, showUps: e.showUps, closes: e.closes, revenue: e.cashCollected.toFixed(2),
          cashCollected: e.cashCollected.toFixed(2), accuracyConfirmed: true,
        });
        out.eods.push({ clientSlug: slug, setterId: u.id, setterName: name, ...e });
      }
    }
    out.clients.push({ slug, name: client.name, id: client.id, commissionPct: cfg.commissionPct, setters: setterMeta });
  }

  const [sa] = await db.select().from(schema.users).where(eq(schema.users.email, "matthewbryanchuang@gmail.com"));
  out.tokens.super = await signSession({ userId: sa.id, role: sa.role, clientId: null, clientSlug: null });
  for (const [slug, rep] of Object.entries(repBySlug)) {
    const client = bySlug[slug];
    out.tokens["rep_" + slug] = { token: await signSession({ userId: rep.id, role: "sales_rep", clientId: client.id, clientSlug: slug }), setterId: rep.id, name: rep.name, slug };
  }
  // Tone role accounts (ensure + token).
  const tone = bySlug["tone"];
  for (const r of TONE_ROLES) {
    let [u] = await db.select().from(schema.users).where(eq(schema.users.email, r.email));
    if (!u) [u] = await db.insert(schema.users).values({ email: r.email, passwordHash: pw, role: r.role, name: r.name, clientId: tone.id }).returning();
    out.tokens["tone_" + r.role] = { token: await signSession({ userId: u.id, role: r.role, clientId: tone.id, clientSlug: "tone" }) };
  }

  console.log(JSON.stringify(out));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
