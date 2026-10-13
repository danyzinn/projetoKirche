-- =============================================================================
-- SEED DE DEMONSTRAÇÃO — SOMENTE AMBIENTE LOCAL DE DESENVOLVIMENTO
-- Todos os dados são FICTÍCIOS. Não há endereço, horário de culto, nome de
-- membro ou dado financeiro reais da IBV Nova. Nunca execute em produção.
-- Senha local: demo-local-123 (apenas `supabase start`).
-- Para apagar antes do piloto, veja README → "Removendo dados de demonstração".
-- =============================================================================
-- Idempotente: pode ser executado mais de uma vez.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
                        email_change_token_new, email_change, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('demo-local-123', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), '', '', '', '', now(), now()
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'demo.membro@kirche.local',  'Ana Demonstração'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'demo.lider@kirche.local',   'Bruno Exemplo'),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'demo.admin@kirche.local',   'Carla Fictícia'),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'demo.celula@kirche.local',  'Davi Teste')
) as u(id, email, name)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u where u.email like 'demo.%@kirche.local'
on conflict do nothing;

insert into public.organizations (id, slug, display_name, status, is_demo)
values ('d1000000-0000-4000-8000-000000000001', 'ibv-nova-demo', 'IBV Nova', 'demo', true)
on conflict do nothing;

insert into public.organization_branding (organization_id, app_name, theme_tokens)
values ('d1000000-0000-4000-8000-000000000001', 'IBV Nova',
        '{"primary":"#B51227","primaryHover":"#920F20","primarySoft":"#FCE9ED"}')
on conflict do nothing;

insert into public.organization_modules (organization_id, module_key, enabled)
select 'd1000000-0000-4000-8000-000000000001', m, true
from unnest(array['announcements','events','ministries','schedules','cells','notifications']) m
on conflict do nothing;

insert into public.organization_memberships (organization_id, user_id)
select 'd1000000-0000-4000-8000-000000000001', id from auth.users where email like 'demo.%@kirche.local'
on conflict do nothing;

insert into public.ministries (id, organization_id, name, kind, description)
select ('d2000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'd1000000-0000-4000-8000-000000000001', name, kind, '(DEMO) Descrição editável'
from (values
  (1,'Louvor','worship'), (2,'Mídia','media'), (3,'Layout','layout'), (4,'Recepção','reception'),
  (5,'Escola Bíblica Dominical','teaching'), (6,'Infantil','children'), (7,'Jovens','youth'),
  (8,'Ação Social','social'), (9,'Intercessão Homens','intercession_men'),
  (10,'Intercessão Mulheres','intercession_women'), (11,'Segurança','security')
) as m(n, name, kind)
on conflict do nothing;

insert into public.ministry_memberships (organization_id, ministry_id, user_id, positions) values
  ('d1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', '{Ministro,Violão}'),
  ('d1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '{Vocal}')
on conflict do nothing;

insert into public.cells (id, organization_id, name, region_label, meeting_weekday, meeting_time, description) values
  ('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Célula Esperança (DEMO)', 'Região Norte', 3, '20:00', 'Célula fictícia para demonstração'),
  ('d3000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'Célula Vida (DEMO)', 'Região Sul', 4, '19:30', 'Célula fictícia para demonstração')
on conflict do nothing;
insert into public.cell_private_details (cell_id, organization_id, address) values
  ('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Endereço fictício — não usar'),
  ('d3000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'Endereço fictício — não usar')
on conflict do nothing;
insert into public.cell_memberships (organization_id, cell_id, user_id) values
  ('d1000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001'),
  ('d1000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004')
on conflict do nothing;

insert into public.user_role_assignments (organization_id, user_id, role_id, scope_type, scope_id)
select 'd1000000-0000-4000-8000-000000000001', g.u, r.id, g.s, g.sid
from (values
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'church_owner',    'church',   null::uuid),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'ministry_leader', 'ministry', 'd2000000-0000-4000-8000-000000000001'::uuid),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'cell_leader',     'cell',     'd3000000-0000-4000-8000-000000000001'::uuid)
) as g(u, k, s, sid)
join public.role_definitions r on r.key = g.k and r.organization_id is null
on conflict do nothing;

insert into public.announcements (id, organization_id, title, body, author_id) values
  ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001',
   'Bem-vindo ao app da IBV Nova (DEMO)', 'Este é um aviso de demonstração. Conteúdo fictício e editável.', 'd0000000-0000-4000-8000-000000000003')
on conflict do nothing;
insert into public.announcement_audiences (announcement_id, organization_id, audience_type)
values ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'church')
on conflict do nothing;
select set_config('kirche.publishing', 'on', false);
update public.announcements set status = 'published', published_at = now(), notified_at = now()
 where id = 'd4000000-0000-4000-8000-000000000001' and status = 'draft';
select set_config('kirche.publishing', 'off', false);

insert into public.events (organization_id, title, description, location_label, starts_at, capacity, registration_enabled, created_by)
select 'd1000000-0000-4000-8000-000000000001', t, 'Evento fictício.', 'Local a definir', now() + d, c, true, 'd0000000-0000-4000-8000-000000000003'
from (values ('Encontro de Jovens (DEMO)', interval '12 days', 80), ('Treinamento de Voluntários (DEMO)', interval '20 days', null::int)) as e(t, d, c)
where not exists (select 1 from public.events where organization_id = 'd1000000-0000-4000-8000-000000000001' and title = e.t);
