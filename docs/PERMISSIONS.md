# Permissões — matriz de autorização

Princípios: **default deny**, **papéis aditivos**, **privilégio mínimo**, checagem **no banco** (RLS/RPC).
Esconder botão é apenas UX.

## Operações e escopos

- Operações: view, create, update, delete, publish, approve, export, manage_members, manage_permissions, view_sensitive, manage_finance, audit.
- Escopos: `platform` (equipe Kirche, sem dados pastorais), `church`, `congregation`, `ministry`, `cell`, `own`.
- Grant em `church` cobre qualquer escopo daquela igreja. Grants em ministry/cell valem só para aquele id.
- `own`: implícito nas policies (ex.: responder à própria escala, editar o próprio perfil).

## Permissões definidas

`church.view_members · church.manage_members · church.manage_permissions · church.manage_settings · church.view_sensitive · church.audit ·
ministries.create · ministries.update · ministries.manage_members · schedules.create · schedules.update · schedules.delete ·
announcements.create · announcements.publish · announcements.approve · announcements.update ·
events.create · events.update · events.manage_registrations ·
cells.create · cells.update · cells.manage_members · cells.manage_meetings · cells.view_sensitive ·
finance.view · finance.manage`

## Papéis de sistema (configuráveis; igrejas podem criar papéis próprios)

| Papel | Escopo típico | Principais permissões |
|---|---|---|
| church_owner | igreja | tudo de gestão **exceto finanças**; único que concede papéis privilegiados |
| church_admin | igreja | membros, ministérios, escalas, avisos, eventos, células, auditoria — **sem** conceder papéis e **sem** finanças |
| pastor | igreja | diretório, avisos (publicar/aprovar), eventos, endereço de células |
| secretary | igreja | diretório, cadastro/convites, dados sensíveis cadastrais, rascunho de avisos, eventos |
| treasurer | igreja | `finance.view`, `finance.manage` (módulo na Etapa E) |
| ministry_leader | ministério | equipe, escalas, avisos/eventos do ministério |
| ministry_assistant | ministério | escalas, rascunho de avisos |
| cell_coordinator | igreja | criar/gerir todas as células, avisos para células |
| cell_supervisor | célula | gerir células atribuídas (um grant por célula supervisionada) |
| cell_leader | célula | participantes, encontros, presença, endereço, avisos da célula |
| volunteer / member / visitor | — | sem permissões extras; acesso de membro vem da membership ativa |

## Matriz de cenários verificados por teste automatizado (`supabase/tests`)

| Cenário | Resultado esperado | Teste |
|---|---|---|
| Usuário da Igreja B consulta objetos da Igreja A | 0 linhas / `not_found` | 10_tenant_isolation |
| Owner B tenta conceder papel ou criar ministério em A | negado | 10 |
| Troca de `organization_id` para burlar tenant | `tenant_mismatch` | 10 |
| Anônimo | nada visível | 10 |
| Membro comum consulta tesouraria / diretório / auditoria | negado | 20 |
| Membro tenta autopromoção ou insert direto em grants | negado | 20 |
| Admin genérico tenta finanças ou conceder papéis | negado | 20 |
| Líder de louvor edita/escala Segurança ou Mídia | negado | 20, 30 |
| Escopo de outra igreja em grant | `invalid_scope` | 20 |
| Remover último owner | `last_owner` | 20 |
| Escalar quem não é do ministério | `assignee_not_in_ministry` | 30 |
| Terceiro responde escala alheia (IDOR) | `not_found` | 30 |
| Líder de célula consulta célula alheia / endereço | 0 linhas | 40 |
| Participante registra presença | negado | 40 |
| Líder de ministério publica para a igreja toda | negado | 50 |
| Publicação por UPDATE direto (fora do fluxo) | negado | 50 |
| Fora do público vê aviso segmentado ou métricas | negado | 50 |
| Vagas esgotadas / insert direto em inscrições | negado | 50 |
| Usuário removido mantendo sessão (JWT válido) | perde acesso imediatamente | 60 |
| Convite aceito por outro e-mail / reutilizado / token falso | negado | 60 |
| Cliente forja auditoria ou notificação | negado | 60 |
| Busca de pessoas por membro comum ou em outra igreja | negado | 70 |

Pendente: links de arquivo compartilhados (Storage ainda não utilizado) — testar quando anexos forem implementados.
