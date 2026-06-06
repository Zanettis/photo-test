# Skills Index

This project uses two skill systems in parallel.

---

## System 1 — Slash Commands (claude-flow)
**Location:** `.claude/commands/`  
**How to use:** `/nome-do-comando` no Claude Code  
**Scope:** projeto (commitado no repo)

| Categoria | Comandos |
|---|---|
| Agents | `agent-capabilities`, `agent-coordination`, `agent-spawning`, `agent-types`, `health`, `list`, `logs`, `metrics`, `pool` |
| Analysis | `bottleneck-detect`, `performance-bottlenecks`, `performance-report`, `token-efficiency`, `token-usage` |
| Automation | `auto-agent`, `self-healing`, `session-memory`, `smart-agents`, `smart-spawn`, `workflow-select` |
| Claude Flow | `claude-flow-help`, `claude-flow-memory`, `claude-flow-swarm` |
| Coordination | `agent-spawn`, `init`, `orchestrate`, `spawn`, `swarm-init`, `task-orchestrate` |
| GitHub | `code-review`, `code-review-swarm`, `github-modes`, `github-swarm`, `issue-tracker`, `issue-triage`, `multi-repo-swarm`, `pr-enhance`, `pr-manager`, `project-board-sync`, `release-manager`, `release-swarm`, `repo-analyze`, `repo-architect`, `swarm-issue`, `swarm-pr`, `sync-coordinator`, `workflow-automation` |
| Hive-Mind | `hive-mind`, `hive-mind-consensus`, `hive-mind-init`, `hive-mind-memory`, `hive-mind-metrics`, `hive-mind-resume`, `hive-mind-sessions`, `hive-mind-spawn`, `hive-mind-status`, `hive-mind-stop`, `hive-mind-wizard` |
| Hooks | `overview`, `post-edit`, `post-task`, `pre-edit`, `pre-task`, `session-end`, `setup` |
| Memory | `memory-persist`, `memory-search`, `memory-usage`, `neural` |
| Monitoring | `agent-metrics`, `agents`, `real-time-view`, `status`, `swarm-monitor` |
| Optimization | `auto-topology`, `cache-manage`, `parallel-execute`, `parallel-execution`, `topology-optimize` |
| SPARC | `analyzer`, `architect`, `ask`, `batch-executor`, `code`, `coder`, `debug`, `debugger`, `designer`, `devops`, `docs-writer`, `documenter`, `innovator`, `integration`, `mcp`, `memory-manager`, `optimizer`, `orchestrator`, `post-deployment-monitoring-mode`, `refinement-optimization-mode`, `researcher`, `reviewer`, `security-review`, `sparc`, `sparc-modes`, `spec-pseudocode`, `supabase-admin`, `swarm-coordinator`, `tdd`, `tester`, `tutorial`, `workflow-manager` |
| Swarm | `analysis`, `development`, `examples`, `maintenance`, `optimization`, `research`, `swarm`, `swarm-analysis`, `swarm-background`, `swarm-init`, `swarm-modes`, `swarm-monitor`, `swarm-spawn`, `swarm-status`, `swarm-strategies`, `testing` |
| Workflows | `development`, `research`, `workflow-create`, `workflow-execute`, `workflow-export` |

---

## System 2 — SKILL.md Skills (awesome-claude-skills)
**Location:** `~/.config/claude-code/skills/` (global, não commitado)  
**How to use:** Carregam automaticamente — Claude ativa quando relevante  
**Source:** [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)

### Desenvolvimento & Code
| Skill | Descrição |
|---|---|
| `artifacts-builder` | Cria artefatos HTML complexos com React/Tailwind/shadcn |
| `changelog-generator` | Gera release notes a partir do git history |
| `mcp-builder` | Cria MCP servers customizados |
| `webapp-testing` | Testa apps web locais com Playwright |
| `skill-creator` | Cria novos skills no formato SKILL.md |
| `langsmith-fetch` | Integração com LangSmith para rastreamento de LLMs |
| `developer-growth-analysis` | Analisa métricas de crescimento de produto dev |

