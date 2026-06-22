import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { createClientSchema } from "@/lib/clients/schema";
import { ProvisionError, provisionClient } from "@/lib/clients/provision";
import { verifyMcpToken } from "@/lib/mcp/auth";

export const runtime = "nodejs";

/**
 * MCP server for claude.ai. Exposes one tool — create_nova_client — that runs the
 * same "create client org + invite owner" flow as POST /api/clients, but is
 * triggered from a Claude conversation via the custom connector.
 *
 * Auth: OAuth 2.1 bearer token from the configured IdP, validated in
 * lib/mcp/auth.ts. Unlike the /api/clients route, there is no shared secret —
 * the connector is gated by the operator's IdP login.
 */

const DEFAULT_DISCORD_INVITE =
  process.env.MCP_DEFAULT_DISCORD_INVITE ?? "https://discord.gg/Ahb3zhNcSX";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "create_nova_client",
      {
        title: "Onboard a NOVA client",
        description:
          "Provision a new NOVA Consulting client: create their org on the " +
          "portal, invite the owner by email, and send the welcome email " +
          "(portal access + NOVA community Discord + their private workspace " +
          "Discord). Use when onboarding a newly signed client.",
        inputSchema: {
          name: z.string().min(2).max(80).describe("Business / agency name"),
          ownerName: z.string().min(2).max(80).describe("Client owner's name"),
          ownerEmail: z
            .string()
            .email()
            .describe("Owner's email — receives the welcome email"),
          clientServerInvite: z
            .string()
            .url()
            .describe("Permanent invite URL to the client's private Discord server"),
          discordInviteUrl: z
            .string()
            .url()
            .optional()
            .describe(
              "NOVA community Discord invite; defaults to the standard community invite",
            ),
          notionUrl: z
            .string()
            .url()
            .optional()
            .describe("Optional Notion workspace URL for the client"),
        },
      },
      async (args) => {
        // Re-validate through the canonical schema so the MCP path enforces the
        // exact same rules as the HTTP route (empty strings, length, URL shape).
        const parsed = createClientSchema.safeParse({
          name: args.name,
          ownerName: args.ownerName,
          ownerEmail: args.ownerEmail,
          clientServerInvite: args.clientServerInvite,
          discordInviteUrl: args.discordInviteUrl || DEFAULT_DISCORD_INVITE,
          notionUrl: args.notionUrl ?? "",
        });
        if (!parsed.success) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text:
                  "Invalid input: " +
                  parsed.error.issues.map((i) => i.message).join("; "),
              },
            ],
          };
        }

        try {
          const r = await provisionClient(parsed.data);
          return {
            content: [
              {
                type: "text",
                text:
                  `Onboarded ${r.organizationSlug}.\n` +
                  `- Organization: ${r.organizationSlug} (${r.organizationId})\n` +
                  `- Owner: ${r.ownerEmail}\n` +
                  `- Invite URL: ${r.inviteUrl}\n` +
                  `- Welcome email sent to ${r.ownerEmail}.`,
              },
            ],
          };
        } catch (err) {
          const text =
            err instanceof ProvisionError
              ? err.code === "duplicate_email"
                ? `That owner email is already invited. The client may already be onboarded.`
                : err.code === "duplicate_slug"
                  ? `An org with that name already exists (slug "${err.slug}"). Use a different business name or confirm it isn't already onboarded.`
                  : `Could not derive a valid slug from that business name.`
              : `Provisioning failed unexpectedly. The org may not have been created — check the portal before retrying.`;
          if (!(err instanceof ProvisionError)) console.error("[mcp] provision error", err);
          return { isError: true, content: [{ type: "text", text }] };
        }
      },
    );
  },
  {},
  { basePath: "", maxDuration: 60, verboseLogs: process.env.NODE_ENV !== "production" },
);

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
