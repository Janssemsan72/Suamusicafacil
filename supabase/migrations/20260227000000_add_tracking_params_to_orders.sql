-- ==========================================
-- Adicionar tracking_params (sck, utm_*, gclid, etc.) à tabela orders
-- e incluir na função create_order_atomic para persistir entre dispositivos.
-- Também atualizar ensure_checkout_links_for_order para incluir tracking params na URL Cakto.
-- ==========================================

-- 1. Coluna tracking_params na tabela orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_params JSONB;
COMMENT ON COLUMN orders.tracking_params IS 'Tracking params (sck, utm_*, gclid, fbclid, etc.) capturados na landing page e persistidos para uso cross-device.';

-- 2. Recriar create_order_atomic com suporte a tracking_params
-- NOTA: p_tracking_params tem DEFAULT NULL para não quebrar chamadas existentes.
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

COMMENT ON FUNCTION create_order_atomic IS 'Cria quiz + order em transação atômica com tracking params. Usado pela Edge Function create-checkout.';

-- 3. Recriar ensure_checkout_links_for_order com suporte a tracking_params
CREATE OR REPLACE FUNCTION ensure_checkout_links_for_order(p_order_id UUID)
RETURNS TABLE (
  checkout_link_id UUID,
  checkout_token TEXT,
  cakto_url TEXT,
  checkout_url TEXT,
  edit_quiz_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_quiz RECORD;
  v_existing_link RECORD;
  v_token TEXT;
  v_checkout_link_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_base_url TEXT := 'https://musiclovely.com';
  v_locale TEXT;
  v_cakto_url TEXT;
  v_checkout_url TEXT;
  v_edit_quiz_url TEXT;
BEGIN
  SELECT
    o.id,
    o.customer_email,
    o.customer_whatsapp,
    o.quiz_id,
    o.cakto_payment_url,
    o.tracking_params
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % não encontrado', p_order_id;
  END IF;

  IF v_order.quiz_id IS NULL THEN
    RAISE EXCEPTION 'Pedido % não tem quiz_id', p_order_id;
  END IF;

  SELECT
    q.id,
    COALESCE(q.language, 'pt') as language
  INTO v_quiz
  FROM quizzes q
  WHERE q.id = v_order.quiz_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz % não encontrado', v_order.quiz_id;
  END IF;

  v_locale := v_quiz.language;

  SELECT
    cl.id,
    cl.token,
    cl.expires_at
  INTO v_existing_link
  FROM checkout_links cl
  WHERE cl.order_id = p_order_id
    AND cl.quiz_id = v_order.quiz_id
    AND cl.expires_at > NOW()
    AND cl.used_at IS NULL
  ORDER BY cl.created_at DESC
  LIMIT 1;

  IF v_existing_link IS NULL THEN
    v_token := encode(gen_random_bytes(32), 'hex');
    v_expires_at := NOW() + INTERVAL '48 hours';

    INSERT INTO checkout_links (
      order_id,
      quiz_id,
      token,
      expires_at
    ) VALUES (
      p_order_id,
      v_order.quiz_id,
      v_token,
      v_expires_at
    )
    RETURNING id INTO v_checkout_link_id;
  ELSE
    v_checkout_link_id := v_existing_link.id;
    v_token := v_existing_link.token;
  END IF;

  v_checkout_url := v_base_url || '/' || v_locale || '/checkout?order_id=' || p_order_id::TEXT || '&quiz_id=' || v_order.quiz_id::TEXT || '&token=' || v_token || '&restore=true';
  v_edit_quiz_url := v_base_url || '/' || v_locale || '/quiz?order_id=' || p_order_id::TEXT || '&quiz_id=' || v_order.quiz_id::TEXT || '&token=' || v_token || '&edit=true';

  IF v_order.cakto_payment_url IS NOT NULL AND v_order.cakto_payment_url != '' THEN
    v_cakto_url := v_order.cakto_payment_url;
  ELSIF v_order.customer_email IS NOT NULL AND v_order.customer_whatsapp IS NOT NULL THEN
    DECLARE
      v_normalized_whatsapp TEXT;
      v_cakto_base_url TEXT := 'https://pay.cakto.com.br/oqkhgvm_618383';
      v_redirect_url TEXT;
      v_tracking_key TEXT;
      v_tracking_value TEXT;
    BEGIN
      v_normalized_whatsapp := regexp_replace(v_order.customer_whatsapp, '[^0-9]', '', 'g');
      v_redirect_url := v_base_url || '/' || v_locale || '/payment-success';

      v_cakto_url := v_cakto_base_url ||
        '?order_id=' || p_order_id::TEXT ||
        '&email=' || v_order.customer_email ||
        '&whatsapp=' || v_normalized_whatsapp ||
        '&language=' || v_locale ||
        '&redirect_url=' || v_redirect_url;

      -- Adicionar tracking params do pedido à URL
      IF v_order.tracking_params IS NOT NULL AND v_order.tracking_params != '{}'::JSONB THEN
        FOR v_tracking_key, v_tracking_value IN
          SELECT key, value#>>'{}'
          FROM jsonb_each(v_order.tracking_params)
          WHERE value IS NOT NULL AND value#>>'{}' != ''
        LOOP
          v_cakto_url := v_cakto_url || '&' || v_tracking_key || '=' || v_tracking_value;
        END LOOP;
      END IF;

      UPDATE orders
      SET cakto_payment_url = v_cakto_url
      WHERE id = p_order_id;
    END;
  ELSE
    v_cakto_url := NULL;
  END IF;

  RETURN QUERY SELECT
    v_checkout_link_id,
    v_token,
    v_cakto_url,
    v_checkout_url,
    v_edit_quiz_url;
END;
$$;

COMMENT ON FUNCTION ensure_checkout_links_for_order IS 'Gera checkout links incluindo tracking params (sck, utm_*, etc.) na URL Cakto.';
