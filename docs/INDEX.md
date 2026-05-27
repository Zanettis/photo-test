# Índice de Documentação — foto.app

> Entry point para agentes IA e desenvolvedores. Leia este arquivo primeiro antes de qualquer tarefa.

Plataforma AI-first de coleta e busca semântica de fotos em eventos para o Brasil. Convidados fazem upload via QR Code (PWA, sem instalação); anfitriões buscam em linguagem natural.

**Design doc aprovado (fonte de verdade):**
`C:\Users\zanet\.gstack\projects\Zanettis-photo-test\zanet-main-design-20260526-220958.md`

---

## Documentos

| Arquivo | Propósito | Leia quando... |
|---------|-----------|----------------|
| [OVERVIEW.md](OVERVIEW.md) | Problema, solução, usuário, diferencial, pricing | Antes de tomar qualquer decisão de produto |
| [MVP-SCOPE.md](MVP-SCOPE.md) | O que está IN/OUT do MVP, épicos, critérios de sucesso | Antes de implementar qualquer feature |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, componentes, fluxo de dados, decisões tomadas | Antes de qualquer decisão técnica |
| [DATA-MODELS.md](DATA-MODELS.md) | Schema Postgres, tabelas, RLS policies, relações | Antes de tocar banco de dados |
| [API-SPEC.md](API-SPEC.md) | Endpoints, Edge Functions, auth, contratos de input/output | Antes de implementar API ou consumir endpoints |
| [AGENT-GUIDE.md](AGENT-GUIDE.md) | Convenções, onde colocar arquivos, como atualizar docs | No início de qualquer sessão de desenvolvimento |
| [PROGRESS.md](PROGRESS.md) | Status de cada task por épico (todo/in-progress/done) | Para verificar o que já foi feito e o que fazer em seguida |

---

## Regras de atualização

| Quem | O que atualiza | Quando |
|------|---------------|--------|
| Qualquer agente | `PROGRESS.md` | Após completar qualquer task |
| Agente backend | `DATA-MODELS.md`, `API-SPEC.md` | Após mudança de schema ou endpoint |
| Agente architect | `ARCHITECTURE.md` | Após decisão de arquitetura |
| Lead / founder | `MVP-SCOPE.md` | Após mudança de escopo |

**Nunca editar:** `AGENT-GUIDE.md` sem revisar com o lead primeiro.

---

## Estado atual do projeto

- Fase: **Documentação + Setup (pré-código)**
- Código: zero linhas implementadas
- Próximo passo: setup do boilerplate Next.js + Supabase (Épico 0 em PROGRESS.md)
