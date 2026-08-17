// worker/src/routes/members.ts
//
// Member auth routes: magic-link sign-in and passkey registration, wired
// against migrations/0001_members_auth.sql. Ported from grassmvt_survey's
// equivalent handlers in src/worker.js, rewritten through Hono's context
// (c.env, c.req, c.json) instead of raw Request/Response, and against
// session.ts's hand-rolled sessions instead of Lucia (see session.ts's
// header comment for why). See docs/planning/05-mvp-roadmap.md Phase 1.
//
// Not yet implemented, left for a follow-up pass: passkey login
// (authentication, as opposed to registration) and OAuth. Magic link is the
// only account-creation path for now; passkeys can only be added to an
// account that already has a session.

import { Hono } from 'hono';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { Env } from '../index.js';
import { createSession, getSessionMember, invalidateSession } from '../lib/session.js';
import { createMagicLinkToken, findOrCreateMember, MAGIC_LINK_TTL_MINUTES, verifyMagicLinkToken } from '../lib/magic-link.js';
import { sendEmail } from '../lib/email.js';
import { isValidEmail, normalizeEmail } from '../lib/validators.js';
import { requireAllowedOrigin } from '../lib/origin.js';
import { writeAuditEvent, getRequestSignals } from '../lib/audit.js';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE_NAME } from '../lib/session.js';

const WEBAUTHN_CHALLENGE_TTL_MINUTES = 10;

const members = new Hono<{ Bindings: Env }>();

members.get('/me', async (c) => {
  const member = await getSessionMember(c);
  if (!member) {
    return c.json({ error: 'not_authenticated' }, 401);
  }
  return c.json({ member });
});

members.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    await invalidateSession(c, token);
  }
  return c.json({ ok: true });
});

members.post('/magic-link/request', async (c) => {
  const originError = requireAllowedOrigin(c);
  if (originError) {
    return c.json({ error: 'invalid_origin' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email || ''));
  if (!isValidEmail(email)) {
    return c.json({ error: 'invalid_email' }, 400);
  }

  // Same response regardless of whether the account already existed, so
  // this endpoint can't be used to enumerate registered members.
  try {
    const memberId = await findOrCreateMember(c, email);
    const rawToken = await createMagicLinkToken(c, memberId);
    // Points at this API's own origin, not APP_BASE_URL (the Astro
    // frontend): /magic-link/verify is an API route. In production the two
    // happen to be the same domain (thefourthbranch.net/api/* is proxied
    // onto the Worker), but locally the Worker (8787) and Astro (4321) are
    // different ports, so using APP_BASE_URL here would point the link at
    // the wrong server.
    const verifyUrl = new URL('/api/members/magic-link/verify', new URL(c.req.url).origin);
    verifyUrl.searchParams.set('token', rawToken);

    const sent = await sendEmail(c.env, {
      to: email,
      subject: 'Your The Fourth Branch sign-in link',
      text: `Click this link to sign in: ${verifyUrl.toString()}\n\nThis link expires in ${MAGIC_LINK_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
      html: `Click <a href="${verifyUrl.toString()}">here</a> to sign in to The Fourth Branch.<br>This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
    });

    await writeAuditEvent(c, {
      memberId,
      eventType: 'magic_link_requested',
      metadata: { sent: sent.ok },
    });
  } catch (error) {
    console.error('[MagicLink] request failed:', (error as Error).message);
  }

  return c.json({ ok: true, status: 'magic_link_sent' });
});

members.get('/magic-link/verify', async (c) => {
  const token = c.req.query('token');
  if (!token) {
    return c.json({ error: 'missing_token' }, 400);
  }

  const memberId = await verifyMagicLinkToken(c, token);
  if (!memberId) {
    return c.json({ error: 'invalid_or_expired_token' }, 400);
  }

  await createSession(c, memberId);
  await writeAuditEvent(c, { memberId, eventType: 'magic_link_verified' });

  // No frontend /auth page exists yet (tracked in
  // docs/planning/05-mvp-roadmap.md Phase 1); redirect straight to the site
  // root with the session cookie already set, rather than blocking this
  // route on a page that isn't built.
  const baseUrl = c.env.APP_BASE_URL || new URL(c.req.url).origin;
  return c.redirect(baseUrl, 302);
});

members.post('/passkey/register/options', async (c) => {
  const originError = requireAllowedOrigin(c);
  if (originError) {
    return c.json({ error: 'invalid_origin' }, 403);
  }
  const member = await getSessionMember(c);
  if (!member) {
    return c.json({ error: 'not_authenticated' }, 401);
  }

  const existing = await c.env.DB.prepare(
    `SELECT credential_id, transports_json FROM member_passkeys WHERE member_id = ?`,
  )
    .bind(member.id)
    .all<{ credential_id: string; transports_json: string | null }>();

  const excludeCredentials = (existing.results || []).map((row) => ({
    id: row.credential_id,
    transports: row.transports_json ? JSON.parse(row.transports_json) : undefined,
  }));

  const rpID = c.env.WEBAUTHN_RP_ID || new URL(c.req.url).hostname;
  const rpName = c.env.WEBAUTHN_RP_NAME || 'The Fourth Branch';

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: member.email,
    // Cast needed: @cloudflare/workers-types' TextEncoder.encode() returns a
    // structurally identical but nominally different Uint8Array<ArrayBufferLike>
    // than @simplewebauthn/server's Uint8Array<ArrayBuffer> param type.
    userID: new TextEncoder().encode(member.id) as Uint8Array<ArrayBuffer>,
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    attestationType: 'none',
  });

  const challengeId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MINUTES * 60 * 1000);
  const signals = await getRequestSignals(c);

  await c.env.DB.prepare(
    `INSERT INTO webauthn_challenges
       (id, kind, member_id, challenge, created_at, expires_at, request_ip_hash, request_ua_hash)
     VALUES (?, 'registration', ?, ?, ?, ?, ?, ?)`,
  )
    .bind(challengeId, member.id, options.challenge, now.toISOString(), expiresAt.toISOString(), signals.ipHash, signals.userAgentHash)
    .run();

  await writeAuditEvent(c, { memberId: member.id, eventType: 'passkey_register_options_issued' });

  return c.json({ ok: true, options, challengeId });
});

