-- Script para criar as tabelas do módulo de Agendas

create table if not exists agendas (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  cor text not null default '#3498db',
  ordem integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists agendas_anotacoes (
  id uuid default gen_random_uuid() primary key,
  agenda_id uuid references agendas(id) on delete cascade,
  titulo text not null,
  descricao text,
  data_vencimento date,
  status text not null default 'pendente' check (status in ('pendente', 'concluido')),
  created_at timestamp with time zone default now()
);
