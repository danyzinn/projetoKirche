-- Células: membro vê só a própria; endereço restrito; líder com escopo limitado.
select tests.login('10000000-0000-4000-8000-000000000009'); -- participante da célula Vida
select tests.eq(tests.count($$select 1 from cells$$), 2, 'diretório básico de células visível (sem endereço)');
select tests.eq(tests.count($$select 1 from cell_private_details where cell_id = 'ce000000-0000-4000-8000-000000000001'$$), 0, 'não vê endereço de célula alheia');
select tests.eq(tests.count($$select 1 from cell_private_details where cell_id = 'ce000000-0000-4000-8000-000000000002'$$), 1, 'vê endereço da própria célula');
select tests.eq(tests.count($$select 1 from cell_memberships where cell_id = 'ce000000-0000-4000-8000-000000000001'$$), 0, 'não vê participantes de célula alheia');

select tests.login('10000000-0000-4000-8000-000000000005'); -- líder da Esperança
select tests.eq(tests.count($$select 1 from cell_memberships where cell_id = 'ce000000-0000-4000-8000-000000000002'$$), 0, 'líder não consulta participantes de outra célula');
select tests.eq(tests.count($$select 1 from cell_private_details where cell_id = 'ce000000-0000-4000-8000-000000000002'$$), 0, 'líder não vê endereço de outra célula');
insert into cell_meetings (id, organization_id, cell_id, starts_at, topic, created_by)
values ('a6000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'ce000000-0000-4000-8000-000000000001', now() + interval '2 days', 'Estudo (DEMO)', auth.uid());
select tests.ok(true, 'líder agenda encontro da própria célula');
insert into cell_attendance (organization_id, meeting_id, user_id, present, recorded_by)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', true, auth.uid());
select tests.ok(true, 'líder registra presença');
select tests.throws($$insert into cell_meetings (organization_id, cell_id, starts_at, created_by) values ('aaaaaaaa-0000-4000-8000-000000000001', 'ce000000-0000-4000-8000-000000000002', now(), auth.uid())$$, 'líder não agenda encontro de outra célula', 'row-level security');
select tests.throws($$insert into cell_memberships (organization_id, cell_id, user_id) values ('aaaaaaaa-0000-4000-8000-000000000001', 'ce000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')$$, 'não adiciona pessoa de outra igreja', 'target_not_member');
select tests.throws($$insert into cells (organization_id, name, created_by) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Nova', auth.uid())$$, 'líder de célula não cria células', 'row-level security');

select tests.login('10000000-0000-4000-8000-000000000002'); -- participante da Esperança
select tests.eq(tests.count($$select 1 from cell_meetings where cell_id = 'ce000000-0000-4000-8000-000000000001'$$), 1, 'participante vê encontros da própria célula');
select tests.eq(tests.count($$select 1 from cell_attendance$$), 1, 'participante vê a própria presença');
select tests.throws($$insert into cell_attendance (organization_id, meeting_id, user_id, recorded_by) values ('aaaaaaaa-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', auth.uid(), auth.uid())$$, 'participante não registra presença', 'row-level security');

select tests.login('10000000-0000-4000-8000-000000000001'); -- owner cria célula e designa líder
insert into cells (id, organization_id, name, created_by) values ('ce000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'Célula Nova', auth.uid());
select tests.ok(grant_role('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', (select id from role_definitions where key='cell_leader'), 'cell', 'ce000000-0000-4000-8000-000000000003') is not null, 'owner designa líder da nova célula');
rollback;
