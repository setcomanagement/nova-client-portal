"use client";

import {
  IdentityProvider,
  OTPMethods,
  Products,
  StytchLogin,
  StytchProvider,
  useStytchSession,
  type StytchLoginConfig,
} from "@stytch/react";
import { stytchClient } from "./stytch";

/**
 * Connected Apps consent surface. claude.ai sends the operator here with the OAuth
 * authorize params in the URL.
 *
 *  - No Stytch session yet  -> email OTP login. OTP keeps the user ON this page
 *    (enter email, then a 6-digit code) so the inbound OAuth params in the URL are
 *    never lost. A magic link, by contrast, navigates away to the inbox and back,
 *    dropping the params and breaking the consent step.
 *  - Stytch session present -> mount <IdentityProvider>, which reads the OAuth
 *    params from the (still-intact) URL and renders consent, then redirects back to
 *    the MCP client with an authorization code.
 *
 * Access is already gated to NOVA operators by the portal admin session check in
 * page.tsx; the Stytch login here is what mints the token.
 */
const loginConfig: StytchLoginConfig = {
  products: [Products.otp],
  otpOptions: {
    methods: [OTPMethods.Email],
    expirationMinutes: 10,
  },
};

function Gate() {
  const { session } = useStytchSession();
  return session ? <IdentityProvider /> : <StytchLogin config={loginConfig} />;
}

export function AuthorizeClient() {
  return (
    <StytchProvider stytch={stytchClient}>
      <Gate />
    </StytchProvider>
  );
}
