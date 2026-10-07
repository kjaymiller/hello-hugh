-- Accounts. Hugh's existing password/session login maps to the 'hugh'
-- account (which has no API key until one is issued via the admin API).
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    -- SHA-256 of the API key; the key itself is never stored. Keys are
    -- high-entropy random values, so a fast hash is appropriate.
    api_key_hash TEXT UNIQUE,
    -- First few characters of the key, so keys can be told apart in listings.
    api_key_prefix TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

INSERT INTO accounts (slug, name) VALUES ('hugh', 'Hugh')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE checkins ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
UPDATE checkins SET account_id = (SELECT id FROM accounts WHERE slug = 'hugh')
  WHERE account_id IS NULL;
ALTER TABLE checkins ALTER COLUMN account_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS checkins_account_id_idx ON checkins (account_id);

-- Nicknamed places are per-account; names only need to be unique within one.
ALTER TABLE locations ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
UPDATE locations SET account_id = (SELECT id FROM accounts WHERE slug = 'hugh')
  WHERE account_id IS NULL;
ALTER TABLE locations ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS locations_account_name_idx ON locations (account_id, name);
