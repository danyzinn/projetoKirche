-- =============================================================================
-- Kirche Core — 0001: tenancy, perfis, memberships, RBAC, convites e auditoria
-- Princípios: default deny (RLS ligada em todas as tabelas), papéis aditivos,
-- checagem de permissão sempre no banco, nenhuma escalada por auto cadastro.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Organizações (tenants) e configuração white-label
-- -----------------------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  display_name  text not null check (length(display_name) between 2 and 120),
  legal_name    text,                                   -- só após confirmação pela igreja
  status        text not null default 'onboarding'
                check (status in ('demo','onboarding','active','suspended')),
  is_demo       boolean not null default false,
  timezone      text not null default 'America/Sao_Paulo',
  locale        text not null default 'pt-BR',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_branding (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  app_name        text not null,
  logo_url        text,
  icon_url        text,
  theme_tokens    jsonb not null default '{}'::jsonb,
  powered_by_label text not null default 'Tecnologia Kirche',
  updated_at      timestamptz not null default now()
);
create trigger trg_org_branding_updated before update on public.organization_branding
  for each row execute function public.set_updated_at();

create table public.organization_modules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key      text not null,
  enabled         boolean not null default true,
  config          jsonb not null default '{}'::jsonb,
  primary key (organization_id, module_key)
);

create table public.congregations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  is_headquarters boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.congregations (organization_id);
create trigger trg_congregations_updated before update on public.congregations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Perfis (1:1 com auth.users). Dados pessoais mínimos.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  display_name text,
  phone        text,
  birth_date   date,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Equipe interna Kirche (operação comercial). NÃO concede acesso a dados das igrejas.
-- -----------------------------------------------------------------------------
create table public.platform_staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('platform_owner','platform_support')),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Vínculo pessoa ↔ igreja
-- -----------------------------------------------------------------------------
create table public.organization_memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  congregation_id uuid references public.congregations(id) on delete set null,
  member_type     text not null default 'member' check (member_type in ('member','visitor','attendee')),
  status          text not null default 'active' check (status in ('active','suspended','removed')),
  joined_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index on public.organization_memberships (user_id);
create trigger trg_memberships_updated before update on public.organization_memberships
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RBAC: permissões, papéis (templates de sistema ou por igreja) e grants
-- -----------------------------------------------------------------------------
create table public.permission_definitions (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  module      text not null,
  operation   text not null check (operation in (
                'view','create','update','delete','publish','approve','export',
                'manage_members','manage_permissions','view_sensitive','manage_finance','audit')),
  description text not null
);

