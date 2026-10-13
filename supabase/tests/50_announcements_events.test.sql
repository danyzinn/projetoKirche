-- Avisos segmentados e eventos com inscrição.
select tests.login('10000000-0000-4000-8000-000000000002'); -- membro comum
select tests.throws($$insert into announcements (organization_id, title, body, author_id) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Meu aviso', 'x', auth.uid())$$, 'membro comum não cria aviso', 'row-level security');
select tests.eq(tests.count($$select 1 from announcements$$), 1, 'membro vê aviso geral publicado');

select tests.login('10000000-0000-4000-8000-000000000003'); -- líder de louvor
insert into announcements (id, organization_id, title, body, author_id)
values ('a2000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ensaio extra', 'Sábado 16h (DEMO)', auth.uid());
insert into announcement_audiences (announcement_id, organization_id, audience_type, audience_id)
values ('a2000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'church', null);
select tests.throws($$select publish_announcement('a2000000-0000-4000-8000-000000000002')$$, 'líder de ministério não publica para a igreja toda', 'permission_denied');
delete from announcement_audiences where announcement_id = 'a2000000-0000-4000-8000-000000000002';
insert into announcement_audiences (announcement_id, organization_id, audience_type, audience_id)
values ('a2000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'ministry', 'a1000000-0000-4000-8000-000000000001');
select tests.throws($$update announcements set status = 'published', published_at = now() where id = 'a2000000-0000-4000-8000-000000000002'$$, 'publicação direta por UPDATE bloqueada', 'publish_announcement');
select publish_announcement('a2000000-0000-4000-8000-000000000002');
select tests.ok(true, 'líder publica para o próprio ministério');

select tests.login('10000000-0000-4000-8000-000000000002'); -- integrante do louvor
select tests.eq(tests.count($$select 1 from announcements where id = 'a2000000-0000-4000-8000-000000000002'$$), 1, 'integrante do louvor vê aviso segmentado');
select tests.eq(tests.count($$select 1 from notifications where entity_id = 'a2000000-0000-4000-8000-000000000002'$$), 1, 'integrante recebe notificação do aviso');
select mark_announcement_read('a2000000-0000-4000-8000-000000000002');
select mark_announcement_read('a2000000-0000-4000-8000-000000000002');
select tests.eq(tests.count($$select 1 from announcement_reads$$), 1, 'leitura registrada de forma idempotente');
select tests.eq(mark_notifications_read(null), 1, 'marcar todas como lidas');

select tests.login('10000000-0000-4000-8000-000000000009'); -- mídia, fora do público
select tests.eq(tests.count($$select 1 from announcements where id = 'a2000000-0000-4000-8000-000000000002'$$), 0, 'fora do público não vê aviso segmentado');
select tests.throws($$select announcement_read_count('a2000000-0000-4000-8000-000000000002')$$, 'fora do público não vê métricas de leitura', 'not_found');

select tests.login('10000000-0000-4000-8000-000000000003');
select tests.eq(announcement_read_count('a2000000-0000-4000-8000-000000000002'), 1, 'autor vê contagem agregada de leituras');

-- Agendado: invisível até a data
select tests.login('10000000-0000-4000-8000-000000000001');
insert into announcements (id, organization_id, title, body, author_id) values ('a2000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'Futuro', 'Agendado', auth.uid());
insert into announcement_audiences (announcement_id, organization_id, audience_type) values ('a2000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'church');
select publish_announcement('a2000000-0000-4000-8000-000000000003', now() + interval '1 day');
select tests.login('10000000-0000-4000-8000-000000000002');
select tests.eq(tests.count($$select 1 from announcements where id = 'a2000000-0000-4000-8000-000000000003'$$), 0, 'aviso agendado invisível antes da data');

-- Eventos: capacidade e inscrição
select register_for_event('a3000000-0000-4000-8000-000000000001');
select tests.eq(tests.count($$select 1 from event_registrations where user_id = auth.uid() and status = 'registered'$$), 1, 'membro se inscreve');
select tests.throws($$insert into event_registrations (organization_id, event_id, user_id) values ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009')$$, 'insert direto em inscrições bloqueado', 'row-level security');
select tests.login('10000000-0000-4000-8000-000000000009');
select tests.throws($$select register_for_event('a3000000-0000-4000-8000-000000000001')$$, 'vagas esgotadas respeitadas', 'event_full');
select tests.eq(tests.count($$select 1 from event_registrations$$), 0, 'membro não vê inscrições de terceiros');
select tests.throws($$insert into events (organization_id, title, starts_at, created_by) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Meu evento', now() + interval '1 day', auth.uid())$$, 'membro comum não cria evento', 'row-level security');

select tests.login('10000000-0000-4000-8000-000000000002');
select cancel_event_registration('a3000000-0000-4000-8000-000000000001');
select tests.login('10000000-0000-4000-8000-000000000009');
select register_for_event('a3000000-0000-4000-8000-000000000001');
select tests.ok(true, 'vaga liberada após cancelamento');

select tests.login('10000000-0000-4000-8000-000000000001');
select tests.eq(tests.count($$select 1 from event_registrations where event_id = 'a3000000-0000-4000-8000-000000000001'$$), 2, 'gestão vê lista de inscrições');
update events set status = 'cancelled' where id = 'a3000000-0000-4000-8000-000000000001';
select tests.login('10000000-0000-4000-8000-000000000009');
select tests.eq(tests.count($$select 1 from notifications where category = 'event'$$), 1, 'inscrito notificado do cancelamento');
rollback;
