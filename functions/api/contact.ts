/**
 * Cloudflare Pages Function: POST /api/contact
 *
 * Sends a feedback or feature-request message to the team's inbox through Resend, so visitors do not need a mail app.
 * The API key lives only in the host's environment variables, never in the browser.
 *
 * Needed environment variables (see docs/TODO.md §1):
 *   RESEND_API_KEY   secret API key (re_...). Without it the function answers 503 and the site falls back to a mailto: link.
 *   CONTACT_TO       optional. Inbox that receives the messages. Default hello@iduckpdf.com
 *   CONTACT_FROM     optional. Verified sender. Default "iDuckPDF <noreply@iduckpdf.com>" (the domain must be verified in Resend)
 *
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */

type Env = { RESEND_API_KEY?: string; CONTACT_TO?: string; CONTACT_FROM?: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
// A subject must stay one line: strip control characters so a visitor cannot inject headers.
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f]+/g, ' ').trim();

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.RESEND_API_KEY) return json({ error: 'Sending is not switched on yet.' }, 503);

  let data: { subject?: unknown; body?: unknown; replyTo?: unknown; website?: unknown };
  try {
    data = (await request.json()) as typeof data;
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  // Honeypot: real visitors never see this field, bots fill it. Pretend it worked.
  if (typeof data.website === 'string' && data.website.trim()) return json({ ok: true });

  const subject = typeof data.subject === 'string' ? oneLine(data.subject) : '';
  const body = typeof data.body === 'string' ? data.body.trim() : '';
  const replyTo = typeof data.replyTo === 'string' ? data.replyTo.trim() : '';
  if (!subject || !body) return json({ error: 'Please write a message first.' }, 400);
  if (subject.length > 200 || body.length > 5000) return json({ error: 'That message is too long.' }, 400);

  const payload: Record<string, unknown> = {
    from: env.CONTACT_FROM || 'iDuckPDF <noreply@iduckpdf.com>',
    to: [env.CONTACT_TO || 'hello@iduckpdf.com'],
    subject,
    text: body,
  };
  if (replyTo && EMAIL.test(replyTo) && replyTo.length <= 254) payload.reply_to = replyTo;

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return json({ error: 'Could not reach the mail provider.' }, 502);
  }
  // Do not leak provider error details (they can echo configuration) to the browser.
  if (!res.ok) return json({ error: 'The message could not be sent.' }, 502);
  return json({ ok: true });
};

// Anything but POST: tell the caller what is allowed.
export const onRequest = async (): Promise<Response> => json({ error: 'Use POST.' }, 405);
