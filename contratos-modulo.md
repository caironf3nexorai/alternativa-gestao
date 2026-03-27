# Visão Geral
Criação do módulo "Contratos" no sistema Alternativa Gestão. Este módulo será responsável pelo vínculo entre Clientes e Equipamentos alugados via contrato, contendo datas de vigência, valores e checklist de documentos anexos. O módulo impactará outras telas como Dashboard, Clientes e Patrimônio.

# Tipo de Projeto
WEB

# Critérios de Sucesso
- Tabelas `contratos`, `contrato_equipamentos`, e `contrato_documentos` criadas no Supabase com suas respectivas ForeignKey Constraints e Row Level Security.
- Novo item "📄 Contratos" anexado na sidebar.
- Página principal `/contratos` exibindo tabela interativa, filtros de busca por nome/cliente e status. Botão para "Novo Contrato".
- Modal de Cadastro dividida em abas ou seções longas contendo "Dados do Contrato", "Equipos Vinculados" e "Checklist de Documentos".
- Lógica de sincronização de Status de Equipamentos: Vincular equipamento no contrato muda status pra "alugado". Desvincular ou Encerrar contrato pergunta se volta pra "disponivel".
- Componente de Detalhes (`/contratos/:id` ou Modal Detail) implementado com as descrições read-only e alertas de vencimento.
- Impactos no Dashboard aplicados: Adicionado Card de "Contratos Ativos" e alertas dinâmicos (vencendo em X dias / vencidos).
- Impacto no Patrimônio (Equipamentos): Equipamentos com status "alugado" exibem o cliente do contrato atual.
- Impacto nos Clientes: Mostrar badge/text discreto com a contagem de contratos ativos na tabela de Clientes.

# Tech Stack
- Frontend: React / TypeScript / CSS Modules (ou global)
- Back-end/DB: Supabase (Tabelas e constraints relacionais)

# Estrutura de Arquivos
- Adições e Modificações:
  - `supabase_setup.sql`: Adição das queries de tabela.
  - `src/components/Sidebar.tsx`: Adicionar a rota para Contratos.
  - `src/pages/Contratos.tsx` (Novo): Lista master e Header.
  - `src/components/ContratoForm.tsx` (Novo): Create/Edit Modal.
  - `src/components/ContratoDetail.tsx` (Novo): View Model da ação visualizar.
  - `src/pages/Dashboard.tsx`: Novas queries para cards de Contrato.
  - `src/pages/Equipamentos.tsx` (Patrimônio): Mostrar cliente se for alugado (requer join query).
  - `src/pages/Clientes.tsx`: Extrair counter de contratos ativos.

# Task Breakdown
1. **DB Setup**:
   - Criar 3 tabelas e configurar RLS limits. Alterar tabelas existentes se necessário.
2. **UI Contratos Master**:
   - Construir o Layout de tabela e filtros + Roteamento na navegação.
3. **UI Contratos Forms (3 seções)**:
   - Layout complexo de criação contendo inputs, relations (Dropdown dinâmico de equipamentos disponíveis vs clientes) e arrays field logic para Checklist.
4. **Logic Status Sincronizado**:
   - Tratamento Transacional/Batch no Supabase Client para garantir que se o Contrato for ativado o `Equipamentos.status = 'alugado'`.
5. **Dashboard Widgets**:
   - Card Totalizadores + Lista de Warnings (vencimento < 7 dias).
6. **Integração Cruzada**:
   - Rota Clientes e Patrimônio exibindo ClientName e Totalizadores do Relacional.

## ✅ PHASE X COMPLETE
[PENDENTE]
