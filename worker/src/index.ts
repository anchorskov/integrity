// worker/src/index.ts
//
// Hono app, not native Cloudflare Workers request/response handling — see
// docs/planning/03-reuse-architecture.md "API framework" for why. This same
// app should be able to run on Node/Deno/Bun later with only the entry
// export at the bottom changing, as long as route handlers stay off
// Cloudflare-specific globals and take everything through `c.env`.

import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Env = {
  DB: D1Database;
  CORS_ORIGINS: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const allowed = c.env.CORS_ORIGINS.split(',').map((o) => o.trim());
  return cors({
    origin: (origin) => (origin && allowed.includes(origin) ? origin : allowed[0]),
    credentials: true,
  })(c, next);
});

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'fourthbranch-api', time: new Date().toISOString() }),
);

// ---------------------------------------------------------------------
// Members / auth — schema is live (migrations/0001_members_auth.sql,
// ported from grassmvt_survey's Lucia + WebAuthn stack). Route handlers
// are not yet implemented; each stub below documents what it will do so
// this file stays the map of Phase 1 as it fills in, rather than a bare
// 404. See docs/planning/05-mvp-roadmap.md Phase 1.
// ---------------------------------------------------------------------
const members = new Hono<{ Bindings: Env }>();

members.get('/me', (c) =>
  c.json(
    { error: 'not_implemented', detail: 'Session lookup against member_sessions is not wired up yet.' },
    501,
  ),
);

members.post('/magic-link/request', (c) =>
  c.json(
    { error: 'not_implemented', detail: 'Will insert into member_magic_link_tokens and send via email — port grassmvt_survey src/server/email/.' },
    501,
  ),
);

members.post('/passkey/register/options', (c) =>
  c.json(
    { error: 'not_implemented', detail: 'Will issue a webauthn_challenges row via @simplewebauthn/server.' },
    501,
  ),
);

app.route('/api/members', members);

export default app;
