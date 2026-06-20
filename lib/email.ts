import "server-only";

/*
  Transactional email via Resend's REST API (no SDK dependency). Sends only when
  RESEND_API_KEY and RESEND_FROM are configured — otherwise it's a no-op and the
  caller falls back to showing the invite link in the admin UI.

  RESEND_FROM must be a verified-domain sender, e.g. "NOVA <invites@yourdomain>".
*/
export async function sendInviteEmail(input: {
  to: string;
  /** Owner's name. */
  name: string;
  /** Business / client org name. */
  orgName: string;
  /** Portal password-setting invite link (always present). */
  link: string;
  /** Optional: invite to the wider NOVA community Discord. */
  discordInviteUrl?: string | null;
  /** Optional: invite to the client's private NOVA Discord workspace. */
  clientServerInvite?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false };

  // Section order: portal access (always), then any provided Discord invites.
  const sections = [
    ctaSection({
      title: "Set up your portal access",
      copy: "Click below to set your password and access your client portal.",
      href: input.link,
      cta: "Set your password",
    }),
  ];
  if (input.discordInviteUrl) {
    sections.push(
      ctaSection({
        title: "Join the NOVA community Discord",
        copy: "The wider NOVA community — wins, weekly calls, and Q&A.",
        href: input.discordInviteUrl,
        cta: "Join the community",
      }),
    );
  }
  if (input.clientServerInvite) {
    sections.push(
      ctaSection({
        title: "Your private NOVA workspace",
        copy: "Your dedicated Discord server where the NOVA team will work with you directly.",
        href: input.clientServerInvite,
        cta: "Open your workspace",
      }),
    );
  }

  const html = `
  <div style="font-family:system-ui,sans-serif;background:#f4ece0;padding:32px;color:#2a1f17">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto">
      <tr><td style="background:#fff;border-radius:14px;padding:32px">
        <div style="font-weight:700;font-size:20px;letter-spacing:-0.01em;color:#2a1f17">NOVA</div>
        <h1 style="font-size:20px;margin:20px 0 8px;color:#2a1f17">
          Welcome to NOVA Consulting, ${escapeHtml(input.name)}
        </h1>
        <p style="color:#6b5a45;font-size:14px;line-height:1.5;margin:0">
          We're glad to have ${escapeHtml(input.orgName)} on board. Below is everything you
          need to get started.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${sections.join("")}
        </table>
        <p style="color:#6b5a45;font-size:14px;line-height:1.5;margin:28px 0 0">
          We're excited to work with you.<br>— The NOVA team
        </p>
        <p style="color:#9c886a;font-size:12px;margin:20px 0 0">
          Your portal link expires in 7 days. If the button doesn't work, paste this into your browser:<br>
          <span style="word-break:break-all">${escapeHtml(input.link)}</span>
        </p>
      </td></tr>
    </table>
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
        subject: `Welcome to NOVA Consulting`,
        html,
      }),
    });
    if (!res.ok) return { sent: false, error: `Resend ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** One titled call-to-action block (heading + explanation + amber button). */
function ctaSection(opts: {
  title: string;
  copy: string;
  href: string;
  cta: string;
}): string {
  return `
  <tr><td style="padding:20px 0 0">
    <div style="font-weight:700;font-size:15px;color:#2a1f17">${escapeHtml(opts.title)}</div>
    <div style="color:#6b5a45;font-size:13px;line-height:1.5;margin:4px 0 12px">${escapeHtml(opts.copy)}</div>
    <a href="${escapeAttr(opts.href)}" style="display:inline-block;background:#a0703c;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px">
      ${escapeHtml(opts.cta)} →
    </a>
  </td></tr>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Escape a URL for safe use inside an HTML attribute value. */
function escapeAttr(s: string): string {
  return s.replace(/[&"<>]/g, (c) =>
    ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]!,
  );
}
