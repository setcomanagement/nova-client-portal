import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { submitEod } from "./actions";

const BOTTLENECKS = [
  "Weak offer understanding",
  "Weak opener",
  "Low volume",
  "Not enough follow-ups",
  "Unsure how to handle objections",
  "Unclear when to pitch the call",
  "Weak tonality or delivery",
  "Not enough feedback / review",
];
const OBJECTIONS = [
  "Price",
  "Time",
  "Already in another program",
  "Not interested",
  "Ghosting after opener",
  "Other",
];

function NumField({ name, label, def = 0 }: { name: string; label: string; def?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={name} name={name} type="number" defaultValue={def} />
    </div>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-2 border-b border-[color:var(--rule)] pb-2.5">
      <span className="eyebrow">{children}</span>
    </div>
  );
}

export default async function EodPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={submitEod.bind(null, slug)} className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">NOVA · setter</p>
          <h1 className="mt-2 text-3xl font-semibold">End of day</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log it in under two minutes.
          </p>
        </div>
        <Button type="submit" variant="accent">
          Submit EOD
        </Button>
      </div>

      <Card className="p-6">
        <Lede>Today</Lede>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="submissionDate" className="text-xs text-muted-foreground">
              Date
            </Label>
            <Input id="submissionDate" name="submissionDate" type="date" defaultValue={today} />
          </div>
        </div>

        <Lede>Volume</Lede>
        <div className="grid gap-4 sm:grid-cols-4">
          <NumField name="outbound" label="Outbound messages sent" def={0} />
          <NumField name="inbound" label="Inbound conversations" def={0} />
          <NumField name="followUps" label="Follow-up conversations" def={0} />
          <NumField name="totalConvos" label="Total conversations had" def={0} />
        </div>

        <Lede>Calls</Lede>
        <div className="grid gap-4 sm:grid-cols-4">
          <NumField name="callsPitched" label="Calls pitched" />
          <NumField name="callsBooked" label="Calls booked" />
          <NumField name="qualifiedBooked" label="Qualified calls booked" />
          <NumField name="callsDeclined" label="Calls declined" />
          <NumField name="showUps" label="Calls that showed up" />
          <NumField name="closes" label="Deals closed" />
        </div>

        <Lede>Money</Lede>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField name="revenue" label="Revenue from your sets today ($) — closed" />
          <NumField name="cashCollected" label="Cash collected today ($) — closed" />
        </div>

        <Lede>Self-assessment</Lede>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="performanceRating" className="text-xs text-muted-foreground">
              Rate your performance today (1–10)
            </Label>
            <Select id="performanceRating" name="performanceRating" defaultValue="7">
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1}>{i + 1}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skillRating" className="text-xs text-muted-foreground">
              Your current skill level (1–10)
            </Label>
            <Select id="skillRating" name="skillRating" defaultValue="7">
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1}>{i + 1}</option>
              ))}
            </Select>
          </div>
        </div>

        <Lede>Reflection</Lede>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wentWell" className="text-xs text-muted-foreground">
              What went well today?
            </Label>
            <textarea id="wentWell" name="wentWell" rows={3} className="flex w-full rounded-md border border-input bg-bone px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goneBetter" className="text-xs text-muted-foreground">
              What could have gone better?
            </Label>
            <textarea id="goneBetter" name="goneBetter" rows={3} className="flex w-full rounded-md border border-input bg-bone px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="tomorrowDifferent" className="text-xs text-muted-foreground">
            What will you do differently tomorrow to improve?
          </Label>
          <textarea id="tomorrowDifferent" name="tomorrowDifferent" rows={2} className="flex w-full rounded-md border border-input bg-bone px-3 py-2 text-sm" />
        </div>

        <Lede>Diagnostics</Lede>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leadQuality" className="text-xs text-muted-foreground">
              What was lead quality like today?
            </Label>
            <Select id="leadQuality" name="leadQuality" defaultValue="Good">
              <option>Excellent</option>
              <option>Good</option>
              <option>Mixed</option>
              <option>Poor</option>
              <option>Tire-kickers</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bottleneck" className="text-xs text-muted-foreground">
              Main bottleneck holding you back?
            </Label>
            <Select id="bottleneck" name="bottleneck">
              {BOTTLENECKS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topObjection" className="text-xs text-muted-foreground">
              Top objection you faced today
            </Label>
            <Select id="topObjection" name="topObjection">
              {OBJECTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="missedAnything" className="text-xs text-muted-foreground">
              Did you miss anything? (EOD, call, review)
            </Label>
            <Select id="missedAnything" name="missedAnything" defaultValue="No, nothing missed">
              <option>No, nothing missed</option>
              <option>Missed an EOD</option>
              <option>Missed a call</option>
              <option>Missed a review</option>
              <option>Other</option>
            </Select>
          </div>
        </div>

        <Lede>Manager</Lede>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="managerRequest" className="text-xs text-muted-foreground">
            Anything you need from your manager?
          </Label>
          <textarea id="managerRequest" name="managerRequest" rows={2} className="flex w-full rounded-md border border-input bg-bone px-3 py-2 text-sm" />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="accuracyConfirmed" defaultChecked />
          I confirm these numbers are accurate.
        </label>
      </Card>
    </form>
  );
}
