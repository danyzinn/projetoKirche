-- Fluxo louvor: equipe + escala + confirmação, com negativos.
select tests.login('10000000-0000-4000-8000-000000000003'); -- líder de louvor
insert into schedules (id, organization_id, ministry_id, title, starts_at, created_by)
values ('a4000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Culto de domingo (DEMO)', now() + interval '3 days', auth.uid());
select tests.ok(true, 'líder cria escala no louvor');
select tests.throws($$insert into schedules (organization_id, ministry_id, title, starts_at, created_by) values ('aaaaaaaa-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Escala mídia', now(), auth.uid())$$, 'líder de louvor não cria escala da mídia', 'row-level security');
insert into schedule_assignments (id, organization_id, schedule_id, user_id, position)
values ('a5000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Vocal');
select tests.ok(true, 'líder escala integrante do louvor');
select tests.throws($$insert into schedule_assignments (organization_id, schedule_id, user_id, position) values ('aaaaaaaa-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Vocal')$$, 'não escala quem não é do ministério', 'assignee_not_in_ministry');

-- integrante não vê rascunho nem notificação antes da publicação
select tests.login('10000000-0000-4000-8000-000000000002');
select tests.eq(tests.count($$select 1 from schedules where id = 'a4000000-0000-4000-8000-000000000001'$$), 0, 'rascunho de escala invisível ao integrante');
select tests.throws($$select respond_to_assignment('a5000000-0000-4000-8000-000000000001', 'confirmed')$$, 'não confirma escala não publicada', 'schedule_not_published');

select tests.login('10000000-0000-4000-8000-000000000003');
select publish_schedule('a4000000-0000-4000-8000-000000000001');
select tests.ok(true, 'líder publica escala');

select tests.login('10000000-0000-4000-8000-000000000002');
select tests.eq(tests.count($$select 1 from notifications where entity_id = 'a5000000-0000-4000-8000-000000000001'$$), 1, 'escalado recebe notificação in-app');
select respond_to_assignment('a5000000-0000-4000-8000-000000000001', 'confirmed');
select tests.eq(tests.count($$select 1 from schedule_assignments where id = 'a5000000-0000-4000-8000-000000000001' and status = 'confirmed'$$), 1, 'voluntário confirma a própria escala');
select tests.eq(tests.affected($$update schedule_assignments set position = 'Teclado' where id = 'a5000000-0000-4000-8000-000000000001'$$), 0, 'voluntário não altera designação diretamente');

-- outro membro (mídia) não responde por ele nem vê escala do louvor
select tests.login('10000000-0000-4000-8000-000000000009');
select tests.throws($$select respond_to_assignment('a5000000-0000-4000-8000-000000000001', 'declined')$$, 'terceiro não responde escala alheia (IDOR)', 'not_found');
select tests.eq(tests.count($$select 1 from schedules where id = 'a4000000-0000-4000-8000-000000000001'$$), 0, 'membro da mídia não vê escala do louvor');
select tests.eq(tests.count($$select 1 from notifications$$), 0, 'não vê notificações de terceiros');

-- recusa notifica o criador da escala
select tests.login('10000000-0000-4000-8000-000000000002');
select respond_to_assignment('a5000000-0000-4000-8000-000000000001', 'declined', 'Viagem');
select tests.login('10000000-0000-4000-8000-000000000003');
select tests.eq(tests.count($$select 1 from notifications where title like 'Recusa%'$$), 1, 'líder notificado da recusa');

-- membro não cria ministério; owner cria
select tests.login('10000000-0000-4000-8000-000000000002');
select tests.throws($$insert into ministries (organization_id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Novo')$$, 'membro não cria ministério', 'row-level security');
select tests.login('10000000-0000-4000-8000-000000000001');
insert into ministries (organization_id, name, kind) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Recepção', 'reception');
select tests.ok(true, 'owner cria ministério');
rollback;
