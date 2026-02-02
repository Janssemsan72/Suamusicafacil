-- ============================================================
-- LIMPAR TODOS OS DADOS DO ADMIN
-- ============================================================
-- Este script limpa TODOS os dados relacionados ao admin,
-- mantendo apenas a estrutura das tabelas.
-- Execute apenas quando quiser começar do zero.
-- ============================================================

-- Desabilitar triggers temporariamente para evitar erros
SET session_replication_role = 'replica';

-- ============================================================
-- 1. LIMPAR TABELAS DE DADOS DE PRODUÇÃO (ordem respeitando FKs)
-- ============================================================

-- Limpar tabelas dependentes primeiro (usando DO block para verificar existência)
DO $$
BEGIN
  -- Limpar tabelas dependentes primeiro
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stem_separations') THEN
    TRUNCATE TABLE public.stem_separations CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audio_generations') THEN
    TRUNCATE TABLE public.audio_generations CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lyrics_approvals') THEN
    TRUNCATE TABLE public.lyrics_approvals CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'songs') THEN
    TRUNCATE TABLE public.songs CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    TRUNCATE TABLE public.jobs CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_logs') THEN
    TRUNCATE TABLE public.email_logs CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_email_queue') THEN
    TRUNCATE TABLE public.payment_email_queue CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_retry_queue') THEN
    TRUNCATE TABLE public.quiz_retry_queue CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cakto_webhooks') THEN
    TRUNCATE TABLE public.cakto_webhooks CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_sessions') THEN
    TRUNCATE TABLE public.stripe_sessions CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_funnel') THEN
    TRUNCATE TABLE public.whatsapp_funnel CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'behavior_analytics') THEN
    TRUNCATE TABLE public.behavior_analytics CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_metrics') THEN
    TRUNCATE TABLE public.quiz_metrics CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    TRUNCATE TABLE public.orders CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quizzes') THEN
    TRUNCATE TABLE public.quizzes CASCADE;
  END IF;
END $$;

-- ============================================================
-- 2. LIMPAR TABELAS DE LOGS E HISTÓRICO
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_logs') THEN
    TRUNCATE TABLE public.admin_logs CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'n8n_webhook_events') THEN
    TRUNCATE TABLE public.n8n_webhook_events CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suno_credits_history') THEN
    TRUNCATE TABLE public.suno_credits_history CASCADE;
  END IF;
END $$;

-- ============================================================
-- 3. RESETAR CRÉDITOS SUNO (manter estrutura, resetar valores)
-- ============================================================

-- Se a tabela existir, resetar para valores iniciais
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suno_credits') THEN
    -- Deletar todos os registros
    DELETE FROM public.suno_credits;
    
    -- Inserir registro inicial (ajuste os valores conforme necessário)
    INSERT INTO public.suno_credits (id, credits, credits_used, total_credits, last_updated_at, created_at, updated_at)
    VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      0,
      0,
      0,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      credits = 0,
      credits_used = 0,
      total_credits = 0,
      last_updated_at = NOW(),
      updated_at = NOW();
  END IF;
END $$;

-- ============================================================
-- 4. LIMPAR DADOS DE ANALYTICS E MÉTRICAS
-- ============================================================
-- Nota: Estas tabelas já foram limpas na seção 1, mas mantemos aqui para garantir

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quiz_metrics') THEN
    TRUNCATE TABLE public.quiz_metrics CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'behavior_analytics') THEN
    TRUNCATE TABLE public.behavior_analytics CASCADE;
  END IF;
END $$;

-- ============================================================
-- 5. RESETAR SEQUENCES (se houver)
-- ============================================================

-- Resetar sequences relacionadas (ajuste conforme necessário)
DO $$
DECLARE
  seq_record RECORD;
BEGIN
  FOR seq_record IN 
    SELECT sequence_name 
    FROM information_schema.sequences 
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE 'ALTER SEQUENCE ' || quote_ident(seq_record.sequence_name) || ' RESTART WITH 1';
  END LOOP;
END $$;

-- ============================================================
-- 6. REABILITAR TRIGGERS
-- ============================================================

SET session_replication_role = 'origin';

-- ============================================================
-- 7. VERIFICAÇÃO FINAL
-- ============================================================

-- Verificar contagem de registros (deve ser 0 ou apenas dados de configuração)
DO $$
DECLARE
  order_count INTEGER;
  song_count INTEGER;
  quiz_count INTEGER;
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO order_count FROM public.orders;
  SELECT COUNT(*) INTO song_count FROM public.songs;
  SELECT COUNT(*) INTO quiz_count FROM public.quizzes;
  
  -- Verificar se tabela jobs existe antes de contar
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    SELECT COUNT(*) INTO job_count FROM public.jobs;
  ELSE
    job_count := 0;
  END IF;
  
  RAISE NOTICE 'Limpeza concluída!';
  RAISE NOTICE 'Pedidos: %', order_count;
  RAISE NOTICE 'Músicas: %', song_count;
  RAISE NOTICE 'Quizzes: %', quiz_count;
  RAISE NOTICE 'Jobs: %', job_count;
  
  IF order_count = 0 AND song_count = 0 AND quiz_count = 0 AND job_count = 0 THEN
    RAISE NOTICE '✅ Todos os dados foram limpos com sucesso!';
  ELSE
    RAISE WARNING '⚠️ Alguns dados ainda permanecem. Verifique as foreign keys.';
  END IF;
END $$;

-- ============================================================
-- NOTA: Este script NÃO remove:
-- - Tabelas de configuração (email_templates, whatsapp_templates_i18n, etc)
-- - Tabelas de usuários (profiles, user_roles, collaborators)
-- - Tabelas de conteúdo (faqs, testimonials, etc)
-- - Estrutura das tabelas
-- ============================================================

