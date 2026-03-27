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
