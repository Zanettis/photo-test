# Guia de Deploy — foto.app

Checklist completo para colocar o MVP em produção do zero.
**Ordem importa:** Supabase primeiro → Vercel → Resend → GitHub Actions.

---

## 1. Supabase (banco + storage + Edge Function)

### 1.1 Criar projeto

1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Nome: `foto-app` · Região: South America (São Paulo)
3. Anote: **Project URL** e **anon key** (Settings → API)
4. Anote também: **service_role key** (Settings → API → Project API keys → `service_role`)

### 1.2 Habilitar extensão pgvector

No SQL Editor do Supabase:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.3 Aplicar migrations

No SQL Editor, execute cada arquivo **em ordem**:

```
supabase/migrations/20260527000001_initial_schema.sql
supabase/migrations/20260527000002_search_function.sql
supabase/migrations/20260528000001_epic5_moderation.sql
supabase/migrations/20260528000002_nps_notified_at.sql
supabase/migrations/20260529000001_guest_email.sql
```

> Cole o conteúdo de cada arquivo no SQL Editor e clique em **Run**.

### 1.4 Deploy da Edge Function

Instale a CLI do Supabase (se não tiver):

```bash
npm install -g supabase
supabase login
```

Link ao projeto e deploy:

```bash
supabase link --project-ref <SEU_PROJECT_REF>
supabase functions deploy on-upload
```

O `PROJECT_REF` está na URL do dashboard: `https://supabase.com/dashboard/project/<PROJECT_REF>`.

### 1.5 Configurar secrets da Edge Function

No dashboard: **Edge Functions → on-upload → Secrets** (ou via CLI):

```bash
supabase secrets set SUPABASE_URL=https://<PROJECT_REF>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
supabase secrets set OPENAI_API_KEY=<openai_key>
```

### 1.6 Configurar Storage webhook

O trigger da Edge Function precisa ser criado manualmente:

1. Supabase Dashboard → **Database → Webhooks**
2. **Create a new hook**:
   - Name: `on-photo-upload`
   - Table: `storage.objects`
   - Events: `INSERT`
   - Type: **Supabase Edge Functions**
   - Edge Function: `on-upload`

---

## 2. Vercel (frontend + API routes)

### 2.1 Importar projeto

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Import do GitHub repo `photo-test`
3. Framework: **Next.js** (detectado automaticamente)

### 2.2 Configurar variáveis de ambiente

Em **Settings → Environment Variables**, adicione:

| Variável | Valor | Ambiente |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key do Supabase | All |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key do Supabase | Production, Preview |
| `OPENAI_API_KEY` | `sk-...` | Production, Preview |
| `RESEND_API_KEY` | `re_...` | Production, Preview |
| `RESEND_FROM` | `noreply@seudominio.com` | Production |
| `NEXT_PUBLIC_APP_URL` | `https://seuapp.vercel.app` | Production |

> **Atenção:** `NEXT_PUBLIC_APP_URL` determina o link no QR Code. Use a URL final do seu domínio.

### 2.3 Deploy

Clique em **Deploy**. O build leva ~2 minutos.

Após o deploy, anote a URL final (ex: `https://foto-app.vercel.app`) e atualize `NEXT_PUBLIC_APP_URL` se necessário, depois faça **Redeploy**.

---

## 3. Resend (emails)

### 3.1 Criar conta e domínio

1. Acesse [resend.com](https://resend.com) → **Add Domain**
2. Adicione o domínio do qual você quer enviar e-mails (ex: `seudominio.com`)
3. Siga as instruções para adicionar os registros DNS (SPF, DKIM)
4. Aguarde verificação (~5 min)

> **Sem domínio próprio?** Use `onboarding@resend.dev` como `RESEND_FROM` para testes. E-mails só chegam ao seu próprio email cadastrado no Resend.

### 3.2 Gerar API Key

Resend Dashboard → **API Keys → Create API Key** → copie e cole no Vercel como `RESEND_API_KEY`.

---

## 4. GitHub Actions (CI/CD)

### 4.1 Adicionar secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | mesma do Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mesma do Vercel |

> O CI não precisa das chaves privadas (`SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) pois só roda build e testes com mocks.

---

## 5. Verificação E2E pós-deploy

Execute este roteiro após o primeiro deploy:

1. **Login:** acesse `/login`, insira seu e-mail → verifique o magic link no inbox
2. **Criar evento:** `/events/new` → preencha nome + data → verifique se o link do QR aponta para o domínio correto
3. **Upload guest:** abra o link do evento em outro dispositivo (celular Android) → tire uma foto → verifique se aparece na galeria em <60s
4. **AI tagging:** na galeria do host, aguarde ~15s → tags devem aparecer abaixo da foto
5. **Busca semântica:** digite "sorriso" na busca → deve retornar fotos relevantes em <3s
6. **Download ZIP:** clique em "Baixar ZIP" na galeria → arquivo `.zip` deve baixar
7. **E-mail de fechamento:** edite o evento em Settings → `closes_at` para 1 min no futuro → aguarde → recarregue dashboard → e-mail deve chegar

---

## Checklist final

- [ ] Supabase: projeto criado com pgvector
- [ ] Supabase: 5 migrations aplicadas
- [ ] Supabase: Edge Function `on-upload` deployada com 3 secrets
- [ ] Supabase: Webhook `on-photo-upload` configurado
- [ ] Vercel: projeto importado com 7 env vars
- [ ] Vercel: deploy bem-sucedido (build verde)
- [ ] Resend: domínio verificado (ou `onboarding@resend.dev` para testes)
- [ ] GitHub Actions: 2 secrets adicionados, CI passando
- [ ] Roteiro E2E executado e todos os 7 passos funcionando
