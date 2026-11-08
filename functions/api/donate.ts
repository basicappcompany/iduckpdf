/**
 * Cloudflare Pages Function: POST /api/donate
 *
 * Creates a Dodo Payments checkout session for a pay-what-you-want donation product
 * and returns its hosted checkout URL. The secret key lives only in the host's environment
 * variables, never in the browser.
 *
 * Needed environment variables (see docs/TODO.md):
 *   DODO_PAYMENTS_API_KEY       secret API key (test key first!)
 *   DODO_DONATION_PRODUCT_ID    id of a one-time, Pay-What-You-Want product (pdt_...)
 *   DODO_API_BASE               optional. https://test.dodopayments.com (default) or the live base URL
 *   SITE_URL                    optional. Where Dodo sends people after paying. Default https://iduckpdf.com
 *
 * Docs: https://docs.dodopayments.com/developer-resources/dynamic-pricing-checkout
 */

type Env = {
  DODO_PAYMENTS_API_KEY?: string;
  DODO_DONATION_PRODUCT_ID?: string;
  DODO_API_BASE?: string;
  SITE_URL?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.DODO_PAYMENTS_API_KEY || !env.DODO_DONATION_PRODUCT_ID) {
    return json({ error: 'Donations are not switched on yet.' }, 503);
  }

  let amount = NaN;
  try {
    const body = (await request.json()) as { amount?: unknown };
    amount = Number(body.amount);
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  // major units (dollars) in, whole-dollar amounts between 1 and 500
  if (!Number.isFinite(amount) || amount < 1 || amount > 500) {
    return json({ error: 'Please choose an amount between 1 and 500.' }, 400);
  }
  const cents = Math.round(amount * 100);

  const base = (env.DODO_API_BASE || 'https://test.dodopayments.com').replace(/\/$/, '');
  const site = (env.SITE_URL || 'https://iduckpdf.com').replace(/\/$/, '');

  let res: Response;
  try {
    res = await fetch(`${base}/checkouts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_cart: [{ product_id: env.DODO_DONATION_PRODUCT_ID, quantity: 1, amount: cents }],
        return_url: `${site}/donate?thanks=1`,
        metadata: { source: 'iduckpdf-donate' },
      }),
    });
  } catch {
    return json({ error: 'Could not reach the payment provider.' }, 502);
  }

  if (!res.ok) {
    // Do not leak provider error details (they can echo configuration) to the browser.
    return json({ error: 'The payment provider could not start the checkout.' }, 502);
  }
  const data = (await res.json()) as { checkout_url?: string };
  if (!data.checkout_url) return json({ error: 'No checkout link was returned.' }, 502);
  return json({ url: data.checkout_url });
};

// Anything but POST: tell the caller what is allowed.
export const onRequest = async (): Promise<Response> => json({ error: 'Use POST.' }, 405);
