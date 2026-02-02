-- ==========================================
-- Função de Diagnóstico: Pedidos Pending sem Funil
-- ==========================================
-- Retorna lista detalhada de pedidos pending sem funil e motivo pelo qual não foram migrados

CREATE OR REPLACE FUNCTION diagnose_pending_orders_without_funnel()
RETURNS TABLE(
  order_id UUID,
  customer_email TEXT,
  customer_whatsapp TEXT,
  quiz_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  pending_at TIMESTAMPTZ,
  reason TEXT,
  can_create_funnel BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  RETURN QUERY
  SELECT 
    o.id::UUID,                    -- order_id
    o.customer_email::TEXT,         -- customer_email
    o.customer_whatsapp::TEXT,      -- customer_whatsapp
    o.quiz_id::UUID,                -- quiz_id
    o.status::TEXT,                 -- status
    o.created_at::TIMESTAMPTZ,      -- created_at
    o.pending_at::TIMESTAMPTZ,      -- pending_at
    (CASE
      WHEN o.customer_whatsapp IS NULL THEN 'Sem WhatsApp (NULL)'
      WHEN TRIM(o.customer_whatsapp) = '' THEN 'WhatsApp vazio'
      WHEN o.quiz_id IS NULL THEN 'Sem quiz_id'
      WHEN EXISTS (
        SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
      ) THEN 'Já tem funil'
      ELSE 'Pode criar funil'
    END)::TEXT,                     -- reason
    (CASE
      WHEN o.customer_whatsapp IS NOT NULL 
        AND TRIM(o.customer_whatsapp) != ''
        AND o.quiz_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
          UNION ALL
          SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
          UNION ALL
          SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
        ) THEN TRUE
      ELSE FALSE
    END)::BOOLEAN                   -- can_create_funnel
  FROM orders o
  WHERE o.status = 'pending'
    AND (
      -- Incluir todos os pedidos pending, mesmo os que não podem ter funil
      o.customer_whatsapp IS NULL 
      OR TRIM(o.customer_whatsapp) = ''
      OR o.quiz_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
        UNION ALL
        SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
      )
    )
  ORDER BY 
    (CASE
      WHEN o.customer_whatsapp IS NOT NULL 
        AND TRIM(o.customer_whatsapp) != ''
        AND o.quiz_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_funnel_pending wfp WHERE wfp.order_id = o.id
          UNION ALL
          SELECT 1 FROM whatsapp_funnel_completed wfc WHERE wfc.order_id = o.id
          UNION ALL
          SELECT 1 FROM whatsapp_funnel_exited wfe WHERE wfe.order_id = o.id
        ) THEN TRUE
      ELSE FALSE
    END) DESC, -- Primeiro os que podem ter funil
    o.created_at ASC;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION diagnose_pending_orders_without_funnel() TO authenticated, service_role;

-- Comentário
COMMENT ON FUNCTION diagnose_pending_orders_without_funnel() IS 
'Diagnostica pedidos pending sem funil, retornando motivo pelo qual não foram migrados e se podem ter funil criado.';

