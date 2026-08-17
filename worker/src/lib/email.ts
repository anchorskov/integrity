// worker/src/lib/email.ts
//
// Ported from grassmvt_survey's src/server/email/resend.js (plain fetch
// against the Resend HTTP API, no SDK, so it needed no rewrite to be
// portable). RESEND_API_KEY is not provisioned for this project yet
// (tracked in docs/planning/05-mvp-roadmap.md Phase 0/6); until it is, sends
// stay stubbed to a console log whenever ENVIRONMENT is unset or "local".

import type { Env } from '../index.js';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_EMAIL_FROM = 'The Fourth Branch <noreply@thefourthbranch.net>';

const shouldStubEmail = (env: Env) => (env.ENVIRONMENT || 'local').toLowerCase() === 'local';

export type SendEmailResult = { ok: true; stubbed?: true; emailId?: string } | { ok: false; code: string };

export const sendEmail = async (
  env: Env,
  { to, subject, html, text, replyTo, from }: { to: string; subject: string; html?: string; text?: string; replyTo?: string; from?: string },
): Promise<SendEmailResult> => {
  if (!to || !subject || (!html && !text)) {
    return { ok: false, code: 'INVALID_PAYLOAD' };
  }
  if (shouldStubEmail(env)) {
    // Local dev has no RESEND_API_KEY; log the full body so a developer can
    // copy a magic-link URL straight out of `wrangler dev` output.
    console.log('[Email] Stub send:', to, subject, '\n' + (text || html));
    return { ok: true, stubbed: true };
  }
  if (!env.RESEND_API_KEY) {
    return { ok: false, code: 'MISSING_RESEND_API_KEY' };
  }

  const payload: Record<string, string> = {
    from: from || env.EMAIL_FROM || DEFAULT_EMAIL_FROM,
    to,
    subject,
  };
  if (text) payload.text = text;
  if (html) payload.html = html;
  const effectiveReplyTo = replyTo || env.EMAIL_REPLY_TO;
  if (effectiveReplyTo) payload.reply_to = effectiveReplyTo;

  let response: Response;
  try {
    response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[Email] Resend fetch error:', (error as Error).message);
    return { ok: false, code: 'RESEND_FETCH_ERROR' };
  }

  const responseBody = await response.text();
  if (!response.ok) {
    console.error('[Email] Resend failed:', { status: response.status, body: responseBody });
    return { ok: false, code: 'RESEND_FAILED' };
  }

  let parsed: { id?: string } = {};
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    // Resend always returns JSON on success; an unparseable body just means
    // no email id to report back, not a failed send.
  }
  return { ok: true, emailId: parsed.id };
};
