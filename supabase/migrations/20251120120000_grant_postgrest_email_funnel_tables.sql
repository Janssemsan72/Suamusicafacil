-- ==========================================
-- Adicionar Permissões PostgREST para Tabelas de Email Funnel
-- Resolve erro 404 (PGRST205) ao acessar via API REST
-- ==========================================

-- O PostgREST precisa de permissões básicas nas tabelas para poder acessá-las
-- O RLS vai controlar o acesso real baseado nas políticas

-- Verificar e adicionar permissões apenas se as tabelas existirem
DO $$
BEGIN
  -- Permissões para email_funnel_pending
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_funnel_pending') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON email_funnel_pending TO anon, authenticated, service_role;
    RAISE NOTICE '✅ Permissões adicionadas para email_funnel_pending';
  ELSE
    RAISE WARNING '⚠️ Tabela email_funnel_pending não existe. Execute a migration 20251111160320_create_email_funnel_tables.sql primeiro.';
  END IF;

  -- Permissões para email_funnel_completed
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_funnel_completed') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON email_funnel_completed TO anon, authenticated, service_role;
    RAISE NOTICE '✅ Permissões adicionadas para email_funnel_completed';
  ELSE
    RAISE WARNING '⚠️ Tabela email_funnel_completed não existe. Execute a migration 20251111160320_create_email_funnel_tables.sql primeiro.';
  END IF;

  -- Permissões para email_funnel_exited
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_funnel_exited') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON email_funnel_exited TO anon, authenticated, service_role;
    RAISE NOTICE '✅ Permissões adicionadas para email_funnel_exited';
  ELSE
    RAISE WARNING '⚠️ Tabela email_funnel_exited não existe. Execute a migration 20251111160320_create_email_funnel_tables.sql primeiro.';
  END IF;

  -- Permissões para a view unificada (se existir)
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'email_funnel_unified') THEN
    GRANT SELECT ON email_funnel_unified TO anon, authenticated, service_role;
    RAISE NOTICE '✅ Permissões adicionadas para email_funnel_unified';
  ELSE
    RAISE WARNING '⚠️ View email_funnel_unified não existe. Execute a migration 20251111160322_create_email_funnel_unified_view.sql primeiro.';
  END IF;
END $$;

