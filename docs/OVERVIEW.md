# Overview do Produto — foto.app

## Problema

A coleta de fotos em eventos sociais no Brasil é estruturalmente quebrada:

- Convidados tiram fotos mas raramente as enviam ao anfitrião
- Quando enviam, fazem via WhatsApp — que comprime 8MB para 200KB, destruindo qualidade
- O anfitrião perde a maioria das fotos do próprio evento

**Competidores globais não resolvem o Brasil:**

| Concorrente | Por que falha no Brasil |
|------------|------------------------|
| Once, Lense, POV | iOS-first em mercado 70% Android |
| Todos | Preços em USD — barreira para mercado BR |
| Todos | Sem AI — são galerias glorificadas com QR Code |

**O competidor real é o grupo do WhatsApp.** Qualquer produto vencedor no Brasil tem que ser mais fácil que criar um grupo no WhatsApp.

---

## Solução

PWA web (sem instalação) com upload direto e busca semântica em português:

1. Anfitrião cria evento → recebe QR Code + link curto
2. Compartilha via WhatsApp com convidados
3. Convidado escaneia → câmera ou galeria → upload em menos de 10 segundos
4. Fotos tagueadas por IA (GPT-4o-mini) e indexadas para busca
5. Anfitrião busca: "momento da vela", "foto com a vovó" → retorna fotos certas

**Regra inviolável:** se levar mais de 10 segundos do escaneamento ao envio, o convidado abandona.

---

## Diferencial

Busca semântica de fotos em linguagem natural em português — nenhum concorrente global tem isso.

Enquanto outros são galerias com QR Code, este produto permite encontrar a foto certa em 500+ imagens digitando como você falaria para um amigo.

---

## Usuário-alvo (wedge)

**Noivas e noivos brasileiros — casamentos**

| Fator | Detalhe |
|-------|---------|
| Emoção | Evento único e irrepetível — cada foto perdida é permanente |
| Disposição a pagar | Gastam R$15-80k+ no evento; R$100-200 no app é irrelevante |
| Motivação | Vão ativamente convencer os convidados a usar |

Expansão planejada para fase 2: assessoras de eventos e corporate B2B.

---

## Mercado

- Brasil/Latam
- Android: 70%+ de market share → PWA-first (sem App Store)
- Idioma: português do Brasil
- Preços: BRL

---

## Pricing

| Plano | Preço | Limite |
|-------|-------|--------|
| Gratuito | R$0 | 20 convidados / 50 fotos |
| Básico | R$59 | 100 convidados / 300 fotos |
| Completo | R$149 | Até 500 fotos (+ R$0,30/foto adicional) |

Custo de AI estimado: R$0,05-0,10/foto. Margem positiva a partir do plano Básico.

---

## Critérios de sucesso

| Métrica | Meta |
|---------|------|
| Validação pré-MVP | >40% dos convidados fazem upload em evento teste |
| MVP validado | >50% conversão scan→upload em 1 casamento real |
| PMF | 10 casamentos pagos nos primeiros 2 meses |
| AI diferenciador | >60% dos anfitriões usam busca semântica |
| NPS | >8 (coletado por email 48h após evento) |

---

## Fora de escopo (fase 2)

- Face clustering (requer LGPD consent flow explícito)
- Revelação atrasada (câmera descartável)
- WhatsApp Business API
- White-label para assessoras
- Deduplicação automática
- Auth social (Google/Apple)
- B2B corporativo
