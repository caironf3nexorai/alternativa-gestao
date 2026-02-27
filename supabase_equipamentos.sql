create table if not exists categorias_equipamento (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  created_at timestamp with time zone default now()
);

create table if not exists equipamentos (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  categoria_id uuid references categorias_equipamento(id),
  codigo_patrimonio text,
  status text not null default 'disponivel' check (status in ('disponivel', 'alugado', 'manutencao', 'baixado')),
  valor_aquisicao numeric(12,2),
  data_aquisicao date,
  foto_url text,
  observacoes text,
  created_at timestamp with time zone default now()
);

-- Políticas de RLS temporárias para testes no frontend (Permite operações sem login real)
-- Descomente as linhas abaixo caso sua tabela esteja com RLS (Row Level Security) ativado:

-- alter table categorias_equipamento enable row level security;
-- create policy "Allow public full access categorias" on categorias_equipamento for all using (true);

-- alter table equipamentos enable row level security;
-- create policy "Allow public full access equipamentos" on equipamentos for all using (true);
