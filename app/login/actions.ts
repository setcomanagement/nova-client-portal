"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getClientById, getUserByEmail } from "@/lib/db/queries";
import { verifyPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Only honor same-origin relative paths for the post-login return ("/oauth/authorize?…").
 * Reject absolute URLs and protocol-relative "//evil.com" to avoid an open redirect.
 */
function safeNext(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export interface LoginState {
  error?: string;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const user = await getUserByEmail(parsed.data.email);
  // Same generic message whether the email is unknown or the password is wrong.
  const GENERIC = "Invalid email or password.";
  if (!user) {
    return { error: GENERIC };
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return { error: GENERIC };
  }

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
    mustChange: user.mustChangePassword,
  });

  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  redirect(safeNext(formData.get("next")) ?? "/home");
}