create table public.role_definitions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade, -- null = template do sistema
  key             text not null check (key ~ '^[a-z_]+$'),
  name            text not null,
  description     text not null default '',
  default_scope   text not null default 'church'
                  check (default_scope in ('church','congregation','ministry','cell')),
  is_system       boolean not null default false,
  created_at      timestamptz not null default now()
);
create unique index role_definitions_key_uniq
  on public.role_definitions (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

create table public.role_permissions (
  role_id        uuid not null references public.role_definitions(id) on delete cascade,
  permission_key text not null references public.permission_definitions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.user_role_assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role_id         uuid not null references public.role_definitions(id) on delete restrict,
  scope_type      text not null check (scope_type in ('church','congregation','ministry','cell')),
  scope_id        uuid,
  granted_by      uuid references auth.users(id) on delete set null,
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users(id) on delete set null,
  check ((scope_type = 'church' and scope_id is null) or (scope_type <> 'church' and scope_id is not null))
);
create index on public.user_role_assignments (user_id, organization_id) where revoked_at is null;
create unique index user_role_assignments_active_uniq
  on public.user_role_assignments (organization_id, user_id, role_id, scope_type,
     coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;

-- -----------------------------------------------------------------------------
-- Auditoria (append-only; escrita apenas por funções security definer)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id        uuid,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  metadata        jsonb not null default '{}'::jsonb,  -- nunca gravar dado sensível aqui
  created_at      timestamptz not null default now()
);
create index on public.audit_logs (organization_id, created_at desc);

create or replace function public.write_audit(
  p_org uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke all on function public.write_audit(uuid, text, text, uuid, jsonb) from public;
-- Supabase concede EXECUTE explícito a anon/authenticated; removemos para que só funções internas registrem auditoria.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.write_audit(uuid, text, text, uuid, jsonb) from anon, authenticated';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Funções de autorização (núcleo do modelo). SECURITY DEFINER para evitar
-- recursão de RLS; sempre baseadas em auth.uid() — nunca em parâmetro de usuário.
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active');
$$;

-- Permissão efetiva: membership ativa + grant não revogado com a permissão,
-- em escopo de igreja (cobre tudo) ou no escopo exato solicitado.
create or replace function public.has_permission(
  p_org uuid, p_permission text, p_scope_type text default 'church', p_scope_id uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_org) and exists (
    select 1
    from public.user_role_assignments a
    join public.role_permissions rp on rp.role_id = a.role_id
    where a.organization_id = p_org
      and a.user_id = auth.uid()
      and a.revoked_at is null
      and rp.permission_key = p_permission
      and (a.scope_type = 'church'
           or (a.scope_type = p_scope_type and a.scope_id = p_scope_id)));
$$;

-- Algum grant (em qualquer escopo) com a permissão — usado para exibir áreas de gestão.
create or replace function public.has_permission_anywhere(p_org uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_org) and exists (
    select 1 from public.user_role_assignments a
    join public.role_permissions rp on rp.role_id = a.role_id
    where a.organization_id = p_org and a.user_id = auth.uid()
      and a.revoked_at is null and rp.permission_key = p_permission);
$$;

create or replace function public.has_role(p_org uuid, p_role_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_org) and exists (
    select 1 from public.user_role_assignments a
    join public.role_definitions r on r.id = a.role_id
    where a.organization_id = p_org and a.user_id = auth.uid()
      and a.revoked_at is null and r.key = p_role_key and a.scope_type = 'church');
$$;

-- Usuários da mesma igreja enxergam perfil básico uns dos outros (nome/avatar).
create or replace function public.shares_org_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships me
    join public.organization_memberships other on other.organization_id = me.organization_id
    where me.user_id = auth.uid() and me.status = 'active'
      and other.user_id = p_user and other.status = 'active');
$$;

-- -----------------------------------------------------------------------------
-- Convites (token armazenado apenas como hash; expira; papel opcional)
-- -----------------------------------------------------------------------------
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash      text not null unique,
  role_id         uuid references public.role_definitions(id) on delete set null,
  scope_type      text not null default 'church' check (scope_type in ('church','congregation','ministry','cell')),
  scope_id        uuid,
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id) on delete set null,
  revoked_at      timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on public.invitations (organization_id);

-- -----------------------------------------------------------------------------
-- Concessão/revogação de papéis — único caminho de escrita em user_role_assignments.
-- Regras anti-escalada:
--  * exige church.manage_permissions no escopo igreja;
--  * papéis que contêm church.manage_permissions só podem ser concedidos por church_owner;
--  * não-owner não pode conceder papéis a si mesmo;
--  * o papel precisa ser do sistema ou da própria igreja; o alvo precisa ser membro ativo.
-- -----------------------------------------------------------------------------
create or replace function public.role_is_privileged(p_role uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.role_permissions
                 where role_id = p_role and permission_key = 'church.manage_permissions');
$$;

create or replace function public.grant_role(
  p_org uuid, p_user uuid, p_role uuid, p_scope_type text default 'church', p_scope_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_role public.role_definitions%rowtype;
begin
  if not public.has_permission(p_org, 'church.manage_permissions') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select * into v_role from public.role_definitions where id = p_role;
  if not found or (v_role.organization_id is not null and v_role.organization_id <> p_org) then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if public.role_is_privileged(p_role) and not public.has_role(p_org, 'church_owner') then
    raise exception 'permission_denied: privileged role' using errcode = '42501';
  end if;
  if p_user = auth.uid() and not public.has_role(p_org, 'church_owner') then
    raise exception 'permission_denied: self grant' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_memberships
                 where organization_id = p_org and user_id = p_user and status = 'active') then
    raise exception 'target_not_member' using errcode = '22023';
  end if;
  -- escopo precisa pertencer à mesma igreja (validação completa após criação das tabelas de escopo)
  if p_scope_type <> 'church' and not public.scope_belongs_to_org(p_org, p_scope_type, p_scope_id) then
    raise exception 'invalid_scope' using errcode = '22023';
  end if;

  insert into public.user_role_assignments (organization_id, user_id, role_id, scope_type, scope_id, granted_by)
  values (p_org, p_user, p_role, p_scope_type, case when p_scope_type = 'church' then null else p_scope_id end, auth.uid())
  on conflict do nothing
  returning id into v_id;

  perform public.write_audit(p_org, 'role.granted', 'user_role_assignment', v_id,
    jsonb_build_object('user_id', p_user, 'role_key', v_role.key, 'scope_type', p_scope_type, 'scope_id', p_scope_id));
  return v_id;
