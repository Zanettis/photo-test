# Arquitetura — foto.app

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | Next.js App Router (PWA) | 16.x |
| Hospedagem frontend | Vercel | — |
| Database | Supabase Postgres + pgvector | Free tier |
| Storage | Supabase Storage + CDN | Free tier |
| Edge Functions | Supabase Edge Functions (Deno) | — |
| AI Tagging | GPT-4o-mini Vision (OpenAI) | — |
| AI Search | text-embedding-3-small (OpenAI) | 1536-dim |
| Auth | Supabase Auth (Magic Link) | @supabase/ssr |
| Email | Resend | — |
| QR Code | qrcode.js (client-side) | — |
| CI/CD | GitHub Actions → Vercel | — |
| UI Components | shadcn/ui + Tailwind CSS | v4 |
| Testes (unit/integration) | Vitest + @testing-library/react | — |
| Testes (E2E) | Playwright | — |
| Rate limiting | Supabase Postgres (query na tabela photos) | — |

---

## Diagrama do sistema

```
GUEST FLOW (com Shot Cap + Delayed Reveal)
──────────────────────────────────────────
[Android browser]
      │  escaneia QR Code → app.com/e/abc123
      ▼
GET /api/events/[slug]  →  { is_open, is_revealed, shot_cap, shots_used, reveal_at }
      │
  is_open?
  ├─ Não  → tela "evento encerrado"
  └─ Sim  → Camera UI (interface câmera descartável analógica)
                │
          [tira foto / shutter]
                │
           shots_used < shot_cap?
           ├─ Não  → tela "suas fotos acabaram"
           └─ Sim  → POST /upload-url → upload direto para [Supabase Storage + CDN]
                              │                    │
                      animação de flash      trigger (insert)
                      contador atualiza            │
                                                   ▼
                                         [Edge Function: on-upload]
                                           GPT-4o-mini → tags
                                           embedding → pgvector
                │
          [quer ver galeria?]
                │
          is_revealed?
          ├─ Sim  → GET /gallery → grid de fotos
          └─ Não  → countdown timer até reveal_at

HOST FLOW
─────────
[Browser desktop/mobile]
      │  magic link (email)
      ▼
[Supabase Auth]  ──session──▶  [Next.js PWA]
      │
  ┌───┴──────────────────────────┐
  │                              │
  ▼                              ▼
galeria + moderação    busca em linguagem natural
(sempre visível,          │
 independente de       text-embedding-3-small
 reveal_at)            (query → embedding)
                          │
                       pgvector cosine search
                       photos ordenadas por relevância
```

---

## Estrutura de pastas do projeto

```
/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (host)/               # Rotas autenticadas (host)
│   │   │   ├── dashboard/        # Lista de eventos do host
│   │   │   └── events/[slug]/    # Galeria + busca + moderação
│   │   ├── e/[slug]/             # Rota pública guest (upload)
│   │   ├── api/                  # API Routes
│   │   │   ├── events/           # CRUD eventos
│   │   │   └── events/[slug]/    # Upload URL + search + DELETE foto + PATCH evento
│   │   └── layout.tsx
│   ├── components/               # Componentes React
│   ├── lib/                      # Utilitários (supabase client, openai, etc.)
│   └── types/                    # TypeScript types
├── supabase/
│   ├── migrations/               # SQL migrations (versionadas)
│   └── functions/
│       └── on-upload/            # Edge Function AI tagging
├── docs/                         # Esta pasta — documentação do projeto
├── public/                       # Assets estáticos + manifest PWA
├── .github/
│   └── workflows/                # CI/CD GitHub Actions
├── CLAUDE.md                     # Regras para agentes IA
└── README.md
```

---

## State Machine do Evento

Eventos têm estado derivado (não armazenado) calculado a partir de `closes_at` e `reveal_at`:

```
collecting  ──closes_at──▶  post-event  ──reveal_at──▶  revealed  ──30d+──▶  archived
(upload aberto)              (host only)                 (público)
```

| Estado | Guest pode fazer upload | Guest vê galeria | Host vê galeria |
|--------|------------------------|-----------------|-----------------|
| collecting | Sim (respeitando shot_cap) | Não (se reveal_at no futuro) / Sim (se imediato) | Sempre |
| post-event | Não | Não (countdown) | Sempre |
| revealed | Não | Sim | Sempre |
| archived | Não | Sim (read-only) | Sempre |

**Trigger de revelação:** verificado no request (lazy evaluation) — não há cron job. Se `reveal_at <= now()`, `is_revealed = true`. O email de revelação é disparado pela primeira vez que o endpoint detecta a transição.

---

## Decisões de arquitetura

### Upload direto via presigned URL (não passa pelo servidor)
**Por quê:** Atingir <10s do escaneamento ao envio. Se o upload passasse pelo Next.js/Vercel, seria limitado a 4.5MB e adicionaria latência. Supabase Storage gera URLs temporárias assinadas; o browser do convidado faz upload diretamente ao CDN.

