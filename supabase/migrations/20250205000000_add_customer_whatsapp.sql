-- ==========================================
-- Adicionar customer_whatsapp às tabelas quizzes e orders
-- ==========================================

-- Adicionar coluna customer_whatsapp em quizzes
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT;

-- Adicionar coluna customer_whatsapp em orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT;

-- Comentários descritivos
COMMENT ON COLUMN quizzes.customer_whatsapp IS 'Número de WhatsApp do cliente no formato internacional (55XXXXXXXXXXX)';
COMMENT ON COLUMN orders.customer_whatsapp IS 'Número de WhatsApp do cliente no formato internacional (55XXXXXXXXXXX)';

