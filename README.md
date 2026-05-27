# foto.app — Plataforma AI-First de Fotos para Eventos

PWA para coleta e busca semântica de fotos em eventos sociais no Brasil. Interface de câmera descartável analógica, revelação agendada e busca em linguagem natural — sem instalar nada, sem criar conta.

---

## Para convidados

- Escaneia QR Code → abre no browser (Android ou iOS), sem download
- Interface de câmera descartável: viewfinder, botão shutter, contador de poses
- Upload direto em qualidade original em menos de 10 segundos
- Countdown animado até o momento de revelação das fotos

## Para anfitriões

- Cria o evento em minutos: nome, data, shot cap e horário de revelação
- **Shot Cap** — define quantas fotos cada convidado pode tirar (5, 10, 20 ou sem limite)
- **Delayed Reveal** — define quando a galeria é revelada; antecipação coletiva pós-evento
- Galeria sempre visível para moderação antes da revelação
- **Busca semântica em português** — "momento da vela", "foto com a vovó", "brinde"
- Download individual ou ZIP em alta resolução

---

## Stack

Next.js 14 PWA · Supabase Pro · GPT-4o-mini Vision · pgvector · text-embedding-3-small · Resend · Vercel

---

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [docs/INDEX.md](docs/INDEX.md) | Entry point — mapa de toda a documentação |
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | Problema, solução, diferencial, pricing |
| [docs/MVP-SCOPE.md](docs/MVP-SCOPE.md) | Features IN/OUT, épicos, critérios de done |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, diagramas, state machine do evento |
| [docs/DATA-MODELS.md](docs/DATA-MODELS.md) | Schema Postgres, RLS policies |
| [docs/API-SPEC.md](docs/API-SPEC.md) | Endpoints, contratos, Edge Functions |
| [docs/AGENT-GUIDE.md](docs/AGENT-GUIDE.md) | Guia para agentes IA trabalhando no projeto |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Tracker de tasks por épico |

---

Mercado: Brasil / Latam · Wedge: casamentos · Android-first
