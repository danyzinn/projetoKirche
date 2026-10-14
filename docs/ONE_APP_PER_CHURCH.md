# Um aplicativo por igreja

Decisão de produto (14/10/2026): desenvolver uma base compartilhada, com uma instalação e uma identidade por igreja. Validar primeiro o piloto e incorporar suas melhorias ao núcleo antes de replicar. O usuário entra diretamente no app da sua igreja.

## Configuração

`config/church.json` é a fonte pública de nome, slug, descrição, logo SVG local, cores e módulos. Vite gera HTML e manifesto a partir dela; entrada, navegação e modo demonstração usam a mesma identidade. `npm run check:church` valida a configuração, também executada antes do build.

O slug deve existir em `organizations`. O valor inicial `ibv-nova-demo` corresponde ao seed fictício existente. Para uma igreja real, criar organização própria e alterar o slug; nunca promover o seed como cadastro real. Nome e marca da instalação prevalecem sobre o branding do banco nesta fase. Fuso horário, vínculos e permissões continuam vindo do banco.

Os módulos exibidos são a interseção entre a configuração e `organization_modules` habilitados no banco. Rotas desabilitadas mostram indisponibilidade. Isso controla a experiência, não a autorização: RLS e RPCs continuam obrigatórias. Desabilitar um módulo não apaga seus dados nem revoga permissões de API.

## Implantação por igreja

1. Usar a mesma versão do núcleo, com configuração e assets específicos da igreja. Evitar cópias divergentes de componentes.
2. Preferir um projeto Supabase independente por igreja, além de domínio e implantação próprios. O modelo com organization_id é preservado como defesa e para futuras necessidades de congregações.
3. Aplicar todas as migrations em ordem. Este incremento acrescenta `20261014000006_access_hardening.sql`. Publicar backend e frontend de forma coordenada: as RPCs de perfil e leitura de notificações mudaram.
4. Criar organização, módulos e responsável inicial por procedimento administrativo confiável. Não incluir service_role no frontend. O filtro de slug do app não substitui isolamento de banco.
5. Configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente de build. Conferir URL do site, redirecionamentos de confirmação `/convite/**` e recuperação `/redefinir-senha` no Supabase Auth para o domínio desta igreja.
6. Testar criação de conta, confirmação de e-mail, aceite de convite, saída e recuperação de senha com contas de teste. Criar conta não concede vínculo ou papel; o aceite do convite confere e-mail e permissões no banco.
7. Configurar fallback de rotas para index.html na hospedagem. Executar lint, typecheck, testes web, SQL e build antes de publicar.

Não há publicação automática nem migração de dados reais neste incremento. O manifesto não significa suporte offline, push ou entrega nas lojas.

## Próximos incrementos

- Homologar ponta a ponta contra Supabase real de teste, incluindo confirmação de e-mail e duas contas.
- Completar gestão de convites, revogação na interface, edição/cancelamento de eventos e proteção de mudanças simultâneas.
- Revisar todos os vínculos entre congregações, papéis e escopos; endurecer helpers SECURITY DEFINER e gerar tipos do banco.
- Calibrar identidade oficial, linguagem de células/grupos por denominação, acessibilidade e estados vazios com a igreja piloto.
- Somente após validação do piloto: automatizar provisionamento de novas instalações e distribuição das atualizações do núcleo.
