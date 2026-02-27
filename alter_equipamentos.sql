-- Este script de alteração insere a coluna sugerida pelo usuário de 'TAG' na tabela já existente de equipamentos.

alter table equipamentos add column if not exists tag text;
