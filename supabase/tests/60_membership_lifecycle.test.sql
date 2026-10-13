-- Convites, remoção com sessão ativa e auditoria.
select tests.login('10000000-0000-4000-8000-000000000007'); -- admin que será removido
select tests.ok(has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'church.view_members'), 'antes da remoção tem acesso');

select tests.login('10000000-0000-4000-8000-000000000001');
select remove_member('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007');

select tests.login('10000000-0000-4000-8000-000000000007'); -- mesma "sessão" (JWT ainda válido)
select tests.ok(not has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'church.view_members'), 'removido perde permissão imediatamente');
select tests.eq(tests.count($$select 1 from organizations$$), 0, 'removido não vê mais a igreja');
select tests.eq(tests.count($$select 1 from announcements$$), 0, 'removido não vê avisos');

-- Convites
select tests.login('10000000-0000-4000-8000-000000000002');
select tests.throws($$select create_invitation('aaaaaaaa-0000-4000-8000-000000000001', 'x@teste.local')$$, 'membro não convida', 'permission_denied');

select tests.login('10000000-0000-4000-8000-000000000008'); -- admin (manage_members, sem manage_permissions)
select tests.throws($$select create_invitation('aaaaaaaa-0000-4000-8000-000000000001', 'convidado@teste.local', (select id from role_definitions where key='church_owner'))$$, 'admin não convida com papel privilegiado', 'permission_denied');
create temp table tok as select create_invitation('aaaaaaaa-0000-4000-8000-000000000001', 'convidado@teste.local') as t;
select tests.ok(true, 'admin cria convite simples');

select tests.login('10000000-0000-4000-8000-000000000009'); -- e-mail diferente
select tests.throws($$select accept_invitation((select t from tok))$$, 'convite não pode ser aceito por outro e-mail', 'invitation_email_mismatch');
select tests.login('10000000-0000-4000-8000-000000000010');
select accept_invitation((select t from tok));
select tests.eq(tests.count($$select 1 from organizations where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$), 1, 'convidado entra na igreja');
select tests.eq(tests.count($$select 1 from user_role_assignments$$), 0, 'convite sem papel não concede privilégio');
select tests.throws($$select accept_invitation((select t from tok))$$, 'convite não é reutilizável', 'invalid_or_expired_invitation');
select tests.throws($$select accept_invitation('token-falso')$$, 'token inválido rejeitado', 'invalid_or_expired_invitation');

select tests.login('10000000-0000-4000-8000-000000000001');
select tests.ok((select count(*) from audit_logs where action in ('member.removed','invitation.created','invitation.accepted')) = 3, 'remoção e convites auditados');
select tests.throws($$select write_audit('aaaaaaaa-0000-4000-8000-000000000001', 'fake', 'x', null, '{}')$$, 'cliente não forja auditoria', 'permission denied');
select tests.throws($$select notify_user('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'system', 'spam', '', null, null, null, 'x')$$, 'cliente não dispara notificação arbitrária', 'permission denied');
rollback;
