-- Busca de pessoas: só para quem gerencia integrantes; nunca cruza igrejas.
-- fixtures terminam como authenticated; ajustes de dados exigem superusuário
reset role;
update profiles set full_name = 'Maria Membro' where id = '10000000-0000-4000-8000-000000000002';
update profiles set full_name = 'Maria de B' where id = '20000000-0000-4000-8000-000000000002';
set role authenticated;

select tests.login('10000000-0000-4000-8000-000000000002'); -- membro comum
select tests.throws($$select * from search_members('aaaaaaaa-0000-4000-8000-000000000001', 'Maria')$$, 'membro comum não pesquisa pessoas', 'permission_denied');

select tests.login('10000000-0000-4000-8000-000000000003'); -- líder de louvor
select tests.eq(tests.count($$select 1 from search_members('aaaaaaaa-0000-4000-8000-000000000001', 'Maria')$$), 1, 'líder encontra pessoa da própria igreja (sem a de B)');
select tests.eq(tests.count($$select 1 from search_members('aaaaaaaa-0000-4000-8000-000000000001', 'M')$$), 0, 'consulta curta não lista ninguém');
select tests.throws($$select * from search_members('bbbbbbbb-0000-4000-8000-000000000001', 'Maria')$$, 'líder de A não pesquisa em B', 'permission_denied');
rollback;
