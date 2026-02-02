-- ==========================================
-- ATUALIZAR DELIVERY TIME PARA 22 HORAS NO PLANO EXPRESS
-- Recupera a versão anterior do template que mencionava 22 horas
-- ==========================================

-- Atualizar função get_order_paid_variables para retornar 22 horas no express
CREATE OR REPLACE FUNCTION get_order_paid_variables(
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
  order_data RECORD;
  user_data RECORD;
  release_date_text TEXT;
  delivery_time_text TEXT;
BEGIN
  -- Buscar dados do pedido
  SELECT 
    o.id,
    o.plan,
    o.created_at,
    o.user_id,
    q.about_who,
    q.style,
    s.release_at
  INTO order_data
  FROM orders o
  LEFT JOIN quizzes q ON o.quiz_id = q.id
  LEFT JOIN songs s ON o.id = s.order_id
  WHERE o.id = p_order_id;

  -- Buscar dados do usuário
  SELECT 
    u.email,
    COALESCE(p.display_name, u.email) as display_name,
    COALESCE(p.preferred_language, 'pt') as language
  INTO user_data
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE u.id = order_data.user_id;

  -- Formatar data de release de forma segura
  IF order_data.release_at IS NOT NULL THEN
    release_date_text := to_char(order_data.release_at, 'DD/MM/YYYY');
  ELSE
    release_date_text := to_char(order_data.created_at + interval '3 days', 'DD/MM/YYYY');
  END IF;

  -- ✅ ATUALIZADO: Express é 22 horas (conforme solicitado)
  IF order_data.plan = 'express' THEN
    delivery_time_text := CASE COALESCE(user_data.language, 'pt')
      WHEN 'pt' THEN '22 horas'
      WHEN 'es' THEN '22 horas'
      WHEN 'en' THEN '22 hours'
      ELSE '22 hours'
    END;
  ELSE
    delivery_time_text := CASE COALESCE(user_data.language, 'pt')
      WHEN 'pt' THEN '7 dias'
      WHEN 'es' THEN '7 días'
      WHEN 'en' THEN '7 days'
      ELSE '7 days'
    END;
  END IF;

  -- Montar objeto com as variáveis
  result := jsonb_build_object(
    'customer_name', COALESCE(user_data.display_name, user_data.email),
    'customer_email', user_data.email,
    'recipient_name', order_data.about_who,
    'about_who', order_data.about_who,
    'order_id', order_data.id::text,
    'style', order_data.style,
    'music_style', order_data.style,
    'plan', CASE 
      WHEN order_data.plan = 'standard' THEN (
        CASE COALESCE(user_data.language, 'pt')
          WHEN 'pt' THEN 'Standard (7 dias)'
          WHEN 'es' THEN 'Standard (7 días)'
          WHEN 'en' THEN 'Standard (7 days)'
          ELSE 'Standard (7 days)'
        END)
      WHEN order_data.plan = 'express' THEN (
        CASE COALESCE(user_data.language, 'pt')
          WHEN 'pt' THEN 'Express (22 horas)'
          WHEN 'es' THEN 'Expreso (22 horas)'
          WHEN 'en' THEN 'Express (22 hours)'
          ELSE 'Express (22 hours)'
        END)
      ELSE (
        CASE COALESCE(user_data.language, 'pt')
          WHEN 'pt' THEN 'Standard (7 dias)'
          WHEN 'es' THEN 'Standard (7 días)'
          WHEN 'en' THEN 'Standard (7 days)'
          ELSE 'Standard (7 days)'
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
'Extrai variáveis para template order_paid. Express plan retorna delivery_time: 22 horas e plan: Express (22 horas)';

