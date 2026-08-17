// worker/src/lib/origin.ts
//
// State-changing auth requests (magic-link request/verify, passkey
// register) must come from an allowed origin, not just any site that can
// point a browser at this API. Checked against CORS_ORIGINS (the same list
// the CORS middleware in index.ts already allows) rather than the request's
// own URL: grassmvt_survey's equivalent check (requireSameOrigin in
// src/worker.js) compares Origin against the Worker's own origin, which
// only works because its frontend and API share a domain in production. In
// local dev here, Astro (4321) and the Worker (8787) are on different
// ports, so an against-self check would reject every local POST. Comparing
// against the configured allowlist instead is correct in both environments.

import type { Context } from 'hono';
import type { Env } from '../index.js';

export const requireAllowedOrigin = (c: Context<{ Bindings: Env }>): string | null => {
  const origin = c.req.header('Origin');
  if (!origin) {
    // Plain GET navigation (e.g. clicking a magic-link URL) has no Origin
    // header in most browsers; only enforce this for requests that carry one.
    return c.req.method === 'GET' ? null : 'Missing Origin header.';
  }
  const allowed = (c.env.CORS_ORIGINS || '').split(',').map((o) => o.trim());
  return allowed.includes(origin) ? null : 'Origin not allowed.';
};
