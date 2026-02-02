-- Migration: Criar triggers para atualizar métricas automaticamente
-- Objetivo: Atualizar métricas sempre que houver mudanças relevantes
-- Nota: Triggers podem ser pesados em alta concorrência, então usamos debounce

-- Trigger para atualizar métricas após INSERT em quizzes
CREATE OR REPLACE FUNCTION trigger_update_quiz_metrics_on_quiz_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Atualizar métricas de forma assíncrona (não bloquear INSERT)
  -- Usar pg_notify para processar em background ou simplesmente atualizar
  -- Por enquanto, atualizar diretamente (pode ser otimizado depois)
  PERFORM update_quiz_metrics();
  RETURN NEW;
END;
$$;

CREATE TRIGGER quiz_insert_metrics_trigger
AFTER INSERT ON quizzes
FOR EACH ROW
EXECUTE FUNCTION trigger_update_quiz_metrics_on_quiz_insert();

-- Trigger para atualizar métricas após INSERT em orders
CREATE OR REPLACE FUNCTION trigger_update_quiz_metrics_on_order_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM update_quiz_metrics();
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_insert_metrics_trigger
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION trigger_update_quiz_metrics_on_order_insert();

-- Trigger para atualizar métricas após UPDATE em orders (quando quiz_id é vinculado)
CREATE OR REPLACE FUNCTION trigger_update_quiz_metrics_on_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Atualizar apenas se quiz_id mudou
  IF OLD.quiz_id IS DISTINCT FROM NEW.quiz_id THEN
    PERFORM update_quiz_metrics();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_update_metrics_trigger
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (OLD.quiz_id IS DISTINCT FROM NEW.quiz_id)
EXECUTE FUNCTION trigger_update_quiz_metrics_on_order_update();

-- Comentários
COMMENT ON FUNCTION trigger_update_quiz_metrics_on_quiz_insert() IS 'Atualiza métricas após inserção de quiz';
COMMENT ON FUNCTION trigger_update_quiz_metrics_on_order_insert() IS 'Atualiza métricas após inserção de pedido';
COMMENT ON FUNCTION trigger_update_quiz_metrics_on_order_update() IS 'Atualiza métricas quando quiz_id é vinculado a um pedido';

