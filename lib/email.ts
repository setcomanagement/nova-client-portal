import "server-only";

/*
  Transactional email via Resend's REST API (no SDK dependency). Sends only when
  RESEND_API_KEY and RESEND_FROM are configured — otherwise it's a no-op and the
  caller falls back to showing the invite link in the admin UI.

  RESEND_FROM must be a verified-domain sender, e.g. "NOVA <invites@yourdomain>".
*/
export async function sendInviteEmail(input: {
  to: string;
  name: string;
  orgName: string;
  link: string;
}): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false };

  const html = `
  <div style="font-family:system-ui,sans-serif;background:#f4ece0;padding:32px;color:#2a1f17">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:32px">
      <div style="font-weight:700;font-size:20px;letter-spacing:-0.01em">NOVA</div>
      <h1 style="font-size:20px;margin:20px 0 8px">Set up your ${escapeHtml(input.orgName)} portal</h1>
      <p style="color:#6b5a45;font-size:14px;line-height:1.5">
        Hi ${escapeHtml(input.name)}, you've been invited to the NOVA portal. Click below to
        choose your password and sign in.
      </p>
      <a href="${input.link}" style="display:inline-block;margin-top:20px;background:#a0703c;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">
        Set your password →
      </a>
      <p style="color:#9c886a;font-size:12px;margin-top:24px">
        This link expires in 7 days. If the button doesn't work, paste this into your browser:<br>
        <span style="word-break:break-all">${input.link}</span>
      </p>
    </div>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: `Set up your NOVA portal account`,
        html,
      }),
    });
    if (!res.ok) return { sent: false, error: `Resend ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
