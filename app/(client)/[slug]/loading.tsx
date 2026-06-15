export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-56 animate-pulse rounded-md bg-[color:var(--line)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-[color:var(--line)]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-[color:var(--line)]" />
    </div>
  );
}
