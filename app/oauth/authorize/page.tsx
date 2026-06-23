import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuthorizeClient } from "./authorize-client";

/**
 * OAuth 2.1 authorization endpoint for the MCP connector (Stytch Connected Apps).
 * Stytch is configured with this page as its Authorization URL.
 *
 * Security: Dynamic Client Registration lets any client register against /mcp, so
 * the gate that actually limits who can mint a token is HERE — we require a NOVA
 * operator (admin / super_admin) portal session before showing the Stytch consent
 * flow. A logged-out or non-admin visitor is bounced to /login and returned here
 * (params preserved) after authenticating.
 */
const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export const dynamic = "force-dynamic";

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();

  if (!session || !ADMIN_ROLES.has(session.role)) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") qs.set(key, value);
    }
    const returnTo = `/oauth/authorize?${qs.toString()}`;
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <AuthorizeClient />
      </div>
    </div>
  );
}
