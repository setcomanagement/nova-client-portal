import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/auth/jwt";

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  client: "Client",
  manager: "Manager",
  sales_rep: "Setter",
  team_member: "Team member",
};

export interface NavItem {
  href: string;
  label: string;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "·"
  );
}

export function AppShell({
  role,
  name,
  nav,
  dark = false,
  children,
}: {
  role: UserRole;
  name: string;
  nav: NavItem[];
  dark?: boolean;
  children: React.ReactNode;
}) {
  const headerCls = dark
    ? "border-[#e6e3dd] bg-[#f7f7f4]"
    : "border-border bg-cream/85 backdrop-blur";
  const wm = dark ? "text-ink" : "text-ink";
  const navLink = dark
    ? "text-[#6b6b70] hover:bg-[#eceae4] hover:text-ink"
    : "text-muted-foreground hover:bg-secondary hover:text-ink";
  const nm = dark ? "text-ink" : "text-ink";
  const rl = dark ? "text-[#6b6b70]" : "text-muted-foreground";
  // Admin (dark "mission control") fills the window; client stays editorial width.
  const widthCls = dark ? "max-w-[100rem] px-6 lg:px-10" : "max-w-6xl px-5";

  return (
    <div className={`flex min-h-screen flex-col ${dark ? "bg-[#f7f7f4]" : ""}`}>
      <header className={`sticky top-0 z-30 border-b ${headerCls}`}>
        <div className={`mx-auto flex w-full items-center gap-7 py-3 ${widthCls}`}>
          <Link href="/home" className={`font-serif text-xl font-semibold tracking-tight ${wm}`}>
            NOVA
          </Link>
          <nav className="hidden flex-1 items-center gap-1 overflow-x-auto md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${navLink}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-caramel text-xs font-semibold text-white">
                {initials(name)}
              </span>
              <span className="leading-tight">
                <span className={`block text-[13px] font-semibold ${nm}`}>{name}</span>
                <span className={`block text-[11px] ${rl}`}>{ROLE_LABEL[role]}</span>
              </span>
            </div>
            <form action="/logout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        {nav.length > 0 && (
          <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${navLink}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main
        className={`mx-auto w-full flex-1 py-10 ${widthCls} ${dark ? "text-[#2f2f33]" : ""}`}
      >
        {children}
      </main>
    </div>
  );
}