end $$;

create or replace function public.revoke_role(p_assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.user_role_assignments%rowtype;
begin
  select * into a from public.user_role_assignments where id = p_assignment and revoked_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.has_permission(a.organization_id, 'church.manage_permissions') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if public.role_is_privileged(a.role_id) and not public.has_role(a.organization_id, 'church_owner') then
    raise exception 'permission_denied: privileged role' using errcode = '42501';
  end if;
  -- impede a igreja de ficar sem owner
  if exists (select 1 from public.role_definitions where id = a.role_id and key = 'church_owner')
     and (select count(*) from public.user_role_assignments x
          join public.role_definitions r on r.id = x.role_id
          where x.organization_id = a.organization_id and r.key = 'church_owner' and x.revoked_at is null) <= 1 then
    raise exception 'last_owner' using errcode = '22023';
  end if;
  update public.user_role_assignments set revoked_at = now(), revoked_by = auth.uid() where id = p_assignment;
  perform public.write_audit(a.organization_id, 'role.revoked', 'user_role_assignment', a.id,
    jsonb_build_object('user_id', a.user_id, 'role_id', a.role_id));
end $$;

-- Placeholder sobrescrito na migration 0002 quando ministérios/células existirem.
create or replace function public.scope_belongs_to_org(p_org uuid, p_scope_type text, p_scope_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_scope_type = 'congregation' then
    return exists (select 1 from public.congregations where id = p_scope_id and organization_id = p_org);
  end if;
  return false;
end $$;

-- Convite: só quem gerencia membros cria; papel privilegiado exige owner.
create or replace function public.create_invitation(
  p_org uuid, p_email text, p_role uuid default null, p_scope_type text default 'church', p_scope_id uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text; v_id uuid;
begin
  if not public.has_permission(p_org, 'church.manage_members') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_role is not null then
    if not public.has_permission(p_org, 'church.manage_permissions') then
      raise exception 'permission_denied: role in invitation' using errcode = '42501';
    end if;
    if public.role_is_privileged(p_role) and not public.has_role(p_org, 'church_owner') then
      raise exception 'permission_denied: privileged role' using errcode = '42501';
    end if;
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.invitations (organization_id, email, token_hash, role_id, scope_type, scope_id, created_by)
  values (p_org, lower(trim(p_email)), encode(digest(v_token, 'sha256'), 'hex'), p_role, p_scope_type, p_scope_id, auth.uid())
  returning id into v_id;
  perform public.write_audit(p_org, 'invitation.created', 'invitation', v_id,
    jsonb_build_object('role_id', p_role));
  return v_token; -- exibido uma única vez para envio do link
end $$;

-- Aceite: o e-mail da conta precisa coincidir com o do convite.
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invitations%rowtype; v_email text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into inv from public.invitations
   where token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and accepted_at is null and revoked_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invalid_or_expired_invitation' using errcode = '22023'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from inv.email then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;

  insert into public.organization_memberships (organization_id, user_id, status)
  values (inv.organization_id, auth.uid(), 'active')
  on conflict (organization_id, user_id) do update set status = 'active';

  if inv.role_id is not null then
    insert into public.user_role_assignments (organization_id, user_id, role_id, scope_type, scope_id, granted_by)
    values (inv.organization_id, auth.uid(), inv.role_id, inv.scope_type,
            case when inv.scope_type = 'church' then null else inv.scope_id end, inv.created_by)
    on conflict do nothing;
  end if;

  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  perform public.write_audit(inv.organization_id, 'invitation.accepted', 'invitation', inv.id, '{}'::jsonb);
  return inv.organization_id;
end $$;

-- Remoção de membro: revoga grants e marca como removido (sessão perde acesso na próxima consulta).
create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(p_org, 'church.manage_members') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_role_assignments a join public.role_definitions r on r.id = a.role_id
             where a.organization_id = p_org and a.user_id = p_user and a.revoked_at is null
               and public.role_is_privileged(r.id))
     and not public.has_role(p_org, 'church_owner') then
    raise exception 'permission_denied: privileged member' using errcode = '42501';
  end if;
  update public.organization_memberships set status = 'removed' where organization_id = p_org and user_id = p_user;
  update public.user_role_assignments set revoked_at = now(), revoked_by = auth.uid()
   where organization_id = p_org and user_id = p_user and revoked_at is null;
  perform public.write_audit(p_org, 'member.removed', 'user', p_user, '{}'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.organizations            enable row level security;
alter table public.organization_branding    enable row level security;
alter table public.organization_modules     enable row level security;
alter table public.congregations            enable row level security;
alter table public.profiles                 enable row level security;
alter table public.platform_staff           enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.permission_definitions   enable row level security;
alter table public.role_definitions         enable row level security;
alter table public.role_permissions         enable row level security;
alter table public.user_role_assignments    enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.invitations              enable row level security;

create policy org_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy org_update on public.organizations for update to authenticated
  using (public.has_permission(id, 'church.manage_settings'))
  with check (public.has_permission(id, 'church.manage_settings'));

create policy branding_select on public.organization_branding for select to authenticated
  using (public.is_org_member(organization_id));
create policy branding_update on public.organization_branding for update to authenticated
  using (public.has_permission(organization_id, 'church.manage_settings'))
  with check (public.has_permission(organization_id, 'church.manage_settings'));

create policy modules_select on public.organization_modules for select to authenticated
  using (public.is_org_member(organization_id));
create policy modules_write on public.organization_modules for all to authenticated
  using (public.has_permission(organization_id, 'church.manage_settings'))
  with check (public.has_permission(organization_id, 'church.manage_settings'));

create policy congregations_select on public.congregations for select to authenticated
  using (public.is_org_member(organization_id));
create policy congregations_write on public.congregations for all to authenticated
  using (public.has_permission(organization_id, 'church.manage_settings'))
  with check (public.has_permission(organization_id, 'church.manage_settings'));

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy platform_staff_self on public.platform_staff for select to authenticated
  using (user_id = auth.uid());

create policy memberships_select on public.organization_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_permission(organization_id, 'church.view_members'));
create policy memberships_update on public.organization_memberships for update to authenticated
  using (public.has_permission(organization_id, 'church.manage_members'))
  with check (public.has_permission(organization_id, 'church.manage_members'));
create policy memberships_insert on public.organization_memberships for insert to authenticated
  with check (public.has_permission(organization_id, 'church.manage_members'));

create policy perm_defs_select on public.permission_definitions for select to authenticated using (true);

create policy role_defs_select on public.role_definitions for select to authenticated
  using (organization_id is null or public.is_org_member(organization_id));
create policy role_defs_write on public.role_definitions for all to authenticated
  using (organization_id is not null and public.has_role(organization_id, 'church_owner'))
  with check (organization_id is not null and public.has_role(organization_id, 'church_owner'));

create policy role_perms_select on public.role_permissions for select to authenticated using (
  exists (select 1 from public.role_definitions r where r.id = role_id
          and (r.organization_id is null or public.is_org_member(r.organization_id))));

-- Sem policy de insert/update/delete: escrita só via grant_role/revoke_role/accept_invitation.
create policy ura_select on public.user_role_assignments for select to authenticated
  using (user_id = auth.uid() or public.has_permission(organization_id, 'church.view_members'));

create policy audit_select on public.audit_logs for select to authenticated
  using (organization_id is not null and public.has_permission(organization_id, 'church.audit'));

create policy invitations_select on public.invitations for select to authenticated
  using (public.has_permission(organization_id, 'church.manage_members'));
create policy invitations_revoke on public.invitations for update to authenticated
  using (public.has_permission(organization_id, 'church.manage_members'))
  with check (public.has_permission(organization_id, 'church.manage_members'));

-- -----------------------------------------------------------------------------
-- Catálogo de permissões e papéis de sistema (aditivos e configuráveis)
-- -----------------------------------------------------------------------------
insert into public.permission_definitions (key, module, operation, description) values
  ('church.view_members',       'church', 'view',               'Ver diretório de membros'),
  ('church.manage_members',     'church', 'manage_members',     'Cadastrar, convidar e remover membros'),
  ('church.manage_permissions', 'church', 'manage_permissions', 'Conceder e revogar papéis'),
  ('church.manage_settings',    'church', 'update',             'Editar dados, marca e módulos da igreja'),
  ('church.view_sensitive',     'church', 'view_sensitive',     'Ver dados pessoais sensíveis'),
  ('church.audit',              'church', 'audit',              'Consultar trilha de auditoria'),
  ('ministries.create',         'ministries', 'create',         'Criar ministérios'),
  ('ministries.update',         'ministries', 'update',         'Editar ministério'),
  ('ministries.manage_members', 'ministries', 'manage_members', 'Gerenciar integrantes do ministério'),
  ('schedules.create',          'schedules', 'create',          'Criar escalas'),
  ('schedules.update',          'schedules', 'update',          'Editar escalas e designações'),
  ('schedules.delete',          'schedules', 'delete',          'Excluir escalas'),
  ('announcements.create',      'announcements', 'create',      'Criar rascunhos de avisos'),
  ('announcements.publish',     'announcements', 'publish',     'Publicar avisos para o público autorizado'),
  ('announcements.approve',     'announcements', 'approve',     'Aprovar avisos'),
  ('announcements.update',      'announcements', 'update',      'Editar avisos de terceiros'),
  ('events.create',             'events', 'create',             'Criar eventos'),
  ('events.update',             'events', 'update',             'Editar e cancelar eventos'),
  ('events.manage_registrations','events', 'manage_members',    'Ver e gerenciar inscrições'),
  ('cells.create',              'cells', 'create',              'Criar células'),
  ('cells.update',              'cells', 'update',              'Editar célula'),
  ('cells.manage_members',      'cells', 'manage_members',      'Gerenciar participantes da célula'),
  ('cells.manage_meetings',     'cells', 'update',              'Agendar encontros e registrar presença'),
  ('cells.view_sensitive',      'cells', 'view_sensitive',      'Ver endereço e dados restritos da célula'),
  ('finance.view',              'finance', 'view',              'Ver tesouraria (Etapa E)'),
  ('finance.manage',            'finance', 'manage_finance',    'Registrar lançamentos financeiros (Etapa E)');

do $$
declare
  r record;
  roles jsonb := '[
    {"key":"church_owner","name":"Responsável da igreja","scope":"church","perms":["church.view_members","church.manage_members","church.manage_permissions","church.manage_settings","church.view_sensitive","church.audit","ministries.create","ministries.update","ministries.manage_members","schedules.create","schedules.update","schedules.delete","announcements.create","announcements.publish","announcements.approve","announcements.update","events.create","events.update","events.manage_registrations","cells.create","cells.update","cells.manage_members","cells.manage_meetings","cells.view_sensitive"]},
    {"key":"church_admin","name":"Administrador","scope":"church","perms":["church.view_members","church.manage_members","church.manage_settings","church.audit","ministries.create","ministries.update","ministries.manage_members","schedules.create","schedules.update","announcements.create","announcements.publish","announcements.approve","announcements.update","events.create","events.update","events.manage_registrations","cells.create","cells.update","cells.manage_members","cells.manage_meetings"]},
    {"key":"pastor","name":"Pastor","scope":"church","perms":["church.view_members","announcements.create","announcements.publish","announcements.approve","events.create","events.update","events.manage_registrations","cells.view_sensitive"]},
    {"key":"secretary","name":"Secretaria","scope":"church","perms":["church.view_members","church.manage_members","church.view_sensitive","announcements.create","events.create","events.update","events.manage_registrations"]},
    {"key":"treasurer","name":"Tesouraria","scope":"church","perms":["finance.view","finance.manage"]},
    {"key":"ministry_leader","name":"Líder de ministério","scope":"ministry","perms":["ministries.update","ministries.manage_members","schedules.create","schedules.update","schedules.delete","announcements.create","announcements.publish","events.create","events.update","events.manage_registrations"]},
    {"key":"ministry_assistant","name":"Auxiliar de ministério","scope":"ministry","perms":["schedules.create","schedules.update","announcements.create"]},
    {"key":"cell_coordinator","name":"Coordenação de células","scope":"church","perms":["cells.create","cells.update","cells.manage_members","cells.manage_meetings","cells.view_sensitive","announcements.create","announcements.publish"]},
    {"key":"cell_supervisor","name":"Supervisor de célula","scope":"cell","perms":["cells.update","cells.manage_members","cells.manage_meetings","cells.view_sensitive","announcements.create","announcements.publish"]},
    {"key":"cell_leader","name":"Líder de célula","scope":"cell","perms":["cells.manage_members","cells.manage_meetings","cells.view_sensitive","announcements.create","announcements.publish"]},
    {"key":"volunteer","name":"Voluntário","scope":"ministry","perms":[]},
    {"key":"member","name":"Membro","scope":"church","perms":[]},
    {"key":"visitor","name":"Visitante","scope":"church","perms":[]}
  ]';
  v_id uuid;
  p text;
begin
  for r in select * from jsonb_array_elements(roles) as e(v) loop
    insert into public.role_definitions (organization_id, key, name, default_scope, is_system)
    values (null, r.v->>'key', r.v->>'name', r.v->>'scope', true)
    returning id into v_id;
    for p in select jsonb_array_elements_text(r.v->'perms') loop
      insert into public.role_permissions (role_id, permission_key) values (v_id, p);
    end loop;
  end loop;
end $$;
