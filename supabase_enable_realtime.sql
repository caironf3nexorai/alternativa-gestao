-- Ativando o Realtime para Tabelas Específicas no Supabase

-- 1. Habilita realtime na tabela de Equipamentos
-- Isso fará com que qualquer mudança de status (Disponível/Alugado/etc) ou edição
-- reflita ao vivo na Listagem, Dashboard e Patrimônio sem precisar de F5.
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipamentos;

-- 2. Habilita realtime na tabela de Solicitações (Opcional, mas recomendado)
-- Isso fará com que o painel interno de solicitações pisque ao entrar algo novo. 
ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_solicitacoes;
