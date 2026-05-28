-- ============================================================
-- foto.app — Épico 5: Moderação + Notificação
-- ============================================================

-- Idempotência para emails do host disparados após encerramento do evento:
-- · email de encerramento (galeria disponível)
-- · email NPS (48h após event_date)
-- Quando NULL = email ainda não enviado. Lazy: verificado no GET /api/events.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS closes_notified_at TIMESTAMPTZ;
