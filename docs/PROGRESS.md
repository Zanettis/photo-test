# Progress Tracker — foto.app

Atualizar este arquivo após completar qualquer task. Status: `[ ]` todo · `[~]` in-progress · `[x]` done.

---

## Épico 0 — Setup & Infraestrutura

- [x] Inicializar projeto Next.js 16 App Router com TypeScript + Tailwind + shadcn/ui
- [ ] Configurar Supabase (free tier): criar projeto, habilitar extensão pgvector
- [x] Configurar variáveis de ambiente (`.env.local` — chaves disponíveis; Vercel: pendente deploy)
- [x] Configurar GitHub Actions CI/CD → `.github/workflows/ci.yml` criado
- [ ] Configurar Resend (domínio de email verificado)
- [x] Configurar PWA: `src/app/manifest.ts` criado (ícones pendentes)
- [x] Estrutura de pastas inicial (`src/app`, `src/lib`, `src/components`, `src/types`, `supabase/`)
- [x] Cliente Supabase configurado (`src/lib/supabase.ts`)
- [x] Cliente OpenAI configurado (`src/lib/openai.ts`)

---

## Épico 1 — Criação de Evento (Host)

**Schema:**
- [ ] Migration: tabelas `hosts` e `events` com RLS policies
- [ ] Campos `shot_cap INTEGER` e `reveal_at TIMESTAMPTZ` na tabela `events`
- [ ] Índice em `events.slug`

**Backend:**
- [ ] `POST /api/events` — criar evento, gerar slug nanoid 8, aceitar `shot_cap` e `reveal_at`
- [ ] `GET /api/events` — listar eventos do host

**Frontend:**
- [ ] Página de login (magic link) — `src/app/(auth)/login/page.tsx`
- [ ] Página de criação de evento — `src/app/(host)/events/new/page.tsx`
- [ ] Campo Shot Cap no formulário: opções 5 / 10 / 20 / sem limite (default: 20)
- [ ] Campo Delayed Reveal no formulário: date+time picker ou "revelar imediatamente"
- [ ] Geração de QR Code client-side (qrcode.js) após criação
- [ ] Dashboard do host — `src/app/(host)/dashboard/page.tsx`

**Testes:**
- [ ] Teste: criação de evento com slug único
- [ ] Teste: criação de evento com shot_cap e reveal_at
- [ ] Teste: rate limit e limites de plano

---

## Épico 2 — Upload de Convidados (Guest) + Camera UI

**Schema:**
- [x] Migration: tabela `photos` com campos de upload e tagging_status

**Backend:**
- [x] `GET /api/events/[slug]` — dados públicos: `is_revealed`, `shot_cap`, `shots_used`, `reveal_at`
- [x] `POST /api/events/[slug]/upload-url` — validar + gerar presigned URL + retornar `shots_remaining`
- [x] Validações: mime_type, file_size, shot_cap check, rate limit global (50/token), plano do host

**Frontend — Camera UI:**
- [x] Página guest — `src/app/e/[slug]/page.tsx`
- [x] Interface Camera UI: viewfinder estilizado, estética analógica
- [x] Botão shutter central e grande (não botão genérico de upload)
- [x] Contador de poses: "12 fotos restantes" (com shot_cap) ou "12 fotos enviadas" (sem limite)
- [x] Animação de flash após captura
- [x] Upload direto via presigned URL com retry (3 tentativas, backoff exponencial)
- [x] Feedback visual: loading, sucesso, erro ("Falha no envio. Tente novamente.")
- [x] Tela "suas fotos acabaram" quando shot_cap atingido (429 `shot_cap_reached`)
- [x] Tela countdown timer quando `reveal_at` no futuro (informativo, não bloqueia câmera)
- [x] Tela de evento encerrado

**Testes:**
- [ ] Teste: upload com JPEG válido
- [ ] Teste: rejeição de HEIC e outros formatos
- [ ] Teste: rejeição acima de 50MB
- [ ] Teste: shot_cap bloqueio após N fotos
- [ ] Teste: rate limit global 50 fotos/IP

---

## Épico 3 — AI Tagging (Async)

**Schema:**
- [x] Migration: adicionar `tags TEXT[]`, `embedding VECTOR(1536)`, índice HNSW em `photos.embedding`

**Edge Function:**
- [x] `supabase/functions/on-upload/index.ts` — trigger storage → GPT-4o-mini → embedding → update photos
- [x] Tratamento de erro: `tagging_status = 'failed'` em caso de timeout/falha OpenAI (await + try/catch)
- [x] Retry com backoff exponencial + timeout 30s nas chamadas OpenAI
- [x] Validação UUID em `photoIdFromPath` — rejeita paths malformados
- [x] Validação de variáveis de ambiente na inicialização (`getRequiredEnv`)
- [x] Encoding base64 em chunks — evita stack overflow em imagens grandes
- [ ] Deploy da Edge Function no Supabase

