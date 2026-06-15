import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettersPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Setters</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregated setter KPI rollups.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming in Day 2</CardTitle>
          <CardDescription>
            Cross-setter KPI rollups land once the EOD form is wired up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            EOD submissions table and indexes are already in the schema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