members.post('/passkey/register/verify', async (c) => {
  const originError = requireAllowedOrigin(c);
  if (originError) {
    return c.json({ error: 'invalid_origin' }, 403);
  }
  const member = await getSessionMember(c);
  if (!member) {
    return c.json({ error: 'not_authenticated' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const attestationResponse = body.attestationResponse as RegistrationResponseJSON | undefined;
  const nickname = body.nickname ? String(body.nickname).trim() : null;
  if (!attestationResponse) {
    return c.json({ error: 'missing_attestation' }, 400);
  }

  const challengeRow = await c.env.DB.prepare(
    `SELECT id, challenge, expires_at FROM webauthn_challenges
     WHERE member_id = ? AND kind = 'registration' AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(member.id)
    .first<{ id: string; challenge: string; expires_at: string }>();

  if (!challengeRow) {
    return c.json({ error: 'challenge_missing' }, 400);
  }
  if (new Date(challengeRow.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'challenge_expired' }, 400);
  }

  const rpID = c.env.WEBAUTHN_RP_ID || new URL(c.req.url).hostname;
  const expectedOrigin = c.req.header('Origin') || new URL(c.req.url).origin;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (error) {
    console.error('[PasskeyRegister] verify failed:', (error as Error).message);
    return c.json({ error: 'verify_failed' }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: 'verify_failed' }, 400);
  }

  const { credential } = verification.registrationInfo;
  const credentialId = credential.id;
  const publicKey = isoBase64URL.fromBuffer(credential.publicKey);
  const transports = attestationResponse.response.transports;

  await c.env.DB.prepare(
    `INSERT INTO member_passkeys
       (id, member_id, credential_id, public_key, counter, transports_json, created_at, nickname)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      member.id,
      credentialId,
      publicKey,
      credential.counter,
      transports ? JSON.stringify(transports) : null,
      new Date().toISOString(),
      nickname,
    )
    .run();

  await c.env.DB.prepare(`UPDATE webauthn_challenges SET used_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), challengeRow.id)
    .run();

  await writeAuditEvent(c, { memberId: member.id, eventType: 'passkey_register_completed' });

  return c.json({ ok: true });
});

export default members;
