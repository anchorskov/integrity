-- worker/migrations/0001_members_auth.sql
-- Purpose: member accounts + session/passkey/OAuth/magic-link auth.
-- Ported from grassmvt_survey's Lucia + WebAuthn auth stack
-- (db/migrations/0006_auth_tables.sql, 0008_passkey_tables.sql,
-- 0012_oauth_tables.sql, 0037_magic_link_tokens.sql), renamed to this
-- project's `members` vocabulary per docs/planning/02-data-model.md.
-- Intentionally NOT ported: grassmvt_survey's `user_verification` table
-- (WY voter-residence matching — not applicable here).

CREATE TABLE IF NOT EXISTS members (
  id                TEXT NOT NULL PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT,                          -- nullable: passkey/OAuth-only members never set one
  display_name      TEXT,
  membership_tier   TEXT NOT NULL DEFAULT 'free',   -- free | supporter | sustainer | founding
  billing_status    TEXT NOT NULL DEFAULT 'none',   -- none | active | past_due | canceled
  stripe_customer_id TEXT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_sessions (
  id          TEXT NOT NULL PRIMARY KEY,
  expires_at  INTEGER NOT NULL,
  member_id   TEXT NOT NULL,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_member_sessions_member_id ON member_sessions (member_id);
CREATE INDEX IF NOT EXISTS idx_member_sessions_expires_at ON member_sessions (expires_at);

CREATE TABLE IF NOT EXISTS member_passkeys (
  id              TEXT NOT NULL PRIMARY KEY,
  member_id       TEXT NOT NULL,
  credential_id   TEXT NOT NULL UNIQUE,
  public_key      TEXT NOT NULL,
  counter         INTEGER NOT NULL DEFAULT 0,
  transports_json TEXT,
  created_at      TEXT NOT NULL,
  last_used_at    TEXT,
  nickname        TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_member_passkeys_member_id ON member_passkeys (member_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id              TEXT NOT NULL PRIMARY KEY,
  kind            TEXT NOT NULL,          -- registration | authentication
  member_id       TEXT,
  challenge       TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  used_at         TEXT,
  request_ip_hash TEXT,
  request_ua_hash TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges (expires_at);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_member_kind ON webauthn_challenges (member_id, kind);

CREATE TABLE IF NOT EXISTS member_oauth_states (
  state         TEXT PRIMARY KEY,
  provider      TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS member_oauth_accounts (
  provider      TEXT NOT NULL,
  provider_sub  TEXT NOT NULL,
  member_id     TEXT NOT NULL,
  email         TEXT,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_sub),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_member_oauth_accounts_member_id ON member_oauth_accounts (member_id);

CREATE TABLE IF NOT EXISTS member_magic_link_tokens (
  id              TEXT NOT NULL PRIMARY KEY,
  token_hash      TEXT NOT NULL UNIQUE,
  member_id       TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at      TEXT NOT NULL,
  used_at         TEXT,
  request_ip_hash TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_member_magic_link_tokens_member_id ON member_magic_link_tokens (member_id);
CREATE INDEX IF NOT EXISTS idx_member_magic_link_tokens_expires_at ON member_magic_link_tokens (expires_at);

-- WORM audit trail (see AGENTS.md "WORM Data Protocol" once written for this
-- project) — every auth-relevant event gets a row here, never edited.
CREATE TABLE IF NOT EXISTS audit_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id        TEXT,
  event_type       TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash          TEXT,
  user_agent_hash  TEXT,
  metadata_json    TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_events_member_id ON audit_events (member_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events (created_at);
