-- Usuário da Igreja B não acessa nada da Igreja A (e vice-versa).
select tests.login('20000000-0000-4000-8000-000000000002'); -- membro B

select tests.eq(tests.count($$select 1 from organizations where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$), 0, 'B não vê organização A');
select tests.eq(tests.count($$select 1 from organizations$$), 1, 'B vê apenas a própria organização');
select tests.eq(tests.count($$select 1 from ministries where organization_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$), 0, 'B não vê ministérios de A');
select tests.eq(tests.count($$select 1 from announcements where organization_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$), 0, 'B não vê avisos de A');
select tests.eq(tests.count($$select 1 from events where organization_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$), 0, 'B não vê eventos de A');
select tests.eq(tests.count($$select 1 from cells where organization_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$), 0, 'B não vê células de A');
select tests.eq(tests.count($$select 1 from cell_private_details$$), 0, 'B não vê endereços de células');
select tests.eq(tests.count($$select 1 from profiles where id = '10000000-0000-4000-8000-000000000002'$$), 0, 'B não vê perfil de membro de A');
select tests.eq(tests.count($$select 1 from organization_memberships where organization_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$), 0, 'B não vê memberships de A');
select tests.eq(tests.count($$select 1 from announcements$$), 1, 'B vê o aviso da própria igreja');

select tests.throws($$select register_for_event('a3000000-0000-4000-8000-000000000001')$$, 'B não se inscreve em evento de A (IDOR)', 'not_found');
select tests.throws($$select mark_announcement_read('a2000000-0000-4000-8000-000000000001')$$, 'B não marca leitura de aviso de A', 'not_found');
select tests.throws($$insert into announcements (organization_id, title, body, author_id) values ('aaaaaaaa-0000-4000-8000-000000000001', 'x invasor', 'x', auth.uid())$$, 'B não cria aviso em A', 'row-level security');

-- Owner B (privilegiado em B) também não alcança A
select tests.login('20000000-0000-4000-8000-000000000001');
select tests.ok(not has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'church.view_members'), 'owner B sem permissão em A');
select tests.throws($$select grant_role('aaaaaaaa-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', (select id from role_definitions where key='church_owner'))$$, 'owner B não concede papel em A', 'permission_denied');
select tests.throws($$insert into ministries (organization_id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Invasão')$$, 'owner B não cria ministério em A', 'row-level security');
select tests.throws($$insert into ministry_memberships (organization_id, ministry_id, user_id) values ('bbbbbbbb-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')$$, 'owner B não vincula membro a ministério de A trocando tenant', 'tenant_mismatch');
select tests.eq(tests.count($$select 1 from audit_logs where organization_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$), 0, 'owner B não lê auditoria de A');

-- anônimo não vê nada
reset role; set role anon; select tests.login(null);
select tests.eq(tests.count($$select 1 from organizations$$), 0, 'anônimo não vê organizações');
select tests.eq(tests.count($$select 1 from announcements$$), 0, 'anônimo não vê avisos');
rollback;
