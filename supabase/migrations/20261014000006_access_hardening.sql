-- Incremento 1: reduzir superfícies de escalada e exposição de dados pessoais.
-- A configuração do frontend não substitui estas garantias no banco.
begin;
drop policy invitations_revoke on public.invitations;
revoke update on public.invitations from anon, authenticated;
drop policy memberships_update on public.organization_memberships;
drop policy memberships_insert on public.organization_memberships;

-- RLS filtra linhas; privilégios por coluna limitam o perfil compartilhado.
revoke select on public.profiles from public, anon, authenticated;
grant select (id, full_name, display_name, avatar_url) on public.profiles to authenticated;
create or replace function public.get_my_profile()
returns table (id uuid, full_name text, display_name text, phone text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.display_name, p.phone from public.profiles p where p.id = auth.uid();
$$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

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
  if p_scope_type is null or p_scope_type not in ('church', 'congregation', 'ministry', 'cell')
     or (p_scope_type = 'church' and p_scope_id is not null)
     or (p_scope_type <> 'church' and (p_scope_id is null or not public.scope_belongs_to_org(p_org, p_scope_type, p_scope_id))) then
    raise exception 'invalid_scope' using errcode = '22023';
  end if;
  if p_role is not null and not exists (select 1 from public.role_definitions where id = p_role and (organization_id is null or organization_id = p_org)) then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.invitations (organization_id, email, token_hash, role_id, scope_type, scope_id, created_by)
  values (p_org, lower(trim(p_email)), encode(digest(v_token, 'sha256'), 'hex'), p_role, p_scope_type, p_scope_id, auth.uid())
  returning id into v_id;
  perform public.write_audit(p_org, 'invitation.created', 'invitation', v_id,
    jsonb_build_object('role_id', p_role));
  return v_token; -- exibido uma única vez para envio do link
end $$;

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

  if inv.scope_type is null or inv.scope_type not in ('church', 'congregation', 'ministry', 'cell')
     or (inv.scope_type = 'church' and inv.scope_id is not null)
     or (inv.scope_type <> 'church' and (inv.scope_id is null or not public.scope_belongs_to_org(inv.organization_id, inv.scope_type, inv.scope_id))) then
    raise exception 'invalid_scope' using errcode = '22023';
  end if;
  if inv.role_id is not null and not exists (select 1 from public.role_definitions where id = inv.role_id and (organization_id is null or organization_id = inv.organization_id)) then
    raise exception 'invalid_role' using errcode = '22023';
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

create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.organizations where id = p_org for update;
  if not public.has_permission(p_org, 'church.manage_members') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_role_assignments a join public.role_definitions r on r.id = a.role_id
             where a.organization_id = p_org and a.user_id = p_user and a.revoked_at is null
               and public.role_is_privileged(r.id))
     and not public.has_role(p_org, 'church_owner') then
    raise exception 'permission_denied: privileged member' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_role_assignments a join public.role_definitions r on r.id = a.role_id
      where a.organization_id = p_org and a.user_id = p_user and a.revoked_at is null and a.scope_type = 'church' and r.key = 'church_owner')
     and not exists (select 1 from public.user_role_assignments a join public.role_definitions r on r.id = a.role_id
      join public.organization_memberships m on m.organization_id = a.organization_id and m.user_id = a.user_id and m.status = 'active'
      where a.organization_id = p_org and a.user_id <> p_user and a.revoked_at is null and a.scope_type = 'church' and r.key = 'church_owner') then
    raise exception 'last_owner' using errcode = '22023';
  end if;
  update public.invitations set revoked_at = now()
    where organization_id = p_org and created_by = p_user and accepted_at is null and revoked_at is null;
  update public.organization_memberships set status = 'removed' where organization_id = p_org and user_id = p_user;
  update public.user_role_assignments set revoked_at = now(), revoked_by = auth.uid()
   where organization_id = p_org and user_id = p_user and revoked_at is null;
  perform public.write_audit(p_org, 'member.removed', 'user', p_user, '{}'::jsonb);
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
  perform 1 from public.organizations where id = a.organization_id for update;
  -- impede a igreja de ficar sem owner
  if exists (select 1 from public.role_definitions where id = a.role_id and key = 'church_owner')
     and (select count(*) from public.user_role_assignments x
          join public.role_definitions r on r.id = x.role_id
          join public.organization_memberships m on m.organization_id = x.organization_id and m.user_id = x.user_id and m.status = 'active'
          where x.organization_id = a.organization_id and r.key = 'church_owner' and x.scope_type = 'church' and x.revoked_at is null) <= 1 then
    raise exception 'last_owner' using errcode = '22023';
  end if;
  update public.user_role_assignments set revoked_at = now(), revoked_by = auth.uid() where id = p_assignment;
  perform public.write_audit(a.organization_id, 'role.revoked', 'user_role_assignment', a.id,
    jsonb_build_object('user_id', a.user_id, 'role_id', a.role_id));
end $$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.invitations%rowtype;
begin
  select * into inv from public.invitations where id = p_invitation for update;
  if not found or not public.has_permission(inv.organization_id, 'church.manage_members') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.invitations set revoked_at = now() where id = inv.id and accepted_at is null and revoked_at is null;
  perform public.write_audit(inv.organization_id, 'invitation.revoked', 'invitation', inv.id, '{}'::jsonb);
end $$;
revoke all on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;

drop function public.mark_notifications_read(uuid[]);
create function public.mark_notifications_read(p_org uuid, p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_org_member(p_org) then raise exception 'permission_denied' using errcode = '42501'; end if;
  update public.notifications set read_at = now()
    where organization_id = p_org and user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_notifications_read(uuid, uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid, uuid[]) to authenticated;

create or replace function public.event_registered_count(p_event uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare e public.events%rowtype;
begin
  select * into e from public.events where id = p_event;
  if not found or not public.is_org_member(e.organization_id)
     or not ((e.status <> 'draft' and public.in_audience(e.organization_id, e.audience_type, e.audience_id))
       or coalesce(e.created_by = auth.uid(), false) or public.has_permission(e.organization_id, 'events.manage_registrations')) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return (select count(*)::int from public.event_registrations where event_id = p_event and status = 'registered');
end $$;
revoke all on function public.event_registered_count(uuid) from public, anon;
grant execute on function public.event_registered_count(uuid) to authenticated;

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
      '/ministerios/' || s.ministry_id, 'schedule_assignment', a.id, 'declined:' || a.id || ':' || extract(epoch from now())::bigint);
  end if;
end $$;
update public.notifications set link = replace(link, '/gestao/ministerios/', '/ministerios/') where link like '/gestao/ministerios/%';
commit;
