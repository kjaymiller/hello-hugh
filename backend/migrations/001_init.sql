CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy_m DOUBLE PRECISION,
    photo_key TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'hugh'
);

CREATE INDEX IF NOT EXISTS checkins_created_at_idx ON checkins (created_at DESC);
