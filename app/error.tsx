"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-serif text-2xl font-semibold tracking-tight">NOVA</p>
        <h1 className="mt-6 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page hit an unexpected error. Try again — if it keeps happening,
          let us know.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
