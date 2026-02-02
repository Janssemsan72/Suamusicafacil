-- ==========================================
-- CONFIGURAR TIMEZONE PARA BRASÍLIA
-- ==========================================
-- Configura o timezone do banco de dados para America/Sao_Paulo (Brasília)
-- Cria funções auxiliares para trabalhar com horário de Brasília
-- ==========================================

-- Configurar timezone da sessão para Brasília
-- Nota: No Supabase, configurações globais devem ser feitas via dashboard
-- Esta configuração afeta a sessão atual e será aplicada em cada conexão
SET timezone = 'America/Sao_Paulo';

-- Criar função auxiliar para obter data atual em Brasília
CREATE OR REPLACE FUNCTION now_brasilia()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Retornar horário atual convertido para Brasília
  RETURN (NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

-- Criar função para obter apenas a data (sem hora) no horário de Brasília
-- Retorna como TEXT no formato YYYY-MM-DD para compatibilidade com Supabase RPC
CREATE OR REPLACE FUNCTION date_brasilia()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Retornar apenas a data no horário de Brasília no formato YYYY-MM-DD
  RETURN to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD');
END;
$$;

-- Criar função para formatar datas no horário de Brasília
CREATE OR REPLACE FUNCTION formatar_data_brasilia(timestamp_with_timezone TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Converter para horário de Brasília (America/Sao_Paulo = UTC-3)
  RETURN to_char(timestamp_with_timezone AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS');
END;
$$;

-- Comentários para documentação
COMMENT ON FUNCTION now_brasilia() IS 'Retorna o horário atual no fuso de Brasília (America/Sao_Paulo)';
COMMENT ON FUNCTION date_brasilia() IS 'Retorna apenas a data atual no fuso de Brasília (sem hora)';
COMMENT ON FUNCTION formatar_data_brasilia(TIMESTAMPTZ) IS 'Formata timestamp para horário de Brasília (DD/MM/YYYY HH24:MI:SS)';

-- Verificação
DO $$
BEGIN
  RAISE NOTICE '✅ Configurações de timezone aplicadas';
  RAISE NOTICE '📅 Data atual em Brasília: %', date_brasilia();
  RAISE NOTICE '🕐 Horário atual em Brasília: %', formatar_data_brasilia(NOW());
END $$;

