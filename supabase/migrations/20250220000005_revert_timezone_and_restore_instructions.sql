-- ==========================================
-- REVERTER CONFIGURAÇÕES DE TIMEZONE
-- ==========================================
-- Esta migração reverte as configurações de timezone criadas na migração anterior
-- 
-- ⚠️ IMPORTANTE: Esta migração NÃO recupera os dados deletados.
-- Para recuperar os dados deletados, você precisa restaurar de um backup do Supabase.
-- Veja o arquivo: scripts-admin/COMO_RECUPERAR_DADOS_DELETADOS.md
-- ==========================================

-- Remover funções auxiliares criadas (se existirem)
-- Usando DROP IF EXISTS para evitar erros se as funções não existirem
DROP FUNCTION IF EXISTS now_brasilia();
DROP FUNCTION IF EXISTS formatar_data_brasilia(TIMESTAMPTZ);

-- Reverter timezone para UTC (padrão)
SET timezone = 'UTC';

-- Verificação
DO $$
BEGIN
  RAISE NOTICE '✅ Configurações de timezone revertidas';
  RAISE NOTICE '⚠️  ATENÇÃO: Os dados deletados NÃO foram recuperados por esta migração';
  RAISE NOTICE '📋 Para recuperar dados, consulte: scripts-admin/COMO_RECUPERAR_DADOS_DELETADOS.md';
END $$;

