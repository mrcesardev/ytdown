-- ==============================================================================
-- YtDown - Schema do Supabase / PostgreSQL
-- ==============================================================================

-- 1. Criação da tabela de downloads
CREATE TABLE IF NOT EXISTS public.media_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    thumbnail TEXT,
    original_url TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('mp3', 'mp4')),
    quality TEXT DEFAULT 'best',
    file_path TEXT,
    filename TEXT,
    file_size BIGINT,
    download_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_media_downloads_user_id ON public.media_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_media_downloads_status ON public.media_downloads(status);
CREATE INDEX IF NOT EXISTS idx_media_downloads_created_at ON public.media_downloads(created_at DESC);

-- 3. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_updated_at ON public.media_downloads;
CREATE TRIGGER trigger_set_updated_at
BEFORE UPDATE ON public.media_downloads
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.media_downloads ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Acesso (RLS) - Apenas o próprio usuário autenticado pode manipular seus registros
CREATE POLICY "Usuários podem visualizar seus próprios downloads"
    ON public.media_downloads
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar novos downloads"
    ON public.media_downloads
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios downloads"
    ON public.media_downloads
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios downloads"
    ON public.media_downloads
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 6. Habilitar Supabase Realtime para a tabela
-- Permite que o frontend receba atualizações instantâneas de status
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_downloads;
