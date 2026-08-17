// worker/src/lib/audit.ts
//
// Writes to audit_events, the WORM audit trail from
// migrations/0001_members_auth.sql. Every auth-relevant event gets a row
// here; rows are never edited or deleted outside an explicit, logged
// corrective action, per AGENTS.md's WORM data protocol.

import type { Context } from 'hono';
import type { Env } from '../index.js';
import { hashSignal } from './crypto.js';

export const getRequestSignals = async (c: Context<{ Bindings: Env }>) => {
  const salt = c.env.HASH_SALT || '';
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
  const userAgent = c.req.header('user-agent') || '';
  return {
    ipHash: await hashSignal(ip, salt),
    userAgentHash: await hashSignal(userAgent, salt),
  };
};

export const writeAuditEvent = async (
  c: Context<{ Bindings: Env }>,
  { memberId = null, eventType, metadata = null }: { memberId?: string | null; eventType: string; metadata?: unknown },
): Promise<void> => {
  const signals = await getRequestSignals(c);
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  await c.env.DB.prepare(
    `INSERT INTO audit_events (member_id, event_type, ip_hash, user_agent_hash, metadata_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(memberId, eventType, signals.ipHash, signals.userAgentHash, metadataJson)
    .run();
};
