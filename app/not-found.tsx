import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        404
      </p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page does not exist, or you do not have access to it.
      </p>
      <Link href="/home" className={buttonVariants({ variant: "accent" })}>
        Go to your home
      </Link>
    </div>
  );
}
