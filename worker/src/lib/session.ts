// worker/src/lib/session.ts
//
// Hand-rolled session auth, not Lucia. grassmvt_survey (the port source, see
// docs/planning/05-mvp-roadmap.md Phase 1) uses the `lucia` package, but two
// things ruled it out here: its own author deprecated it in 2024 in favor of
// exactly this pattern (a random token, hashed before storage, looked up by
// hash), and its D1 adapter hardcodes a `session.user_id` column, which
// doesn't fit this project's `member_sessions.member_id` naming from
// migrations/0001_members_auth.sql. Rewriting the few dozen lines by hand
// avoided a deprecated dependency and a schema-vs-library naming fight.
//
// Token handling follows Lucia's own recommended manual pattern: a random
// token goes in the cookie and is never stored; only its SHA-256 hash is
// stored, as the session row's id.

import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { Env } from '../index.js';
import { generateRandomToken, sha256Hex } from './crypto.js';

export const SESSION_COOKIE_NAME = 'fb_session';

// Not specified in docs/planning (which covers auth table shape, not session
// lifetime); this is a new choice for a membership site rather than a ported
// value, grassmvt_survey's 7-day default was set for its voter-verification
// use case. Revisit if the eventual payment-platform integration (Phase 6)
// wants something shorter.
const SESSION_TTL_DAYS = 30;
const RENEWAL_THRESHOLD_DAYS = 15;

export type SessionMember = {
  id: string;
  email: string;
  display_name: string | null;
  membership_tier: string;
  billing_status: string;
};

const expiresAtFromNow = () => Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 24 * 60 * 60;

export const createSession = async (c: Context<{ Bindings: Env }>, memberId: string): Promise<string> => {
  const token = generateRandomToken(20);
  const sessionId = await sha256Hex(token);
  const expiresAt = expiresAtFromNow();
  await c.env.DB.prepare(
    `INSERT INTO member_sessions (id, expires_at, member_id) VALUES (?, ?, ?)`,
  )
    .bind(sessionId, expiresAt, memberId)
    .run();
  setSessionCookie(c, token, expiresAt);
  return token;
};

export const validateSessionToken = async (
  c: Context<{ Bindings: Env }>,
  token: string,
): Promise<SessionMember | null> => {
  const sessionId = await sha256Hex(token);
  const row = await c.env.DB.prepare(
    `SELECT m.id, m.email, m.display_name, m.membership_tier, m.billing_status, s.expires_at
     FROM member_sessions s
     JOIN members m ON m.id = s.member_id
     WHERE s.id = ?`,
  )
    .bind(sessionId)
    .first<SessionMember & { expires_at: number }>();

  if (!row) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (row.expires_at <= nowSeconds) {
    await c.env.DB.prepare(`DELETE FROM member_sessions WHERE id = ?`).bind(sessionId).run();
    return null;
  }

  // Sliding renewal: push expiry back out once the session is inside the
  // renewal window, so an active member is never logged out mid-use, but an
  // abandoned session still expires on schedule.
  const renewalCutoff = nowSeconds + RENEWAL_THRESHOLD_DAYS * 24 * 60 * 60;
  if (row.expires_at < renewalCutoff) {
    const newExpiresAt = expiresAtFromNow();
    await c.env.DB.prepare(`UPDATE member_sessions SET expires_at = ? WHERE id = ?`)
      .bind(newExpiresAt, sessionId)
      .run();
    setSessionCookie(c, token, newExpiresAt);
  }

  const { expires_at: _expiresAt, ...member } = row;
  return member;
};

export const invalidateSession = async (c: Context<{ Bindings: Env }>, token: string): Promise<void> => {
  const sessionId = await sha256Hex(token);
  await c.env.DB.prepare(`DELETE FROM member_sessions WHERE id = ?`).bind(sessionId).run();
  deleteSessionCookie(c);
};

export const setSessionCookie = (c: Context<{ Bindings: Env }>, token: string, expiresAtSeconds: number): void => {
  const isProduction = (c.env.ENVIRONMENT || '').toLowerCase() === 'production';
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isProduction,
    path: '/',
    expires: new Date(expiresAtSeconds * 1000),
  });
};

export const deleteSessionCookie = (c: Context<{ Bindings: Env }>): void => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
};

// Looks up the member for the current request's session cookie, if any.
// Returns null rather than throwing when there is no session or it is
// invalid/expired, callers decide whether that's a 401.
export const getSessionMember = async (c: Context<{ Bindings: Env }>): Promise<SessionMember | null> => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) return null;
  return validateSessionToken(c, token);
};
