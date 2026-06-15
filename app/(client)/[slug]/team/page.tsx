import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TeamHome() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shared client resources for team members.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Team workspace</CardTitle>
          <CardDescription>
            Recaps and modules for this client will surface here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Read access to your client&apos;s recaps and modules is coming with
            Days 3 and 4.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
