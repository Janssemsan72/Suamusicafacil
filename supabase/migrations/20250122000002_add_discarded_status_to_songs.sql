-- ==========================================
-- ADICIONAR STATUS 'discarded' PARA MÚSICAS
-- Permite marcar músicas antigas como descartadas/referência
-- ao invés de deletá-las quando uma nova música é gerada
-- ==========================================

-- Adicionar comentário sobre o novo status
COMMENT ON COLUMN songs.status IS 'Status da música: pending, ready, approved, released, failed, generating, processing, discarded (música antiga mantida como referência)';

-- Criar índice para facilitar filtragem de músicas descartadas
CREATE INDEX IF NOT EXISTS idx_songs_status_discarded 
ON songs(status) 
WHERE status = 'discarded';

-- Comentário no índice
COMMENT ON INDEX idx_songs_status_discarded IS 'Índice para filtrar músicas descartadas (antigas mantidas como referência)';

