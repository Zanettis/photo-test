# MVP Scope — foto.app

## O que está IN do MVP

### Épico 1 — Criação de Evento (Host)
O anfitrião se autentica, cria o evento e recebe o QR code para distribuir.

- Host se cadastra/loga via magic link (email)
- Host cria evento: nome, data, configurações
- Host define **Shot Cap**: 5, 10, 20 fotos por pessoa ou "sem limite" (default: 20)
- Host define **Delayed Reveal**: data/hora de revelação, ou "imediato" (default: imediato)
- Sistema gera slug único (nanoid 8 chars) → link `app.com/e/[slug]`
- Sistema gera QR Code (client-side, qrcode.js)
- Host vê dashboard do evento com link, QR Code e contagem de fotos

### Épico 2 — Upload de Convidados (Guest) + Camera UI
Convidado abre o link, envia fotos sem criar conta. Meta: <10s do escaneamento ao envio.
Interface emula câmera descartável analógica — não é tela genérica de upload.

- Guest abre `/e/[slug]` no browser mobile → sem login, sem instalação
- **Interface Camera UI**: viewfinder estilizado, botão shutter central e grande, estética analógica
- **Contador de poses**: "12 fotos restantes" (se shot_cap ativo) ou "12 fotos enviadas" (se sem limite)
- **Animação de flash** + confirmação visual após cada envio
- Upload direto via presigned URL (Supabase Storage) — sem passar pelo servidor
- Retry automático em conectividade fraca (3 tentativas, backoff exponencial)
- Tela "suas fotos acabaram" quando shot_cap atingido
- Se `reveal_at` no futuro: botão "ver galeria" exibe countdown em vez da galeria
- Rate limit global: 50 fotos por IP por evento
- Formatos aceitos: JPEG e PNG (HEIC excluído no MVP — mercado Android não gera HEIC)
- Tamanho máximo: 50MB por foto

### Épico 3 — AI Tagging (Async)
Cada foto recebe tags semânticas e embedding para permitir busca.

- Supabase Edge Function disparada por trigger de insert na tabela `photos`
- GPT-4o-mini Vision gera 5-8 tags por foto (ex: "bolo", "brinde", "dança", "noivos")
- text-embedding-3-small converte tags em embedding 1536-dim
- Embedding armazenado em `photos.embedding vector(1536)` via pgvector
- Galeria exibe fotos imediatamente; busca disponível em até 60s após upload

### Épico 4 — Busca Semântica (Host)
Host busca nas fotos do evento em linguagem natural em português.

- Host digita texto livre: "momento da vela", "foto com a vovó", "brinde"
- Query convertida em embedding (text-embedding-3-small)
- Busca por similaridade coseno no pgvector (`<=>` operator)
- Resultado: grid de fotos ordenado por relevância
- Download individual ou ZIP de todas as fotos (link expira em 1h)

### Épico 6 — Delayed Reveal (Revelação Agendada)
O host define o momento em que a galeria será revelada. Gera antecipação e tráfego orgânico pós-evento.

- Host define `reveal_at` ao criar o evento (data + hora específica, ou "imediato")
- **Antes do `reveal_at`**: host vê galeria completa (para moderação), guests veem apenas countdown
- **Página do guest**: countdown timer animado mostrando quanto tempo falta para a revelação
- **No `reveal_at`**: galeria torna-se pública para todos os guests via link direto
- Resend dispara email de revelação para todos os guests que forneceram email (+ link da galeria)
- Host recebe notificação quando a revelação acontece

---

### Épico 5 — Moderação + Notificação
Host modera fotos indesejadas; recebe email de encerramento e NPS.

- Host pode deletar foto indesejada (moderação manual — hard delete, sem recovery)
- Evento ativo por 30 dias após data do evento (configurável até 90 dias via PATCH)
- Após encerramento: guests não podem mais fazer upload; host mantém acesso indefinido
- Resend envia email para o **host** com link da galeria quando evento encerra (lazy, idempotente via `closes_notified_at`)
- Resend envia email de NPS para o host 48h após o evento (lazy, mesmo guard `closes_notified_at`)
- **Email para convidados → Épico 6** (requer consent flow LGPD explícito + campo de email na Camera UI)

---

## O que está OUT do MVP (Fase 2)

| Feature | Motivo |
|---------|--------|
| Face clustering | Requer LGPD consent flow explícito — risco legal |
| WhatsApp Business API | Requer aprovação Meta + custo por mensagem |
| White-label para assessoras | B2B — fora do wedge inicial |
| Deduplicação automática | Complexidade técnica; não é blocker para PMF |
| Auth social (Google/Apple) | Magic link é suficiente para MVP |
| HEIC support | Mercado Android não gera HEIC; adicionar na Fase 2 com Sharp |
| Co-anfitrião com permissão de moderação | v1 tem view-only; definir permissões na Fase 2 |
| B2B corporativo | Fase 2 após validação do wedge casamentos |

---

## Dependências externas (blocker se não estiver configurado)

| Dependência | Tipo | Status |
|------------|------|--------|
| Supabase (free tier) | Infra (DB + Storage + Edge Functions + pgvector) | Pendente |
| OpenAI API key | AI (GPT-4o-mini + text-embedding-3-small) | Pendente |
| Resend | Email transacional | Pendente |
| Vercel | Deploy frontend | Pendente |
| Domínio | Identidade da marca | Pendente |
| Consultoria LGPD | Requisito legal antes do 1º evento pago | Pendente |

---

## Critérios de done para o MVP

- [ ] Fluxo completo host → guest → upload → busca funciona end-to-end
- [ ] Upload <10s em conexão 4G Android (testado em dispositivo real)
- [ ] Busca semântica retorna resultado relevante em <3s
- [ ] Taxa de conversão scan→upload >50% em pelo menos 1 casamento real
- [ ] Nenhum secret no repositório
- [ ] Build passa no CI sem erros
- [ ] Policy de privacidade + termos de uso publicados
