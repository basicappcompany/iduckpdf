/**
 * Tests for the contact function (functions/api/contact.ts). fetch is replaced by a fake Resend, so no key or network is involved.
 * Run:  npx tsx scripts/test-contact.ts
 */
import { onRequestPost, onRequest } from '../functions/api/contact';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, extra = '') {
  if (ok) pass++;
  else {
    fail++;
    failures.push(name + (extra ? ` (${extra})` : ''));
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra && !ok ? '  (' + extra + ')' : ''}`);
}

let sent: { url: string; auth: string; body: any }[] = [];
let providerOk = true;
(globalThis as any).fetch = async (url: string, init: any) => {
  sent.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
  return providerOk ? new Response('{"id":"em_1"}', { status: 200 }) : new Response('{"secret":"provider detail"}', { status: 500 });
};

const ENV: Record<string, string> = { RESEND_API_KEY: 're_fake' };
const post = async (body: unknown, env: Record<string, string> = ENV) => {
  sent = [];
  const res = await onRequestPost({ request: new Request('https://iduckpdf.com/api/contact', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), env });
  return { status: res.status, data: (await res.json()) as any };
};

(async () => {
  let r = await post({ subject: 'S', body: 'Hello' }, {});
  check('no key: 503 so the site falls back to mailto', r.status === 503 && sent.length === 0);

  r = await post('not json');
  check('bad JSON: 400', r.status === 400);

  r = await post({ subject: 'S', body: '   ' });
  check('empty message: 400, nothing sent', r.status === 400 && sent.length === 0);

  r = await post({ subject: 'S', body: 'x'.repeat(5001) });
  check('too long: 400', r.status === 400 && sent.length === 0);

  r = await post({ subject: 'Hi\r\nBcc: evil@x.com', body: 'Hello', replyTo: 'anna@example.com' });
  check('valid: 200 and one email to the default inbox', r.status === 200 && sent.length === 1 && sent[0].body.to[0] === 'hello@iduckpdf.com');
  check('the key goes to Resend as a bearer token', sent[0].url === 'https://api.resend.com/emails' && sent[0].auth === 'Bearer re_fake');
  check('subject is one line (no header injection)', !/[\r\n]/.test(sent[0].body.subject));
  check('valid reply-to is passed on', sent[0].body.reply_to === 'anna@example.com');

  r = await post({ subject: 'S', body: 'Hello', replyTo: 'not an email' });
  check('invalid reply-to is dropped, message still sent', r.status === 200 && sent[0].body.reply_to === undefined);

  r = await post({ subject: 'S', body: 'Hello', website: 'http://spam' });
  check('honeypot filled: looks ok but sends nothing', r.status === 200 && sent.length === 0);

  r = await post({ subject: 'S', body: 'Hello' }, { ...ENV, CONTACT_TO: 'me@x.com', CONTACT_FROM: 'A <a@x.com>' });
  check('CONTACT_TO and CONTACT_FROM override the defaults', sent[0].body.to[0] === 'me@x.com' && sent[0].body.from === 'A <a@x.com>');

  providerOk = false;
  r = await post({ subject: 'S', body: 'Hello' });
  check('provider error: 502 without leaking detail', r.status === 502 && !JSON.stringify(r.data).includes('provider detail'));
  providerOk = true;

  const m = await onRequest();
  check('other methods: 405', m.status === 405);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log(failures.join('\n'));
    process.exit(1);
  }
})();
