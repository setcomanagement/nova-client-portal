import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

// Role-aware landing. Middleware guarantees a session here.
export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role === "admin" || session.role === "super_admin") {
    redirect("/admin");
  }

  // Org-scoped roles must belong to a client.
  if (!session.clientSlug) {
    redirect("/login");
  }

  switch (session.role) {
    case "client":
    case "manager":
      redirect(`/${session.clientSlug}/dashboard`);
    case "sales_rep":
      redirect(`/${session.clientSlug}/rep`);
    case "team_member":
      redirect(`/${session.clientSlug}/team`);
    default:
      redirect("/login");
  }
}
