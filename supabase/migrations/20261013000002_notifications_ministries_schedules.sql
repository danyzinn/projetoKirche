-- =============================================================================
-- Kirche Core — 0002: notificações in-app, ministérios, integrantes e escalas
-- Escalas são um serviço transversal: qualquer ministério (louvor, mídia,
-- recepção, segurança...) usa as mesmas tabelas — sem lógica duplicada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Notificações in-app + outbox para canais complementares (push/e-mail futuros)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  category        text not null check (category in ('announcement','schedule','event','cell','system')),
  title           text not null,
  body            text not null default '',
  link            text,                         -- rota interna, ex.: /avisos/<id>
  entity_type     text,
  entity_id       uuid,
  dedupe_key      text not null,                -- idempotência: um aviso não notifica a mesma pessoa duas vezes
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on public.notifications (user_id, organization_id, created_at desc);

create table public.notification_preferences (
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category        text not null check (category in ('announcement','schedule','event','cell','system')),
  push_enabled    boolean not null default false,  -- opt-in explícito
  email_enabled   boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (user_id, organization_id, category)
);

-- Fila para entrega por canais externos. Nenhum worker está ativo nesta etapa
-- (push/e-mail PENDENTES); a central in-app é a fonte da verdade.
create table public.notification_outbox (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel         text not null check (channel in ('web_push','expo_push','email')),
  status          text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  unique (notification_id, channel)
);

create or replace function public.notify_user(
  p_org uuid, p_user uuid, p_category text, p_title text, p_body text,
  p_link text, p_entity_type text, p_entity_id uuid, p_dedupe_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.notifications (organization_id, user_id, category, title, body, link, entity_type, entity_id, dedupe_key)
  values (p_org, p_user, p_category, p_title, coalesce(p_body, ''), p_link, p_entity_type, p_entity_id, p_dedupe_key)
  on conflict (user_id, dedupe_key) do nothing
  returning id into v_id;
  if v_id is not null and exists (
       select 1 from public.notification_preferences
       where user_id = p_user and organization_id = p_org and category = p_category and push_enabled) then
    insert into public.notification_outbox (notification_id, channel) values (v_id, 'web_push')
    on conflict do nothing;
  end if;
end $$;
revoke all on function public.notify_user(uuid, uuid, text, text, text, text, text, uuid, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.notify_user(uuid, uuid, text, text, text, text, text, uuid, text) from anon, authenticated';
  end if;
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_outbox      enable row level security;  -- sem policies: só service_role/worker

create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.is_org_member(organization_id));
create policy notif_prefs_own on public.notification_preferences for all to authenticated
  using (user_id = auth.uid() and public.is_org_member(organization_id))
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- Ministérios e integrantes
-- -----------------------------------------------------------------------------
create table public.ministries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  congregation_id uuid references public.congregations(id) on delete set null,
  name            text not null check (length(name) between 2 and 80),
  kind            text not null default 'other' check (kind in (
                    'worship','media','layout','reception','teaching','children','youth',
                    'social','intercession_men','intercession_women','security','other')),
  description     text not null default '',
  is_active       boolean not null default true,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);
create index on public.ministries (organization_id);
create trigger trg_ministries_updated before update on public.ministries
  for each row execute function public.set_updated_at();

create table public.ministry_memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ministry_id     uuid not null references public.ministries(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  positions       text[] not null default '{}',   -- ex.: {Vocal, Teclado}
  status          text not null default 'active' check (status in ('active','inactive')),
  created_at      timestamptz not null default now(),
  unique (ministry_id, user_id)
);
create index on public.ministry_memberships (user_id);

create or replace function public.is_ministry_member(p_ministry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ministry_memberships mm
    join public.organization_memberships om
      on om.organization_id = mm.organization_id and om.user_id = mm.user_id and om.status = 'active'
    where mm.ministry_id = p_ministry and mm.user_id = auth.uid() and mm.status = 'active');
$$;

