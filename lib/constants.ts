/**
 * Module catalog categories.
 *
 * The catalog groups modules into sections by category. Sections render in the
 * order of this array; any category not listed here sorts alphabetically after
 * these. A module with a null/empty category falls back to the first entry.
 *
 * This single source feeds the admin dropdown, the render-layer fallback, and
 * the section sort order — keep new categories here.
 */
export const MODULE_CATEGORIES = [
  "NOVA Playbook",
  "Backend Optimisation",
] as const;

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

/** Fallback category for modules saved with no category (null/empty). */
export const DEFAULT_MODULE_CATEGORY: ModuleCategory = MODULE_CATEGORIES[0];
