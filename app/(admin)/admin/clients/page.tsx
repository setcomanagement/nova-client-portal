import Link from "next/link";
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
import { listClients } from "@/lib/db/queries";
import { CreateClientForm } from "./create-client-form";
import { DeleteClientButton } from "./delete-client-button";

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow">NOVA · operator</p>
        <h1 className="mt-2 text-3xl font-semibold">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a client, then open it to add sales reps and team members.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>All clients</CardTitle>
            <CardDescription>
              {clients.length} {clients.length === 1 ? "client" : "clients"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No clients yet. Create your first one on the right.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Manage</TableHead>
                    <TableHead className="text-right">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.slug}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/clients/${client.slug}`}
                          className="text-accent hover:underline"
                        >
                          Open
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <DeleteClientButton
                            slug={client.slug}
                            name={client.name}
                          />
                        </div>
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
            <CardTitle>New client</CardTitle>
            <CardDescription>Add a NOVA Consulting client.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateClientForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
