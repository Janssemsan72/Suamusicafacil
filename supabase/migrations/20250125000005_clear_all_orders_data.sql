-- ============================================================
-- MIGRAÇÃO: Limpar todos os dados de pedidos
-- Data: 2025-01-25
-- Descrição: Remove todos os dados de pedidos e tabelas relacionadas
--            para limpar dados do projeto anterior que foram copiados
-- ============================================================

-- ============================================================
-- ATENÇÃO: Esta migração irá DELETAR TODOS os dados de pedidos
-- ============================================================

-- Desabilitar temporariamente triggers que possam interferir
SET session_replication_role = 'replica';

-- ============================================================
-- 1. LIMPAR TABELAS FILHAS (que referenciam orders)
-- ============================================================
-- Ordem de deleção respeitando foreign keys
-- Todas as operações verificam se a tabela existe antes de deletar

DO $$
BEGIN
  -- Tabelas com ON DELETE CASCADE (serão deletadas automaticamente, mas vamos limpar explicitamente)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_email_queue') THEN
    DELETE FROM payment_email_queue;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refunds') THEN
    DELETE FROM refunds;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'adjustments') THEN
    DELETE FROM adjustments;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audio_generations') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'audio_generations' AND column_name = 'order_id'
    ) THEN
      DELETE FROM audio_generations WHERE order_id IS NOT NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_costs') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'api_costs' AND column_name = 'order_id'
    ) THEN
      DELETE FROM api_costs WHERE order_id IS NOT NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pix_sales') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'pix_sales' AND column_name = 'order_id'
    ) THEN
      DELETE FROM pix_sales WHERE order_id IS NOT NULL;
    END IF;
  END IF;

  -- Tabelas que podem ter referências a orders (verificar se existem)
  -- Limpar tabelas que podem não existir em todos os projetos
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cakto_webhook_logs') THEN
    DELETE FROM cakto_webhook_logs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cakto_webhooks') THEN
    DELETE FROM cakto_webhooks;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checkout_events') THEN
    DELETE FROM checkout_events;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checkout_links') THEN
    DELETE FROM checkout_links;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_funnel_completed') THEN
    DELETE FROM email_funnel_completed;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_funnel_exited') THEN
    DELETE FROM email_funnel_exited;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_funnel_pending') THEN
    DELETE FROM email_funnel_pending;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_logs') THEN
    DELETE FROM email_logs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'song_assets') THEN
    DELETE FROM song_assets;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'generated_lyrics') THEN
    DELETE FROM generated_lyrics;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'generated_music') THEN
    DELETE FROM generated_music;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    DELETE FROM jobs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lyrics_approvals') THEN
    DELETE FROM lyrics_approvals;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lyrics_generated') THEN
    DELETE FROM lyrics_generated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'n8n_webhook_events') THEN
    DELETE FROM n8n_webhook_events;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_creation_logs') THEN
    DELETE FROM order_creation_logs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_analytics') THEN
    DELETE FROM purchase_analytics;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'songs') THEN
    DELETE FROM songs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suno_credits_history') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'suno_credits_history' AND column_name = 'order_id'
    ) THEN
      DELETE FROM suno_credits_history WHERE order_id IS NOT NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_funnel_completed') THEN
    DELETE FROM whatsapp_funnel_completed;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_funnel_exited') THEN
    DELETE FROM whatsapp_funnel_exited;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_funnel') THEN
    DELETE FROM whatsapp_funnel;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_funnel_pending') THEN
    DELETE FROM whatsapp_funnel_pending;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_interactions') THEN
    DELETE FROM whatsapp_interactions;
  END IF;

  -- Limpar quizzes que referenciam orders (se a coluna order_id existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quizzes') THEN
    -- Verificar se a coluna order_id existe antes de atualizar
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'quizzes' 
      AND column_name = 'order_id'
    ) THEN
      UPDATE quizzes SET order_id = NULL WHERE order_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 2. LIMPAR TABELA ORDERS
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    DELETE FROM orders;
    RAISE NOTICE '✅ Tabela orders limpa com sucesso';
  ELSE
    RAISE NOTICE '⚠️ Tabela orders não existe no banco de dados';
  END IF;
END $$;

-- ============================================================
-- 3. REABILITAR TRIGGERS
-- ============================================================
SET session_replication_role = 'origin';

-- ============================================================
-- 4. VERIFICAÇÃO FINAL
-- ============================================================
DO $$
DECLARE
  orders_count INTEGER := 0;
  payment_queue_count INTEGER := 0;
  refunds_count INTEGER := 0;
BEGIN
  -- Contar registros restantes (verificando se as tabelas existem)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    SELECT COUNT(*) INTO orders_count FROM orders;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_email_queue') THEN
    SELECT COUNT(*) INTO payment_queue_count FROM payment_email_queue;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refunds') THEN
    SELECT COUNT(*) INTO refunds_count FROM refunds;
  END IF;

  -- Exibir resultado
  RAISE NOTICE '✅ Limpeza concluída:';
  RAISE NOTICE '   - Orders: % registros restantes', orders_count;
  RAISE NOTICE '   - Payment Email Queue: % registros restantes', payment_queue_count;
  RAISE NOTICE '   - Refunds: % registros restantes', refunds_count;

  IF orders_count > 0 OR payment_queue_count > 0 OR refunds_count > 0 THEN
    RAISE WARNING '⚠️ Ainda existem registros nas tabelas de pedidos. Verifique manualmente.';
  ELSE
    RAISE NOTICE '✅ Todos os dados de pedidos foram removidos com sucesso!';
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE orders IS 'Tabela de pedidos - dados limpos em 2025-01-25 para remover dados do projeto anterior';

