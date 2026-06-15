"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CalendlyManageDialog } from "./manage-dialog";

export function CalendlyCard({
  slug,
  connected,
  configured,
  connectedAt,
  bookingCount,
  notice,
}: {
  slug: string;
  connected: boolean;
  configured: boolean;
  connectedAt: string | null;
  bookingCount: number;
  notice: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const open = sp.get("manage") === "calendly";

  function setOpen(v: boolean) {
    if (v) router.replace(`${pathname}?manage=calendly`, { scroll: false });
    else router.replace(pathname, { scroll: false });
  }

  const noticeText =
    notice === "connected"
      ? "✓ Calendly connected."
      : notice === "denied"
        ? "Connection cancelled."
        : notice === "error"
          ? "Couldn't complete the connection — try again."
          : notice === "unconfigured"
            ? "Calendly OAuth isn't set up on the server yet."
            : null;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between">
        <Image src="/integrations/calendly.svg" alt="Calendly" width={32} height={32} className="rounded-lg" />
        <span className="rounded border border-caramel px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-caramel">
          Booking
        </span>
      </div>
      <div>
        <b className="text-[15px] font-medium">Calendly</b>
        <p className="text-xs text-muted-foreground">Sync your scheduled calls into NOVA bookings</p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: connected ? "#4F7A4A" : "#B5A48E" }}
        />
        <span className="text-muted-foreground">
          {connected ? `Connected${connectedAt ? ` · ${connectedAt}` : ""}` : "Not connected"}
        </span>
      </div>

      {noticeText && (
        <p className="text-xs" style={{ color: notice === "connected" ? "var(--sage)" : "var(--clay)" }}>
          {noticeText}
        </p>
      )}

      {!configured ? (
        <p className="mt-auto text-xs text-muted-foreground">
          Calendly OAuth isn&apos;t configured on the server yet.
        </p>
      ) : connected ? (
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white hover:opacity-90"
          >
            Manage
          </button>
          <a
            href={`/api/calendly/authorize?slug=${slug}`}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-espresso px-4 text-sm font-semibold text-espresso hover:bg-[#f0e7d8]"
          >
            Reconnect
          </a>
        </div>
      ) : (
        <a
          href={`/api/calendly/authorize?slug=${slug}`}
          className="mt-auto inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90"
        >
          Connect Calendly
        </a>
      )}

      {connected && <CalendlyManageDialog slug={slug} open={open} onOpenChange={setOpen} bookingCount={bookingCount} />}
    </Card>
  );
}
