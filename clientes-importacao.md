# Visão Geral
Adicionar funcionalidade de importação de clientes em lote via planilha (Excel/CSV) na tela de Clientes, com validação de dados antes da inserção e prevenção contra duplicidade por CNPJ.

# Tipo de Projeto
WEB

# Critérios de Sucesso
- Botão "📥 Importar" ao lado do botão "Novo Cliente" exibido corretamente.
- Abertura de Modal de importação.
- O Modal apresenta dois botões principais principais: "Baixar Template" e "Fazer Upload".
- Template gerado no padrão exigido: Nome da Empresa, CNPJ, Nome do Contato, Telefone, Email, Endereço, Observações (com aviso na primeira linha ou nome exato mantido).
- Upload do arquivo `.xlsx` / `.csv` exibe uma tabela prévia dos dados antes da importação.
- Linhas sem "Nome da Empresa" são destacadas em vermelho como erro e ignoradas no momento do upload.
- A funcionalidade pulará clientes cujo CNPJ já exista no banco (ignorando pontuações na verificação idealmente).
- Um resumo final: "X clientes importados com sucesso. Y linhas ignoradas por erro." será exibido em um `toast` e as listagens serão atualizadas.
- O código NÃO inclui credenciais *hardcoded*, obedecendo estritamente a REGRA DE SEGURANÇA.

# Tech Stack
- Frontend: React / TypeScript / CSS
- Leitura de Excel: `xlsx` 
- CSS Modules/Styles inline ou globals.

# Estrutura de Arquivos
- Modificações:
  - `src/pages/Clientes.tsx`: Adição do botão na UI e state/refetchers.
  - `src/components/ImportClientsModal.tsx` (Novo): Todo o encapsulamento de lógica de parser de excel e visualização da prévia.

# Task Breakdown
1. **Criar modal de Importação (`ImportClientsModal.tsx`)**:
   - AGENT: `frontend-specialist`, SKILL: `react-best-practices`
   - INPUT: Layout Modal → OUTPUT: Modal renderizável → VERIFY: Modal visível com botões.
2. **Lógica "Baixar Template"**:
   - AGENT: `frontend-specialist`, SKILL: `react-best-practices`
   - INPUT: Action clique → OUTPUT: arquivo `.xlsx` baixado → VERIFY: Colunas corretas no arquivo gerado.
3. **Parser do Upload e Validação de Tabela**:
   - AGENT: `frontend-specialist`, SKILL: `react-best-practices`
   - INPUT: Arquivo selecionado → OUTPUT: Tabela prévia renderizada, erros (vermelho) detectados se `Nome` ausente.
4. **Mutação Batch Import no Supabase**:
   - AGENT: `backend-specialist`/`frontend-specialist`, SKILL: `api-patterns`
   - INPUT: Linhas válidas confirmadas → OUTPUT: Chamada Supabase para fetch de duplicados via CNPJ e Batch Insert de novatos.
   - VERIFY: Verificar se o counter de Sucesso e Erro bate, se listagem de clientes de `Clientes.tsx` realimentou as alterações. 

## ✅ PHASE X COMPLETE
[PENDENTE]
