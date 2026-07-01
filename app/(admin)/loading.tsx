export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-56 animate-pulse rounded-md bg-[#e6e3dd]" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-[#ffffff]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-[#ffffff]" />
    </div>
  );
}
