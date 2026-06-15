import { AppShell, type NavItem } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/queries";

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/funnel", label: "Funnel" },
  { href: "/admin/recaps", label: "Recaps" },
  { href: "/admin/modules", label: "Modules" },
  { href: "/admin/integrations", label: "Integrations" },
  { href: "/admin/insights", label: "Insights" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const user = await getUserById(session.userId);

  return (
    <AppShell role={session.role} name={user?.name ?? "Admin"} nav={ADMIN_NAV} dark>
      {children}
    </AppShell>
  );
}