### Documentos
| Skill | Descrição |
|---|---|
| `pdf` | Extrai texto, tabelas, metadata, merge/split PDFs |
| `docx` | Cria e edita documentos Word com comentários e formatação |
| `pptx` | Lê e gera apresentações PowerPoint |
| `xlsx` | Manipula planilhas Excel: fórmulas, gráficos, dados |

### Imagem & Mídia (relevante para plataforma de fotos)
| Skill | Descrição |
|---|---|
| `image-enhancer` | Melhora resolução e clareza de imagens |
| `cloudinary-automation` | Gerenciamento de imagens via Cloudinary API |
| `imgix-automation` | Otimização e transformação de imagens via imgix |
| `canvas-design` | Cria arte visual (PNG/PDF) |
| `slack-gif-creator` | Gera GIFs animados otimizados |
| `video-downloader` | Download de vídeos do YouTube |
| `theme-factory` | Aplica temas de design profissional |

### Conteúdo & Marketing
| Skill | Descrição |
|---|---|
| `brand-guidelines` | Aplica diretrizes de marca consistentes |
| `content-research-writer` | Cria conteúdo baseado em pesquisa |
| `competitive-ads-extractor` | Analisa publicidade de concorrentes |
| `twitter-algorithm-optimizer` | Maximiza engajamento em tweets |
| `domain-name-brainstormer` | Gera ideias de domínio com verificação de disponibilidade |
| `lead-research-assistant` | Identifica e qualifica leads |

### Produtividade & Organização
| Skill | Descrição |
|---|---|
| `file-organizer` | Organiza arquivos e pastas com inteligência |
| `invoice-organizer` | Automatiza processamento de invoices |
| `meeting-insights-analyzer` | Extrai insights de transcrições de reuniões |
| `internal-comms` | Templates e automação de comunicação interna |
| `tailored-resume-generator` | Customiza currículos para vagas específicas |
| `raffle-winner-picker` | Seleção aleatória criptograficamente segura |

### Infraestrutura & CDN (relevante para deploy de fotos)
| Skill | Descrição |
|---|---|
| `cloudflare-automation` | DNS, CDN e segurança via Cloudflare |
| `cloudflare-api-key-automation` | Gerenciamento de API keys do Cloudflare |
| `cloudflare-browser-rendering-automation` | Rendering de browser via Cloudflare |
| `bunnycdn-automation` | CDN para entrega de mídia via BunnyCDN |
| `neon-automation` | Banco de dados Postgres serverless (Neon) |
| `turso-automation` | Banco de dados SQLite distribuído (Turso) |

### Google Workspace (eventos e colaboração)
| Skill | Descrição |
|---|---|
| `googledrive-automation` | Armazenamento e compartilhamento de arquivos |
| `googlephotos-automation` | Integração com Google Photos |
| `googlecalendar-automation` | Agendamento de eventos |
| `googlemeet-automation` | Videoconferências |

### Comunicação & Equipe
| Skill | Descrição |
|---|---|
| `slackbot-automation` | Bot e automações no Slack |
| `discordbot-automation` | Bot e automações no Discord |
| `resend-automation` | Envio de emails transacionais via Resend |

---

## Como adicionar mais skills

Para instalar mais integrações do repositório Composio:
```bash
# Clonar o repo (já foi clonado em /tmp/awesome-claude-skills)
git clone https://github.com/ComposioHQ/awesome-claude-skills.git

# Instalar uma integração específica
cp -r awesome-claude-skills/composio-skills/nome-automation ~/.config/claude-code/skills/

# Ver todas as ~832 integrações disponíveis
ls awesome-claude-skills/composio-skills/
```

Para usar as integrações que requerem API (GitHub, Stripe, Notion, etc.), instale o plugin Composio:
```bash
claude --plugin-dir ./connect-apps-plugin
/connect-apps:setup
```
