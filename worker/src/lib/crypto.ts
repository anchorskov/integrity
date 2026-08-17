// worker/src/lib/crypto.ts
//
// Hashing and token helpers shared by the auth routes. No Cloudflare-specific
// globals here beyond the standard Web Crypto API, so this stays portable to
// Node/Deno/Bun per AGENTS.md's Hono portability goal.

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
};

// IP/user-agent are hashed with a server-side salt before ever touching the
// database, so audit_events and *_challenges never store raw identifying
// values, only a comparable, non-reversible signal.
export const hashSignal = async (value: string, salt: string): Promise<string | null> => {
  if (!value) return null;
  return sha256Hex(`${salt}:${value}`);
};

export const generateRandomToken = (byteLength = 32): string => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
};
