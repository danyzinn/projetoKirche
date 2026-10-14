-- Fixtures já abrem transação e assumem authenticated.
select tests.login('10000000-0000-4000-8000-000000000008');
select public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001', 'teste@example.test');
select tests.throws($q$update public.invitations set role_id = (select id from public.role_definitions where key = 'church_owner')$q$,
  'admin não transforma convite simples em owner', 'permission denied');
select tests.eq(tests.affected($q$update public.organization_memberships set status = 'removed' where user_id = '10000000-0000-4000-8000-000000000001'$q$), 0,
  'alteração direta não contorna remoção protegida');
select tests.throws($q$select public.remove_member('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')$q$,
  'admin não remove owner', 'permission_denied');
select tests.login('10000000-0000-4000-8000-000000000001');
select tests.throws($q$select public.remove_member('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')$q$,
  'último owner não pode ser removido', 'last_owner');
select tests.throws($q$select public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001', 'teste@example.test', null, 'ministry', 'b1000000-0000-4000-8000-000000000001')$q$,
  'convite rejeita escopo de outra igreja', 'invalid_scope');
select tests.login('10000000-0000-4000-8000-000000000002');
select tests.eq(tests.count($q$select full_name from public.profiles where id = '10000000-0000-4000-8000-000000000009'$q$), 1, 'nome básico compartilhado');
select tests.throws('select phone from public.profiles', 'telefone não é compartilhado', 'permission denied');
select tests.throws('select birth_date from public.profiles', 'nascimento não é compartilhado', 'permission denied');
select tests.eq(tests.count($q$select * from public.get_my_profile() where id = auth.uid()$q$), 1, 'RPC retorna somente perfil próprio');
select tests.eq(public.event_registered_count('a3000000-0000-4000-8000-000000000001'), 0, 'contador acessível ao público do evento');
select tests.throws($q$select public.event_registered_count('b3000000-0000-4000-8000-000000000001')$q$, 'contador não vaza outra igreja', 'not_found');
select tests.throws($q$select public.mark_notifications_read('bbbbbbbb-0000-4000-8000-000000000001', null)$q$, 'leitura de notificações exige vínculo', 'permission_denied');
reset role;
insert into public.organization_memberships (organization_id, user_id, status) values ('bbbbbbbb-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'active');
insert into public.notifications (organization_id, user_id, category, title) values
 ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'system', 'A'),
 ('bbbbbbbb-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'system', 'B');
set local role authenticated;
select tests.eq(public.mark_notifications_read('aaaaaaaa-0000-4000-8000-000000000001', null), 1, 'marcar todas afeta apenas igreja atual');
select tests.eq(tests.count($q$select id from public.notifications where organization_id = 'bbbbbbbb-0000-4000-8000-000000000001' and read_at is null$q$), 1, 'outra igreja permanece não lida');
rollback;
