import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClientSchema } from "@/lib/clients/schema";
import { ProvisionError, provisionClient } from "@/lib/clients/provision";

export const runtime = "nodejs";

/**
 * External provisioning endpoint — creates a client org and invites its owner,
 * the same outcome as the admin "Create client + invite owner" form (see
 * createClientAction in app/(admin)/admin/clients/actions.ts), but callable
 * from external services (e.g. Make.com) via a shared-secret Bearer token.
 *
 * Auth: `Authorization: Bearer <PROVISION_API_KEY>`, compared in constant time.
 * Validation, slug derivation, and service calls are shared with the form path.
 */

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Constant-time secret comparison that never throws on length mismatch. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const ts = new Date().toISOString();

  const expected = process.env.PROVISION_API_KEY;
  if (!expected) {
    // Server is not configured to accept provisioning calls. Don't leak this
    // to the caller beyond a generic 500.
    console.error(`[provision] ${ts} PROVISION_API_KEY not set — refusing`);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !secretMatches(token, expected)) {
    console.warn(`[provision] ${ts} 401 unauthorized ip=${ip}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      console.warn(`[provision] ${ts} 400 invalid json ip=${ip}`);
      return NextResponse.json(
        { error: "validation_error", details: [{ message: "Invalid JSON body" }] },
        { status: 400 },
      );
    }

    const parsed = createClientSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`[provision] ${ts} 400 validation_error ip=${ip}`);
      return NextResponse.json(
        { error: "validation_error", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await provisionClient(parsed.data);
    console.info(
      `[provision] ${ts} 201 created org=${result.organizationId} owner=${result.ownerEmail} ` +
        `discord=${Boolean(parsed.data.discordInviteUrl)} workspace=${Boolean(parsed.data.clientServerInvite)} ip=${ip}`,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ProvisionError) {
      if (err.code === "empty_slug") {
        console.warn(`[provision] ${ts} 400 empty slug ip=${ip}`);
        return NextResponse.json(
          {
            error: "validation_error",
            details: [{ message: "Could not derive a slug from that name." }],
          },
          { status: 400 },
        );
      }
      if (err.code === "duplicate_slug") {
        console.warn(`[provision] ${ts} 409 duplicate slug=${err.slug} ip=${ip}`);
        return NextResponse.json(
          { error: "duplicate", field: "slug" },
          { status: 409 },
        );
      }
      console.warn(
        `[provision] ${ts} 409 duplicate email=${err.email} ip=${ip}`,
      );
      return NextResponse.json(
        { error: "duplicate", field: "email" },
        { status: 409 },
      );
    }
    console.error(`[provision] ${ts} 500 internal ip=${ip}`, err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
