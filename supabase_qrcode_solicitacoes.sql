-- 1. Adicionar coluna de token único em equipamentos
ALTER TABLE public.equipamentos
ADD COLUMN IF NOT EXISTS qr_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT;

-- 2. Tabela de solicitações recebidas via QR
CREATE TABLE IF NOT EXISTS public.qr_solicitacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('limpeza', 'insumos', 'avaria', 'duvida', 'status')),
    status_solicitado TEXT,
    identificacao_solicitante TEXT,
    observacao TEXT,
    status TEXT DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Resolvido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Inserir chave QR nas configurações default do sistema se não existir
INSERT INTO public.configuracoes (chave, valor)
VALUES ('chave_qr', '1234')
ON CONFLICT (chave) DO NOTHING;

-- Configuração de Row Level Security (RLS) para qr_solicitacoes
ALTER TABLE public.qr_solicitacoes ENABLE ROW LEVEL SECURITY;

-- Permite leitura de solicitações para usuários autenticados (Admin/Staff)
CREATE POLICY "Permitir select solicitações QR para usuários autenticados" 
ON public.qr_solicitacoes FOR SELECT 
TO authenticated 
USING (true);

-- Permite update (marcar como resolvido) para usuários autenticados
CREATE POLICY "Permitir update solicitações QR para usuários autenticados" 
ON public.qr_solicitacoes FOR UPDATE 
TO authenticated 
USING (true);

-- Permite insert irrestrito (pois o QR Code poderá ser lido por pessoas externas sem conta)
CREATE POLICY "Permitir insert solicitações QR público" 
ON public.qr_solicitacoes FOR INSERT 
TO public 
WITH CHECK (true);
