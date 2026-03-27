-- Criação da tabela de clientes conforme especificação
create table if not exists clientes (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  cnpj text,
  contato_nome text,
  contato_telefone text,
  contato_email text,
  endereco text,
  observacoes text,
  ativo boolean default true,
  created_at timestamp with time zone default now()
);

-- Ativar Row Level Security (RLS) se necessário
-- alter table clientes enable row level security;

-- Como não há autenticação detalhada ainda provida no escopo, 
-- podemos criar uma policy pública temporária para testes se o anon key for usado diretamente no cliente
-- create policy "Permitir acesso total temporario" on clientes for all using (true);

-- Adicionar tipo em agendas_anotacoes
alter table agendas_anotacoes 
add column if not exists tipo text not null default 'descricao' 
check (tipo in ('descricao', 'lista'));

-- Criar tabela agendas_anotacoes_itens
create table if not exists agendas_anotacoes_itens (
  id uuid default gen_random_uuid() primary key,
  anotacao_id uuid references agendas_anotacoes(id) on delete cascade,
  texto text not null,
  concluido boolean default false,
  ordem integer default 0,
  created_at timestamp with time zone default now()
);

-- Ativar RLS
alter table agendas_anotacoes_itens enable row level security;

-- Policies restritas a usuários autenticados (herdando regra simples)
create policy "Acesso total para usuarios autenticados" 
on agendas_anotacoes_itens for all 
to authenticated 
using (true) 
with check (true);

-- =========================================
-- MÓDULO CONTRATOS
-- =========================================

create table if not exists contratos (
  id uuid default gen_random_uuid() primary key,
  numero_contrato text,
  cliente_id uuid references clientes(id),
  data_inicio date not null,
  data_prevista_encerramento date,
  data_encerramento_real date,
  valor_mensal numeric(12,2),
  valor_total numeric(12,2),
  status text not null default 'ativo'
    check (status in ('ativo','encerrado','suspenso','em_negociacao')),
  observacoes text,
  created_at timestamp with time zone default now()
);

create table if not exists contrato_equipamentos (
  id uuid default gen_random_uuid() primary key,
  contrato_id uuid references contratos(id) on delete cascade,
  equipamento_id uuid references equipamentos(id),
  data_saida date,
  data_retorno_prevista date,
  data_retorno_real date,
  valor_unitario numeric(12,2),
  observacoes text,
  created_at timestamp with time zone default now()
);

create table if not exists contrato_documentos (
  id uuid default gen_random_uuid() primary key,
  contrato_id uuid references contratos(id) on delete cascade,
  nome text not null,
  descricao text,
  concluido boolean default false,
  created_at timestamp with time zone default now()
);

alter table contrato_documentos add column if not exists arquivo_url text;

alter table contratos enable row level security;
alter table contrato_equipamentos enable row level security;
alter table contrato_documentos enable row level security;

create policy "Contratos Auth" on contratos for all to authenticated using (true) with check (true);
create policy "Contrato Equip Auth" on contrato_equipamentos for all to authenticated using (true) with check (true);
create policy "Contrato Docs Auth" on contrato_documentos for all to authenticated using (true) with check (true);
