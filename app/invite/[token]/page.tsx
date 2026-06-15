import { getClientById, getUserByInviteToken } from "@/lib/db/queries";
import { InviteForm } from "./invite-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getUserByInviteToken(token);
  const valid =
    user &&
    user.inviteToken &&
    user.inviteExpiresAt &&
    new Date(user.inviteExpiresAt).getTime() >= Date.now();
  const client = valid && user.clientId ? await getClientById(user.clientId) : null;

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <p className="font-serif text-2xl font-semibold tracking-tight">NOVA</p>
        {valid ? (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Welcome, {user.name.split(" ")[0]}.</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Set a password for <b>{user.email}</b>
              {client ? ` · ${client.name}` : ""} to access your portal.
            </p>
            <div className="mt-6">
              <InviteForm token={token} />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Invite not valid</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This invite link is invalid or has expired. Ask your NOVA admin to
              send you a fresh one.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
