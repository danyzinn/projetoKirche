-- =============================================================================
-- Kirche Core — 0004: avisos segmentados (com leitura) e eventos (com inscrição)
-- =============================================================================

-- Pertence ao público-alvo? (avaliado sempre para auth.uid())
create or replace function public.in_audience(p_org uuid, p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_org) and case p_type
    when 'church'       then true
    when 'congregation' then exists (select 1 from public.organization_memberships
                                     where organization_id = p_org and user_id = auth.uid() and congregation_id = p_id)
    when 'ministry'     then public.is_ministry_member(p_id)
    when 'cell'         then public.is_cell_member(p_id)
    else false end;
$$;

-- -----------------------------------------------------------------------------
-- Avisos
-- -----------------------------------------------------------------------------
create table public.announcements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null check (length(title) between 3 and 140),
  body            text not null check (length(body) between 1 and 5000),
  status          text not null default 'draft' check (status in ('draft','published','archived')),
  published_at    timestamptz,             -- pode ser futuro = agendado
  notified_at     timestamptz,             -- fan-out in-app concluído
  author_id       uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index on public.announcements (organization_id, published_at desc);
create trigger trg_announcements_updated before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.announcement_audiences (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audience_type   text not null check (audience_type in ('church','congregation','ministry','cell')),
  audience_id     uuid,
  check ((audience_type = 'church' and audience_id is null) or (audience_type <> 'church' and audience_id is not null)),
  unique (announcement_id, audience_type, audience_id)
);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create or replace function public.check_audience_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.announcements where id = new.announcement_id and organization_id = new.organization_id) then
    raise exception 'tenant_mismatch' using errcode = '22023';
  end if;
  if new.audience_type <> 'church' and not public.scope_belongs_to_org(new.organization_id, new.audience_type, new.audience_id) then
    raise exception 'invalid_audience' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger trg_audience_check before insert or update on public.announcement_audiences
  for each row execute function public.check_audience_row();

create or replace function public.can_view_announcement(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.announcements a
    where a.id = p_id and public.is_org_member(a.organization_id) and (
          a.author_id = auth.uid()
       or public.has_permission(a.organization_id, 'announcements.update')
       or (a.status = 'published' and a.published_at <= now() and exists (
             select 1 from public.announcement_audiences au
             where au.announcement_id = a.id and public.in_audience(a.organization_id, au.audience_type, au.audience_id)))));
$$;

