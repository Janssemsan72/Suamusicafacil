-- ==========================================
-- Aplicar create_order_atomic manualmente no banco remoto
-- Use quando: "Could not find the function create_order_atomic in the schema cache"
-- Como usar: Supabase Dashboard > SQL Editor > colar e executar
-- ==========================================

-- 1. TABELA order_creation_logs (se não existir)
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

-- 1.1. Coluna order_id na tabela quizzes (exigida pela create_order_atomic)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quizzes_order_id ON quizzes(order_id) WHERE order_id IS NOT NULL;
COMMENT ON COLUMN quizzes.order_id IS 'Pedido vinculado a este quiz (preenchido após criar o order em create_order_atomic).';

-- 2. FUNÇÃO create_order_atomic (versão mais recente - com tracking_params)
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
  p_user_agent TEXT DEFAULT NULL,
  p_tracking_params JSONB DEFAULT NULL
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
  v_transaction_id_uuid UUID;
BEGIN
  IF p_transaction_id IS NOT NULL AND p_transaction_id != '' THEN
    BEGIN
      v_transaction_id_uuid := p_transaction_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_transaction_id_uuid := NULL;
    END;
  ELSE
    v_transaction_id_uuid := NULL;
  END IF;

  INSERT INTO order_creation_logs (
    session_id, customer_email, customer_whatsapp, quiz_data, order_data,
    status, source, ip_address, user_agent
  ) VALUES (
    p_session_id, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data,
    jsonb_build_object('plan', p_plan, 'amount_cents', p_amount_cents, 'provider', p_provider, 'transaction_id', p_transaction_id),
    'attempting', p_source, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;

  BEGIN
    IF p_session_id IS NOT NULL THEN
      SELECT id INTO v_quiz_id FROM quizzes WHERE session_id = p_session_id AND order_id IS NOT NULL LIMIT 1;

      IF v_quiz_id IS NOT NULL THEN
        INSERT INTO quizzes (session_id, customer_email, customer_whatsapp, about_who, relationship, style, language, vocal_gender, qualities, memories, message, key_moments, occasion, desired_tone, answers, transaction_id)
        VALUES (NULL, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data->>'about_who', (p_quiz_data->>'relationship')::TEXT, p_quiz_data->>'style', COALESCE(p_quiz_data->>'language', 'pt'), (p_quiz_data->>'vocal_gender')::TEXT, (p_quiz_data->>'qualities')::JSONB, (p_quiz_data->>'memories')::JSONB, (p_quiz_data->>'message')::TEXT, (p_quiz_data->>'key_moments')::JSONB, (p_quiz_data->>'occasion')::TEXT, (p_quiz_data->>'desired_tone')::TEXT, COALESCE((p_quiz_data->>'answers')::JSONB, '{}'::JSONB) || jsonb_build_object('session_id', p_session_id::TEXT, 'customer_email', LOWER(TRIM(p_customer_email)), 'customer_whatsapp', p_customer_whatsapp), p_transaction_id)
        RETURNING id INTO v_quiz_id;
      ELSE
        INSERT INTO quizzes (session_id, customer_email, customer_whatsapp, about_who, relationship, style, language, vocal_gender, qualities, memories, message, key_moments, occasion, desired_tone, answers, transaction_id)
        VALUES (p_session_id, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data->>'about_who', (p_quiz_data->>'relationship')::TEXT, p_quiz_data->>'style', COALESCE(p_quiz_data->>'language', 'pt'), (p_quiz_data->>'vocal_gender')::TEXT, (p_quiz_data->>'qualities')::JSONB, (p_quiz_data->>'memories')::JSONB, (p_quiz_data->>'message')::TEXT, (p_quiz_data->>'key_moments')::JSONB, (p_quiz_data->>'occasion')::TEXT, (p_quiz_data->>'desired_tone')::TEXT, COALESCE((p_quiz_data->>'answers')::JSONB, '{}'::JSONB) || jsonb_build_object('session_id', p_session_id::TEXT, 'customer_email', LOWER(TRIM(p_customer_email)), 'customer_whatsapp', p_customer_whatsapp), p_transaction_id)
        ON CONFLICT (session_id) DO UPDATE SET customer_email = EXCLUDED.customer_email, customer_whatsapp = EXCLUDED.customer_whatsapp, about_who = EXCLUDED.about_who, relationship = EXCLUDED.relationship, style = EXCLUDED.style, language = EXCLUDED.language, vocal_gender = EXCLUDED.vocal_gender, qualities = EXCLUDED.qualities, memories = EXCLUDED.memories, message = EXCLUDED.message, key_moments = EXCLUDED.key_moments, occasion = EXCLUDED.occasion, desired_tone = EXCLUDED.desired_tone, answers = EXCLUDED.answers, transaction_id = EXCLUDED.transaction_id, updated_at = NOW()
        RETURNING id INTO v_quiz_id;
      END IF;
    ELSE
      INSERT INTO quizzes (session_id, customer_email, customer_whatsapp, about_who, relationship, style, language, vocal_gender, qualities, memories, message, key_moments, occasion, desired_tone, answers, transaction_id)
      VALUES (NULL, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data->>'about_who', (p_quiz_data->>'relationship')::TEXT, p_quiz_data->>'style', COALESCE(p_quiz_data->>'language', 'pt'), (p_quiz_data->>'vocal_gender')::TEXT, (p_quiz_data->>'qualities')::JSONB, (p_quiz_data->>'memories')::JSONB, (p_quiz_data->>'message')::TEXT, (p_quiz_data->>'key_moments')::JSONB, (p_quiz_data->>'occasion')::TEXT, (p_quiz_data->>'desired_tone')::TEXT, COALESCE((p_quiz_data->>'answers')::JSONB, '{}'::JSONB) || jsonb_build_object('customer_email', LOWER(TRIM(p_customer_email)), 'customer_whatsapp', p_customer_whatsapp), p_transaction_id)
      RETURNING id INTO v_quiz_id;
    END IF;

    UPDATE order_creation_logs SET quiz_id = v_quiz_id, status = 'quiz_created', updated_at = NOW() WHERE id = v_log_id;

    INSERT INTO orders (quiz_id, user_id, plan, amount_cents, total_cents, currency, status, provider, payment_provider, customer_email, customer_whatsapp, transaction_id, tracking_params)
    VALUES (v_quiz_id, NULL, p_plan::TEXT, p_amount_cents, p_amount_cents, 'BRL', 'pending', p_provider::TEXT, p_provider::TEXT, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, v_transaction_id_uuid, p_tracking_params)
    RETURNING id INTO v_order_id;

    UPDATE quizzes SET order_id = v_order_id, updated_at = NOW() WHERE id = v_quiz_id;
    UPDATE order_creation_logs SET order_id = v_order_id, status = 'order_created', updated_at = NOW() WHERE id = v_log_id;

    v_result := jsonb_build_object('success', true, 'quiz_id', v_quiz_id, 'order_id', v_order_id, 'log_id', v_log_id);
    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_text = MESSAGE_TEXT;
    UPDATE order_creation_logs SET status = 'failed', error_message = v_error_text, error_details = jsonb_build_object('sqlstate', SQLSTATE, 'error_code', SQLERRM), updated_at = NOW() WHERE id = v_log_id;
    RAISE EXCEPTION 'Erro ao criar pedido: % (Log ID: %)', v_error_text, v_log_id;
  END;
END;
$$;

COMMENT ON FUNCTION create_order_atomic IS 'Cria quiz + order em transação atômica. Usado pela Edge Function create-checkout.';