**Testes (`src/tests/functions/on-upload.test.ts`):**
- [x] Teste: foto processada recebe tags e embedding em <60s (contrato)
- [x] Teste: falha na API OpenAI resulta em `tagging_status = 'failed'` (não crash)
- [x] Teste: bucket errado retorna 200 sem chamar OpenAI
- [x] Teste: foto não encontrada no DB retorna 200 sem chamar OpenAI
- [x] Teste: JSON inválido do GPT resulta em `tagging_status = 'failed'`
- [x] Teste: embedding com dimensões erradas resulta em `tagging_status = 'failed'`
- [x] Teste: idempotência — mesma foto processada 2x retorna sucesso
- [x] Teste: embedding armazenado como `number[]`, não como string JSON

---

## Épico 4 — Busca Semântica (Host)

**Backend:**
- [x] `GET /api/events/[slug]/search?q=` — embedding da query + cosine search pgvector
- [x] `GET /api/events/[slug]/gallery` — galeria paginada com RLS, host-only
- [ ] `GET /api/events/[slug]/download` — gerar ZIP sob demanda, link expira em 1h

**Frontend:**
- [x] Galeria do evento — `src/app/(host)/events/[slug]/page.tsx`
- [x] Campo de busca com debounce (300ms)
- [x] Grid de resultados ordenados por similaridade
- [x] Aviso de fotos em processamento (`pendingCount > 0`)
- [ ] Download individual + botão "baixar todas"
- [ ] Estado vazio explícito quando 0 fotos com tags ("Processando fotos...")

**Testes:**
- [ ] Teste: busca "vela" retorna fotos com tag "vela" antes das demais
- [ ] Teste: busca em português funciona com sinônimos ("brinde" ≈ "toast")
- [ ] Testes para `gallery/route.ts` (endpoint novo, sem cobertura)
- [ ] Teste: rate limit retorna 429 após 30 requests/min

---

## Épico 5 — Moderação + Notificação

**Decisões de arquitetura (planejado 2026-05-28, pipeline researcher→architect→reviewer):**
- **Delete semântica:** hard-delete (Storage first, depois DB). Não soft-flag.
- **Guest emails → Épico 6:** coletar emails de convidados requer consent flow explícito (LGPD) + adiciona fricção antes do upload. MVP envia apenas emails para o host.
- **Lazy evaluation:** emails disparados na primeira request do host ao dashboard após fechamento — sem cron. Idempotência via `closes_notified_at`.
- **IDOR protection:** DELETE deve verificar que `photo.event_id === event.id` (foto pertence ao evento do slug).
- **Storage delete order:** deletar Storage PRIMEIRO. Se falhar → 500, DB intocado. Se Storage OK e DB falha → logar, aceitar órfão no Storage.

**Schema:**
- [x] Migration `supabase/migrations/20260528000001_epic5_moderation.sql` — adicionar `closes_notified_at TIMESTAMPTZ` em `events`
- [x] Atualizar `src/types/database.ts` com `closes_notified_at: string | null`
- [x] Instalar dependência: `resend ^6.12.4`

**Backend:**
- [x] `DELETE /api/events/[slug]/photos/[photo_id]` — moderação host (Storage first → DB; dupla verificação IDOR)
- [x] `PATCH /api/events/[slug]` — editar `name` e `closes_at`
- [x] `src/lib/resend.ts` — helper Resend + templates PT-BR; init condicional (null sem API key)
- [x] Trigger lazy em `GET /api/events/route.ts`: fire-and-forget com guard `closes_notified_at IS NULL`

**Frontend:**
- [x] `src/components/delete-photo-dialog.tsx` — dialog de confirmação (Base UI Dialog, 52 linhas)
- [x] Editar `src/components/photo-grid.tsx` — prop `onDelete?`, botão Trash2 hover (77 linhas)
- [x] Editar `src/app/(host)/events/[slug]/page.tsx` — handleDelete, badge "Encerrado", link Settings
- [x] `src/app/(host)/events/[slug]/settings/page.tsx` — editar name e closes_at (143 linhas)

**Testes (`src/tests/api/moderation.test.ts` — 13 testes ✅):**
- [x] Unauthenticated → 401
- [x] Evento não pertence ao host → 403
- [x] Foto não pertence ao evento (IDOR) → 404
- [x] Storage delete falha → 500, DB intocado (verificado via spy)
- [x] DB delete falha → 500
- [x] Delete bem-sucedido → 204; storage.remove chamado com path correto
- [x] PATCH: body vazio → 400
- [x] PATCH: closes_at inválido → 400
- [x] PATCH: name vazio → 400
- [x] PATCH válido → 200

---

## Épico 6 — Delayed Reveal (Revelação Agendada)

