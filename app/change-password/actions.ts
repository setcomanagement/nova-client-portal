"use server";

import { redirect } from "next/navigation";
import { requireSession, setSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { setUserPassword } from "@/lib/db/queries";

export interface ChangePwState {
  error?: string;
}

const MIN = 8;

/**
 * Forced first-login / post-reset password set. The user is already
 * authenticated (temp password), so we require the new password twice but not
 * the old one. Clears mustChange and re-issues the session without the flag.
 */
export async function setNewPasswordAction(
  _prev: ChangePwState,
  formData: FormData,
): Promise<ChangePwState> {
  const session = await requireSession();
  const password = (formData.get("password")?.toString() ?? "");
  const confirm = (formData.get("confirm")?.toString() ?? "");
  if (password.length < MIN) return { error: `Use at least ${MIN} characters.` };
  if (password !== confirm) return { error: "Passwords don't match." };

  await setUserPassword(session.userId, await hashPassword(password), false);
  await setSession({
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
    clientSlug: session.clientSlug,
    mustChange: false,
  });
  redirect("/home");
}
