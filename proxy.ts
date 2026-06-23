import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/jwt";

/*
  Edge auth gate.
    - /login          : public; bounce to /home if already signed in
    - everything else : requires a valid session
    - /admin/*        : admin role only (others -> /home)

  Per-client data isolation (slug -> client_id -> membership, returning 404 on
  mismatch) is enforced in app/(client)/[slug]/layout.tsx against the DB, since
  the edge has no DB access.
*/
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Machine-to-machine API routes carry their own bearer-token auth (e.g. the
  // recap ingestion endpoint). The cookie-session gate must not touch them.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // The MCP connector (/mcp, /sse) is gated by its own OAuth 2.1 bearer auth in
  // app/[transport]/route.ts. Without this exemption the cookie-session gate
  // below redirects claude.ai's unauthenticated probe to /login (307), so the
  // OAuth handshake never starts.
  if (pathname === "/mcp" || pathname === "/sse") {
    return NextResponse.next();
  }

  // The Connected Apps consent page enforces its own auth (NOVA admin session +
  // Stytch login) inside the route, and must preserve the inbound OAuth params,
  // so it opts out of the blanket cookie-session redirect here.
  if (pathname === "/oauth/authorize") {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/home", req.url));
    }
    return NextResponse.next();
  }

  // Public invite (set-password) links — no session required.
  if (pathname.startsWith("/invite/")) {
    return NextResponse.next();
  }

  // Public marketing landing at "/" — guests see it; signed-in users go home.
  if (pathname === "/") {
    return session
      ? NextResponse.redirect(new URL("/home", req.url))
      : NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  // Force a password change before anything else (temp-password accounts).
  if (session.mustChange && pathname !== "/change-password" && pathname !== "/logout") {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  if (pathname.startsWith("/admin")) {
    if (session.role !== "admin" && session.role !== "super_admin") {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static files (anything with a dot).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
