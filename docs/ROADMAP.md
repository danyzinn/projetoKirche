> Direção atual: **um app por igreja, com núcleo compartilhado**. Consulte [implantação e continuidade](ONE_APP_PER_CHURCH.md). As descrições anteriores de multi-tenant referem-se ao modelo de dados, não a um seletor comercial de igrejas.

# Roadmap e status real

Legenda: ✅ implementado e testado · 🟡 parcial · 📋 planejado · ⛔ bloqueado (depende de decisão/insumo externo)

_Atualizado em 2026-10-13 — Incremento 1 (Etapas A + B e primeira fatia vertical de C)._

## Plano de execução e dependências

```
A (design system, rotas, DEMO) ─┐
B (auth, tenant, RBAC, RLS) ────┼─▶ C (avisos, eventos, escalas, células, notificações in-app)
                                │        └─▶ D (módulos especializados) ─▶ E (tesouraria) ─▶ F (prontidão comercial)
Respostas da igreja piloto ─────┘   (docs/PILOT_QUESTIONS.md bloqueia dados reais, Infantil, Finanças e Intercessão)
```

## Etapa A — Arquitetura e design navegável
| Item | Status |
|---|---|
| Design system (tokens, botões, cards, badges, campos, estados) | ✅ |
| Layout mobile-first (bottom nav) + sidebar desktop | ✅ verificado em 390px e 1280px, sem overflow horizontal |
| Modo DEMO rotulado, sem botões falsos | ✅ |
| PWA (manifest) | 🟡 sem service worker/offline |
| Logotipo oficial Kirche / IBV Nova | ⛔ aguardando arquivos oficiais (marca atual é monograma provisório) |

## Etapa B — Núcleo funcional
| Item | Status |
|---|---|
| Auth Supabase (e-mail/senha, recuperar/redefinir senha, logout) | 🟡 implementado; sem E2E contra Supabase real |
| Convite por link expirável (hash do token, e-mail precisa coincidir) | ✅ banco testado · 🟡 envio de e-mail pendente (link copiado manualmente) |
| Seleção de igreja (múltiplas memberships) | ✅ |
| Perfil (campos permitidos) | ✅ |
| RBAC aditivo com escopos + anti-escalada + auditoria de grants | ✅ 114 asserções SQL |
| Isolamento multi-tenant com testes negativos | ✅ |
| Remoção de membro com efeito imediato | ✅ |
| Cadastro completo de membros (famílias, histórico, duplicatas, consentimentos) | 📋 |
| Tipos gerados do banco (`supabase gen types`) | 📋 |

## Etapa C — Fluxos operacionais
| Item | Status |
|---|---|
| Ministério de Louvor: equipe + escala + publicação + confirmação/recusa | ✅ banco + DEMO + UI |
| Avisos segmentados (igreja/ministério/célula), rascunho, publicação, leitura, contagem agregada | ✅ |
| Avisos agendados | 🟡 visibilidade por data ok; notificação exige agendar `publish_due_announcements()` |
| Fluxo de aprovação de avisos (revisão por terceiros) | 🟡 rascunho fica pendente para quem pode publicar; sem fila dedicada |
| Eventos: criação, inscrição, vagas, cancelamento com notificação | ✅ |
| Lista de presença de eventos / check-in | 📋 (coluna `checked_in_at` existe) |
| Células: criação, liderança por grant, participantes, encontros, presença, endereço restrito | ✅ |
| Notificações in-app (lida/não lida, links, idempotência) | ✅ |
| Preferências de notificação (UI) | 📋 (tabela existe) |
| Web push / Expo push / e-mail / WhatsApp | ⛔ não implementado; depende de provedor, custos e consentimento |
| Substituição de escala (swap) com fluxo | 📋 (recusa já notifica a liderança) |
| Reservas de salas e alerta de conflito | 📋 |

## Etapas D, E, F
| Item | Status |
|---|---|
| Louvor (repertório/cifras licenciadas), Mídia, Layout, Recepção, EBD, Infantil, Jovens, Ação Social, Intercessão (H/M separadas), Segurança, Patrimônio | 📋 Etapa D — reutilizar escalas/avisos/eventos |
| Infantil (check-in/retirada) | ⛔ exige processo validado com a igreja e revisão de privacidade de menores |
| Tesouraria | 📋 Etapa E (permissões `finance.*` já existem e são segregadas) |
| Portal interno Kirche, provisionamento, cobrança, APIs Connect | 📋 Etapa F |

## Checklist de aceitação da primeira entrega

| # | Critério | Status |
|---|---|---|
| 1 | App responsivo e navegável | ✅ |
| 2 | Branding IBV Nova visível; Kirche como fornecedor | ✅ |
| 3 | Auth real ou explicitamente pendente | ✅ real (Supabase) + demo explícita |
| 4 | Perfis membro e líder com interfaces diferentes e políticas reais | ✅ (UI testada; RLS testada) |
| 5 | Louvor: equipe e escala end-to-end | ✅ banco + UI (DEMO); 🟡 E2E contra Supabase real pendente |
| 6 | Aviso segmentado persistido, leitura e histórico in-app | ✅ banco |
| 7 | Eventos: criação e inscrição persistidas | ✅ banco |
| 8 | Células: criação, liderança, participantes e reuniões | ✅ banco |
| 9 | Isolamento de tenant com testes negativos automatizados | ✅ |
| 10 | Typecheck/lint/testes executados com relatório | ✅ |
| 11 | Exportável para GitHub sem segredos | ✅ |
| 12 | README, arquitetura, migrations, .env.example, CLAUDE.md, roadmap | ✅ |
| 13 | Nenhum botão falso | ✅ (itens planejados aparecem como "Planejado", sem ação) |
| 14 | Nada sensível em consultas públicas ou buckets públicos | ✅ (sem Storage ainda; anon não lê nada) |
| 15 | Notificações in-app funcionais; push documentado | ✅ in-app · push pendente |

## Bugs/limitações conhecidos
- Fuso: entradas são convertidas para o fuso da igreja; listas de eventos filtram "a partir de 24h atrás" no relógio do aparelho.
- Recuperação de senha depende da URL de redirect configurada no Supabase.
- `listEvents` consulta contagem de vagas por evento (N chamadas); trocar por view/RPC agregada quando houver volume.
- No modo DEMO, recarregar a página encerra a sessão fictícia (intencional: nada é persistido).

## Próximo incremento sugerido
1. E2E Playwright contra Supabase local (login, criar aviso, escalar voluntário, trocar de igreja).
2. Tipos gerados + view agregada de eventos.
3. Preferências de notificação + fila de aprovação de avisos.
4. Swap de escala e disponibilidade.
5. Reservas de salas com conflito.

## Incremento 2026-10-14 — um app por igreja

Implementado na branch `codex/one-app-per-church` (PR #1): configuração pública central, identidade antes/depois do login, manifesto gerado, filtro por slug, interseção de módulos e proteção de rotas, navegação de quatro seções com aliases, cadastro com continuidade do convite e migration 0006 de acesso/privacidade. Detalhes de implantação em `ONE_APP_PER_CHURCH.md`.

Verificação local: 49 testes web aprovados (8 arquivos), lint, typecheck, configuração e build aprovados. Testes de navegação executam em jsdom; não equivalem à inspeção visual em navegador.

Pendente: suite PostgreSQL (runtime local indisponível; CI ainda sem execução registrada ao abrir o PR), inspeção visual em navegador e homologação do cadastro/confirmacão de e-mail com Supabase real. As alterações de banco permanecem em revisão e não foram aplicadas a um ambiente real. Não considerar este incremento uma versão pronta para produção.
