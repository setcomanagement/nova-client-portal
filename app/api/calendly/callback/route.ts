import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveClientAccess } from "@/lib/db/queries";
import { exchangeCode, storeTokens, verifyState } from "@/lib/calendly";

export const runtime = "nodejs";

const ALLOWED = ["client", "admin", "super_admin"];

function origin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Calendly redirects back here after the user allows access.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const slug = await verifyState(url.searchParams.get("state") ?? "");
  if (!slug) return NextResponse.redirect(new URL("/home", req.url));
  if (error || !code)
    return NextResponse.redirect(new URL(`/${slug}/integrations?calendly=denied`, req.url));

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (!ALLOWED.includes(session.role)) return NextResponse.redirect(new URL("/home", req.url));
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) return NextResponse.redirect(new URL("/home", req.url));

  try {
    const redirectUri = `${origin(req)}/api/calendly/callback`;
    const tokens = await exchangeCode(code, redirectUri);
    await storeTokens(client.id, tokens);
    // Redirect immediately — do NOT block the OAuth callback on a full sync
    // (it can exceed the serverless timeout and strand the user). The user
    // pulls events via "Sync now" in Manage, and new ones arrive by webhook.
    return NextResponse.redirect(new URL(`/${slug}/integrations?calendly=connected`, req.url));
  } catch (e) {
    console.error("[calendly/callback]", e instanceof Error ? e.message : e);
    return NextResponse.redirect(new URL(`/${slug}/integrations?calendly=error`, req.url));
  }
}
