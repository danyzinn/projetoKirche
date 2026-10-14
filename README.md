> Direção atual: **um app por igreja, com núcleo compartilhado**. Consulte [implantação e continuidade](docs/ONE_APP_PER_CHURCH.md). As descrições anteriores de multi-tenant referem-se ao modelo de dados, não a um seletor comercial de igrejas.

# Kirche Core — app IBV Nova (piloto)

Plataforma SaaS multi-tenant de gestão de igrejas desenvolvida pela **Kirche**.
O primeiro tenant piloto é exibido como **IBV Nova**. Todo conteúdo atual é
**fictício (DEMO)** até aprovação da igreja — nada aqui representa nome jurídico,
endereço, horários de culto ou identidade oficial da IBV Nova.

> Status real desta versão: veja [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

React 18 + TypeScript + Vite · Tailwind CSS · TanStack Query · Zod · React Hook Form ·
Supabase (Auth, PostgreSQL com RLS) · Vitest + Testing Library · PWA responsiva.

## Dois modos de execução

| Modo | Quando | Dados | Segurança |
|---|---|---|---|
| **Demonstração** | sem `VITE_SUPABASE_*` | fictícios, em memória, **nada é salvo** (faixa amarela sempre visível) | regras espelhadas só para fidelidade da demo |
| **Supabase** | com `.env.local` preenchido | PostgreSQL | **RLS + RPCs no banco** (fonte da verdade) |

No modo demonstração, a tela de acesso oferece perfis fictícios (Membro, Líder de
Louvor, Administração, Líder de Célula). **Não é login real** e está identificado como tal.

## Rodando localmente

```bash
npm install
npm run dev            # http://localhost:8080 (modo demonstração)
```

### Com Supabase local (recomendado para desenvolvimento do backend)

Pré-requisitos: [Supabase CLI](https://supabase.com/docs/guides/cli) e Docker.

```bash
supabase init          # só na primeira vez (gera supabase/config.toml; mantém migrations)
supabase start         # sobe Postgres/Auth/Studio locais
supabase db reset      # aplica supabase/migrations/* e supabase/seed.sql (dados DEMO)
cp .env.example .env.local
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY com os valores de `supabase status`
npm run dev
```

Usuários do seed (somente local, senha `demo-local-123`):
`demo.membro@kirche.local`, `demo.lider@kirche.local`, `demo.admin@kirche.local`, `demo.celula@kirche.local`.

### Supabase próprio (homologação)

1. Crie um projeto no Supabase e rode `supabase link --project-ref <ref>`.
2. `supabase db push` para aplicar as migrations. **Não** rode `seed.sql` em produção.
3. Crie a organização e o primeiro responsável via SQL Editor (ver `docs/ARCHITECTURE.md` → Provisionamento).
4. Em Auth → URL Configuration, adicione `https://<seu-domínio>/redefinir-senha` aos redirects.
5. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no provedor de deploy (Vercel/Netlify/Cloudflare Pages).
   **Nunca** use a `service_role` no frontend.
6. Agende `select public.publish_due_announcements();` (pg_cron ou Edge Function agendada) para avisos agendados.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emitir |
| `npm test` | testes unitários e de interface (Vitest) |
| `npm run test:db` | aplica migrations em PostgreSQL efêmero e roda testes de RLS/isolamento (`supabase/tests`) |

`test:db` precisa de PostgreSQL 15+ instalado (`initdb` no PATH ou em `/usr/lib/postgresql/*/bin`)
ou de `TEST_DATABASE_URL` apontando para um banco **vazio**. `WITH_SEED=1` também valida o seed.

## Removendo dados de demonstração (antes do piloto real)

```sql
-- Execute no SQL Editor do projeto de homologação/produção, se o seed tiver sido aplicado por engano.
delete from public.organizations where slug = 'ibv-nova-demo' and is_demo = true;
delete from auth.users where email like 'demo.%@kirche.local';
```

Depois confira: `select count(*) from public.organizations where is_demo;` deve retornar 0.

## Documentação

- [`CLAUDE.md`](CLAUDE.md) — regras para continuidade com Claude Code
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura, pastas, rotas, modelo de dados
- [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) — papéis, operações, escopos e matriz
- [`docs/SECURITY_LGPD.md`](docs/SECURITY_LGPD.md) — segurança, privacidade e pendências jurídicas
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — status real por etapa e próximos passos
- [`docs/PILOT_QUESTIONS.md`](docs/PILOT_QUESTIONS.md) — dúvidas a confirmar com a igreja piloto
- [`docs/CONNECT.md`](docs/CONNECT.md) — preparação do Kirche Connect (sem implementação)

---
Tecnologia Kirche.
