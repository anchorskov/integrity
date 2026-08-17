// worker/src/lib/magic-link.ts
//
// Ported from grassmvt_survey's magic-link token flow (src/worker.js), same
// token/hash/expiry shape, rewritten against this project's `members` /
// `member_magic_link_tokens` tables (migrations/0001_members_auth.sql)
// instead of grassmvt_survey's `user` / `magic_link_tokens`.

import type { Context } from 'hono';
import type { Env } from '../index.js';
import { generateRandomToken, sha256Hex } from './crypto.js';
import { getRequestSignals } from './audit.js';

const MAGIC_LINK_TOKEN_BYTES = 32;
export const MAGIC_LINK_TTL_MINUTES = 60;

const addMinutesIso = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString();
const nowIso = () => new Date().toISOString();

// Every magic-link request resolves to a member row, new email addresses
// get one created here rather than requiring a separate signup step, so
// "request a link" doubles as "create my account."
export const findOrCreateMember = async (c: Context<{ Bindings: Env }>, email: string): Promise<string> => {
  const existing = await c.env.DB.prepare(`SELECT id FROM members WHERE email = ?`).bind(email).first<{ id: string }>();
  if (existing) return existing.id;

  const memberId = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO members (id, email) VALUES (?, ?)`).bind(memberId, email).run();
  return memberId;
};

// Returns the raw token, which is only ever returned here, never stored.
export const createMagicLinkToken = async (c: Context<{ Bindings: Env }>, memberId: string): Promise<string> => {
  const rawToken = generateRandomToken(MAGIC_LINK_TOKEN_BYTES);
  const tokenHash = await sha256Hex(rawToken);
  const signals = await getRequestSignals(c);
  await c.env.DB.prepare(
    `INSERT INTO member_magic_link_tokens (id, token_hash, member_id, expires_at, request_ip_hash)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), tokenHash, memberId, addMinutesIso(MAGIC_LINK_TTL_MINUTES), signals.ipHash)
    .run();
  return rawToken;
};

// Verifies and consumes a magic-link token in one step, marking it used so
// it cannot be replayed even if the confirmation link is visited twice.
export const verifyMagicLinkToken = async (c: Context<{ Bindings: Env }>, rawToken: string): Promise<string | null> => {
  const tokenHash = await sha256Hex(rawToken);
  const now = nowIso();
  const row = await c.env.DB.prepare(
    `SELECT id, member_id FROM member_magic_link_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
  )
    .bind(tokenHash, now)
    .first<{ id: string; member_id: string }>();

  if (!row) return null;

  await c.env.DB.prepare(`UPDATE member_magic_link_tokens SET used_at = ? WHERE id = ?`).bind(now, row.id).run();
  return row.member_id;
};
