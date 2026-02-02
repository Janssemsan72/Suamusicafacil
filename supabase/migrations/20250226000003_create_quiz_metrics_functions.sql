-- Migration: Criar funções SQL para atualizar e consultar métricas
-- Objetivo: Automatizar coleta de métricas e facilitar consultas

-- Função para atualizar métricas do dia atual
CREATE OR REPLACE FUNCTION update_quiz_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  quizzes_count INTEGER;
  quizzes_with_session_count INTEGER;
  orders_count INTEGER;
  orders_with_quiz_count INTEGER;
  orders_without_quiz_count INTEGER;
  retry_queue_size_count INTEGER;
BEGIN
  -- Contar quizzes salvos hoje
  SELECT COUNT(*) INTO quizzes_count
  FROM quizzes
  WHERE DATE(created_at) = today;

  -- Contar quizzes salvos com session_id hoje
  SELECT COUNT(*) INTO quizzes_with_session_count
  FROM quizzes
  WHERE DATE(created_at) = today
    AND session_id IS NOT NULL;

  -- Contar pedidos criados hoje
  SELECT COUNT(*) INTO orders_count
  FROM orders
  WHERE DATE(created_at) = today;

  -- Contar pedidos com quiz_id vinculado hoje
  SELECT COUNT(*) INTO orders_with_quiz_count
  FROM orders
  WHERE DATE(created_at) = today
    AND quiz_id IS NOT NULL;

  -- Contar pedidos sem quiz_id hoje
  SELECT COUNT(*) INTO orders_without_quiz_count
  FROM orders
  WHERE DATE(created_at) = today
    AND quiz_id IS NULL;

  -- Contar tamanho da fila de retry
  SELECT COUNT(*) INTO retry_queue_size_count
  FROM quiz_retry_queue
  WHERE status IN ('pending', 'processing');

  -- Calcular quizzes perdidos (estimativa: quizzes sem pedido associado criados hoje)
  -- Esta é uma estimativa, pois um quiz pode ser usado em um pedido criado em outro dia
  -- Mas dá uma ideia de quantos quizzes não foram vinculados

  -- UPSERT na tabela de métricas
  INSERT INTO quiz_metrics (
    metric_date,
    quizzes_saved,
    quizzes_saved_with_session_id,
    orders_created,
    orders_with_quiz,
    orders_without_quiz,
    retry_queue_size,
    updated_at
  )
  VALUES (
    today,
    quizzes_count,
    quizzes_with_session_count,
    orders_count,
    orders_with_quiz_count,
    orders_without_quiz_count,
    retry_queue_size_count,
    NOW()
  )
  ON CONFLICT (metric_date)
  DO UPDATE SET
    quizzes_saved = EXCLUDED.quizzes_saved,
    quizzes_saved_with_session_id = EXCLUDED.quizzes_saved_with_session_id,
    orders_created = EXCLUDED.orders_created,
    orders_with_quiz = EXCLUDED.orders_with_quiz,
    orders_without_quiz = EXCLUDED.orders_without_quiz,
    retry_queue_size = EXCLUDED.retry_queue_size,
    updated_at = NOW();
END;
$$;

-- Função para consultar métricas por período
CREATE OR REPLACE FUNCTION get_quiz_metrics(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  metric_date DATE,
  quizzes_saved INTEGER,
  quizzes_saved_with_session_id INTEGER,
  orders_created INTEGER,
  orders_with_quiz INTEGER,
  orders_without_quiz INTEGER,
  quizzes_lost INTEGER,
  retry_queue_size INTEGER,
  success_rate NUMERIC,
  session_id_adoption_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    qm.metric_date,
    qm.quizzes_saved,
    qm.quizzes_saved_with_session_id,
    qm.orders_created,
    qm.orders_with_quiz,
    qm.orders_without_quiz,
    qm.quizzes_lost,
    qm.retry_queue_size,
    -- Taxa de sucesso: pedidos com quiz / pedidos criados
    CASE
      WHEN qm.orders_created > 0 THEN
        ROUND((qm.orders_with_quiz::NUMERIC / qm.orders_created::NUMERIC) * 100, 2)
      ELSE 0
    END AS success_rate,
    -- Taxa de adoção de session_id: quizzes com session_id / quizzes salvos
    CASE
      WHEN qm.quizzes_saved > 0 THEN
        ROUND((qm.quizzes_saved_with_session_id::NUMERIC / qm.quizzes_saved::NUMERIC) * 100, 2)
      ELSE 0
    END AS session_id_adoption_rate
  FROM quiz_metrics qm
  WHERE qm.metric_date BETWEEN start_date AND end_date
  ORDER BY qm.metric_date DESC;
END;
$$;

-- Comentários
COMMENT ON FUNCTION update_quiz_metrics() IS 'Atualiza métricas do dia atual. Deve ser chamada periodicamente (via trigger ou cron).';
COMMENT ON FUNCTION get_quiz_metrics(DATE, DATE) IS 'Retorna métricas agregadas por período. Inclui taxas de sucesso e adoção de session_id.';

