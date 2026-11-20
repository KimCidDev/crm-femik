# CRM Femik — MVP (prova de conceito)

CRM próprio da Femik: leads e clientes, funil de vendas (Kanban), histórico de atendimento, agenda e tarefas, propostas com PDF, painel comercial, clientes ativos, equipe e permissões, relatórios com exportação CSV, documentos e registro de alterações.

- **Web app instalável (PWA)**: funciona no iPhone, no Android e no computador com o mesmo código.
- **Sem etapa de build**: HTML, CSS e JavaScript puro (módulos ES). Publica direto no GitHub Pages.
- **Dois modos**:
  - **Demonstração** (padrão): os dados ficam no próprio aparelho (localStorage). Serve para testar já, sem conta nenhuma.
  - **Supabase**: login individual, dados partilhados pela equipe em tempo real, anexos no Storage.

## Publicar no GitHub Pages

1. Crie o repositório (sugestão: `KimCidDev/crm-femik`) e envie estes arquivos para a branch `main`.
2. No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
3. O CRM fica em `https://kimciddev.github.io/crm-femik/`.
4. No iPhone: abrir o link no **Safari → Partilhar → Adicionar à Tela de Início**.

## Ligar o Supabase (dados partilhados)

1. Crie a conta em supabase.com com o e-mail da Femik e um projeto novo (região sugerida: `us-east` ou `ca-central`).
2. **SQL Editor → New query**: cole o conteúdo de `supabase/schema.sql` e rode. Ele cria as tabelas, as permissões (RLS), o registro de alterações, o tempo real e o bucket privado `documentos`.
3. **Authentication → URL Configuration**: em *Site URL* coloque o endereço do GitHub Pages; em *Redirect URLs* adicione o mesmo endereço.
4. **Authentication → Users → Invite user**: convide primeiro o Kim (o primeiro usuário vira **administrador** automaticamente), depois Isabel e Felipe.
5. **Project Settings → API**: copie a *Project URL* e a chave *anon public* para `js/config.js` (`SUPABASE_URL` e `SUPABASE_ANON_KEY`). A chave anon é pública por desenho; a segurança vem das políticas RLS.
6. Entre como Kim, ajuste as permissões em **Equipe e serviços** (Isabel → Comercial, Felipe → Dados e análise) e use **Configurações → Importar dados iniciais** para carregar os 6 leads, as tarefas e o catálogo de serviços.

## Permissões

| Permissão | Pode |
|---|---|
| Administrador | Tudo, incluindo equipe, catálogo de serviços, excluir e anonimizar |
| Comercial | Criar e editar leads, histórico, tarefas, propostas, contratos e documentos |
| Dados e análise | Ver tudo, relatórios e exportações; editar as próprias tarefas |
| Técnico | Ver tudo; atualizar o status dos projetos e as próprias tarefas |

As mesmas regras valem no navegador e no banco (RLS), por isso não dá para contorná-las pelo console.

## Google Agenda

Cada tarefa e reunião tem o botão **Adicionar ao Google Agenda**, que abre o evento já preenchido na agenda Google da pessoa que toca nele. A sincronização automática (OAuth) precisa de um projeto no Google Cloud com um *Client ID* e é o próximo passo.

## Estrutura

```
index.html              casca da aplicação
manifest.webmanifest    instalação como app
sw.js                   cache offline da casca
css/app.css             identidade visual Femik
js/config.js            URL e chave do Supabase (vazio = demonstração)
js/data.js              etapas, permissões, listas e dados iniciais
js/store.js             camada de dados (localStorage ou Supabase)
js/ui.js, js/forms.js   utilitários e formulários
js/views/*.js           telas
supabase/schema.sql     banco, permissões, auditoria, storage
```

## Backup

**Configurações → Baixar backup (.json)**. O plano gratuito do Supabase não tem backups automáticos restauráveis: baixe um por semana.
