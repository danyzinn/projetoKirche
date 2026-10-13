-- Fixtures sintéticas para testes (dados fictícios). Abrem uma transação que
-- cada arquivo *.test.sql encerra com ROLLBACK — testes independentes.
begin;

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'owner.a@teste.local'),
  ('10000000-0000-4000-8000-000000000002', 'membro.a@teste.local'),
  ('10000000-0000-4000-8000-000000000003', 'lider.louvor.a@teste.local'),
  ('10000000-0000-4000-8000-000000000004', 'lider.midia.a@teste.local'),
  ('10000000-0000-4000-8000-000000000005', 'lider.celula.a@teste.local'),
  ('10000000-0000-4000-8000-000000000006', 'tesoureiro.a@teste.local'),
  ('10000000-0000-4000-8000-000000000007', 'removido.a@teste.local'),
  ('10000000-0000-4000-8000-000000000008', 'admin.a@teste.local'),
  ('10000000-0000-4000-8000-000000000009', 'membro2.a@teste.local'),
  ('10000000-0000-4000-8000-000000000010', 'convidado@teste.local'),
  ('20000000-0000-4000-8000-000000000001', 'owner.b@teste.local'),
  ('20000000-0000-4000-8000-000000000002', 'membro.b@teste.local');

insert into public.organizations (id, slug, display_name, status, is_demo) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'igreja-a', 'Igreja A (teste)', 'demo', true),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'igreja-b', 'Igreja B (teste)', 'demo', true);

insert into public.organization_memberships (organization_id, user_id, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000008', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'active');

insert into public.ministries (id, organization_id, name, kind) values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Louvor', 'worship'),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Mídia', 'media'),
  ('a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'Segurança', 'security'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Louvor B', 'worship');

insert into public.ministry_memberships (organization_id, ministry_id, user_id, positions) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '{Ministro}'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '{Vocal}'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '{Projeção}'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009', '{Áudio}');

insert into public.cells (id, organization_id, name, region_label) values
  ('ce000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Célula Esperança', 'Região Norte'),
  ('ce000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Célula Vida', 'Região Sul'),
  ('ce000000-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000001', 'Célula B', 'Centro');
insert into public.cell_private_details (cell_id, organization_id, address) values
  ('ce000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Rua Fictícia, 1'),
  ('ce000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Rua Fictícia, 2');
insert into public.cell_memberships (organization_id, cell_id, user_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ce000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ce000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ce000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009');

-- grants
insert into public.user_role_assignments (organization_id, user_id, role_id, scope_type, scope_id)
select 'aaaaaaaa-0000-4000-8000-000000000001', u, (select id from public.role_definitions where key = r and organization_id is null), s, sid
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'church_owner',    'church',   null::uuid),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'ministry_leader', 'ministry', 'a1000000-0000-4000-8000-000000000001'::uuid),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'ministry_leader', 'ministry', 'a1000000-0000-4000-8000-000000000002'::uuid),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'cell_leader',     'cell',     'ce000000-0000-4000-8000-000000000001'::uuid),
  ('10000000-0000-4000-8000-000000000006'::uuid, 'treasurer',       'church',   null::uuid),
  ('10000000-0000-4000-8000-000000000007'::uuid, 'church_admin',    'church',   null::uuid),
  ('10000000-0000-4000-8000-000000000008'::uuid, 'church_admin',    'church',   null::uuid)
) as g(u, r, s, sid);

insert into public.user_role_assignments (organization_id, user_id, role_id, scope_type)
values ('bbbbbbbb-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
        (select id from public.role_definitions where key = 'church_owner' and organization_id is null), 'church');

insert into public.announcements (id, organization_id, title, body, status, published_at, author_id) values
  ('a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Aviso geral A', 'Corpo', 'draft', null, '10000000-0000-4000-8000-000000000001'),
  ('b2000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Aviso geral B', 'Corpo', 'draft', null, '20000000-0000-4000-8000-000000000001');
insert into public.announcement_audiences (announcement_id, organization_id, audience_type) values
  ('a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'church'),
  ('b2000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'church');
-- publicação direta como superusuário (bypass do guard via flag de sessão)
select set_config('kirche.publishing', 'on', true);
update public.announcements set status = 'published', published_at = now() - interval '1 hour';
select set_config('kirche.publishing', 'off', true);

insert into public.events (id, organization_id, title, starts_at, capacity, registration_enabled, created_by) values
  ('a3000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Conferência A', now() + interval '10 days', 1, true, '10000000-0000-4000-8000-000000000001'),
  ('b3000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Conferência B', now() + interval '10 days', null, true, '20000000-0000-4000-8000-000000000001');

set role authenticated;
