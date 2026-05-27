# API Spec — foto.app

Todos os endpoints são Next.js App Router API Routes em `src/app/api/`.
Edge Functions rodam no Supabase (Deno runtime).

---

## Autenticação

| Contexto | Mecanismo |
|----------|-----------|
| Host | Supabase session (magic link) — Bearer token no header `Authorization` |
| Guest | Nenhum — identificado por token anônimo gerado server-side |
| Edge Functions | Service role key (variável de ambiente, nunca exposta ao client) |

---

## API Routes (Next.js)

### POST /api/events

Cria um novo evento. Requer host autenticado.

**Request:**
```json
{
  "name": "Casamento Ana e Pedro",
  "event_date": "2026-07-15",
  "closes_at": null,
  "shot_cap": 20,
  "reveal_at": "2026-07-16T10:00:00-03:00"
}
```

`shot_cap`: null = sem limite. Valores sugeridos na UI: 5, 10, 20, null.
`reveal_at`: null = revelação imediata. Timestamp ISO 8601 com timezone para revelação agendada.

**Response 201:**
```json
{
  "id": "uuid",
  "slug": "abc12345",
  "name": "Casamento Ana e Pedro",
  "event_date": "2026-07-15",
  "shot_cap": 20,
  "reveal_at": "2026-07-16T10:00:00-03:00",
  "link": "https://app.com/e/abc12345"
}
```

**Errors:** 401 (não autenticado), 400 (campos obrigatórios ausentes), 402 (limite do plano atingido)

---

### GET /api/events

Lista eventos do host autenticado.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "slug": "abc12345",
    "name": "Casamento Ana e Pedro",
    "event_date": "2026-07-15",
    "photo_count": 143,
    "is_open": true
  }
]
```

---

### GET /api/events/[slug]

Dados públicos do evento. Sem auth — usado pelo guest ao abrir o link.
Header opcional `X-Uploader-Token` para calcular `shots_used` do convidado atual.

**Response 200:**
```json
{
  "slug": "abc12345",
  "name": "Casamento Ana e Pedro",
  "event_date": "2026-07-15",
  "is_open": true,
  "is_revealed": false,
  "reveal_at": "2026-07-16T10:00:00-03:00",
  "shot_cap": 20,
  "shots_used": 7
}
```

`is_revealed`: booleano derivado. `true` se `reveal_at IS NULL OR reveal_at <= now()`.
`shots_used`: count de fotos deste `uploader_token` neste evento. 0 se token não informado.
`shot_cap`: null = sem limite.

**Response 404:** evento não encontrado ou slug inválido
**Response 410:** evento encerrado (closes_at no passado) — guest não pode mais fazer upload

---

### POST /api/events/[slug]/upload-url

Gera presigned URL para upload direto ao Supabase Storage. Guest identifica-se com token anônimo.

**Request:**
```json
{
  "uploader_token": "tok12345",
  "file_name": "photo.jpg",
  "mime_type": "image/jpeg",
  "file_size_bytes": 4200000
}
```

**Validações server-side (antes de emitir URL):**
- Evento existe e está aberto
- `mime_type` é `image/jpeg` ou `image/png`
- `file_size_bytes` ≤ 52428800 (50MB)
- Shot cap: se `events.shot_cap IS NOT NULL`, verificar `COUNT(photos WHERE event_id = X AND uploader_token = Y) < shot_cap`
- Rate limit global: ≤50 fotos por `uploader_token` por evento (independente do shot_cap)
- Limite do plano: total de fotos do evento não excede o limite do plano do host

**Response 200:**
```json
{
  "upload_url": "https://supabase-cdn.../presigned...",
  "photo_id": "uuid",
  "storage_path": "events/abc12345/uuid.jpg",
  "expires_in": 300,
  "shots_remaining": 13
}
```

`shots_remaining`: null se sem shot_cap; inteiro ≥ 0 se shot_cap ativo.

**Errors:** 400 (validação), 403 (evento fechado), 429 `{ "error": "shot_cap_reached", "limit": 20 }` ou rate limit global

---

### GET /api/events/[slug]/gallery

Galeria pública do evento (acesso de guest após revelação). Sem auth necessária se `is_revealed`.

**Response 200:**
```json
{
  "is_revealed": true,
  "reveal_at": "2026-07-16T10:00:00-03:00",
  "photos": [
    {
      "photo_id": "uuid",
      "public_url": "https://cdn.../...",
      "uploaded_at": "2026-07-15T23:14:00-03:00"
    }
  ]
}
```

**Response 403** se `is_revealed = false` e request sem auth de host:
```json
{
  "error": "not_revealed",
  "reveal_at": "2026-07-16T10:00:00-03:00"
}
```
Frontend usa `reveal_at` para renderizar o countdown timer.

---

### GET /api/events/[slug]/search

Busca semântica nas fotos do evento. Requer host autenticado.

**Query params:**
- `q` (string, obrigatório): query em linguagem natural. Ex: `?q=momento+da+vela`
- `limit` (number, default 20): máximo de resultados

**Response 200:**
```json
{
  "results": [
    {
      "photo_id": "uuid",
      "storage_path": "events/abc12345/uuid.jpg",
      "public_url": "https://cdn.../...",
      "tags": ["vela", "bolo", "noivos"],
      "similarity": 0.87
    }
  ]
}
```

**Errors:** 401 (não autenticado), 400 (q ausente), 403 (evento não pertence ao host)

---

### DELETE /api/events/[slug]/photos/[photo_id]

Deleta uma foto (moderação). Requer host autenticado e dono do evento.

**Response 204:** deletado com sucesso
**Errors:** 401, 403, 404

---

### GET /api/events/[slug]/download

Gera link temporário de download ZIP com todas as fotos do evento. Requer host autenticado.

**Response 200:**
```json
{
  "download_url": "https://...",
  "expires_at": "2026-07-15T14:00:00Z",
  "photo_count": 143
}
```

---

## Edge Functions (Supabase)

### on-upload

Disparada por trigger no Supabase Storage após insert bem-sucedido de objeto em `events/**`.

**Trigger:** `storage.objects` INSERT

**Fluxo:**
1. Recebe `storage_path` e `photo_id` do record inserido
2. Download da imagem do Storage (URL temporária)
3. Chama GPT-4o-mini Vision com prompt: _"List 5-8 short descriptive tags for this photo in Brazilian Portuguese. Focus on: people, objects, actions, emotions, setting. Return as JSON array of strings."_
4. Chama text-embedding-3-small com as tags concatenadas
5. UPDATE na tabela `photos`: `tags`, `embedding`, `tagging_status = 'done'`
6. Em caso de erro: `tagging_status = 'failed'`, log do erro

**Timeout:** 30s. Se exceder, marcar como `failed` (retry manual fora do MVP).

**Variáveis de ambiente necessárias:**
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

---

## Variáveis de ambiente

Nunca commitar no repositório. Usar `.env.local` (não versionado) em desenvolvimento.

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://app.com
```
