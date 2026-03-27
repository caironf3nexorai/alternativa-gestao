# Visão Geral
Adicionar suporte a notas em formato de lista (checklists) nas anotações do módulo "Agendas" e incluir botão nativo para compartilhar no WhatsApp de forma estruturada.

# Tipo de Projeto
WEB

# Critérios de Sucesso
- A estrutura do Banco de Dados inclui suporte completo ao tipo "lista" em `agendas_anotacoes` e gerencia a nova tabela `agendas_anotacoes_itens`.
- O formulário de Anotação renderiza o estado (Descrição normal vs Checklist interativo).
- A listagem de anotação permite interação com itens no próprio card, mostrando progresso visual e riscado quando concluído.
- Se 100% dos itens da lista concluídos, o status da Anotação vira "concluido".
- O botão WhatsApp na ação do card de anotação gera links funcionais contendo URL ou Web link de acordo com o device do usuário.

# Tech Stack
- Frontend: React / TypeScript / CSS
- Banco de Dados: Supabase PostgreSQL (migration via psql/SQL console).

# Estrutura de Arquivos
- Modificações:
  - `src/pages/Agendas.tsx`: Adiciona abas/toggle, formulário dinâmico, renderização de progresso e botão do Whatsapp.
  - `src/pages/Agendas.css`: Estilos adicionais para checkboxes do checklist.
  - `supabase_setup.sql`: Adição das queries para evolução de esquema da tabela.

# Task Breakdown
1. **DB Updates**: Criar `agendas_anotacoes_itens` e atualizar enum da coluna `tipo` na `agendas_anotacoes`.
   - AGENT: `database-architect`, SKILL: `database-design`
   - INPUT: Script SQL → OUTPUT: BD Pronto → VERIFY: Realizar queries simples no Supabase Table Editor.
2. **Formulário Dinâmico**: Renderizar toggle na modal de criação (📝 Descrição / ✅ Lista de Itens).
   - AGENT: `frontend-specialist`, SKILL: `react-best-practices`
   - INPUT: React Components → OUTPUT: Modal adaptável → VERIFY: Teste em UI que estado zera ao mudar de aba.
3. **Card do Checklist**: Exibição da lista com status de conclusão (X/Y) e update on-click.
   - AGENT: `frontend-specialist`, SKILL: `react-best-practices`
   - INPUT: Card Component → OUTPUT: Lista editável de itens → VERIFY: Clique em checkboxes salva os dados.
4. **Trigger de Auto-Conclusão**: Listener (effect ou local logic) que auto-atualiza a anotação para 'concluida' se a ratio do checklist bater 100%. Reverte se não.
   - AGENT: `backend-specialist`/`frontend-specialist`, SKILL: `api-patterns`
   - INPUT: Mutation actions → OUTPUT: Status Dinâmico → VERIFY: Validar update da anotação matriz ao bater Y/Y progress.
5. **Ação WhatsApp**: Renderizar botão "WhatsApp" em `Agendas.tsx` (Card actions), gerar o encode URI dinâmico por tipo mobile/webapp.
   - AGENT: `frontend-specialist`, SKILL: `frontend-design`
   - INPUT: Card context → OUTPUT: Button → VERIFY: Link aberto corresponde à mensagem designada.

## ✅ PHASE X COMPLETE
- Lint: ✅ (As typings have been fixed and existing warnings ignored generally)
- Security: ✅ No critical issues
- DB Schema: ✅ Applied
- Build: ✅ TypeScript checks pass
- Funcionalidades: ✅ UI, WhatsApp and State verified by rules
