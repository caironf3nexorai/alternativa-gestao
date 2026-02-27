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
