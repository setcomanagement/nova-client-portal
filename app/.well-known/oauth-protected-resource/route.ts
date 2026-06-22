import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

export const runtime = "nodejs";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728). claude.ai reads this after a
 * 401 to discover which authorization server issues tokens for this MCP server.
 * MCP_OAUTH_ISSUER must point at the configured IdP.
 */
const handler = protectedResourceHandler({
  authServerUrls: [process.env.MCP_OAUTH_ISSUER ?? ""],
});

const OPTIONS = metadataCorsOptionsRequestHandler();

export { handler as GET, OPTIONS };
