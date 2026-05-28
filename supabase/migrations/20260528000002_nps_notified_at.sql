-- ============================================================
-- foto.app — Épico 5 (patch): NPS email idempotency
-- ============================================================

-- Prevents duplicate NPS emails: NULL = not yet sent, timestamp = sent
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS nps_notified_at TIMESTAMPTZ;
