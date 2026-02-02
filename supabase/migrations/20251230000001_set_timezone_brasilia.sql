-- ==========================================
-- Configuração de Fuso Horário: Brasília (UTC-3)
-- ==========================================
-- Define o fuso horário padrão para o banco de dados e roles principais
-- Isso garante que NOW(), CURRENT_DATE, etc. retornem valores no horário do Brasil
-- ==========================================

-- 1. Tentar definir para o banco de dados (pode falhar dependendo das permissões, mas é o ideal)
DO $$
BEGIN
  BEGIN
    ALTER DATABASE postgres SET timezone TO 'America/Sao_Paulo';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível alterar timezone do database (permissão insuficiente). Tentando por role...';
  END;
END $$;

-- 2. Definir para roles específicas (garantido funcionar no Supabase)
-- Role 'postgres' (admin/dashboard)
ALTER ROLE postgres SET timezone TO 'America/Sao_Paulo';

-- Role 'authenticated' (usuários logados)
ALTER ROLE authenticated SET timezone TO 'America/Sao_Paulo';

-- Role 'anon' (usuários não logados/public)
ALTER ROLE anon SET timezone TO 'America/Sao_Paulo';

-- Role 'service_role' (backend/edge functions)
ALTER ROLE service_role SET timezone TO 'America/Sao_Paulo';

-- 3. Verificação (apenas para log)
DO $$
DECLARE
  v_current_tz TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  SHOW timezone INTO v_current_tz;
  v_now := NOW();
  RAISE NOTICE 'Fuso horário configurado para: %', v_current_tz;
  RAISE NOTICE 'Hora atual no servidor (com novo fuso): %', v_now;
END $$;
