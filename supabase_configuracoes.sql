-- Criação da tabela de configurações globais do sistema
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chave TEXT NOT NULL UNIQUE,
    valor TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Criar políticas simples para permitir leitura e escrita para usuários autenticados (ou anon, ajustável conforme necessidade)
CREATE POLICY "Permitir leitura de configuracoes para todos"
    ON public.configuracoes FOR SELECT
    USING (true);

CREATE POLICY "Permitir inserção e atualização de configuracoes"
    ON public.configuracoes FOR ALL
    USING (true)
    WITH CHECK (true);

-- Criar bucket público para upload da logo da empresa se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Configurar políticas de storage para permitir acesso público e upload
CREATE POLICY "Permitir leitura pública do bucket public-assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'public-assets');

CREATE POLICY "Permitir upload no bucket public-assets"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'public-assets');

CREATE POLICY "Permitir update no bucket public-assets"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'public-assets');

CREATE POLICY "Permitir delete no bucket public-assets"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'public-assets');
