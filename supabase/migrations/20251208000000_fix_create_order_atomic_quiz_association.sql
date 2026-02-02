-- Migration: Corrigir função create_order_atomic para não atualizar quiz já associado a pedido
-- Problema: Quando um cliente faz múltiplos pedidos, o UPSERT por session_id atualiza o quiz antigo
-- Solução: Verificar se quiz já está associado a pedido antes de fazer UPSERT

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
  v_existing_quiz_id UUID;
  v_existing_order_id UUID;
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
    -- ✅ CORREÇÃO: Verificar se quiz já está associado a pedido antes de fazer UPSERT
    IF p_session_id IS NOT NULL THEN
      -- Verificar se já existe quiz com este session_id
      SELECT id INTO v_existing_quiz_id
      FROM quizzes
      WHERE session_id = p_session_id
      LIMIT 1;
      
      -- Se quiz existe, verificar se está associado a algum pedido
      IF v_existing_quiz_id IS NOT NULL THEN
        SELECT id INTO v_existing_order_id
        FROM orders
        WHERE quiz_id = v_existing_quiz_id
        LIMIT 1;
        
        -- Se quiz já está associado a um pedido, criar novo quiz em vez de atualizar
        IF v_existing_order_id IS NOT NULL THEN
          -- Criar novo quiz (sem session_id para evitar conflito)
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
            NULL, -- Não usar session_id para novo quiz (evitar conflito)
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
          ) RETURNING id INTO v_quiz_id;
        ELSE
          -- Quiz existe mas não está associado a pedido - pode atualizar
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
        END IF;
      ELSE
        -- Quiz não existe - criar novo
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
      END IF;
    ELSE
      -- Sem session_id - criar novo quiz normalmente
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
        NULL,
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
          'customer_email', LOWER(TRIM(p_customer_email)),
          'customer_whatsapp', p_customer_whatsapp
        ),
        p_transaction_id
      ) RETURNING id INTO v_quiz_id;
    END IF;

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
      -- ✅ CORREÇÃO: Converter transaction_id de TEXT para UUID se necessário
      CASE 
        WHEN p_transaction_id IS NULL THEN NULL
        WHEN p_transaction_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_transaction_id::UUID
        ELSE NULL -- Se não for um UUID válido, usar NULL
      END
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
Verifica se quiz já está associado a pedido antes de fazer UPSERT.
Se estiver associado, cria novo quiz em vez de atualizar o antigo.
Registra todas as tentativas em order_creation_logs para recuperação posterior.';
