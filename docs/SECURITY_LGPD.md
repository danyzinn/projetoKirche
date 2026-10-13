# Segurança, privacidade e LGPD

> Documento técnico. **Não** constitui parecer jurídico nem declaração de conformidade.
> Papéis de controlador/operador, bases legais e aviso de privacidade final devem ser definidos com assessoria jurídica.

## Premissas
- Dados sobre convicção religiosa são **dados pessoais sensíveis** (LGPD art. 5º, II). Dados de crianças e adolescentes exigem proteção reforçada (art. 14).
- Relação provável: a **igreja** como controladora e a **Kirche** como operadora — a confirmar em contrato.
- Consentimento **não** é tratado como base legal universal; cada finalidade terá base definida com o jurídico.

## Controles implementados
| Controle | Onde |
|---|---|
| RLS em todas as tabelas, default deny, anônimo sem acesso | migrations 0001–0005 |
| Isolamento entre igrejas + triggers de consistência de tenant | migrations; testes 10_* |
| Privilégio mínimo, papéis aditivos, anti-escalada | `grant_role`, testes 20_* |
| Revogação imediata ao remover membro | `remove_member`, teste 60_* |
| Endereço de célula separado e restrito | `cell_private_details`, teste 40_* |
| Métricas de leitura apenas agregadas | `announcement_read_count` |
| Auditoria de grants, convites, remoções, publicação e edição pós-publicação | `audit_logs` (sem conteúdo sensível) |
| Tokens de convite armazenados só como hash SHA-256, com expiração e uso único | `invitations` |
| Busca de pessoas limitada (nome, 20 resultados, mín. 2 caracteres) | `search_members` |
| Sem `service_role` no frontend; `.env*` fora do git | `.env.example`, `.gitignore` |
| Mensagens de erro sem detalhes internos | `supabaseApi.ts#fail` |
| Seeds somente fictícios e locais | `supabase/seed.sql` |

## Pendências antes de dados reais (bloqueantes)
1. Revisão jurídica: aviso de privacidade, bases legais, termo controlador/operador, encarregado (DPO).
2. Política de retenção e exclusão (pedidos de oração, ocorrências, menores, visitantes).
3. Storage privado com URLs assinadas de curta duração (quando houver anexos) + testes de acesso.
4. Rate limiting em formulários públicos (cadastro de visitante via QR) — usar limites do Supabase Auth + Edge Function.
5. Procedimento de backup e restauração documentado e testado (PITR do plano Supabase escolhido).
6. Revisão de logs do provedor para não reter dados sensíveis.
7. MFA para papéis privilegiados (owner, secretaria, tesouraria).
8. Pentest/revisão de RLS por terceiro antes do piloto com dados reais.

## Fora de escopo por decisão
- Vigilância invasiva ou perfis de risco pessoais (Central 08).
- Exposição de nomes de beneficiários de ação social.
- Lista pública de crianças.
- Contribuições individuais visíveis a administradores genéricos.
