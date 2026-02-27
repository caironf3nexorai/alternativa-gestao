-- Tabela para armazenar os tokens de acesso e refresh do Google Calendar
-- Como o sistema não tem multisession configurada inicialmente, 
-- podemos manter os tokens do painel centralizados aqui.

CREATE TABLE IF NOT EXISTS public.auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Garantir que a tabela possa ser modificada (RLS Desativado localmente ou Políticas Abertas)
-- (Substitua ou adicione suas políticas caso utilize RLS em produção)
-- ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;