**Backend:**
- [ ] Lógica `is_revealed = (reveal_at IS NULL OR reveal_at <= now())` em todos os endpoints relevantes
- [ ] `GET /api/events/[slug]/gallery` — retorna 403 com `reveal_at` se não revelado (guest sem auth)
- [ ] Trigger de email de revelação: primeira request que detecta transição dispara Resend (campo `reveal_notified_at` na tabela `events` para idempotência)
- [ ] Migration: adicionar `reveal_notified_at TIMESTAMPTZ` em `events`

**Frontend:**
- [ ] Host: galeria sempre visível (moderação independe de reveal_at)
- [ ] Guest: countdown timer animado quando `is_revealed = false`
- [ ] Guest: galeria visível quando `is_revealed = true`
- [ ] Email de revelação: template Resend com link da galeria

**Testes:**
- [ ] Teste: guest não acessa galeria antes do `reveal_at`
- [ ] Teste: guest acessa galeria após `reveal_at`
- [ ] Teste: host acessa galeria em qualquer estado
- [ ] Teste: email de revelação disparado exatamente uma vez (idempotência)

---

## Backlog de Qualidade — descoberto na revisão da Épica 4

Itens identificados por revisão multi-agente (2026-05-28). Não bloqueiam o MVP mas devem ser resolvidos antes de produção.

**🔴 Alta — corrigidos nesta sessão:**
- [x] `gallery/route.ts`: limit sem floor → crash com `?limit=-1` (adicionado `Math.max(1,...)`)
- [x] `gallery/route.ts`: offset sem validação → NaN/negativo quebrava range (clamped para 0)
- [x] `gallery/route.ts`: sem verificação explícita de `host_id` (adicionado check pós-RLS)
- [x] `search/route.ts`: sem rate limiting → custo ilimitado OpenAI (30 req/min por user, HTTP 429)
- [x] `search/route.ts`: `tagging_status` hardcoded `'done'` ignorava valor real do banco
- [x] `search/route.ts`: `event_id` exposto desnecessariamente no response JSON
- [x] Arquivo órfão `MAX_QUERY_LENGTH)` na raiz do projeto — deletado

**🟡 Baixa — pendentes:**
- [ ] `gallery/route.ts:37`: coluna `is_flagged` selecionada no SELECT mas descartada no response — remover do SELECT
- [ ] `search/route.ts:64`: `embeddingResponse.data[0]` sem guarda — adicionar check `if (!embeddingResponse.data[0])`

**🔵 Cleanup — pendentes:**
- [ ] Extrair padrão auth+ownership duplicado (search + gallery + upload-url) para helper compartilhado `src/lib/require-event-host.ts`

---

## Critérios de done do MVP

- [ ] Fluxo E2E completo funciona (host cria → guest faz upload → host busca)
- [ ] Upload <10s em 4G Android (testado em dispositivo real)
- [ ] Busca semântica retorna resultado relevante em <3s
- [ ] Build e testes passam no CI
- [ ] Sem secrets no repositório
- [ ] Policy de privacidade + termos de uso publicados
- [ ] Testado em 1 casamento real com >50% conversão scan→upload

---

## Decisões & registro de mudanças

| Data | Decisão | Agente |
|------|---------|--------|
| 2026-05-26 | Documentação criada, setup pré-código | lead |
| 2026-05-26 | Análise do Once: Delayed Reveal, Shot Cap e Camera UI aprovados para MVP | founder |
| 2026-05-27 | Épico 0 iniciado: Next.js 16, shadcn/ui, Tailwind v4, Supabase SSR client, OpenAI client, manifest PWA, CI/CD | coder |
| 2026-05-27 | Stack complementada: shadcn/ui+Tailwind v4 (UI), Vitest+Playwright (testes), Postgres (rate limiting) | architect |
| 2026-05-27 | Épico 2 concluído: GET/POST API routes guest, Camera UI analógica, presigned URL upload, retry backoff | swarm (backend-dev + frontend-dev + reviewer) |
| 2026-05-27 | Épico 3 revisado: fix bug crítico embedding (JSON.stringify→array), retry/timeout OpenAI, error handler await, UUID validation, middleware Next.js 16 (proxy.ts), +4 testes | review swarm |
| 2026-05-28 | Épico 4 implementado: search API, gallery API, host gallery page, photo-grid component, migration search_photos SQL | coder |
| 2026-05-28 | Revisão multi-agente Épica 4: 9 findings (3 alta, 2 média, 2 baixa, 2 cleanup) — todos alta corrigidos + 47/47 testes passando | review swarm + code-review skill |
| 2026-05-28 | Épico 5 planejado: pipeline researcher→architect→reviewer; guest emails → Épico 6 (LGPD); hard-delete Storage-first; closes_notified_at para idempotência; IDOR protection obrigatória | planning swarm |
| 2026-05-28 | Épico 5 implementado: DELETE photo, PATCH event, resend.ts (lazy init), lazy email trigger, delete dialog, photo-grid onDelete, settings page — 71/71 testes passando, build limpo | 4-agent swarm (backend + frontend + review + test) |
