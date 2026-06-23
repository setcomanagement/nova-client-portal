"use client";

import {
  IdentityProvider,
  Products,
  StytchLogin,
  StytchProvider,
  useStytchSession,
  type StytchLoginConfig,
} from "@stytch/react";
import { stytchClient } from "./stytch";

/**
 * Connected Apps consent surface. claude.ai (or any registered MCP client) sends
 * the operator here with the OAuth authorize params in the URL.
 *
 *  - No Stytch session yet  -> show Stytch login (email magic link). Stytch
 *    persists the in-flight OAuth request across the magic-link round trip.
 *  - Stytch session present -> mount <IdentityProvider>, which reads the OAuth
 *    params from the URL and renders the consent screen, then redirects back to
 *    the MCP client with an authorization code.
 *
 * Access to this page is already gated to NOVA operators by the portal admin
 * session check in page.tsx; the Stytch login here is what mints the token.
 */
function Gate({ loginConfig }: { loginConfig: StytchLoginConfig }) {
  const { session } = useStytchSession();
  return session ? <IdentityProvider /> : <StytchLogin config={loginConfig} />;
}

export function AuthorizeClient({ appUrl }: { appUrl: string }) {
  const redirectUrl = `${appUrl}/oauth/authorize`;
  const loginConfig: StytchLoginConfig = {
    products: [Products.emailMagicLinks],
    emailMagicLinksOptions: {
      loginRedirectURL: redirectUrl,
      signupRedirectURL: redirectUrl,
    },
  };

  return (
    <StytchProvider stytch={stytchClient}>
      <Gate loginConfig={loginConfig} />
    </StytchProvider>
  );
}
