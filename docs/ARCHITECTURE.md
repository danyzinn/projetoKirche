# Arquitetura — Kirche Core

## 1. Visão

```
┌──────────── PWA (React/Vite) ────────────┐        ┌─────────── Supabase ───────────┐
│ pages → hooks (TanStack Query) → KircheApi│──HTTPS─▶│ Auth (JWT)                      │
│                         ├─ supabaseApi    │        │ PostgREST + RPC                  │
│                         └─ demoApi (mem.) │        │ PostgreSQL: RLS + SECURITY DEFINER│
└───────────────────────────────────────────┘        │ (futuro) Storage privado, Edge Fn │
                                                      └─────────────────────────────────┘
  Futuro app Expo/React Native → mesmo backend, mesmos tipos de src/domain e contrato KircheApi.
```

- **Multi-tenant em banco único**: toda tabela de negócio tem `organization_id`; isolamento por RLS.
  Não há projeto/banco por cliente.
- **Fronteira Kirche × tenant**: `platform_staff` identifica a equipe Kirche, sem bypass de RLS.
  `organizations`, `organization_branding` e `organization_modules` definem o tenant (white-label).
- **PWA** (manifest + responsivo). Não há service worker nem push nesta versão.

## 2. Estrutura de pastas

```
src/
  domain/        types.ts · permissions.ts (+test) · schemas.ts (+test)
  services/      api.ts (contrato) · supabaseApi.ts · demoApi.ts (+test) · index.ts (seleção do modo)
  app/           AuthProvider · OrgProvider (tenant, grants, tema) · guards (RequireAuth/RequireOrg)
  components/    ui/ (Button, Card, Badge, Field, States, PageHeader) · layout/ (AppShell, DemoBanner) · PersonPicker
  pages/         auth/ · Home · Avisos · Eventos · Grupos · Ministério · Escalas · Célula · Notificações · Perfil · management/
  lib/           env · utils (datas no fuso da igreja, BRL, tokens)
  test/          setup + testes de navegação por perfil
supabase/
  migrations/    0001 tenancy/RBAC/convites/auditoria · 0002 notificações/ministérios/escalas · 0003 células
                 0004 avisos/eventos · 0005 busca de pessoas para líderes
  tests/         stub do ambiente Supabase, helpers, fixtures sintéticas e *.test.sql
  seed.sql       dados DEMO (apenas local)
scripts/test-db.sh
```

## 3. Rotas

| Rota | Tela | Acesso |
|---|---|---|
| `/entrar`, `/recuperar-senha`, `/redefinir-senha` | acesso | público / sessão |
| `/convite/:token` | aceite de convite | público → sessão com o e-mail convidado |
| `/selecionar-igreja`, `/sem-igreja`, `/privacidade` | contexto | sessão |
| `/` | início (próxima escala, célula, avisos, eventos, atalho de gestão) | membro |
| `/avisos`, `/avisos/:id`, `/avisos/novo` | feed, detalhe (marca leitura), criação | membro / `announcements.create` |
| `/eventos`, `/eventos/:id`, `/eventos/novo` | lista, inscrição, criação | membro / `events.create` |
| `/grupos`, `/ministerios/:id`, `/escalas` | meus grupos, equipe+escalas, minhas escalas | integrante / liderança |
| `/celulas/:id` | célula (endereço restrito, encontros, presença) | participante / liderança |
| `/notificacoes`, `/perfil` | central in-app, perfil | membro |
| `/gestao`, `/gestao/membros`, `/gestao/ministerios`, `/gestao/celulas` | Minha Central de Gestão | conforme grants |

Toda tela trata loading, vazio, erro e acesso negado. Acesso negado na UI **não** substitui a checagem no banco.

## 4. Modelo de dados implementado

| Domínio | Tabelas |
|---|---|
| Tenancy | organizations, organization_branding, organization_modules, congregations |
| Identidade | profiles (1:1 auth.users), organization_memberships, platform_staff |
| RBAC | permission_definitions, role_definitions, role_permissions, user_role_assignments, invitations |
| Auditoria | audit_logs (append-only via `write_audit`) |
| Notificações | notifications (dedupe por usuário), notification_preferences, notification_outbox |
| Ministérios/Escalas | ministries, ministry_memberships, schedules, schedule_assignments |
| Células | cells, cell_private_details, cell_memberships, cell_meetings, cell_attendance |
| Comunicação | announcements, announcement_audiences, announcement_reads |
| Eventos | events, event_registrations |

Convenções: UUID, `created_at/updated_at` (trigger), `created_by` quando aplicável, CHECKs de domínio,
FKs com `on delete` explícito, triggers de **consistência de tenant** (linha filha não pode apontar para pai de outra igreja).

RPCs principais: `grant_role`, `revoke_role`, `create_invitation`, `accept_invitation`, `remove_member`,
`publish_schedule`, `respond_to_assignment`, `publish_announcement`, `mark_announcement_read`, `announcement_read_count`,
`register_for_event` (trava de vagas com `FOR UPDATE`), `cancel_event_registration`, `mark_notifications_read`, `search_members`.

Planejadas (não criadas): households, guardian_links, visitors, event_occurrences, availability, schedule_swaps,
push_subscriptions, discipleship, prayer_requests, classrooms, child_checkins, social/inventory, facility_rooms,
reservations, assets, incidents, documents, finance_*, approvals, support_tickets, public_church_profiles, public_events.

## 5. Provisionamento de uma nova igreja (manual nesta fase)

No SQL Editor (papel `postgres`), por alguém da equipe Kirche:

```sql
with org as (
  insert into public.organizations (slug, display_name, status)
  values ('minha-igreja', 'Nome exibido', 'onboarding') returning id
), b as (
  insert into public.organization_branding (organization_id, app_name) select id, 'Nome exibido' from org
)
insert into public.invitations (organization_id, email, token_hash, role_id, expires_at)
select org.id, 'responsavel@igreja.org',
       encode(digest('TOKEN-ALEATORIO-LONGO', 'sha256'), 'hex'),
       (select id from public.role_definitions where key = 'church_owner' and organization_id is null),
       now() + interval '7 days'
from org;
-- Envie https://<app>/convite/TOKEN-ALEATORIO-LONGO ao responsável (que cria a conta com o mesmo e-mail).
```

Um portal interno Kirche para isso está planejado (Etapa F).

## 6. Riscos e decisões

| Risco | Mitigação atual |
|---|---|
| Vazamento entre igrejas | RLS em todas as tabelas + triggers de tenant + testes negativos automatizados |
| Escalada de privilégio | escrita de grants só via RPC com regras anti-escalada; testado |
| Usuário removido com sessão ativa | toda checagem consulta membership ativa a cada requisição; testado |
| Dados sensíveis (religião, menores) | minimização, endereço separado, sem módulos de menores até processo validado |
| Demo confundida com produção | faixa permanente, rótulos "(DEMO)", perfis explicitamente fictícios |
| Push "fantasma" | push não implementado e sinalizado; outbox preparada |
| Funções SECURITY DEFINER | `search_path` fixo, baseadas em `auth.uid()`, EXECUTE revogado nas internas |
| Tipos do banco não gerados | mapeamento explícito em `supabaseApi.ts`; gerar tipos é próximo passo |
