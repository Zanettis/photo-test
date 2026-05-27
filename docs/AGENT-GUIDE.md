# Agent Guide — foto.app

Guia operacional para agentes IA trabalhando neste projeto. Leia antes de qualquer sessão de desenvolvimento.

---

## Checklist de início de sessão

1. Ler [docs/INDEX.md](INDEX.md) — entender o estado atual do projeto
2. Ler [docs/PROGRESS.md](PROGRESS.md) — verificar o que foi feito e o que está pendente
3. Verificar [docs/MVP-SCOPE.md](MVP-SCOPE.md) — confirmar que a task está IN do MVP antes de implementar
4. Para tasks de DB: ler [docs/DATA-MODELS.md](DATA-MODELS.md) antes de tocar em qualquer schema
5. Para tasks de API: ler [docs/API-SPEC.md](API-SPEC.md) antes de implementar endpoints

---

## Estrutura de arquivos

```
src/app/              # Rotas Next.js (App Router)
src/components/       # Componentes React reutilizáveis
src/lib/              # Clientes (supabase, openai), utilitários, helpers
src/types/            # TypeScript types e interfaces
supabase/migrations/  # SQL migrations (uma por mudança de schema)
supabase/functions/   # Edge Functions (Deno)
docs/                 # Esta pasta — documentação
public/               # Assets estáticos, manifest PWA
```

**Nunca criar arquivos em outros lugares.** Testes vão em `src/__tests__/` ou colocados ao lado do arquivo testado (`.test.ts`).

---

## Convenções de código

- TypeScript em todos os arquivos `.ts` e `.tsx`
- Nenhum `any` — usar tipos explícitos ou `unknown` com narrowing
- Funções com nomes descritivos — sem abreviações obscuras
- Arquivos máximo 500 linhas — se ultrapassar, dividir em módulos
- Sem comentários explicando o "o quê" — apenas o "por quê" quando não óbvio

---

## Banco de dados

- Toda mudança de schema = nova migration em `supabase/migrations/YYYYMMDDHHMMSS_descricao.sql`
- Nunca editar migration já aplicada em produção
- Sempre verificar RLS policies após criar nova tabela
- Extensão `vector` deve estar habilitada — verificar antes de usar `VECTOR(1536)`

---

## Segurança

- **Nunca** commitar `.env`, `.env.local`, ou qualquer arquivo com API keys
- **Nunca** expor `SUPABASE_SERVICE_ROLE_KEY` no client — apenas server-side
- Rate limiting: implementar em API Routes antes de gerar presigned URLs
- Validar `mime_type` e `file_size_bytes` server-side, não apenas client-side
- Usar `nanoid` para gerar tokens opacos — nunca IDs sequenciais em URLs públicas

---

## Antes de qualquer commit

```bash
npm run build   # deve passar sem erros
npm test        # todos os testes devem passar
```

CI/CD no GitHub Actions reproduz esses dois comandos. Se o build falha localmente, vai falhar no CI.

---

## Após completar uma task

1. Atualizar `docs/PROGRESS.md`: marcar a task como `[x]`
2. Se criou/alterou schema: atualizar `docs/DATA-MODELS.md`
3. Se criou/alterou endpoint: atualizar `docs/API-SPEC.md`
4. Se tomou decisão arquitetural: adicionar em `docs/ARCHITECTURE.md` na seção "Decisões"

---

## Time de agentes

| Nome | Tipo | Responsabilidade |
|------|------|-----------------|
| `architect` | system-architect | Estrutura Next.js, decisões de arquitetura, revisão de DATA-MODELS e API-SPEC |
| `backend` | backend-dev | Supabase migrations, Edge Functions, API Routes |
| `frontend` | mobile-dev | Next.js PWA, UI guest/host, camera UX, performance mobile |
| `ai-integrator` | coder | GPT-4o-mini integration, pgvector search, Edge Function on-upload |
| `tester` | tester | Testes unitários e de integração, validação E2E |
| `security` | security-auditor | RLS policies, rate limiting, validações, LGPD compliance |
| `reviewer` | reviewer | Code review, qualidade, performance, consistência com os docs |

**Pipeline por épico:**
```
architect → backend → frontend → ai-integrator → tester → security → reviewer
```

**Comunicação:** SendMessage-first. Cada agente envia resultados ao próximo via SendMessage antes de encerrar. Nunca polling — agentes aguardam mensagem do anterior.

---

## Limites do MVP

Antes de qualquer implementação, verificar:
- Está em [MVP-SCOPE.md](MVP-SCOPE.md) na seção "IN MVP"?
- Se não estiver, **não implementar** — documentar como sugestão para Fase 2

Features out-of-scope comuns que **não devem ser implementadas**:
- Face clustering / reconhecimento facial
- Revelação atrasada
- WhatsApp Business API
- Auth social (Google/Apple)
- HEIC support
- White-label

---

## Variáveis de ambiente necessárias

Ver lista completa em [docs/API-SPEC.md](API-SPEC.md#variáveis-de-ambiente).

Para desenvolvimento local: criar `.env.local` na raiz (não versionado, não commitar).
