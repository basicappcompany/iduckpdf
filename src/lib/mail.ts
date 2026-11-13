import { SITE } from '../config';
import { openMail } from '../engine/io';

/**
 * Sends a message to the team through the /api/contact function (functions/api/contact.ts).
 * Resolves 'sent' when the server accepted it. If the endpoint is not switched on or cannot be reached
 * it opens the visitor's mail app with the message pre-filled instead and resolves 'fallback'.
 */
export async function sendMail(subject: string, body: string, replyTo = ''): Promise<'sent' | 'fallback'> {
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, replyTo }),
    });
    if (res.ok) return 'sent';
  } catch {
    // offline or blocked: fall through to the mail app
  }
  const safeBody = body.length > 1800 ? body.slice(0, 1800) + '\n…' : body;
  openMail(`mailto:${SITE.feedbackEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(safeBody)}`);
  return 'fallback';
}
