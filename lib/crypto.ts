import "server-only";
import crypto from "node:crypto";

/*
  AES-256-GCM encryption for secrets at rest (Calendly OAuth tokens). The key is
  derived from JWT_SECRET so no extra env is required; rotating JWT_SECRET
  invalidates stored tokens (clients re-connect), which is acceptable.
  Format: base64(iv).base64(tag).base64(ciphertext)
*/
function key(): Buffer {
  return crypto
    .createHash("sha256")
    .update(process.env.JWT_SECRET ?? "dev-secret-change-me")
    .digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
