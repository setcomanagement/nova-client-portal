import { SignJWT, jwtVerify } from "jose";

/*
  Edge-safe session token helpers (jose only — no Node APIs, no DB, no bcrypt),
  so this module can be imported from middleware as well as server code.
*/
export const COOKIE_NAME = "nova_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type UserRole =
  | "super_admin"
  | "admin"
  | "client"
  | "manager"
  | "sales_rep"
  | "team_member";

export interface SessionPayload {
  userId: string;
  role: UserRole;
  /** null for admin; the user's owning client otherwise */
  clientId: string | null;
  clientSlug: string | null;
  /** true when the user must set a new password before using the app */
  mustChange?: boolean;
}

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    role: payload.role,
    clientId: payload.clientId,
    clientSlug: payload.clientSlug,
    mustChange: payload.mustChange ?? false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret());
}

const ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "client",
  "manager",
  "sales_rep",
  "team_member",
];

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role;
    if (typeof payload.sub !== "string") return null;
    if (typeof role !== "string" || !ROLES.includes(role as UserRole)) {
      return null;
    }
    const clientId =
      typeof payload.clientId === "string" ? payload.clientId : null;
    const clientSlug =
      typeof payload.clientSlug === "string" ? payload.clientSlug : null;
    return {
      userId: payload.sub,
      role: role as UserRole,
      clientId,
      clientSlug,
      mustChange: payload.mustChange === true,
    };
  } catch {
    return null;
  }
}
