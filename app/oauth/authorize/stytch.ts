"use client";
import { createStytchUIClient } from "@stytch/react";

/**
 * Browser Stytch UI client for the Connected Apps consent page. The public token
 * is publishable (NEXT_PUBLIC_*) — it only identifies the project to the SDK and
 * carries no secret. createStytchUIClient is SSR-safe; it defers browser work
 * until hydration.
 */
export const stytchClient = createStytchUIClient(
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN ?? "",
);
