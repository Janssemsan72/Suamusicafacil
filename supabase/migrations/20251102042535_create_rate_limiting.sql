-- ==========================================
-- SISTEMA DE RATE LIMITING
-- Implementa rate limiting para edge functions
-- ==========================================

-- Tabela para armazenar tentativas de rate limit
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP ou user_id
  action TEXT NOT NULL, -- Nome da ação (ex: 'checkout', 'generate-lyrics')
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, action, window_start)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action ON rate_limits(identifier, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- RLS: Apenas service_role pode acessar
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON rate_limits
  FOR ALL
  USING (auth.role() = 'service_role');

-- Função para verificar rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  _identifier TEXT,
  _action TEXT,
  _max_count INTEGER,
  _window_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  _window_start TIMESTAMPTZ;
  _current_count INTEGER;
  _result BOOLEAN;
BEGIN
  -- Calcular início da janela de tempo (arredondado para o início da janela)
  _window_start := date_trunc('minute', NOW()) - 
    (EXTRACT(MINUTE FROM NOW())::INTEGER % _window_minutes || ' minutes')::INTERVAL;
  
  -- Buscar ou criar registro de rate limit
  INSERT INTO rate_limits (identifier, action, count, window_start)
  VALUES (_identifier, _action, 1, _window_start)
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET 
    count = rate_limits.count + 1,
    updated_at = NOW()
  RETURNING count INTO _current_count;
  
  -- Verificar se excedeu o limite
  IF _current_count > _max_count THEN
    _result := FALSE;
  ELSE
    _result := TRUE;
  END IF;
  
  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar registros antigos (chamada periodicamente)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  -- Remover registros mais antigos que 24 horas
  DELETE FROM rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE rate_limits IS 'Armazena tentativas de rate limiting por identificador e ação';
COMMENT ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) IS 
  'Verifica se um identificador (IP/user) pode executar uma ação dentro do limite. Retorna TRUE se permitido, FALSE se excedido.';
COMMENT ON FUNCTION cleanup_old_rate_limits() IS 
  'Remove registros de rate limiting mais antigos que 24 horas';



