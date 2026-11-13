/**
 * Cloudflare Worker "iduckpdf-mailer": the only place that holds the email-sending binding.
 * Pages Functions cannot use the send_email binding, so functions/api/contact.ts validates the message and
 * hands it to this Worker through a service binding (CONTACT_MAILER). The Worker has no public route and
 * workers.dev is off, so nothing but the site can reach it.
 *
 * Sending to an address verified in Email Routing is free on the Workers Free plan.
 * Settings (see docs/TODO.md §1): Worker secret CONTACT_TO (a verified Email Routing destination);
 * optional CONTACT_FROM (default noreply@iduckpdf.com; the domain must have Email Routing).
 */

type Env = {
  EMAIL: { send(message: { to: string; from: string; subject: string; text: string; replyTo?: string }): Promise<{ messageId?: string }> };
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Use POST.', { status: 405 });
    if (!env.CONTACT_TO) return new Response('CONTACT_TO is not set.', { status: 503 });
    let m: { subject?: unknown; body?: unknown; replyTo?: unknown };
    try {
      m = (await request.json()) as typeof m;
    } catch {
      return new Response('Bad JSON.', { status: 400 });
    }
    if (typeof m.subject !== 'string' || typeof m.body !== 'string' || !m.subject || !m.body) return new Response('Missing fields.', { status: 400 });
    try {
      await env.EMAIL.send({
        to: env.CONTACT_TO,
        from: env.CONTACT_FROM || 'noreply@iduckpdf.com',
        subject: m.subject,
        text: m.body,
        ...(typeof m.replyTo === 'string' && m.replyTo ? { replyTo: m.replyTo } : {}),
      });
    } catch {
      return new Response('Send failed.', { status: 502 });
    }
    return new Response('ok');
  },
};
