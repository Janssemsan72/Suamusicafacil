-- ==========================================
-- Cron Job para Migração Automática de Pedidos Pending
-- ==========================================
-- Este cron job executa automaticamente a migração de pedidos pending sem funil
-- Executa a cada 5 minutos para garantir que todos os pedidos tenham funis criados

-- Verificar se pg_cron está habilitado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension não está habilitada. Execute: CREATE EXTENSION IF NOT EXISTS pg_cron;';
  END IF;
END $$;

-- Remover cron job existente se houver (para evitar duplicatas)
SELECT cron.unschedule('auto-migrate-pending-orders-every-5min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-migrate-pending-orders-every-5min'
);

-- Criar cron job para executar migração automática a cada 5 minutos
SELECT cron.schedule(
  'auto-migrate-pending-orders-every-5min',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT auto_migrate_all_pending_orders();
  $$
);

-- Executar imediatamente após criar o cron job para processar pedidos pendentes
DO $$
DECLARE
  v_result RECORD;
  v_funnels_created INTEGER;
BEGIN
  SELECT funnels_created INTO v_funnels_created FROM auto_migrate_all_pending_orders() LIMIT 1;
  RAISE NOTICE '✅ Migração inicial executada: % funis criados', v_funnels_created;
END $$;

-- Comentário
COMMENT ON FUNCTION auto_migrate_all_pending_orders() IS 
'Migra automaticamente TODOS os pedidos pending que não têm funil. Processa até 500 pedidos por vez com retry automático. Executado automaticamente a cada 5 minutos via cron job.';