-- Garante consistência de tenant: linha filha precisa ter o mesmo organization_id do pai
-- e o usuário alvo precisa ser membro ativo da igreja.
create or replace function public.check_ministry_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ministries where id = new.ministry_id and organization_id = new.organization_id) then
    raise exception 'tenant_mismatch' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organization_memberships
                 where organization_id = new.organization_id and user_id = new.user_id and status = 'active') then
    raise exception 'target_not_member' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger trg_ministry_membership_check before insert or update on public.ministry_memberships
  for each row execute function public.check_ministry_membership();

-- -----------------------------------------------------------------------------
-- Escalas (serviço compartilhado)
-- -----------------------------------------------------------------------------
create table public.schedules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ministry_id     uuid not null references public.ministries(id) on delete cascade,
  title           text not null check (length(title) between 2 and 120),
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  notes           text not null default '',
  status          text not null default 'draft' check (status in ('draft','published','cancelled')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index on public.schedules (ministry_id, starts_at);
create trigger trg_schedules_updated before update on public.schedules
  for each row execute function public.set_updated_at();

create table public.schedule_assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id     uuid not null references public.schedules(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  position        text not null default '',
  status          text not null default 'pending' check (status in ('pending','confirmed','declined')),
  decline_reason  text,
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (schedule_id, user_id, position)
);
create index on public.schedule_assignments (user_id, status);

create or replace function public.check_schedule_rows()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ministry uuid;
begin
  if tg_table_name = 'schedules' then
    if not exists (select 1 from public.ministries where id = new.ministry_id and organization_id = new.organization_id) then
      raise exception 'tenant_mismatch' using errcode = '22023';
    end if;
  else
    select ministry_id into v_ministry from public.schedules
     where id = new.schedule_id and organization_id = new.organization_id;
    if v_ministry is null then raise exception 'tenant_mismatch' using errcode = '22023'; end if;
    if not exists (select 1 from public.ministry_memberships
                   where ministry_id = v_ministry and user_id = new.user_id and status = 'active') then
      raise exception 'assignee_not_in_ministry' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger trg_schedules_check before insert or update on public.schedules
  for each row execute function public.check_schedule_rows();
create trigger trg_schedule_assignments_check before insert or update on public.schedule_assignments
  for each row execute function public.check_schedule_rows();

-- Notifica escalado quando a escala está publicada (na publicação ou em inclusão posterior).
create or replace function public.notify_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.schedules%rowtype;
begin
  select * into s from public.schedules where id = new.schedule_id;
  if s.status = 'published' then
    perform public.notify_user(s.organization_id, new.user_id, 'schedule',
      'Você foi escalado(a): ' || s.title, 'Confirme sua participação.',
      '/escalas', 'schedule_assignment', new.id, 'assignment:' || new.id);
  end if;
  return new;
end $$;
create trigger trg_notify_assignment after insert on public.schedule_assignments
  for each row execute function public.notify_assignment();

create or replace function public.publish_schedule(p_schedule uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.schedules%rowtype; a record;
begin
  select * into s from public.schedules where id = p_schedule for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.has_permission(s.organization_id, 'schedules.update', 'ministry', s.ministry_id) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.schedules set status = 'published' where id = p_schedule;
  for a in select id, user_id from public.schedule_assignments where schedule_id = p_schedule loop
    perform public.notify_user(s.organization_id, a.user_id, 'schedule',
      'Você foi escalado(a): ' || s.title, 'Confirme sua participação.',
      '/escalas', 'schedule_assignment', a.id, 'assignment:' || a.id);
  end loop;
  perform public.write_audit(s.organization_id, 'schedule.published', 'schedule', s.id, '{}'::jsonb);
end $$;

-- Voluntário responde somente à PRÓPRIA designação.
create or replace function public.respond_to_assignment(p_assignment uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.schedule_assignments%rowtype; s public.schedules%rowtype;
begin
  if p_status not in ('confirmed','declined') then raise exception 'invalid_status' using errcode = '22023'; end if;
  select * into a from public.schedule_assignments where id = p_assignment for update;
  if not found or a.user_id <> auth.uid() or not public.is_org_member(a.organization_id) then
    raise exception 'not_found' using errcode = 'P0002';  -- não revela existência (anti-IDOR)
  end if;
  select * into s from public.schedules where id = a.schedule_id;
  if s.status <> 'published' then raise exception 'schedule_not_published' using errcode = '22023'; end if;
  update public.schedule_assignments
     set status = p_status, responded_at = now(),
         decline_reason = case when p_status = 'declined' then left(p_reason, 280) else null end
   where id = p_assignment;
  if p_status = 'declined' and s.created_by is not null then
    perform public.notify_user(s.organization_id, s.created_by, 'schedule',
      'Recusa na escala: ' || s.title, 'Um integrante não poderá servir. Avalie substituição.',
      '/gestao/ministerios/' || s.ministry_id, 'schedule_assignment', a.id, 'declined:' || a.id || ':' || extract(epoch from now())::bigint);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- RLS — ministérios e escalas
-- -----------------------------------------------------------------------------
alter table public.ministries           enable row level security;
alter table public.ministry_memberships enable row level security;
alter table public.schedules            enable row level security;
alter table public.schedule_assignments enable row level security;

create policy ministries_select on public.ministries for select to authenticated
  using (public.is_org_member(organization_id));
create policy ministries_insert on public.ministries for insert to authenticated
  with check (public.has_permission(organization_id, 'ministries.create'));
create policy ministries_update on public.ministries for update to authenticated
  using (public.has_permission(organization_id, 'ministries.update', 'ministry', id))
  with check (public.has_permission(organization_id, 'ministries.update', 'ministry', id));

create policy mm_select on public.ministry_memberships for select to authenticated
  using (public.is_org_member(organization_id) and (
         user_id = auth.uid()
      or public.is_ministry_member(ministry_id)
      or public.has_permission(organization_id, 'ministries.manage_members', 'ministry', ministry_id)));
create policy mm_write on public.ministry_memberships for all to authenticated
  using (public.has_permission(organization_id, 'ministries.manage_members', 'ministry', ministry_id))
  with check (public.has_permission(organization_id, 'ministries.manage_members', 'ministry', ministry_id));

create policy schedules_select on public.schedules for select to authenticated
  using (public.is_org_member(organization_id) and (
         (status <> 'draft' and public.is_ministry_member(ministry_id))
      or public.has_permission(organization_id, 'schedules.update', 'ministry', ministry_id)
      or public.has_permission(organization_id, 'schedules.create', 'ministry', ministry_id)));
create policy schedules_insert on public.schedules for insert to authenticated
  with check (public.has_permission(organization_id, 'schedules.create', 'ministry', ministry_id)
              and created_by = auth.uid());
create policy schedules_update on public.schedules for update to authenticated
  using (public.has_permission(organization_id, 'schedules.update', 'ministry', ministry_id))
  with check (public.has_permission(organization_id, 'schedules.update', 'ministry', ministry_id));
create policy schedules_delete on public.schedules for delete to authenticated
  using (public.has_permission(organization_id, 'schedules.delete', 'ministry', ministry_id));

create or replace function public.schedule_ministry(p_schedule uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select ministry_id from public.schedules where id = p_schedule;
$$;
create or replace function public.schedule_is_visible(p_schedule uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.schedules s where s.id = p_schedule and s.status <> 'draft'
                 and public.is_ministry_member(s.ministry_id));
$$;

create policy sa_select on public.schedule_assignments for select to authenticated
  using (public.is_org_member(organization_id) and (
         user_id = auth.uid()
      or public.schedule_is_visible(schedule_id)
      or public.has_permission(organization_id, 'schedules.update', 'ministry', public.schedule_ministry(schedule_id))));
create policy sa_write on public.schedule_assignments for all to authenticated
  using (public.has_permission(organization_id, 'schedules.update', 'ministry', public.schedule_ministry(schedule_id)))
  with check (public.has_permission(organization_id, 'schedules.update', 'ministry', public.schedule_ministry(schedule_id)));
