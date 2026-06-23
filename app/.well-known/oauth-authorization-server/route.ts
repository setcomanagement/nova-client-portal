import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414), served from our own origin.
 *
 * Stytch's test env doesn't serve this document (only openid-configuration), and
 * its `iss` doesn't match its discovery URL, so claude.ai's discovery against
 * Stytch fails and it falls back to `${origin}/authorize`. We instead advertise
 * ourselves as the authorization server and hand claude.ai a document whose
 * `issuer` matches this URL's origin (so RFC 8414 validation passes), with:
 *   - authorization_endpoint -> our Stytch-backed consent page (/oauth/authorize)
 *   - token_endpoint / registration_endpoint / jwks_uri -> the real Stytch URLs
 *
 * The access token claude.ai ends up with is still Stytch-issued (iss
 * `stytch.com/project-test-…`); lib/mcp/auth.ts validates it against
 * MCP_OAUTH_ISSUER + the Stytch JWKS. claude.ai treats the access token as opaque,
 * so the issuer it sees here vs. the token's `iss` need not match.
 *
 * Env:
 *   MCP_RESOURCE_URL    -> origin = this AS issuer + /oauth/authorize
 *   MCP_AUTH_SERVER_URL -> upstream Stytch base (e.g. https://test.stytch.com/v1/public/<id>)
 *   MCP_OAUTH_JWKS_URL  -> Stytch JWKS (defaults to ${upstream}/.well-known/jwks.json)
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "public, max-age=300",
};

function metadata() {
  const origin = (() => {
    try {
      return new URL(process.env.MCP_RESOURCE_URL ?? "").origin;
    } catch {
      return "";
    }
  })();
  const upstream = (process.env.MCP_AUTH_SERVER_URL ?? "").replace(/\/$/, "");
  const jwks =
    process.env.MCP_OAUTH_JWKS_URL || `${upstream}/.well-known/jwks.json`;

  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${upstream}/oauth2/token`,
    registration_endpoint: `${upstream}/oauth2/register`,
    jwks_uri: jwks,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [
      "none",
      "client_secret_post",
      "client_secret_basic",
    ],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
  };
}

export function GET() {
  return NextResponse.json(metadata(), { headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
