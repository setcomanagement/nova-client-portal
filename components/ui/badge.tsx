import { cn } from "@/lib/utils";

type Variant = "neutral" | "good" | "pendingAdd" | "pendingRemove";

const VARIANTS: Record<Variant, string> = {
  neutral: "bg-[rgba(26,19,13,0.05)] text-[color:var(--ink)]",
  good: "bg-[#EAF3DE] text-[#3B6D11]",
  pendingAdd: "bg-[#FAEEDA] text-[#854F0B]",
  pendingRemove: "bg-[rgba(156,59,46,0.1)] text-[#9C3B2E]",
};

export function Badge({
  variant = "neutral",
  dot = false,
  className,
  children,
}: {
  variant?: Variant;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[11px] font-medium",
        VARIANTS[variant],
        className,
      )}
    >
      {dot && (
        <span
          className="h-[5px] w-[5px] rounded-full"
          style={{ background: variant === "good" ? "#3B6D11" : "currentColor" }}
        />
      )}
      {children}
    </span>
  );
}
