import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySessionToken,
  type SessionPayload,
} from "./jwt";

/** Read and verify the current session from the httpOnly cookie. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

/** Issue a session cookie. Call only inside a Server Action or Route Handler. */
export async function setSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Require any session; redirect to /login if absent. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** NOVA operator roles that can reach the /admin surface. */
const ADMIN_ROLES = ["admin", "super_admin"] as const;

/** Require an operator role (admin or super_admin); redirect others to /home. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!ADMIN_ROLES.includes(session.role as (typeof ADMIN_ROLES)[number])) {
    redirect("/home");
  }
  return session;
}

/** Require super_admin specifically (impersonation, cross-client, account creation). */
export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "super_admin") redirect("/home");
  return session;
}

/**
 * Client-only content (Recaps, Modules, integrations) is visible to the org's
 * `client` account and to NOVA operators viewing in. Managers, setters, and
 * team members must NOT reach it — even by typing the URL directly. 404 rather
 * than redirect so the surface is indistinguishable from "does not exist".
 */
const CLIENT_CONTENT_ROLES = ["client", "admin", "super_admin"] as const;
export async function requireClientContentAccess(): Promise<SessionPayload> {
  const session = await requireSession();
  if (
    !CLIENT_CONTENT_ROLES.includes(
      session.role as (typeof CLIENT_CONTENT_ROLES)[number],
    )
  ) {
    notFound();
  }
  return session;
}

/**
 * Integrations are managed by the org's `client` account and NOVA operators.
 * Managers/setters/team members must not reach them (404, same as client content).
 */
const INTEGRATIONS_ROLES = ["client", "admin", "super_admin"] as const;
export async function requireIntegrationsAccess(): Promise<SessionPayload> {
  const session = await requireSession();
  if (
    !INTEGRATIONS_ROLES.includes(
      session.role as (typeof INTEGRATIONS_ROLES)[number],
    )
  ) {
    notFound();
  }
  return session;
}
