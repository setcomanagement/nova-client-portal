import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ObjectionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Objections &amp; bottlenecks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          7 / 30-day breakdown across all setters.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming in Day 4</CardTitle>
          <CardDescription>
            Stacked bar of bottleneck + top objection from EOD submissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Recharts is installed and ready for this view.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
