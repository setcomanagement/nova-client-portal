import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requireSession } from "@/lib/auth/session";
import {
  getActiveAnnouncement,
  getUserById,
  resolveClientAccess,
} from "@/lib/db/queries";
import type { UserRole } from "@/lib/auth/jwt";
import { AnnouncementBanner } from "@/components/announcement-banner";

function navForRole(role: UserRole, slug: string): NavItem[] {
  const isOps = role === "admin" || role === "super_admin";
  const nav: NavItem[] = [];
  if (role === "sales_rep") {
    nav.push({ href: `/${slug}/rep`, label: "Home" });
    nav.push({ href: `/${slug}/eod`, label: "My EOD" });
  } else {
    nav.push({ href: `/${slug}/dashboard`, label: "Dashboard" });
  }
  // Calendar + Leads: client, manager, setter (+ ops viewing)
  if (role === "client" || role === "manager" || role === "sales_rep" || isOps) {
    nav.push({ href: `/${slug}/calendar`, label: "Calendar" });
    nav.push({ href: `/${slug}/milestones`, label: "Milestones" });
    nav.push({ href: `/${slug}/leads`, label: "Leads" });
  }
  // Recaps + Modules + Integrations: client-only (and ops viewing)
  if (role === "client" || isOps) {
    nav.push({ href: `/${slug}/recaps`, label: "Recaps" });
    nav.push({ href: `/${slug}/modules`, label: "Modules" });
    nav.push({ href: `/${slug}/integrations`, label: "Integrations" });
  }
  if (role === "team_member") nav.push({ href: `/${slug}/team`, label: "Team" });
  // Settings (profile) for org-scoped members
  if (role === "client" || role === "manager" || role === "sales_rep") {
    nav.push({ href: `/${slug}/settings`, label: "Settings" });
  }
  if (isOps) nav.push({ href: "/admin/clients", label: "Back to admin" });
  return nav;
}

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireSession();

  // DB-verified isolation: slug -> client_id -> membership. Anything that does
  // not resolve to a client this user may access becomes a 404 (existence of
  // other clients is never revealed).
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) {
    // The user is trying to reach the org their session claims, but membership
    // no longer resolves (e.g. the org was deleted/reset after they signed in).
    // Self-heal by clearing the stale session instead of trapping them in a 404.
    if (session.clientSlug === slug) redirect("/logout");
    notFound(); // genuine cross-tenant access — never reveal the org exists
  }

  const [user, announcement] = await Promise.all([
    getUserById(session.userId),
    getActiveAnnouncement(),
  ]);

  return (
    <AppShell
      role={session.role}
      name={user?.name ?? "Member"}
      nav={navForRole(session.role, client.slug)}
    >
      {announcement && <AnnouncementBanner message={announcement.message} />}
      <div className="mb-6 flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: client.brandColor }}
        />
        <Link
          href={`/${client.slug}/dashboard`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {client.name}
        </Link>
      </div>
      {children}
    </AppShell>
  );
}
