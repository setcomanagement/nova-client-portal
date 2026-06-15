"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createInvitedUser,
  emailExists,
  getUserById,
  insertFeedback,
  resolveClientAccess,
  setUserPassword,
  updateUserProfile,
} from "@/lib/db/queries";
import { buildInviteLink, inviteExpiry, newInviteToken } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";

export interface ProfileState {
  ok?: boolean;
}

export async function saveProfileAction(
  slug: string,
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await requireSession();
  const name = (formData.get("name")?.toString() ?? "").trim();
  const timezone = (formData.get("timezone")?.toString() ?? "").trim() || null;
  await updateUserProfile(session.userId, {
    name: name || undefined,
    timezone,
  });
  revalidatePath(`/${slug}/settings`);
  return { ok: true };
}

export interface FeedbackState {
  ok?: boolean;
  error?: string;
}

export async function sendFeedbackAction(
  slug: string,
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const session = await requireSession();
  const message = (formData.get("message")?.toString() ?? "").trim();
  if (!message) return { error: "Write something first." };
  await insertFeedback(session.userId, session.clientId, message);
  return { ok: true };
}

export interface ChangePasswordState {
  ok?: boolean;
  error?: string;
}

/** Voluntary password change from Settings — requires the current password. */
export async function changePasswordAction(
  _slug: string,
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await requireSession();
  const current = formData.get("current")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirm")?.toString() ?? "";
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "New passwords don't match." };
  const user = await getUserById(session.userId);
  if (!user) return { error: "Session expired — sign in again." };
  if (!(await verifyPassword(current, user.passwordHash)))
    return { error: "Current password is incorrect." };
  await setUserPassword(session.userId, await hashPassword(password), false);
  return { ok: true };
}

const MEMBER_ROLES = ["client", "manager", "sales_rep", "team_member"] as const;
const MANAGE_ROLES = ["client", "manager", "admin", "super_admin"];

export interface ResetPwState {
  ok?: boolean;
  error?: string;
}

/** Manager/client/admin resets a team member's password to a temp value; that
 *  member is forced to change it on next login. */
export async function resetMemberPasswordAction(
  slug: string,
  memberId: string,
  _prev: ResetPwState,
  formData: FormData,
): Promise<ResetPwState> {
  const session = await requireSession();
  if (!MANAGE_ROLES.includes(session.role)) notFound();
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) notFound();
  const member = await getUserById(memberId);
  if (!member || member.clientId !== client.id)
    return { error: "Member not found in this org." };
  const temp = (formData.get("temp")?.toString() ?? "").trim();
  if (temp.length < 8) return { error: "Temp password needs 8+ characters." };
  await setUserPassword(memberId, await hashPassword(temp), true);
  return { ok: true };
}

export interface AddMemberState {
  ok?: boolean;
  error?: string;
  inviteLink?: string;
  emailed?: boolean;
  to?: string;
}

export async function addMemberAction(
  slug: string,
  _prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const session = await requireSession();
  if (!MANAGE_ROLES.includes(session.role)) notFound();
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) notFound();

  const name = (formData.get("name")?.toString() ?? "").trim();
  const email = (formData.get("email")?.toString() ?? "").trim().toLowerCase();
  const roleRaw = formData.get("role")?.toString() ?? "";
  if (!name || !email) return { error: "Name and email are required." };
  if (!MEMBER_ROLES.includes(roleRaw as (typeof MEMBER_ROLES)[number]))
    return { error: "Pick a valid role." };
  if (await emailExists(email)) return { error: "That email already has an account." };

  const token = newInviteToken();
  await createInvitedUser({
    email,
    name,
    role: roleRaw as (typeof MEMBER_ROLES)[number],
    clientId: client.id,
    passwordHash: await hashPassword(newInviteToken()), // unusable until they set one
    inviteToken: token,
    inviteExpiresAt: inviteExpiry(),
  });
  const link = await buildInviteLink(token);
  const { sent } = await sendInviteEmail({ to: email, name, orgName: client.name, link });
  revalidatePath(`/${slug}/settings`);
  return { ok: true, inviteLink: link, emailed: sent, to: email };
}
