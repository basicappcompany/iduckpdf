/**
 * Cloudflare Pages Function: POST /api/contact
 *
 * Validates a feedback or feature-request message and hands it to the iduckpdf-mailer Worker (worker/mailer.ts),
 * which sends it to the team's inbox with Cloudflare Email Service (free for a verified destination). Pages Functions
 * cannot hold the send_email binding themselves, so the Worker is attached as a service binding.
 *
 * Needed setup (see docs/TODO.md §1): Pages, Settings, Bindings: a service binding named CONTACT_MAILER pointing at
 * the iduckpdf-mailer Worker. Without it the function answers 503 and the site falls back to a mailto: link.
 */

type Env = { CONTACT_MAILER?: { fetch(input: string, init?: RequestInit): Promise<Response> } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
// A subject must stay one line: strip control characters so a visitor cannot inject headers.
const oneLine = (s: string) => s.replace(/[\r\n\u0000-\u001f]+/g, ' ').trim();

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.CONTACT_MAILER) return json({ error: 'Sending is not switched on yet.' }, 503);

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

  const payload: Record<string, string> = { subject, body };
  if (replyTo && EMAIL.test(replyTo) && replyTo.length <= 254) payload.replyTo = replyTo;

  let res: Response;
  try {
    res = await env.CONTACT_MAILER.fetch('https://mailer.internal/', { method: 'POST', body: JSON.stringify(payload) });
  } catch {
    return json({ error: 'Could not reach the mail service.' }, 502);
  }
  // Do not leak provider error details to the browser.
  if (!res.ok) return json({ error: 'The message could not be sent.' }, 502);
  return json({ ok: true });
};

// Anything but POST: tell the caller what is allowed.
export const onRequest = async (): Promise<Response> => json({ error: 'Use POST.' }, 405);
