-- =============================================================================
-- Kirche Core — 0005: busca mínima de pessoas para líderes
-- Líderes de ministério/célula precisam adicionar pessoas sem acessar o
-- diretório completo (church.view_members). Retorna só id + nome, máx. 20.
-- =============================================================================
create or replace function public.search_members(p_org uuid, p_query text)
returns table (user_id uuid, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_permission_anywhere(p_org, 'ministries.manage_members')
          or public.has_permission_anywhere(p_org, 'cells.manage_members')
          or public.has_permission(p_org, 'church.view_members')) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_query, ''))) < 2 then
    return;
  end if;
  return query
    select p.id, coalesce(nullif(p.display_name, ''), p.full_name)
    from public.organization_memberships m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org and m.status = 'active'
      and (p.full_name ilike '%' || trim(p_query) || '%' or p.display_name ilike '%' || trim(p_query) || '%')
    order by 2
    limit 20;
end $$;
