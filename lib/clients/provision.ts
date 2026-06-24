import "server-only";
import {
  createClient,
  createInvitedUser,
  emailExists,
  getClientBySlug,
} from "@/lib/db/queries";
import { hashPassword } from "@/lib/auth/password";
import { buildInviteLink, inviteExpiry, newInviteToken } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";
import { slugify } from "@/lib/utils";
import type { CreateClientInput } from "./schema";

/**
 * Core "create a client org + invite its owner" flow, shared by:
 *  - the external provisioning API route (POST /api/clients), and
 *  - the MCP connector tool (create_nova_client).
 *
 * Input MUST already be validated against createClientSchema. Failures that the
 * caller maps to a status code are thrown as ProvisionError; everything else
 * propagates as a normal Error (the caller treats it as a 500 / internal error).
 */

export type ProvisionErrorCode =
  | "empty_slug"
  | "duplicate_slug"
  | "duplicate_email";

export class ProvisionError extends Error {
  constructor(
    public readonly code: ProvisionErrorCode,
    /** Present for duplicate_slug / empty_slug so callers can log the value. */
    public readonly slug?: string,
    /** Present for duplicate_email so callers can log the value. */
    public readonly email?: string,
  ) {
    super(code);
    this.name = "ProvisionError";
  }
}

export interface ProvisionResult {
  organizationId: string;
  organizationSlug: string;
  ownerProfileId: string;
  ownerEmail: string;
  inviteUrl: string;
}

export interface ProvisionOptions {
  /**
   * When true, skip sending the owner invite email. The org + owner are still
   * created identically (and inviteUrl is still returned); only the Resend send
   * is suppressed — e.g. when an external system like Make.com sends its own.
   */
  skipEmail?: boolean;
}

export async function provisionClient(
  data: CreateClientInput,
  options: ProvisionOptions = {},
): Promise<ProvisionResult> {
  const slug = slugify(data.slug || data.name);
  if (!slug) throw new ProvisionError("empty_slug");
  if (await getClientBySlug(slug)) throw new ProvisionError("duplicate_slug", slug);
  if (await emailExists(data.ownerEmail)) {
    throw new ProvisionError("duplicate_email", undefined, data.ownerEmail);
  }

  const client = await createClient({
    name: data.name,
    slug,
    notionUrl: data.notionUrl ? data.notionUrl : null,
  });

  // Owner login is an email invite — they set their own password. The stored
  // hash is of a throwaway token; the real credential is the invite link.
  const inviteToken = newInviteToken();
  const owner = await createInvitedUser({
    email: data.ownerEmail,
    name: data.ownerName,
    role: "client",
    clientId: client.id,
    passwordHash: await hashPassword(newInviteToken()),
    inviteToken,
    inviteExpiresAt: inviteExpiry(),
  });

  const inviteUrl = await buildInviteLink(inviteToken);
  if (!options.skipEmail) {
    // Empty string → treat as not provided so the email skips that section.
    await sendInviteEmail({
      to: data.ownerEmail,
      name: data.ownerName,
      orgName: client.name,
      link: inviteUrl,
      discordInviteUrl: data.discordInviteUrl || null,
      clientServerInvite: data.clientServerInvite || null,
    });
  }

  return {
    organizationId: client.id,
    organizationSlug: client.slug,
    ownerProfileId: owner.id,
    ownerEmail: owner.email,
    inviteUrl,
  };
}
