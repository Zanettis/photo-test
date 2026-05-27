# Data Models — foto.app

Todas as tabelas são Supabase Postgres. pgvector deve estar habilitado como extensão.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()
```

---

## Tabelas

### hosts

Anfitriões autenticados via magic link.

```sql
CREATE TABLE hosts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'complete')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### events

Um evento por host. Slug é o identificador público compartilhado via QR Code.

```sql
CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE,           -- nanoid 8 chars, ex: "abc12345"
  name        TEXT NOT NULL,
  event_date  DATE NOT NULL,
  closes_at   TIMESTAMPTZ,                    -- null = ativo por 30d após event_date
  shot_cap    INTEGER,                        -- null = sem limite; ex: 5, 10, 20
  reveal_at   TIMESTAMPTZ,                    -- null = revelação imediata; timestamp = revelação agendada
  settings    JSONB NOT NULL DEFAULT '{}',    -- configurações futuras
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_events_host_id ON events(host_id);
```

**Nota sobre `closes_at`:** se null, calcular como `event_date + 30 days` na camada de aplicação. Host pode configurar até 90 dias.

**Nota sobre `reveal_at`:** se null, galeria é visível imediatamente após upload. Se definido, galeria fica bloqueada para guests até esse timestamp. Host sempre vê as fotos (para moderação antes da revelação).

**Nota sobre `shot_cap`:** se null, sem limite por convidado. Rate limit global (50 fotos/IP/evento) ainda se aplica independente do shot_cap. Default sugerido ao criar evento: 20.

---

## Estados do Evento

Estado derivado na camada de aplicação — não armazenado como campo separado no banco.

```
collecting  →  [post-event]  →  revealed  →  archived
(upload       (reveal_at        (gallery     (30+ dias
 aberto)       no futuro,        visível)     após evento)
               host only)
```

| Estado | Condição | Guest pode fazer upload? | Guest vê galeria? | Host vê galeria? |
|--------|----------|--------------------------|-------------------|-----------------|
| collecting | `closes_at > now()` | Sim (respeitando shot_cap) | Apenas se `is_revealed` | Sempre |
| post-event | `closes_at ≤ now()` e `reveal_at > now()` | Não | Não (countdown) | Sempre |
| revealed | `is_revealed = true` | Não | Sim | Sempre |
| archived | `event_date + 30d+` | Não | Sim (read-only) | Sempre |

**`is_revealed`** (booleano derivado):
```
is_revealed = (reveal_at IS NULL) OR (reveal_at <= now())
```

### photos

Uma linha por foto. Uploader identificado por token anônimo (não tem conta).

```sql
CREATE TABLE photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uploader_token  TEXT NOT NULL,              -- token anônimo do convidado (nanoid 8)
  storage_path    TEXT NOT NULL,              -- ex: "events/abc12345/uuid.jpg"
  file_size_bytes INTEGER,
  mime_type       TEXT,                       -- "image/jpeg" ou "image/png"
  tags            TEXT[],                     -- gerado por GPT-4o-mini, ex: ["bolo", "brinde"]
  embedding       VECTOR(1536),               -- text-embedding-3-small das tags
  tagging_status  TEXT NOT NULL DEFAULT 'pending' CHECK (tagging_status IN ('pending', 'done', 'failed')),
  is_flagged      BOOLEAN NOT NULL DEFAULT false,  -- moderação pelo host
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_photos_event_id ON photos(event_id);
CREATE INDEX idx_photos_embedding ON photos USING hnsw (embedding vector_cosine_ops);
```

**Nota sobre o índice HNSW:** necessário para busca semântica performática em produção. O índice IVFFlat pode ser usado como alternativa em volumes menores.

---

## RLS Policies (Row Level Security)

Supabase usa RLS para garantir isolamento entre hosts.

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- hosts: cada host vê apenas seu próprio registro
CREATE POLICY "host_select_own" ON hosts
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "host_update_own" ON hosts
  FOR UPDATE USING (id = auth.uid());

-- events: host gerencia apenas seus próprios eventos
CREATE POLICY "host_manage_events" ON events
  FOR ALL USING (host_id = auth.uid());

-- events: acesso público de leitura para guests (slug-based, sem auth)
-- Implementado na API Route, não via RLS (guest não tem session Supabase)

-- photos: host vê todas as fotos dos seus eventos
CREATE POLICY "host_select_photos" ON photos
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE host_id = auth.uid())
  );

-- photos: host pode deletar fotos dos seus eventos (moderação)
CREATE POLICY "host_delete_photos" ON photos
  FOR DELETE USING (
    event_id IN (SELECT id FROM events WHERE host_id = auth.uid())
  );

-- photos: insert via service role (Edge Function + API Route usam service role key)
-- Guests não têm session — upload gerenciado server-side via service role
```

---

## Migrations

Todas as migrations vão em `/supabase/migrations/` com naming convention:

```
YYYYMMDDHHMMSS_descricao.sql
```

Exemplo: `20260526000001_initial_schema.sql`

Nunca editar uma migration já aplicada em produção — sempre criar uma nova.

---

## Limites por plano

Validados na camada de aplicação (API Route), não no banco:

| Plano | Max convidados (uploader_tokens distintos) | Max fotos |
|-------|------------------------------------------|-----------|
| free | 20 | 50 |
| basic | 100 | 300 |
| complete | ilimitado | 500 (+ R$0,30/foto acima) |
