"use server";

import { redirect } from "next/navigation";
import {
  consumeInvite,
  getClientById,
  getUserByInviteToken,
} from "@/lib/db/queries";
import { hashPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";

export interface InviteState {
  error?: string;
}

export async function setInvitePasswordAction(
  token: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const user = await getUserByInviteToken(token);
  if (
    !user ||
    !user.inviteToken ||
    !user.inviteExpiresAt ||
    new Date(user.inviteExpiresAt).getTime() < Date.now()
  ) {
    return { error: "This invite link is invalid or has expired. Ask your admin to resend it." };
  }
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirm")?.toString() ?? "";
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  await consumeInvite(user.id, await hashPassword(password));

  let clientSlug: string | null = null;
  if (user.clientId) {
    const client = await getClientById(user.clientId);
    clientSlug = client?.slug ?? null;
  }
  await setSession({
    userId: user.id,
    role: user.role,
    clientId: user.clientId,
    clientSlug,
    mustChange: false,
  });
  redirect("/home");
}
