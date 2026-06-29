// Shared funnel definitions for the Leads page.
// `pipelineStage` is the sales-conversation funnel (rep-owned), independent of
// the lifecycle `stage` (new|booked|showed|closed|lost) that Calendly auto-writes.

export const PIPELINE_STAGES = [
  { key: "cold", label: "Cold" },
  { key: "rapport", label: "Rapport" },
  { key: "pain_digging", label: "Pain Digging" },
  { key: "solution_aware", label: "Solution Aware" },
  { key: "pitch", label: "Pitch" },
  { key: "follow_up", label: "Post-Booking / Follow-Up" },
] as const;

export type PipelineKey = (typeof PIPELINE_STAGES)[number]["key"];

export const PIPELINE_KEYS: string[] = PIPELINE_STAGES.map((s) => s.key);

export const pipelineLabel = (key: string): string =>
  PIPELINE_STAGES.find((s) => s.key === key)?.label ?? key;

// inbound = the lead approached us; outbound = we approached them.
export const LEAD_TYPES = [
  { key: "inbound", label: "Inbound" },
  { key: "outbound", label: "Outbound" },
] as const;

export type LeadTypeKey = (typeof LEAD_TYPES)[number]["key"];

export const LEAD_TYPE_KEYS: string[] = LEAD_TYPES.map((t) => t.key);

export const leadTypeLabel = (key: string): string =>
  LEAD_TYPES.find((t) => t.key === key)?.label ?? key;
