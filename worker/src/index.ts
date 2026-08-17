// worker/src/index.ts
//
// Hono app, not native Cloudflare Workers request/response handling. See
// docs/planning/03-reuse-architecture.md "API framework" for why. This same
// app should be able to run on Node/Deno/Bun later with only the entry
// export at the bottom changing, as long as route handlers stay off
// Cloudflare-specific globals and take everything through `c.env`.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import members from './routes/members.js';

export type Env = {
  DB: D1Database;
  CORS_ORIGINS: string;
  // Auth (worker/src/lib/session.ts, magic-link.ts, routes/members.ts).
  // HASH_SALT and RESEND_API_KEY are secrets (worker/.dev.vars locally,
  // `wrangler secret put` in each deployed env), never committed vars.
  HASH_SALT: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  APP_BASE_URL?: string;
  ENVIRONMENT?: string;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_RP_NAME?: string;
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

// Members / auth: magic-link sign-in and passkey registration against
// migrations/0001_members_auth.sql. See routes/members.ts and
// docs/planning/05-mvp-roadmap.md Phase 1. Passkey login (as opposed to
// registration) and OAuth are not implemented yet.
app.route('/api/members', members);

export default app;
