import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

export const runtime = "nodejs";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728). claude.ai reads this after a
 * 401 to discover which authorization server issues tokens for this MCP server.
 * MCP_OAUTH_ISSUER must point at the configured IdP.
 *
 * resourceUrl is pinned to MCP_RESOURCE_URL so the advertised `resource` matches
 * the token audience enforced in lib/mcp/auth.ts. Without this it defaults to the
 * request origin (no /mcp path), and the client would request a token whose `aud`
 * never matches what we validate — the handshake would fail. When unset it falls
 * back to that origin default (the connector is unconfigured and 401s anyway).
 */
const handler = protectedResourceHandler({
  authServerUrls: [process.env.MCP_OAUTH_ISSUER ?? ""],
  resourceUrl: process.env.MCP_RESOURCE_URL || undefined,
});

const OPTIONS = metadataCorsOptionsRequestHandler();

export { handler as GET, OPTIONS };
