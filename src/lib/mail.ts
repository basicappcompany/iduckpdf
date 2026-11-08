import { SITE } from '../config';
import { openMail } from '../engine/io';

/**
 * Opens the visitor's mail app with a pre-filled message to the team.
 * TODO(docs/TODO.md): swap for a serverless endpoint so people without a mail app can submit too.
 */
export function sendMail(subject: string, body: string): void {
  const safeBody = body.length > 1800 ? body.slice(0, 1800) + '\n…' : body;
  openMail(`mailto:${SITE.feedbackEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(safeBody)}`);
}
