-- ==========================================
-- Sistema de Proteção de Pedidos
-- Garante que nenhum pedido seja perdido
-- ==========================================

-- 1. TABELA: order_creation_logs
-- Registra TODAS as tentativas de criação de pedidos (sucesso ou falha)
CREATE TABLE IF NOT EXISTS order_creation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  customer_email TEXT NOT NULL,
  customer_whatsapp TEXT,
  quiz_data JSONB,
  order_data JSONB,
  status TEXT NOT NULL CHECK (status IN ('attempting', 'quiz_created', 'order_created', 'failed', 'recovered')),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  error_message TEXT,
  error_details JSONB,
  source TEXT NOT NULL CHECK (source IN ('frontend', 'edge_function', 'recovery', 'manual', 'trigger', 'backfill')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_creation_logs_session_id ON order_creation_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_order_creation_logs_customer_email ON order_creation_logs(customer_email);
CREATE INDEX IF NOT EXISTS idx_order_creation_logs_status ON order_creation_logs(status);
CREATE INDEX IF NOT EXISTS idx_order_creation_logs_created_at ON order_creation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_creation_logs_quiz_id ON order_creation_logs(quiz_id) WHERE quiz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_creation_logs_order_id ON order_creation_logs(order_id) WHERE order_id IS NOT NULL;

COMMENT ON TABLE order_creation_logs IS 
'Registra todas as tentativas de criação de pedidos para garantir que nenhum pedido seja perdido. 
Permite recuperação de pedidos que falharam durante a criação.';

-- 2. FUNÇÃO: create_order_atomic
-- Cria quiz + order em uma transação atômica (tudo ou nada)
CREATE OR REPLACE FUNCTION create_order_atomic(
  p_session_id UUID,
  p_customer_email TEXT,
  p_customer_whatsapp TEXT,
  p_quiz_data JSONB,
  p_plan TEXT,
  p_amount_cents INTEGER,
  p_provider TEXT,
  p_transaction_id TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'edge_function',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_quiz_id UUID;
  v_order_id UUID;
  v_result JSONB;
  v_error_text TEXT;
BEGIN
  -- Criar log inicial
  INSERT INTO order_creation_logs (
    session_id,
    customer_email,
    customer_whatsapp,
    quiz_data,
    order_data,
    status,
    source,
    ip_address,
    user_agent
  ) VALUES (
    p_session_id,
    LOWER(TRIM(p_customer_email)),
    p_customer_whatsapp,
    p_quiz_data,
    jsonb_build_object(
      'plan', p_plan,
      'amount_cents', p_amount_cents,
      'provider', p_provider,
      'transaction_id', p_transaction_id
    ),
    'attempting',
    p_source,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_log_id;

  BEGIN
    -- PASSO 1: Criar/atualizar quiz
    INSERT INTO quizzes (
      session_id,
      customer_email,
      customer_whatsapp,
      about_who,
      relationship,
      style,
      language,
      vocal_gender,
      qualities,
      memories,
      message,
      key_moments,
      occasion,
      desired_tone,
      answers,
      transaction_id
    ) VALUES (
      p_session_id,
      LOWER(TRIM(p_customer_email)),
      p_customer_whatsapp,
      p_quiz_data->>'about_who',
      (p_quiz_data->>'relationship')::TEXT,
      p_quiz_data->>'style',
      COALESCE(p_quiz_data->>'language', 'pt'),
      (p_quiz_data->>'vocal_gender')::TEXT,
      (p_quiz_data->>'qualities')::JSONB,
      (p_quiz_data->>'memories')::JSONB,
      (p_quiz_data->>'message')::TEXT,
      (p_quiz_data->>'key_moments')::JSONB,
      (p_quiz_data->>'occasion')::TEXT,
      (p_quiz_data->>'desired_tone')::TEXT,
      COALESCE((p_quiz_data->>'answers')::JSONB, '{}'::JSONB) || jsonb_build_object(
        'session_id', p_session_id::TEXT,
        'customer_email', LOWER(TRIM(p_customer_email)),
        'customer_whatsapp', p_customer_whatsapp
      ),
      p_transaction_id
    )
    ON CONFLICT (session_id) DO UPDATE SET
      customer_email = EXCLUDED.customer_email,
      customer_whatsapp = EXCLUDED.customer_whatsapp,
      about_who = EXCLUDED.about_who,
      relationship = EXCLUDED.relationship,
      style = EXCLUDED.style,
      language = EXCLUDED.language,
      vocal_gender = EXCLUDED.vocal_gender,
      qualities = EXCLUDED.qualities,
      memories = EXCLUDED.memories,
      message = EXCLUDED.message,
      key_moments = EXCLUDED.key_moments,
      occasion = EXCLUDED.occasion,
      desired_tone = EXCLUDED.desired_tone,
      answers = EXCLUDED.answers,
      transaction_id = EXCLUDED.transaction_id,
      updated_at = NOW()
    RETURNING id INTO v_quiz_id;

    -- Atualizar log com quiz_id
    UPDATE order_creation_logs
    SET 
      quiz_id = v_quiz_id,
      status = 'quiz_created',
      updated_at = NOW()
    WHERE id = v_log_id;

    -- PASSO 2: Criar order
    INSERT INTO orders (
      quiz_id,
      user_id,
      plan,
      amount_cents,
      status,
      provider,
      payment_provider,
      customer_email,
      customer_whatsapp,
      transaction_id
    ) VALUES (
      v_quiz_id,
      NULL,
      p_plan::TEXT,
      p_amount_cents,
      'pending',
      p_provider::TEXT,
      p_provider::TEXT,
      LOWER(TRIM(p_customer_email)),
      p_customer_whatsapp,
      p_transaction_id
    ) RETURNING id INTO v_order_id;

    -- Atualizar log com order_id e status final
    UPDATE order_creation_logs
    SET 
      order_id = v_order_id,
      status = 'order_created',
      updated_at = NOW()
    WHERE id = v_log_id;

    -- Retornar sucesso
    v_result := jsonb_build_object(
      'success', true,
      'quiz_id', v_quiz_id,
      'order_id', v_order_id,
      'log_id', v_log_id
    );

    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    -- Capturar erro e atualizar log
    GET STACKED DIAGNOSTICS v_error_text = MESSAGE_TEXT;
    
    UPDATE order_creation_logs
    SET 
      status = 'failed',
      error_message = v_error_text,
      error_details = jsonb_build_object(
        'sqlstate', SQLSTATE,
        'error_code', SQLERRM
      ),
      updated_at = NOW()
    WHERE id = v_log_id;

    -- Retornar erro
    RAISE EXCEPTION 'Erro ao criar pedido: % (Log ID: %)', v_error_text, v_log_id;
  END;
END;
$$;

COMMENT ON FUNCTION create_order_atomic IS 
'Cria quiz + order em uma transação atômica. 
Registra todas as tentativas em order_creation_logs para recuperação posterior.';

-- 3. FUNÇÃO: recover_failed_orders
-- Recupera pedidos que falharam durante a criação
CREATE OR REPLACE FUNCTION recover_failed_orders()
RETURNS TABLE(
  recovered_count INTEGER,
  recovered_order_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log RECORD;
  v_recovered_count INTEGER := 0;
  v_recovered_orders UUID[] := ARRAY[]::UUID[];
  v_order_id UUID;
BEGIN
  -- Buscar logs com quiz criado mas order não criado
  FOR v_log IN
    SELECT 
      id,
      session_id,
      customer_email,
      customer_whatsapp,
      quiz_id,
      quiz_data,
      order_data,
      created_at
    FROM order_creation_logs
    WHERE status = 'failed'
      AND quiz_id IS NOT NULL
      AND order_id IS NULL
      AND created_at > NOW() - INTERVAL '7 days' -- Apenas últimos 7 dias
    ORDER BY created_at DESC
  LOOP
    BEGIN
      -- Verificar se quiz ainda existe
      IF NOT EXISTS (SELECT 1 FROM quizzes WHERE id = v_log.quiz_id) THEN
        CONTINUE;
      END IF;

      -- Verificar se já existe order para este quiz
      SELECT id INTO v_order_id
      FROM orders
      WHERE quiz_id = v_log.quiz_id
      LIMIT 1;

      IF v_order_id IS NOT NULL THEN
        -- Order já existe, atualizar log
        UPDATE order_creation_logs
        SET 
          order_id = v_order_id,
          status = 'recovered',
          updated_at = NOW()
        WHERE id = v_log.id;
        
        v_recovered_count := v_recovered_count + 1;
        v_recovered_orders := array_append(v_recovered_orders, v_order_id);
        CONTINUE;
      END IF;

      -- Tentar criar order novamente
      INSERT INTO orders (
        quiz_id,
        user_id,
        plan,
        amount_cents,
        status,
        provider,
        payment_provider,
        customer_email,
        customer_whatsapp,
        transaction_id
      ) VALUES (
        v_log.quiz_id,
        NULL,
        (v_log.order_data->>'plan')::TEXT,
        (v_log.order_data->>'amount_cents')::INTEGER,
        'pending',
        (v_log.order_data->>'provider')::TEXT,
        (v_log.order_data->>'provider')::TEXT,
        v_log.customer_email,
        v_log.customer_whatsapp,
        (v_log.order_data->>'transaction_id')::TEXT
      ) RETURNING id INTO v_order_id;

      -- Atualizar log
      UPDATE order_creation_logs
      SET 
        order_id = v_order_id,
        status = 'recovered',
        updated_at = NOW()
      WHERE id = v_log.id;

      v_recovered_count := v_recovered_count + 1;
      v_recovered_orders := array_append(v_recovered_orders, v_order_id);

    EXCEPTION WHEN OTHERS THEN
      -- Logar erro mas continuar com próximo
      RAISE WARNING 'Erro ao recuperar pedido do log %: %', v_log.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_recovered_count, v_recovered_orders;
END;
$$;

COMMENT ON FUNCTION recover_failed_orders IS 
'Recupera pedidos que falharam durante a criação mas têm quiz válido. 
Executa automaticamente via pg_cron.';

-- 4. TRIGGER: Auto-log de criação de orders
-- Registra automaticamente quando um order é criado (backup adicional)
CREATE OR REPLACE FUNCTION log_order_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se não existe log para este order, criar um
  IF NOT EXISTS (
    SELECT 1 FROM order_creation_logs 
    WHERE order_id = NEW.id
  ) THEN
    INSERT INTO order_creation_logs (
      customer_email,
      customer_whatsapp,
      quiz_id,
      order_id,
      status,
      source,
      order_data
    ) VALUES (
      NEW.customer_email,
      NEW.customer_whatsapp,
      NEW.quiz_id,
      NEW.id,
      'order_created',
      'trigger',
      jsonb_build_object(
        'plan', NEW.plan,
        'amount_cents', NEW.amount_cents,
        'provider', NEW.provider,
        'status', NEW.status,
        'transaction_id', NEW.transaction_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_order_creation ON orders;
CREATE TRIGGER trigger_log_order_creation
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_creation();

-- 5. JOB pg_cron: Recuperação automática a cada hora
DO $$
DECLARE
  v_job_exists BOOLEAN;
BEGIN
  -- Verificar se job já existe
  SELECT EXISTS (
    SELECT 1 FROM cron.job 
    WHERE jobname = 'recover-failed-orders-hourly'
  ) INTO v_job_exists;

  IF NOT v_job_exists THEN
    PERFORM cron.schedule(
      'recover-failed-orders-hourly',
      '0 * * * *', -- A cada hora
      'SELECT recover_failed_orders();'
    );
  END IF;
END $$;

-- 6. VIEW: Pedidos em risco (quiz sem order)
CREATE OR REPLACE VIEW orders_at_risk AS
SELECT 
  q.id as quiz_id,
  q.session_id,
  q.customer_email,
  q.customer_whatsapp,
  q.created_at as quiz_created_at,
  ocl.id as log_id,
  ocl.status as log_status,
  ocl.error_message,
  ocl.created_at as log_created_at
FROM quizzes q
LEFT JOIN orders o ON o.quiz_id = q.id
LEFT JOIN order_creation_logs ocl ON ocl.quiz_id = q.id
WHERE o.id IS NULL
  AND q.created_at > NOW() - INTERVAL '7 days'
ORDER BY q.created_at DESC;

COMMENT ON VIEW orders_at_risk IS 
'Quizzes criados nos últimos 7 dias que não têm order associado. 
Indica possíveis pedidos perdidos.';

-- 7. GRANTs
GRANT SELECT, INSERT, UPDATE ON order_creation_logs TO authenticated;
GRANT SELECT ON orders_at_risk TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION recover_failed_orders TO authenticated;

