import { z } from "zod";

/**
 * Validation rules for "Create client + invite owner". Shared by the admin
 * form server action (createClientAction) and the external provisioning API
 * route (POST /api/clients) so both paths enforce identical input rules.
 */
export const createClientSchema = z.object({
  name: z.string().min(2, "Name is too short").max(80),
  slug: z.string().max(60).optional(),
  ownerName: z.string().min(2, "Owner name is too short").max(80),
  ownerEmail: z.string().email("Enter a valid owner email"),
  notionUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  // Optional Discord links surfaced in the welcome email (provisioning API only;
  // the admin form doesn't collect these). Empty string is treated as "not set".
  discordInviteUrl: z
    .string()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
  clientServerInvite: z
    .string()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
