-- =============================================================================
-- Kirche Core — 0003: células, participantes, encontros e presença
-- Endereço residencial fica em tabela separada com RLS própria (nunca público).
-- Liderança (líder, supervisor, coordenação) = grants em user_role_assignments
-- com escopo 'cell' ou 'church' — hierarquia configurável, não presumida.
-- =============================================================================

create table public.cells (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  congregation_id uuid references public.congregations(id) on delete set null,
  name            text not null check (length(name) between 2 and 80),
  region_label    text not null default '',          -- bairro/região genérica, visível para membros
  meeting_weekday smallint check (meeting_weekday between 0 and 6),
  meeting_time    time,
  description     text not null default '',
  status          text not null default 'active' check (status in ('active','paused','multiplied','closed')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);
create index on public.cells (organization_id);
create trigger trg_cells_updated before update on public.cells
  for each row execute function public.set_updated_at();

create table public.cell_private_details (
  cell_id         uuid primary key references public.cells(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  address         text not null default '',
  host_notes      text not null default '',
  updated_at      timestamptz not null default now()
);

create table public.cell_memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cell_id         uuid not null references public.cells(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            text not null default 'participant' check (kind in ('participant','visitor','host')),
  status          text not null default 'active' check (status in ('active','inactive')),
  created_at      timestamptz not null default now(),
  unique (cell_id, user_id)
);
create index on public.cell_memberships (user_id);

create table public.cell_meetings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cell_id         uuid not null references public.cells(id) on delete cascade,
  starts_at       timestamptz not null,
  topic           text not null default '',
  notes           text not null default '',              -- visível aos participantes; nada pastoral/sensível aqui
  status          text not null default 'scheduled' check (status in ('scheduled','held','cancelled')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on public.cell_meetings (cell_id, starts_at);

create table public.cell_attendance (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id      uuid not null references public.cell_meetings(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  guest_label     text,                                   -- visitante sem conta (apenas primeiro nome)
  present         boolean not null default true,
  recorded_by     uuid references auth.users(id) on delete set null,
  recorded_at     timestamptz not null default now(),
  check (user_id is not null or guest_label is not null)
);
-- NULLs são distintos: vários visitantes sem conta no mesmo encontro continuam permitidos.
alter table public.cell_attendance add constraint cell_attendance_member_uniq unique (meeting_id, user_id);

create or replace function public.is_cell_member(p_cell uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cell_memberships cm
    join public.organization_memberships om
      on om.organization_id = cm.organization_id and om.user_id = cm.user_id and om.status = 'active'
    where cm.cell_id = p_cell and cm.user_id = auth.uid() and cm.status = 'active');
$$;

create or replace function public.meeting_cell(p_meeting uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select cell_id from public.cell_meetings where id = p_meeting;
$$;

create or replace function public.check_cell_rows()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cell uuid;
begin
  if tg_table_name = 'cell_attendance' then
    select cell_id into v_cell from public.cell_meetings where id = new.meeting_id and organization_id = new.organization_id;
  else
    v_cell := new.cell_id;
  end if;
  if not exists (select 1 from public.cells where id = v_cell and organization_id = new.organization_id) then
    raise exception 'tenant_mismatch' using errcode = '22023';
  end if;
  if tg_table_name = 'cell_memberships' then
    if not exists (select 1 from public.organization_memberships
                   where organization_id = new.organization_id and user_id = new.user_id and status = 'active') then
      raise exception 'target_not_member' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger trg_cell_private_check before insert or update on public.cell_private_details
  for each row execute function public.check_cell_rows();
create trigger trg_cell_memberships_check before insert or update on public.cell_memberships
  for each row execute function public.check_cell_rows();
create trigger trg_cell_meetings_check before insert or update on public.cell_meetings
  for each row execute function public.check_cell_rows();
create trigger trg_cell_attendance_check before insert or update on public.cell_attendance
  for each row execute function public.check_cell_rows();

-- Escopos válidos para grants agora incluem ministério e célula.
create or replace function public.scope_belongs_to_org(p_org uuid, p_scope_type text, p_scope_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return case p_scope_type
    when 'congregation' then exists (select 1 from public.congregations where id = p_scope_id and organization_id = p_org)
    when 'ministry'     then exists (select 1 from public.ministries    where id = p_scope_id and organization_id = p_org)
    when 'cell'         then exists (select 1 from public.cells         where id = p_scope_id and organization_id = p_org)
    else false end;
end $$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.cells                enable row level security;
alter table public.cell_private_details enable row level security;
alter table public.cell_memberships     enable row level security;
alter table public.cell_meetings        enable row level security;
alter table public.cell_attendance      enable row level security;

-- Diretório básico (nome, região, dia/horário) visível a membros para "encontrar uma célula".
create policy cells_select on public.cells for select to authenticated
  using (public.is_org_member(organization_id));
create policy cells_insert on public.cells for insert to authenticated
  with check (public.has_permission(organization_id, 'cells.create') and created_by = auth.uid());
create policy cells_update on public.cells for update to authenticated
  using (public.has_permission(organization_id, 'cells.update', 'cell', id))
  with check (public.has_permission(organization_id, 'cells.update', 'cell', id));

create policy cell_private_select on public.cell_private_details for select to authenticated
  using (public.is_cell_member(cell_id)
      or public.has_permission(organization_id, 'cells.view_sensitive', 'cell', cell_id));
create policy cell_private_write on public.cell_private_details for all to authenticated
  using (public.has_permission(organization_id, 'cells.update', 'cell', cell_id))
  with check (public.has_permission(organization_id, 'cells.update', 'cell', cell_id));

create policy cm_select on public.cell_memberships for select to authenticated
  using (public.is_org_member(organization_id) and (
         user_id = auth.uid()
      or public.is_cell_member(cell_id)
      or public.has_permission(organization_id, 'cells.manage_members', 'cell', cell_id)));
create policy cm_write on public.cell_memberships for all to authenticated
  using (public.has_permission(organization_id, 'cells.manage_members', 'cell', cell_id))
  with check (public.has_permission(organization_id, 'cells.manage_members', 'cell', cell_id));

create policy meetings_select on public.cell_meetings for select to authenticated
  using (public.is_cell_member(cell_id)
      or public.has_permission(organization_id, 'cells.manage_meetings', 'cell', cell_id));
create policy meetings_write on public.cell_meetings for all to authenticated
  using (public.has_permission(organization_id, 'cells.manage_meetings', 'cell', cell_id))
  with check (public.has_permission(organization_id, 'cells.manage_meetings', 'cell', cell_id));

create policy attendance_select on public.cell_attendance for select to authenticated
  using ((user_id = auth.uid() and public.is_org_member(organization_id))
      or public.has_permission(organization_id, 'cells.manage_meetings', 'cell', public.meeting_cell(meeting_id)));
create policy attendance_write on public.cell_attendance for all to authenticated
  using (public.has_permission(organization_id, 'cells.manage_meetings', 'cell', public.meeting_cell(meeting_id)))
  with check (public.has_permission(organization_id, 'cells.manage_meetings', 'cell', public.meeting_cell(meeting_id)));
