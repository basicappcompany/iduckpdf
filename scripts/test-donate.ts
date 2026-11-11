/**
 * Tests for the donate function (functions/api/donate.ts). fetch is replaced by a fake Dodo Payments, so no key, network or money
 * is involved; the fake records what the function sends.
 * Run:  npx tsx scripts/test-donate.ts
 */
import { onRequestPost, onRequest } from '../functions/api/donate';

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
  return providerOk
    ? new Response(JSON.stringify({ checkout_url: 'https://checkout.example/cks_1' }), { status: 200 })
    : new Response('{"secret":"provider detail"}', { status: 500 });
};

const ENV = { DODO_PAYMENTS_API_KEY: 'sk-fake', DODO_DONATION_PRODUCT_ID: 'pdt_once', DODO_MONTHLY_PRODUCT_ID: 'pdt_month' };
const post = async (body: unknown, env: Record<string, string> = ENV) => {
  sent = [];
  const res = await onRequestPost({ request: new Request('https://iduckpdf.com/api/donate', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), env });
  return { status: res.status, data: (await res.json()) as any };
};

(async () => {
  let r = await post({ amount: 5 });
  check('one-time: returns the checkout link', r.status === 200 && r.data.url === 'https://checkout.example/cks_1');
  check('one-time: uses the pay-what-you-want product with the amount in cents', sent[0].body.product_cart[0].product_id === 'pdt_once' && sent[0].body.product_cart[0].amount === 500 && sent[0].body.product_cart[0].quantity === 1);
  check('one-time: goes to the test host with the key by default', sent[0].url === 'https://test.dodopayments.com/checkouts' && sent[0].auth === 'Bearer sk-fake');
  check('one-time: the return page and tag are set', sent[0].body.return_url === 'https://iduckpdf.com/donate?thanks=1' && sent[0].body.metadata.kind === 'one-time');

  r = await post({ amount: 7.5 });
  check('one-time: a non-whole amount is fine', r.status === 200 && sent[0].body.product_cart[0].amount === 750);

  r = await post({ amount: 7, monthly: true });
  check('monthly: returns the checkout link', r.status === 200 && !!r.data.url);
  check('monthly: the monthly product with the dollars as its quantity, and no amount', sent[0].body.product_cart[0].product_id === 'pdt_month' && sent[0].body.product_cart[0].quantity === 7 && !('amount' in sent[0].body.product_cart[0]));
  check('monthly: tagged as monthly', sent[0].body.metadata.kind === 'monthly');

  r = await post({ amount: 7.5, monthly: true });
  check('monthly: a non-whole amount is refused and nothing is sent', r.status === 400 && sent.length === 0);

  r = await post({ amount: 5, monthly: true }, { DODO_PAYMENTS_API_KEY: 'sk-fake', DODO_DONATION_PRODUCT_ID: 'pdt_once' });
  check('monthly: without a monthly product the answer is 503 and nothing is sent', r.status === 503 && sent.length === 0);
  r = await post({ amount: 5 }, { DODO_PAYMENTS_API_KEY: 'sk-fake', DODO_DONATION_PRODUCT_ID: 'pdt_once' });
  check('one-time still works without a monthly product', r.status === 200);

  for (const bad of [0, 0.5, 501, -3, 'abc']) {
    r = await post({ amount: bad });
    check(`amount ${bad} is refused`, r.status === 400 && sent.length === 0);
  }
  r = await post({ amount: 1, monthly: 'yes' });
  check('only a real true means monthly', r.status === 200 && sent[0].body.product_cart[0].product_id === 'pdt_once');
  r = await post('not json');
  check('a body that is not JSON is refused', r.status === 400);

  r = await post({ amount: 5 }, {} as any);
  check('without keys the answer is 503', r.status === 503 && sent.length === 0);

  r = await post({ amount: 5 }, { ...ENV, DODO_API_BASE: 'https://live.dodopayments.com/', SITE_URL: 'https://example.org/' } as any);
  check('live base URL and site URL come from the environment (trailing slash trimmed)', sent[0].url === 'https://live.dodopayments.com/checkouts' && sent[0].body.return_url === 'https://example.org/donate?thanks=1');

  providerOk = false;
  r = await post({ amount: 5 });
  check('a provider failure gives a generic 502 and leaks no provider detail', r.status === 502 && !JSON.stringify(r.data).includes('secret'));
  providerOk = true;

  const g = await onRequest();
  check('anything but POST is told to use POST', g.status === 405);

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) {
    console.log('\nFailures:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
})().catch((e) => {
  console.error('TEST CRASH', e);
  process.exit(2);
});
