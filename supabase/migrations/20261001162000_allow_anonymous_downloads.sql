-- ==============================================================================
-- Migração: Permitir downloads anônimos e suporte a playlists
-- ==============================================================================

-- 1. Tornar user_id opcional (permite downloads sem cadastro)
ALTER TABLE public.media_downloads ALTER COLUMN user_id DROP NOT NULL;

-- 2. Adicionar campo para identificar se é playlist
ALTER TABLE public.media_downloads ADD COLUMN IF NOT EXISTS is_playlist BOOLEAN DEFAULT false;

-- 3. Políticas para usuários anônimos (público sem login)
CREATE POLICY "Permitir criacao de downloads anonimos"
    ON public.media_downloads
    FOR INSERT
    TO anon
    WITH CHECK (user_id IS NULL);

CREATE POLICY "Permitir leitura de downloads anonimos"
    ON public.media_downloads
    FOR SELECT
    TO anon
    USING (user_id IS NULL);

-- 4. Garantir que autenticados podem ver tanto os seus quanto anônimos que criaram na mesma sessão se aplicável
DROP POLICY IF EXISTS "Usuários podem criar novos downloads" ON public.media_downloads;
CREATE POLICY "Usuários autenticados podem criar downloads"
    ON public.media_downloads
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
