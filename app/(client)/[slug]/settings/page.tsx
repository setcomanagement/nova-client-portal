import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import {
  getUserById,
  listClientMembers,
  listIntegrations,
  resolveClientAccess,
} from "@/lib/db/queries";
import type { UserRole } from "@/lib/auth/jwt";
import { ProfileForm } from "./profile-form";
import { GoogleConnect } from "./google-connect";
import { FeedbackForm } from "./feedback-form";
import { AddMemberForm } from "./add-member-form";
import { ChangePasswordForm } from "./change-password-form";
import { ResetMemberPassword } from "./reset-member-password";
import { MemberInvite } from "@/components/member-invite";

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  client: "Client",
  manager: "Manager",
  sales_rep: "Setter",
  team_member: "Team member",
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireSession();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const [user, members, integrations] = await Promise.all([
    getUserById(session.userId),
    listClientMembers(client.id),
    listIntegrations(client.id),
  ]);
  const googleConnected =
    integrations.find((i) => i.provider === "google")?.status === "connected";

  const canManageTeam = ["client", "manager", "admin", "super_admin"].includes(
    session.role,
  );
  const canConnect = ["client", "admin", "super_admin"].includes(session.role);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="eyebrow">NOVA · account</p>
        <h1 className="mt-2 text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Profile, team, connections and preferences.
        </p>
      </div>

      <section>
        <p className="eyebrow mb-3 block">Profile</p>
        <Card className="p-6">
          <ProfileForm
            slug={slug}
            name={user?.name ?? ""}
            email={user?.email ?? ""}
            role={ROLE_LABEL[session.role]}
            org={`${client.name} — under NOVA Consulting`}
            timezone={user?.timezone ?? null}
          />
        </Card>
      </section>

      <section>
        <p className="eyebrow mb-3 block">Password</p>
        <Card className="p-6">
          <ChangePasswordForm slug={slug} />
        </Card>
      </section>

      {canConnect && (
        <section>
          <p className="eyebrow mb-3 block">Connected accounts</p>
          <Card className="flex flex-wrap items-center gap-4 p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-white font-bold text-[#4285F4]">
              G
            </span>
            <div className="flex-1 min-w-[220px]">
              <b>Google account</b>
              <p className="text-sm text-muted-foreground">
                Sign in with Google and sync Google Calendar — the easy
                alternative if Calendly&apos;s too fiddly.
              </p>
            </div>
            <GoogleConnect slug={slug} connected={googleConnected} />
          </Card>
        </section>
      )}

      {canManageTeam && (
        <section>
          <p className="eyebrow mb-3 block">Team &amp; access</p>
          <Card className="px-2 py-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.email}
                    </TableCell>
                    <TableCell>{ROLE_LABEL[m.role]}</TableCell>
                    <TableCell className="text-right">
                      {m.inviteToken ? (
                        <MemberInvite
                          token={m.inviteToken}
                          expiresAt={
                            m.inviteExpiresAt
                              ? new Date(m.inviteExpiresAt).toISOString()
                              : null
                          }
                        />
                      ) : (
                        <ResetMemberPassword slug={slug} memberId={m.id} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">
            Managers have the same access as the client owner — they can set
            milestones and manage the team.
          </p>
          <Card className="mt-4 p-6">
            <h4 className="eyebrow mb-4 block">Add a member</h4>
            <AddMemberForm slug={slug} />
          </Card>
        </section>
      )}

      <section>
        <p className="eyebrow mb-3 block">Help us improve</p>
        <Card className="p-6">
          <p className="mb-3 text-sm text-muted-foreground">
            Tell us what&apos;s slowing you down or what you&apos;d change. We read
            every note.
          </p>
          <FeedbackForm slug={slug} />
        </Card>
      </section>
    </div>
  );
}
