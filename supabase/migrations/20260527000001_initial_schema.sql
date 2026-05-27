-- ============================================================
-- foto.app — Initial Schema
-- Colar no Supabase SQL Editor e executar
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELA: hosts
-- Criada automaticamente quando um usuário se cadastra via magic link
-- ============================================================
CREATE TABLE IF NOT EXISTS hosts (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'complete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: cria registro em hosts quando auth.users recebe novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.hosts (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABELA: events
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id             UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  event_date          DATE NOT NULL,
  closes_at           TIMESTAMPTZ,
  shot_cap            INTEGER,
  reveal_at           TIMESTAMPTZ,
  reveal_notified_at  TIMESTAMPTZ,
  settings            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_slug    ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_host_id ON events(host_id);

-- ============================================================
-- TABELA: photos
-- ============================================================
CREATE TABLE IF NOT EXISTS photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uploader_token  TEXT NOT NULL,
  uploader_ip     TEXT,
  storage_path    TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type       TEXT CHECK (mime_type IN ('image/jpeg', 'image/png')),
  tags            TEXT[],
  embedding       VECTOR(1536),
  tagging_status  TEXT NOT NULL DEFAULT 'pending' CHECK (tagging_status IN ('pending', 'done', 'failed')),
  is_flagged      BOOLEAN NOT NULL DEFAULT false,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_event_id  ON photos(event_id);
CREATE INDEX IF NOT EXISTS idx_photos_uploader  ON photos(event_id, uploader_ip, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_photos_embedding ON photos USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================
ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- hosts
CREATE POLICY "host_select_own" ON hosts
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "host_update_own" ON hosts
  FOR UPDATE USING (id = auth.uid());

-- events
CREATE POLICY "host_manage_events" ON events
  FOR ALL USING (host_id = auth.uid());

-- photos: host vê fotos dos seus eventos
CREATE POLICY "host_select_photos" ON photos
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE host_id = auth.uid())
  );

-- photos: host modera (deleta) fotos dos seus eventos
CREATE POLICY "host_delete_photos" ON photos
  FOR DELETE USING (
    event_id IN (SELECT id FROM events WHERE host_id = auth.uid())
  );

-- photos: insert via service role (API Route usa SUPABASE_SERVICE_ROLE_KEY)
-- Guests não têm sessão Supabase — insert é feito server-side

-- ============================================================
-- STORAGE: bucket para fotos
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  52428800,  -- 50MB
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: qualquer um pode fazer upload (validado via presigned URL)
CREATE POLICY "public_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos');

-- Storage policy: qualquer um pode ler (galeria pública)
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

-- Storage policy: host pode deletar fotos do seu evento
CREATE POLICY "host_delete_storage" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = 'events'
  );
