-- ==========================================
-- ATUALIZAR FUNÇÃO get_order_paid_variables
-- Adiciona customer_name e melhora extração de dados
-- ==========================================

CREATE OR REPLACE FUNCTION get_order_paid_variables(
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
  order_data RECORD;
  user_data RECORD;
  release_date_text TEXT;
  delivery_time_text TEXT;
  customer_name_final TEXT;
BEGIN
  -- Buscar dados do pedido (incluindo cakto_customer_name se disponível)
  SELECT 
    o.id,
    o.plan,
    o.created_at,
    o.user_id,
    o.customer_email,
    o.cakto_customer_name,
    q.about_who,
    q.style,
    s.release_at
  INTO order_data
  FROM orders o
  LEFT JOIN quizzes q ON o.quiz_id = q.id
  LEFT JOIN songs s ON o.id = s.order_id
  WHERE o.id = p_order_id;

  -- Buscar dados do usuário (se user_id existir)
  IF order_data.user_id IS NOT NULL THEN
    SELECT 
      u.email,
      COALESCE(p.display_name, u.email) as display_name,
      COALESCE(p.preferred_language, 'es') as language
    INTO user_data
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE u.id = order_data.user_id;
  ELSE
    -- Se não tiver user_id, usar dados do pedido
    user_data.email := order_data.customer_email;
    user_data.display_name := NULL;
    user_data.language := 'es';
  END IF;

  -- Determinar nome do cliente (prioridade: cakto_customer_name > display_name > email)
  customer_name_final := COALESCE(
    order_data.cakto_customer_name,
    user_data.display_name,
    SPLIT_PART(COALESCE(user_data.email, order_data.customer_email, 'Cliente'), '@', 1)
  );

  -- Formatar data de release de forma segura
  IF order_data.release_at IS NOT NULL THEN
    release_date_text := to_char(order_data.release_at, 'DD/MM/YYYY');
  ELSE
    IF order_data.plan = 'express' THEN
      release_date_text := to_char(order_data.created_at + interval '1 day', 'DD/MM/YYYY');
    ELSE
      release_date_text := to_char(order_data.created_at + interval '7 days', 'DD/MM/YYYY');
    END IF;
  END IF;

  -- Definir prazo conforme plano e idioma
  IF order_data.plan = 'express' THEN
    delivery_time_text := CASE COALESCE(user_data.language, 'es')
      WHEN 'pt' THEN '24 horas'
      WHEN 'es' THEN '24 horas'
      WHEN 'en' THEN '24 hours'
      ELSE '24 horas'
    END;
  ELSE
    delivery_time_text := CASE COALESCE(user_data.language, 'es')
      WHEN 'pt' THEN '7 dias'
      WHEN 'es' THEN '7 días'
      WHEN 'en' THEN '7 days'
      ELSE '7 días'
    END;
  END IF;

  -- Montar objeto com as variáveis
  result := jsonb_build_object(
    'customer_name', customer_name_final,
    'customer_email', COALESCE(user_data.email, order_data.customer_email),
    'recipient_name', COALESCE(order_data.about_who, 'alguien especial'),
    'about_who', COALESCE(order_data.about_who, 'alguien especial'),
    'order_id', order_data.id::text,
    'style', COALESCE(order_data.style, 'Personalizado'),
    'music_style', COALESCE(order_data.style, 'Personalizado'),
    'plan', CASE 
      WHEN order_data.plan = 'standard' THEN (
        CASE COALESCE(user_data.language, 'es')
          WHEN 'pt' THEN 'Standard (7 dias)'
          WHEN 'es' THEN 'Standard (7 días)'
          WHEN 'en' THEN 'Standard (7 days)'
          ELSE 'Standard (7 días)'
        END)
      WHEN order_data.plan = 'express' THEN (
        CASE COALESCE(user_data.language, 'es')
          WHEN 'pt' THEN 'Express (24 horas)'
          WHEN 'es' THEN 'Expreso (24 horas)'
          WHEN 'en' THEN 'Express (24 hours)'
          ELSE 'Expreso (24 horas)'
        END)
      ELSE (
        CASE COALESCE(user_data.language, 'es')
          WHEN 'pt' THEN 'Standard (7 dias)'
          WHEN 'es' THEN 'Standard (7 días)'
          WHEN 'en' THEN 'Standard (7 days)'
          ELSE 'Standard (7 días)'
        END)
    END,
    'delivery_time', delivery_time_text,
    'release_date', release_date_text
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário de documentação
COMMENT ON FUNCTION get_order_paid_variables(UUID) IS 
'Extrai variáveis para template order_paid. Inclui customer_name (prioridade: cakto_customer_name > display_name > email), about_who (para quem é a música), e todas as informações do pedido.';




















