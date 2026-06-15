import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClientBySlug, listClientMembers } from "@/lib/db/queries";
import type { UserRole } from "@/lib/auth/jwt";
import { AddMemberForm } from "./add-member-form";
import { MemberInvite } from "@/components/member-invite";

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  client: "Client owner",
  manager: "Manager",
  sales_rep: "Sales rep",
  team_member: "Team member",
};

const ROLE_ORDER: UserRole[] = [
  "client",
  "manager",
  "sales_rep",
  "team_member",
];

export default async function ManageClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const members = await listClientMembers(client.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/clients"
          className="text-sm text-accent hover:underline"
        >
          &larr; All clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{client.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Slug: {client.slug}
          {client.notionUrl ? (
            <>
              {" "}
              &middot;{" "}
              <a
                href={client.notionUrl}
                className="text-accent hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Notion
              </a>
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {members.length} {members.length === 1 ? "person" : "people"} in
              this client
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No members yet. Add a client owner, sales reps and team members
                on the right.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...members]
                    .sort(
                      (a, b) =>
                        ROLE_ORDER.indexOf(a.role) -
                        ROLE_ORDER.indexOf(b.role),
                    )
                    .map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.email}
                        </TableCell>
                        <TableCell>{ROLE_LABEL[member.role]}</TableCell>
                        <TableCell className="text-right">
                          <MemberInvite
                            token={member.inviteToken}
                            expiresAt={
                              member.inviteExpiresAt
                                ? new Date(member.inviteExpiresAt).toISOString()
                                : null
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Add member</CardTitle>
            <CardDescription>
              Create a login for a sales rep, team member or the client owner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddMemberForm slug={client.slug} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
