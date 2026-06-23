import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

export const runtime = "nodejs";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728). claude.ai reads this after a
 * 401 to discover which authorization server issues tokens for this MCP server.
 *
 * We advertise OUR OWN origin as the authorization server (not Stytch directly),
 * because Stytch's test env only serves /.well-known/openid-configuration — not the
 * /.well-known/oauth-authorization-server doc claude.ai looks for — and its `iss`
 * (`stytch.com/project-test-…`) doesn't match its discovery URL. When that lookup
 * fails, claude.ai falls back to `${origin}/authorize`, which isn't our endpoint.
 * Instead we serve our own RFC 8414 metadata at
 * `${origin}/.well-known/oauth-authorization-server` (see that route) pointing at
 * the real Stytch token/registration/JWKS endpoints and our /oauth/authorize page.
 *
 * resourceUrl is pinned to MCP_RESOURCE_URL so the advertised `resource` matches
 * the token audience enforced in lib/mcp/auth.ts.
 */
function authServerOrigin(): string {
  try {
    return new URL(process.env.MCP_RESOURCE_URL ?? "").origin;
  } catch {
    return "";
  }
}

const handler = protectedResourceHandler({
  authServerUrls: [authServerOrigin()],
  resourceUrl: process.env.MCP_RESOURCE_URL || undefined,
});

const OPTIONS = metadataCorsOptionsRequestHandler();

export { handler as GET, OPTIONS };
