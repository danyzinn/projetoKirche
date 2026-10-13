# CLAUDE.md — Kirche Core

Guia de continuidade para Claude Code e para a equipe Kirche. Leia antes de alterar o projeto.
Não dependa de prompts antigos: decisões estão registradas aqui e em `docs/`.

## Produto

- **Kirche** = empresa detentora. **Kirche Core** = produto-base multi-tenant. **IBV Nova** = primeiro tenant (piloto).
- Interface do usuário final mostra a marca do **tenant** (vinda de `organization_branding`), nunca "Kirche",
  exceto o crédito discreto "Tecnologia Kirche".
- **Nunca** hardcodar "IBV Nova" em lógica central. Exceções conscientes: `AuthLayout` (antes do login não há
  tenant resolvido — trocar por branding público quando houver domínio por igreja), `index.html`, `manifest`, seed e modo DEMO.
- Conteúdo DEMO é sempre rotulado "(DEMO)". Não inventar endereço, horários de culto, membros ou finanças reais.

## Comandos

```bash
npm run dev          # app (modo demonstração se não houver .env.local)
npm run lint && npm run typecheck && npm test && npm run test:db && npm run build
```

Sempre rode os cinco antes de commitar. `test:db` cria um PostgreSQL efêmero e roda `supabase/tests/*.test.sql`.

## Arquitetura (resumo — detalhes em docs/ARCHITECTURE.md)

```
src/domain/      tipos, permissões (espelho de has_permission), schemas Zod — sem React/Supabase
src/services/    contrato KircheApi + supabaseApi (real) + demoApi (memória, fictício)
src/app/         AuthProvider, OrgProvider (tenant atual, grants, tema), guards
src/components/  ui/ (design system), layout/ (AppShell, DemoBanner), PersonPicker
src/pages/       telas; pages/management/ é carregado sob demanda
supabase/migrations/  SQL versionado (fonte da verdade de dados e autorização)
supabase/tests/       testes SQL de RLS, escalada e isolamento entre igrejas
```

Regras:
1. **Toda leitura/escrita passa por `KircheApi`.** Páginas não importam o client Supabase.
2. **Autorização real é no banco** (RLS + funções `SECURITY DEFINER`). `can()` no cliente só decide o que exibir.
3. Ao adicionar método em `KircheApi`, implemente nos **dois** adapters (supabase e demo) e cubra com teste.
4. Serviços transversais (escalas, avisos, notificações, eventos) são **compartilhados** entre ministérios — não duplicar por ministério.
5. Datas: `timestamptz` no banco; entrada `datetime-local` convertida com `churchLocalToIso(valor, ctx.org.timezone)`;
   exibição com `formatDateTime(iso, ctx.org.timezone)`.
6. Dinheiro: `numeric` no banco, string/decimal no cliente, `formatBRL`. Nunca `float`.
7. Mensagens ao usuário em pt-BR; erros do banco mapeados em `supabaseApi.ts#ERROR_MESSAGES` sem vazar detalhes.

## Permissões

- Papéis aditivos em `user_role_assignments` (escopos: church, congregation, ministry, cell). Default deny.
- `has_permission(org, perm, scope_type, scope_id)`: membership ativa + grant não revogado; grant de igreja cobre tudo.
- Escrita em grants **somente** via `grant_role` / `revoke_role` / `accept_invitation`. Regras anti-escalada:
  papel com `church.manage_permissions` só por `church_owner`; sem auto-concessão; sem remover o último owner.
- `platform_staff` (Kirche) **não** tem acesso automático a dados das igrejas.
- Finanças (`finance.*`) só via papel `treasurer`; `church_admin` não recebe finanças.
- Matriz completa: `docs/PERMISSIONS.md`.

## Política de migrations

- Arquivos `supabase/migrations/YYYYMMDDHHMMSS_descricao.sql`, **nunca editar migration já aplicada em ambiente compartilhado** —
  crie uma nova. (As migrations atuais ainda não foram aplicadas fora de ambiente local.)
- Toda tabela nova: `organization_id`, RLS habilitada **na mesma migration**, policies explícitas, índices de FK,
  trigger de consistência de tenant quando houver FK para outra tabela com tenant.
- Toda migration nova precisa de testes em `supabase/tests/` incluindo **casos negativos** (outra igreja, sem permissão, escopo errado).
- Funções internas (`write_audit`, `notify_user`, `fanout_announcement`, `publish_due_announcements`) têm EXECUTE revogado de anon/authenticated.

## Limites de segurança (não negociáveis)

- Sem `service_role` no frontend; sem segredos no repositório (`.env*` ignorados).
- Sem dados reais em seed/demo. Sem dados sensíveis em `audit_logs.metadata`, logs ou analytics.
- Endereço de célula só em `cell_private_details`. Lista de crianças, pedidos de oração, contribuições e incidentes nunca em feed público.
- Push/e-mail/WhatsApp: não declarar como ativos sem integração e teste real.
- Não marcar como concluído o que não foi testado. Status real em `docs/ROADMAP.md` (atualize a cada incremento).

## Roteiro de continuidade

Próximas fatias (ordem sugerida — ver ROADMAP): E2E com Playwright contra Supabase local → tipos gerados
(`supabase gen types`) → substituição/troca de escala → reservas de salas e conflito → preferências de notificação + web push
→ módulos da Etapa D → Tesouraria (Etapa E) com anexos privados e trilha de auditoria.

Ao final de cada incremento, informe: arquivos alterados, migrations, rotas prontas, fluxos testados,
permissões verificadas, bugs conhecidos e próxima etapa.
