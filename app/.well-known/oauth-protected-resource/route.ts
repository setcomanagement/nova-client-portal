import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

export const runtime = "nodejs";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728). claude.ai reads this after a
 * 401 to discover which authorization server issues tokens for this MCP server.
 *
 * authServerUrls must be the URL the client can run OIDC/OAuth *discovery* against
 * (i.e. where `${url}/.well-known/openid-configuration` resolves). For most IdPs
 * that equals the issuer, so we fall back to MCP_OAUTH_ISSUER. But some — notably
 * Stytch's test env — use an `iss` claim (`stytch.com/project-test-…`) that differs
 * from the discovery URL (`https://test.stytch.com/v1/public/<id>`), so
 * MCP_AUTH_SERVER_URL lets us advertise the discoverable URL while lib/mcp/auth.ts
 * still validates the token against the distinct MCP_OAUTH_ISSUER `iss` value.
 *
 * resourceUrl is pinned to MCP_RESOURCE_URL so the advertised `resource` matches
 * the token audience enforced in lib/mcp/auth.ts. When unset it falls back to the
 * request origin (the connector is unconfigured and 401s anyway).
 */
const handler = protectedResourceHandler({
  authServerUrls: [
    process.env.MCP_AUTH_SERVER_URL || process.env.MCP_OAUTH_ISSUER || "",
  ],
  resourceUrl: process.env.MCP_RESOURCE_URL || undefined,
});

const OPTIONS = metadataCorsOptionsRequestHandler();

export { handler as GET, OPTIONS };
