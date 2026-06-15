import { NextResponse } from "next/server";
import { createRecap, getClientById, getUserByEmail } from "@/lib/db/queries";

export const runtime = "nodejs";

/**
 * Recap ingestion from the nova-recap-publish skill.
 *
 * Auth: `Authorization: Bearer <RECAP_INGEST_TOKEN>`. If the env var is unset
 * and we're not in production, a dev fallback token is accepted (local PGlite
 * only). In production with no token configured the route refuses to run.
 *
 * Identity: the call's non-Matt invitee email is matched against the portal
 * users table; that user's client_id owns the recap. Unresolved → 422.
 */
const DEV_FALLBACK = "dev-recap-token";

function resolveToken(): string | null {
  const configured = process.env.RECAP_INGEST_TOKEN;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return DEV_FALLBACK;
  return null; // prod + unconfigured → refuse
}

interface RecapPayload {
  clientEmail?: unknown;
  title?: unknown;
  tldr?: unknown;
  fathomUrl?: unknown;
  callDate?: unknown;
  decisions?: unknown;
  actionItems?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(req: Request) {
  const expected = resolveToken();
  if (!expected) {
    return NextResponse.json(
      { error: "ingestion not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: RecapPayload;
  try {
    body = (await req.json()) as RecapPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const clientEmail = asString(body.clientEmail)?.toLowerCase();
  const title = asString(body.title);
  if (!clientEmail || !title) {
    return NextResponse.json(
      { error: "clientEmail and title are required" },
      { status: 400 },
    );
  }

  const user = await getUserByEmail(clientEmail);
  if (!user || !user.clientId) {
    return NextResponse.json(
      { error: `no portal client for ${clientEmail}` },
      { status: 422 },
    );
  }
  const client = await getClientById(user.clientId);
  if (!client) {
    return NextResponse.json(
      { error: "client record missing" },
      { status: 422 },
    );
  }

  const decisions = Array.isArray(body.decisions)
    ? (body.decisions.filter((d) => typeof d === "string") as string[])
    : [];
  const actionItems = Array.isArray(body.actionItems)
    ? body.actionItems
        .filter((a): a is { text: string; owner?: string } => {
          return !!a && typeof (a as { text?: unknown }).text === "string";
        })
        .map((a) => ({ text: a.text, owner: typeof a.owner === "string" ? a.owner : undefined }))
    : [];

  const recap = await createRecap(client.id, {
    title,
    tldr: asString(body.tldr),
    fathomUrl: asString(body.fathomUrl),
    callDate: asString(body.callDate),
    decisions,
    actionItems,
  });

  return NextResponse.json(
    { id: recap.id, slug: client.slug, url: `/${client.slug}/recaps/${recap.id}` },
    { status: 201 },
  );
}
