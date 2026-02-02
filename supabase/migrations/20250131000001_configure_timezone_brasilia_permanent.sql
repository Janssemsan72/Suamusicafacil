-- ============================================================
-- MIGRATION: Configurar Timezone Permanente para Brasília
-- Data: 2025-01-31
-- ============================================================
-- Esta migração configura o banco de dados para usar o horário
-- de Brasília (America/Sao_Paulo) em todas as operações.
-- ============================================================

-- ============================================================
-- 1. CONFIGURAR TIMEZONE DA SESSÃO
-- ============================================================
-- Configura o timezone da sessão atual para Brasília
-- Nota: No Supabase, você também deve configurar o timezone padrão
-- no Dashboard: Settings > Database > Timezone
SET timezone = 'America/Sao_Paulo';

-- ============================================================
-- 2. CRIAR/ATUALIZAR FUNÇÕES AUXILIARES
-- ============================================================

-- Função para obter o horário atual em Brasília (retorna TIMESTAMPTZ)
-- Esta função pode ser usada como DEFAULT em colunas TIMESTAMPTZ
-- IMPORTANTE: Esta função retorna o horário atual, mas interpretado como se fosse em Brasília
-- Para usar como DEFAULT, é melhor usar NOW() diretamente após configurar o timezone do banco
CREATE OR REPLACE FUNCTION now_brasilia()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Retorna o horário atual (que já está em UTC no banco)
  -- Quando o timezone do banco estiver configurado para America/Sao_Paulo,
  -- NOW() já retornará o horário correto
  RETURN NOW();
END;
$$;

-- Função para obter apenas a data (sem hora) no horário de Brasília
CREATE OR REPLACE FUNCTION date_brasilia()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD');
END;
$$;

-- Função para formatar datas no horário de Brasília
CREATE OR REPLACE FUNCTION formatar_data_brasilia(timestamp_with_timezone TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN to_char(timestamp_with_timezone AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS');
END;
$$;

-- Função para converter qualquer timestamp para horário de Brasília
-- Retorna o timestamp convertido para o timezone de Brasília
CREATE OR REPLACE FUNCTION to_brasilia(timestamp_with_timezone TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Converte o timestamp para o timezone de Brasília
  -- Primeiro converte para o timezone local (Brasília), depois volta para TIMESTAMPTZ
  RETURN (timestamp_with_timezone AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

-- ============================================================
-- 3. CONFIGURAR TIMEZONE PADRÃO PARA NOVAS CONEXÕES
-- ============================================================
-- Nota: No Supabase, você precisa configurar isso manualmente no Dashboard:
-- Settings > Database > Timezone > America/Sao_Paulo
-- 
-- Como alternativa, podemos criar um trigger que executa SET timezone
-- no início de cada sessão, mas isso não é recomendado.
-- 
-- A melhor abordagem é configurar no Supabase Dashboard.

-- ============================================================
-- 4. DOCUMENTAÇÃO E COMENTÁRIOS
-- ============================================================
COMMENT ON FUNCTION now_brasilia() IS 'Retorna o horário atual no fuso de Brasília (America/Sao_Paulo) como TIMESTAMPTZ';
COMMENT ON FUNCTION date_brasilia() IS 'Retorna apenas a data atual no fuso de Brasília (formato: YYYY-MM-DD)';
COMMENT ON FUNCTION formatar_data_brasilia(TIMESTAMPTZ) IS 'Formata timestamp para horário de Brasília (DD/MM/YYYY HH24:MI:SS)';
COMMENT ON FUNCTION to_brasilia(TIMESTAMPTZ) IS 'Converte qualquer timestamp para o timezone de Brasília';

-- ============================================================
-- 5. VERIFICAÇÃO E LOG
-- ============================================================
DO $$
DECLARE
  current_tz TEXT;
  brasilia_time TEXT;
BEGIN
  -- Obter timezone atual da sessão
  current_tz := current_setting('timezone');
  
  -- Obter horário atual em Brasília
  brasilia_time := formatar_data_brasilia(NOW());
  
  RAISE NOTICE '✅ Configurações de timezone aplicadas';
  RAISE NOTICE '🌍 Timezone da sessão: %', current_tz;
  RAISE NOTICE '📅 Data atual em Brasília: %', date_brasilia();
  RAISE NOTICE '🕐 Horário atual em Brasília: %', brasilia_time;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE: Para configurar o timezone permanentemente,';
  RAISE NOTICE '   acesse o Supabase Dashboard:';
  RAISE NOTICE '   Settings > Database > Timezone > America/Sao_Paulo';
END $$;

