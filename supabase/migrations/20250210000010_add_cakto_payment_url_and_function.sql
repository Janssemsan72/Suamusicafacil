-- ==========================================
-- Adicionar cakto_payment_url em orders e função SQL
-- ==========================================

-- Adicionar coluna cakto_payment_url se não existir
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cakto_payment_url TEXT;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_orders_cakto_payment_url ON orders(cakto_payment_url) WHERE cakto_payment_url IS NOT NULL;

-- Função SQL para garantir checkout links para um pedido
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
  v_base_url TEXT;
  v_locale TEXT;
  v_cakto_url TEXT;
  v_checkout_url TEXT;
  v_edit_quiz_url TEXT;
BEGIN
  -- Buscar dados do pedido
  SELECT 
    o.id,
    o.customer_email,
    o.customer_whatsapp,
    o.quiz_id,
    o.cakto_payment_url
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % não encontrado', p_order_id;
  END IF;
  
  IF v_order.quiz_id IS NULL THEN
    RAISE EXCEPTION 'Pedido % não tem quiz_id', p_order_id;
  END IF;
  
  -- Buscar dados do quiz
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
  -- Usar URL padrão se não houver configuração
  v_base_url := COALESCE(
    NULLIF(current_setting('app.settings.site_url', true), ''),
    'https://musiclovely.com'
  );
  
  -- Verificar se já existe checkout_link válido
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
  
  -- Se não existe ou expirou, criar novo
  IF v_existing_link IS NULL THEN
    -- Gerar token seguro
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Criar checkout link (válido por 48 horas)
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
  
  -- Gerar URLs (usar URL encoding para parâmetros)
  v_checkout_url := v_base_url || '/' || v_locale || '/checkout?order_id=' || p_order_id::TEXT || '&quiz_id=' || v_order.quiz_id::TEXT || '&token=' || v_token || '&restore=true';
  v_edit_quiz_url := v_base_url || '/' || v_locale || '/quiz?order_id=' || p_order_id::TEXT || '&quiz_id=' || v_order.quiz_id::TEXT || '&token=' || v_token || '&edit=true';
  
  -- Gerar ou usar URL da Cakto existente
  IF v_order.cakto_payment_url IS NOT NULL THEN
    v_cakto_url := v_order.cakto_payment_url;
  ELSIF v_order.customer_email IS NOT NULL AND v_order.customer_whatsapp IS NOT NULL THEN
    -- Normalizar WhatsApp (apenas números)
    DECLARE
      v_normalized_whatsapp TEXT;
      v_cakto_base_url TEXT := 'https://pay.cakto.com.br/oqkhgvm_618383';
      v_redirect_url TEXT;
      v_cakto_params TEXT;
    BEGIN
      v_normalized_whatsapp := regexp_replace(v_order.customer_whatsapp, '[^0-9]', '', 'g');
      v_redirect_url := v_base_url || '/' || v_locale || '/payment-success';
      
      -- Construir parâmetros da Cakto usando URL encoding adequado
      v_cakto_params := 'order_id=' || p_order_id::TEXT || 
                       '&email=' || v_order.customer_email ||
                       '&whatsapp=' || v_normalized_whatsapp ||
                       '&language=' || v_locale ||
                       '&redirect_url=' || v_redirect_url;
      
      v_cakto_url := v_cakto_base_url || '?' || v_cakto_params;
      
      -- Salvar URL da Cakto no pedido
      UPDATE orders
      SET cakto_payment_url = v_cakto_url
      WHERE id = p_order_id;
    END;
  END IF;
  
  -- Retornar resultados
  RETURN QUERY SELECT
    v_checkout_link_id,
    v_token,
    v_cakto_url,
    v_checkout_url,
    v_edit_quiz_url;
END;
$$;

-- Comentários
COMMENT ON FUNCTION ensure_checkout_links_for_order(UUID) IS 
'Garante que um pedido tenha checkout links criados (interno e Cakto). Retorna todos os links necessários.';

-- Garantir permissões
GRANT EXECUTE ON FUNCTION ensure_checkout_links_for_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_checkout_links_for_order(UUID) TO service_role;

