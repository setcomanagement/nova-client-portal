import { requireSession } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  await requireSession(); // any logged-in user; middleware funnels temp accounts here
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <p className="font-serif text-2xl font-semibold tracking-tight">NOVA</p>
        <h1 className="mt-6 text-2xl font-semibold">Set your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;re signed in with a temporary password. Choose a new one to continue.
        </p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
