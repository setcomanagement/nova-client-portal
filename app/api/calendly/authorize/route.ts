import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveClientAccess } from "@/lib/db/queries";
import { authorizeUrl, calendlyConfigured, signState } from "@/lib/calendly";

export const runtime = "nodejs";

const ALLOWED = ["client", "admin", "super_admin"];

function origin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Kicks off Calendly OAuth: redirects the signed-in client to Calendly's consent screen.
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (!ALLOWED.includes(session.role)) return NextResponse.redirect(new URL("/home", req.url));
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) return NextResponse.redirect(new URL("/home", req.url));
  if (!calendlyConfigured())
    return NextResponse.redirect(new URL(`/${slug}/integrations?calendly=unconfigured`, req.url));

  const redirectUri = `${origin(req)}/api/calendly/callback`;
  const state = await signState(slug);
  return NextResponse.redirect(authorizeUrl(redirectUri, state));
}
