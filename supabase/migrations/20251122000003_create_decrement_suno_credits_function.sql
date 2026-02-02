-- ==========================================
-- Função RPC para decrementar créditos da Suno
-- ==========================================
-- Esta função decrementa créditos de forma atômica
-- ==========================================

CREATE OR REPLACE FUNCTION decrement_suno_credits(amount INTEGER DEFAULT 12)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits INTEGER;
  v_current_used INTEGER;
  v_new_credits INTEGER;
  v_new_used INTEGER;
  v_result JSONB;
BEGIN
  -- Buscar créditos atuais
  SELECT credits, credits_used
  INTO v_current_credits, v_current_used
  FROM suno_credits
  WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
  
  -- Se não encontrar, criar registro inicial
  IF v_current_credits IS NULL THEN
    INSERT INTO suno_credits (id, credits, credits_used, total_credits)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 3466, 0, 3466)
    ON CONFLICT (id) DO NOTHING;
    
    SELECT credits, credits_used
    INTO v_current_credits, v_current_used
    FROM suno_credits
    WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;
  
  -- Calcular novos valores
  v_new_credits := GREATEST(0, COALESCE(v_current_credits, 0) - amount);
  v_new_used := COALESCE(v_current_used, 0) + amount;
  
  -- Atualizar créditos
  UPDATE suno_credits
  SET 
    credits = v_new_credits,
    credits_used = v_new_used,
    last_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
  
  -- Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'credits_before', v_current_credits,
    'credits_after', v_new_credits,
    'credits_used', v_new_used,
    'amount_decremented', amount
  );
  
  RETURN v_result;
END;
$$;

-- Comentário
COMMENT ON FUNCTION decrement_suno_credits(INTEGER) IS 
'Função para decrementar créditos da Suno de forma atômica. Retorna os valores antes e depois da atualização.';








