-- ==========================================
-- Adicionar constraint para garantir WhatsApp válido
-- Execute este script se a tabela já existe
-- ==========================================

-- Adicionar constraint se não existir
DO $$
BEGIN
  -- Verificar se constraint já existe
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'whatsapp_funnel_customer_whatsapp_check'
  ) THEN
    ALTER TABLE whatsapp_funnel 
    ADD CONSTRAINT whatsapp_funnel_customer_whatsapp_check 
    CHECK (customer_whatsapp IS NOT NULL AND LENGTH(TRIM(customer_whatsapp)) > 0);
    
    RAISE NOTICE 'Constraint adicionada com sucesso';
  ELSE
    RAISE NOTICE 'Constraint já existe';
  END IF;
END $$;

