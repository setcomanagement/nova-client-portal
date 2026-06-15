import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  await clearSession();
  // 303 so the browser issues a GET to /login after the POST.
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}

// GET path lets server components self-heal a stale/dangling session by
// redirecting the user here (e.g. their org was deleted after login).
export async function GET(req: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
