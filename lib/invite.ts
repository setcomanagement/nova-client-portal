import "server-only";
import { headers } from "next/headers";

/** Unguessable one-time invite token (~256 bits). */
export function newInviteToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

/** Invites are valid for 7 days. */
export function inviteExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

/** Absolute set-password URL for the current deployment. */
export async function buildInviteLink(token: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/invite/${token}`;
}