create or replace function public.can_publish_to(p_org uuid, p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_type = 'church' then public.has_permission(p_org, 'announcements.publish')
              else public.has_permission(p_org, 'announcements.publish', p_type, p_id) end;
$$;

create or replace function public.fanout_announcement(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare a public.announcements%rowtype; n int := 0; u uuid;
begin
  select * into a from public.announcements where id = p_id;
  for u in
    select distinct om.user_id
    from public.announcement_audiences au
    join public.organization_memberships om on om.organization_id = a.organization_id and om.status = 'active'
    where au.announcement_id = p_id and (
          au.audience_type = 'church'
       or (au.audience_type = 'congregation' and om.congregation_id = au.audience_id)
       or (au.audience_type = 'ministry' and exists (select 1 from public.ministry_memberships mm
             where mm.ministry_id = au.audience_id and mm.user_id = om.user_id and mm.status = 'active'))
       or (au.audience_type = 'cell' and exists (select 1 from public.cell_memberships cm
             where cm.cell_id = au.audience_id and cm.user_id = om.user_id and cm.status = 'active')))
  loop
    perform public.notify_user(a.organization_id, u, 'announcement', a.title, left(a.body, 160),
      '/avisos/' || a.id, 'announcement', a.id, 'announcement:' || a.id);
    n := n + 1;
  end loop;
  update public.announcements set notified_at = now() where id = p_id;
  return n;
end $$;
revoke all on function public.fanout_announcement(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.fanout_announcement(uuid) from anon, authenticated';
  end if;
end $$;

-- Publica (ou agenda) um aviso. Exige permissão de publicação em CADA público.
create or replace function public.publish_announcement(p_id uuid, p_publish_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.announcements%rowtype; au record; v_count int := 0;
begin
  select * into a from public.announcements where id = p_id for update;
  if not found or not public.can_view_announcement(p_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if a.status <> 'draft' then raise exception 'not_a_draft' using errcode = '22023'; end if;
  if a.author_id <> auth.uid() and not public.has_permission(a.organization_id, 'announcements.update') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  for au in select * from public.announcement_audiences where announcement_id = p_id loop
    v_count := v_count + 1;
    if not public.can_publish_to(a.organization_id, au.audience_type, au.audience_id) then
      raise exception 'permission_denied: audience %', au.audience_type using errcode = '42501';
    end if;
  end loop;
  if v_count = 0 then raise exception 'audience_required' using errcode = '22023'; end if;

  perform set_config('kirche.publishing', 'on', true);
  update public.announcements set status = 'published', published_at = coalesce(p_publish_at, now()) where id = p_id;
  perform set_config('kirche.publishing', 'off', true);
  perform public.write_audit(a.organization_id, 'announcement.published', 'announcement', p_id,
    jsonb_build_object('scheduled_for', p_publish_at));
  if p_publish_at is null or p_publish_at <= now() then
    perform public.fanout_announcement(p_id);
  end if;
end $$;

-- Para pg_cron / Edge Function agendada (service_role): notifica avisos agendados que venceram.
create or replace function public.publish_due_announcements()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.announcements
           where status = 'published' and notified_at is null and published_at <= now() loop
    perform public.fanout_announcement(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.publish_due_announcements() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.publish_due_announcements() from anon, authenticated';
  end if;
end $$;

-- Bloqueia publicação fora do fluxo e audita edição pós-publicação.
create or replace function public.guard_announcement_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id <> old.organization_id or new.author_id is distinct from old.author_id then
    raise exception 'immutable_fields' using errcode = '42501';
  end if;
  if new.status = 'published' and old.status <> 'published'
     and coalesce(current_setting('kirche.publishing', true), 'off') <> 'on' then
    raise exception 'use publish_announcement()' using errcode = '42501';
  end if;
  if old.status = 'published' and (new.title <> old.title or new.body <> old.body) then
    perform public.write_audit(old.organization_id, 'announcement.edited_after_publish', 'announcement', old.id,
      jsonb_build_object('title_changed', new.title <> old.title, 'body_changed', new.body <> old.body));
  end if;
  return new;
end $$;
create trigger trg_announcements_guard before update on public.announcements
  for each row execute function public.guard_announcement_update();

create or replace function public.mark_announcement_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_view_announcement(p_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.announcement_reads (announcement_id, user_id) values (p_id, auth.uid()) on conflict do nothing;
end $$;

-- Contagem agregada de leituras (sem expor quem leu) para autor/gestão.
create or replace function public.announcement_read_count(p_id uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare a public.announcements%rowtype;
begin
  select * into a from public.announcements where id = p_id;
  if not found or not (a.author_id = auth.uid() or public.has_permission(a.organization_id, 'announcements.update')) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return (select count(*) from public.announcement_reads where announcement_id = p_id);
end $$;

alter table public.announcements          enable row level security;
alter table public.announcement_audiences enable row level security;
alter table public.announcement_reads     enable row level security;

create policy ann_select on public.announcements for select to authenticated
  using (public.can_view_announcement(id));
create policy ann_insert on public.announcements for insert to authenticated
  with check (public.has_permission_anywhere(organization_id, 'announcements.create')
              and author_id = auth.uid() and status = 'draft');
create policy ann_update on public.announcements for update to authenticated
  using ((author_id = auth.uid() and status = 'draft' and public.is_org_member(organization_id))
         or public.has_permission(organization_id, 'announcements.update'))
  with check ((author_id = auth.uid() and status in ('draft','archived') and public.is_org_member(organization_id))
              or public.has_permission(organization_id, 'announcements.update'));
create policy ann_delete on public.announcements for delete to authenticated
  using ((author_id = auth.uid() and status = 'draft') or public.has_permission(organization_id, 'announcements.update'));

create policy aud_select on public.announcement_audiences for select to authenticated
  using (public.can_view_announcement(announcement_id));
create policy aud_write on public.announcement_audiences for all to authenticated
  using (exists (select 1 from public.announcements a where a.id = announcement_id and a.status = 'draft'
                 and (a.author_id = auth.uid() or public.has_permission(a.organization_id, 'announcements.update'))))
  with check (exists (select 1 from public.announcements a where a.id = announcement_id and a.status = 'draft'
                 and (a.author_id = auth.uid() or public.has_permission(a.organization_id, 'announcements.update'))));

create policy reads_select_own on public.announcement_reads for select to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Eventos e inscrições
-- -----------------------------------------------------------------------------
create table public.events (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  title                text not null check (length(title) between 3 and 140),
  description          text not null default '',
  location_label       text not null default '',
  starts_at            timestamptz not null,
  ends_at              timestamptz,
  audience_type        text not null default 'church' check (audience_type in ('church','congregation','ministry','cell')),
  audience_id          uuid,
  capacity             int check (capacity is null or capacity > 0),
  registration_enabled boolean not null default false,
  status               text not null default 'published' check (status in ('draft','published','cancelled')),
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check ((audience_type = 'church' and audience_id is null) or (audience_type <> 'church' and audience_id is not null))
);
create index on public.events (organization_id, starts_at);
create trigger trg_events_updated before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_registrations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id        uuid not null references public.events(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'registered' check (status in ('registered','cancelled')),
  checked_in_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (event_id, user_id)
);
create trigger trg_event_regs_updated before update on public.event_registrations
  for each row execute function public.set_updated_at();

create or replace function public.can_manage_event(p_org uuid, p_perm text, p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_type = 'church' then public.has_permission(p_org, p_perm)
              else public.has_permission(p_org, p_perm, p_type, p_id) end;
$$;

create or replace function public.check_event_audience()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.audience_type <> 'church' and not public.scope_belongs_to_org(new.organization_id, new.audience_type, new.audience_id) then
    raise exception 'invalid_audience' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'immutable_fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_events_audience before insert or update on public.events
  for each row execute function public.check_event_audience();

create or replace function public.event_registered_count(p_event uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.event_registrations where event_id = p_event and status = 'registered';
$$;

create or replace function public.register_for_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype;
begin
  select * into e from public.events where id = p_event for update;  -- serializa controle de vagas
  if not found or not public.in_audience(e.organization_id, e.audience_type, e.audience_id) or e.status <> 'published' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not e.registration_enabled then raise exception 'registration_closed' using errcode = '22023'; end if;
  if e.starts_at < now() then raise exception 'event_started' using errcode = '22023'; end if;
  if e.capacity is not null and public.event_registered_count(p_event) >= e.capacity
     and not exists (select 1 from public.event_registrations where event_id = p_event and user_id = auth.uid() and status = 'registered') then
    raise exception 'event_full' using errcode = '22023';
  end if;
  insert into public.event_registrations (organization_id, event_id, user_id)
  values (e.organization_id, p_event, auth.uid())
  on conflict (event_id, user_id) do update set status = 'registered';
end $$;

create or replace function public.cancel_event_registration(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.event_registrations set status = 'cancelled'
   where event_id = p_event and user_id = auth.uid() and status = 'registered';
end $$;

create or replace function public.notify_event_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    for r in select user_id from public.event_registrations where event_id = new.id and status = 'registered' loop
      perform public.notify_user(new.organization_id, r.user_id, 'event', 'Evento cancelado: ' || new.title,
        'O evento em que você estava inscrito(a) foi cancelado.', '/eventos/' || new.id, 'event', new.id,
        'event_cancelled:' || new.id);
    end loop;
    perform public.write_audit(new.organization_id, 'event.cancelled', 'event', new.id, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger trg_events_cancelled after update on public.events
  for each row execute function public.notify_event_cancelled();

alter table public.events              enable row level security;
alter table public.event_registrations enable row level security;

create policy events_select on public.events for select to authenticated
  using (public.is_org_member(organization_id) and (
         (status <> 'draft' and public.in_audience(organization_id, audience_type, audience_id))
      or created_by = auth.uid()
      or public.can_manage_event(organization_id, 'events.update', audience_type, audience_id)));
create policy events_insert on public.events for insert to authenticated
  with check (public.can_manage_event(organization_id, 'events.create', audience_type, audience_id)
              and created_by = auth.uid());
create policy events_update on public.events for update to authenticated
  using (public.can_manage_event(organization_id, 'events.update', audience_type, audience_id))
  with check (public.can_manage_event(organization_id, 'events.update', audience_type, audience_id));

create or replace function public.event_scope(p_event uuid, out org uuid, out a_type text, out a_id uuid)
language sql stable security definer set search_path = public as $$
  select organization_id, audience_type, audience_id from public.events where id = p_event;
$$;

-- Inscrições: a própria pessoa ou gestão do evento. Escrita só por RPC.
create policy regs_select on public.event_registrations for select to authenticated
  using ((user_id = auth.uid() and public.is_org_member(organization_id))
      or exists (select 1 from public.event_scope(event_id) s
                 where public.can_manage_event(s.org, 'events.manage_registrations', s.a_type, s.a_id)));