### PWA sem instalação (não React Native, não Flutter)
**Por quê:** Android representa 70%+ do mercado brasileiro. App Store/Play Store criam fricção — usuário instala, usa uma vez, desinstala. PWA funciona via browser, sem instalação, sem aprovação de store. O prompt "Adicionar à tela inicial" é opcional, não bloqueante.

### Auth de convidado via token na URL (não OTP, não social)
**Por quê:** Qualquer etapa de autenticação antes do upload mata a conversão. O token opaco na URL (nanoid 8 chars) é suficiente para identificar o evento; o convidado não precisa de conta.

### AI tagging assíncrono (não síncrono)
**Por quê:** GPT-4o-mini pode levar 2-5s por foto. Bloquear o upload enquanto aguarda tagging destrói a UX. A foto aparece na galeria imediatamente; a busca semântica fica disponível em até 60s.

### Delayed Reveal lazy evaluation (não cron job)
**Por quê:** Cron jobs adicionam infraestrutura (Supabase Edge Function scheduled, ou serviço externo). Como o estado `is_revealed` é derivado de `reveal_at <= now()`, ele é calculado no momento de cada request — sem estado mutável no banco. O email de revelação é disparado pela primeira request que detecta a transição (idempotência via campo `reveal_notified_at` adicionado à tabela `events` quando necessário).

### Camera UI — componente separado do fluxo de upload
**Por quê:** A interface da câmera é responsabilidade do frontend (UX); o fluxo de upload (presigned URL, retry) é responsabilidade da lógica de negócio. Manter separados permite iterar no design sem tocar na lógica de upload.

### Supabase Free tier
**Por quê:** pgvector, Edge Functions, Storage e Auth estão disponíveis no free tier — suficiente para MVP. Limitações a considerar: banco pausa após 7 dias de inatividade (irrelevante em produção ativa), storage de 1GB e DB de 500MB (suficiente para validação). Upgrade para Pro quando houver usuários pagantes reais.

### text-embedding-3-small 1536-dim (não large)
**Por quê:** Custo/performance adequado para buscas em português com tags curtas. O modelo large não oferece melhora significativa para este caso de uso e custa 5x mais.

### shadcn/ui + Tailwind CSS v4 (não Ant Design Mobile, não Material UI)
**Por quê:** Componentes copiados (sem dependência de runtime), mobile-first, bundle mínimo, integração nativa com Next.js App Router. Tailwind v4 gerado por shadcn init.

### Vitest + Playwright (não Jest)
**Por quê:** Vitest tem suporte nativo a ESM e startup mais rápido no CI. Jest tem problemas conhecidos com Server Components do App Router. Playwright para E2E no fluxo crítico guest→upload.

### Rate limiting via Postgres (não Upstash Redis)
**Por quê:** Evita dependência extra de SaaS. A query `SELECT COUNT(*) FROM photos WHERE event_id = $1 AND uploader_ip = $2 AND created_at > now() - interval '1 hour'` é suficiente para o MVP e aproveita a infraestrutura Supabase já existente.

### Moderação: hard-delete (não soft-flag)
**Por quê:** O campo `is_flagged` existe no schema mas a galeria já o filtra. Hard-delete (Storage + DB) é mais simples: sem lógica de "lixeira", sem custo de storage acumulado, sem risco de foto flagada vazar em future queries. Irreversível por design — host vê confirmação antes.

### Emails transacionais: lazy evaluation (não cron)
**Por quê:** Cron jobs pagos não estão disponíveis no free tier Supabase. Emails (encerramento + NPS) são disparados via fire-and-forget na primeira request do host ao dashboard após o trigger. Idempotência garantida por `closes_notified_at TIMESTAMPTZ` na tabela `events` — mesmo padrão do `reveal_notified_at`. Um email não enviado (host nunca acessa o dashboard) é aceitável para MVP.

### Guest emails → Fase 2 (Épico 6)
**Por quê:** Convidados não fornecem email no fluxo atual (zero-friction é critério de done). Armazenar emails sem consent flow explícito viola LGPD. Notificação para guests será implementada no Épico 6 com campo opcional na Camera UI e checkbox de consentimento.

---

## Segurança

| Medida | Implementação |
|--------|--------------|
| Token opaco de evento | nanoid 8 chars, não sequencial, gerado server-side |
| Rate limit upload | 50 fotos/IP/evento (middleware Next.js) |
| Tipos de arquivo | Apenas JPEG e PNG (validado server-side antes de presigned URL) |
| Tamanho máximo | 50MB por foto |
| RLS Supabase | Policies garantem que host só acessa eventos próprios |
| Secrets | Apenas em variáveis de ambiente — nunca no repositório |
| LGPD | Policy de privacidade obrigatória antes do 1º evento pago |

---

## CI/CD

```
git push main
      │
      ▼
GitHub Actions
  ├── npm run build
  ├── npm test
  └── (se OK) → Vercel deploy automático
```

Branches: `main` (produção), feature branches para desenvolvimento.
