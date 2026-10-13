-- Papéis aditivos, privilégio mínimo e bloqueio de escalada.
select tests.login('10000000-0000-4000-8000-000000000002'); -- membro comum
select tests.ok(not has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'finance.view'), 'membro sem acesso à tesouraria');
select tests.ok(not has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'church.view_members'), 'membro sem diretório completo');
select tests.throws($$select grant_role('aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), (select id from role_definitions where key='church_admin'))$$, 'membro não se autopromove', 'permission_denied');
select tests.throws($$insert into user_role_assignments (organization_id, user_id, role_id, scope_type) values ('aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), (select id from role_definitions where key='church_owner'), 'church')$$, 'insert direto em grants bloqueado', 'row-level security');
select tests.eq(tests.count($$select 1 from user_role_assignments$$), 0, 'membro só vê os próprios grants (nenhum)');
select tests.eq(tests.affected($$update organization_memberships set status = 'removed' where user_id = '10000000-0000-4000-8000-000000000009'$$), 0, 'membro não edita membership alheia');
select tests.eq(tests.affected($$update organization_memberships set member_type = 'member' where user_id = auth.uid()$$), 0, 'membro não altera o próprio vínculo/status');
select tests.eq(tests.count($$select 1 from organization_memberships where user_id = '10000000-0000-4000-8000-000000000009'$$), 0, 'membro não enxerga membership alheia');
select tests.eq(tests.count($$select 1 from audit_logs$$), 0, 'membro não lê auditoria');

-- admin genérico: sem finanças e sem conceder papéis
select tests.login('10000000-0000-4000-8000-000000000008');
select tests.ok(not has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'finance.view'), 'admin genérico sem acesso automático à tesouraria');
select tests.ok(has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'church.view_members'), 'admin vê diretório');
select tests.throws($$select grant_role('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', (select id from role_definitions where key='treasurer'))$$, 'admin sem manage_permissions não concede papéis', 'permission_denied');

-- tesoureiro
select tests.login('10000000-0000-4000-8000-000000000006');
select tests.ok(has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'finance.view'), 'tesoureiro tem finance.view');
select tests.ok(not has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'church.manage_members'), 'tesoureiro não gerencia membros');

-- líder de louvor: escopo restrito ao ministério
select tests.login('10000000-0000-4000-8000-000000000003');
select tests.ok(has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'schedules.create', 'ministry', 'a1000000-0000-4000-8000-000000000001'), 'líder de louvor escala no louvor');
select tests.ok(not has_permission('aaaaaaaa-0000-4000-8000-000000000001', 'schedules.create', 'ministry', 'a1000000-0000-4000-8000-000000000003'), 'líder de louvor NÃO escala na segurança');
select tests.eq(tests.affected($$update ministries set description = 'hack' where id = 'a1000000-0000-4000-8000-000000000003'$$), 0, 'líder de louvor não edita ministério de segurança');
select tests.eq(tests.affected($$update ministries set description = 'ok' where id = 'a1000000-0000-4000-8000-000000000001'$$), 1, 'líder de louvor edita o próprio ministério');

-- owner concede e revoga; auditoria registrada
select tests.login('10000000-0000-4000-8000-000000000001');
select tests.ok(grant_role('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', (select id from role_definitions where key='ministry_assistant'), 'ministry', 'a1000000-0000-4000-8000-000000000001') is not null, 'owner concede auxiliar no louvor');
select tests.throws($$select grant_role('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', (select id from role_definitions where key='ministry_leader'), 'ministry', 'b1000000-0000-4000-8000-000000000001')$$, 'escopo de outra igreja rejeitado', 'invalid_scope');
select tests.throws($$select grant_role('aaaaaaaa-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', (select id from role_definitions where key='member'))$$, 'não concede papel a não-membro', 'target_not_member');
select tests.eq(tests.count($$select 1 from audit_logs where action = 'role.granted'$$), 1, 'concessão auditada');
select tests.throws($$select revoke_role((select a.id from user_role_assignments a join role_definitions r on r.id=a.role_id where r.key='church_owner' and a.organization_id='aaaaaaaa-0000-4000-8000-000000000001'))$$, 'não remove o último owner', 'last_owner');
rollback;
