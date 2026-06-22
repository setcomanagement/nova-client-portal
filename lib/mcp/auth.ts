import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

/**
 * Resource-server token validation for the MCP connector.
 *
 * The authorization server is an external identity provider (e.g. Stytch /
 * WorkOS) configured to support OAuth 2.1 + Dynamic Client Registration, which
 * is what claude.ai requires of a custom connector. We only act as the OAuth
 * *resource server*: validate the IdP-issued access token on every request.
 *
 * Validation enforces (per the MCP authorization spec):
 *  - signature against the IdP's published JWKS,
 *  - issuer === MCP_OAUTH_ISSUER,
 *  - audience === MCP_RESOURCE_URL (the token was minted for THIS server, RFC 8707).
 *
 * Any failure (including missing env config) returns undefined, which mcp-handler
 * turns into a 401 + WWW-Authenticate pointing at the protected-resource metadata.
 *
 * Required env:
 *   MCP_OAUTH_ISSUER   e.g. https://<your-project>.stytch.com  (token `iss`)
 *   MCP_RESOURCE_URL   canonical URL of this MCP server, e.g. https://www.setco.pro/mcp
 *   MCP_OAUTH_JWKS_URL optional; defaults to `${issuer}/.well-known/jwks.json`
 */

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    const jwksUrl =
      process.env.MCP_OAUTH_JWKS_URL ??
      `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
    jwks = createRemoteJWKSet(new URL(jwksUrl));
  }
  return jwks;
}

export async function verifyMcpToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const issuer = process.env.MCP_OAUTH_ISSUER;
  const audience = process.env.MCP_RESOURCE_URL;
  if (!issuer || !audience) {
    console.error("[mcp] MCP_OAUTH_ISSUER / MCP_RESOURCE_URL not set — refusing");
    return undefined;
  }

  try {
    const { payload } = await jwtVerify(bearerToken, getJwks(issuer), {
      issuer,
      audience,
    });
    const scope = typeof payload.scope === "string" ? payload.scope : "";
    return {
      token: bearerToken,
      clientId: String(payload.client_id ?? payload.sub ?? "mcp"),
      scopes: scope ? scope.split(" ") : [],
      extra: { sub: payload.sub },
    };
  } catch (err) {
    console.warn(
      `[mcp] token rejected: ${err instanceof Error ? err.message : "invalid"}`,
    );
    return undefined;
  }
}
