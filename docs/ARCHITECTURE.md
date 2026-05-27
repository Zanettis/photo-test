# Arquitetura — foto.app

## Stack

| Camada | Tecnologia | Versão alvo |
|--------|-----------|-------------|
| Frontend | Next.js App Router (PWA) | 14.x |
| Hospedagem frontend | Vercel | — |
| Database | Supabase Postgres + pgvector | Pro tier |
| Storage | Supabase Storage + CDN | Pro tier |
| Edge Functions | Supabase Edge Functions (Deno) | — |
| AI Tagging | GPT-4o-mini Vision (OpenAI) | — |
| AI Search | text-embedding-3-small (OpenAI) | 1536-dim |
| Auth | Supabase Auth (Magic Link) | — |
| Email | Resend | — |
| QR Code | qrcode.js (client-side) | — |
| CI/CD | GitHub Actions → Vercel | — |

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
│   │   │   └── events/[slug]/    # Upload URL + search
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

### Supabase Pro (não Free tier)
**Por quê:** Free tier não suporta pgvector em produção nem connection pooling. Pro é necessário para Edge Functions estáveis e pgvector com performance adequada.

### text-embedding-3-small 1536-dim (não large)
**Por quê:** Custo/performance adequado para buscas em português com tags curtas. O modelo large não oferece melhora significativa para este caso de uso e custa 5x mais.

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
