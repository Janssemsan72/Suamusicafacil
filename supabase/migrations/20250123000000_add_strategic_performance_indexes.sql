-- Migration: Adicionar índices estratégicos para performance
-- Objetivo: Otimizar queries frequentes em orders, jobs, songs e outras tabelas críticas

-- ==========================================
-- ÍNDICES PARA TABELA ORDERS
-- ==========================================

-- Índice composto para queries que filtram por status e ordenam por created_at
-- Usado em: SELECT * FROM orders WHERE status = 'paid' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at_desc 
ON orders(status, created_at DESC);

-- Índice composto para queries que filtram por provider e status
-- Usado em: SELECT * FROM orders WHERE provider = 'cakto' AND status = 'paid'
CREATE INDEX IF NOT EXISTS idx_orders_provider_status 
ON orders(provider, status) 
WHERE provider IS NOT NULL;

-- Índice para queries que filtram por payment_provider
-- Usado em: SELECT * FROM orders WHERE payment_provider = 'stripe'
CREATE INDEX IF NOT EXISTS idx_orders_payment_provider 
ON orders(payment_provider) 
WHERE payment_provider IS NOT NULL;

-- Índice para queries que ordenam por paid_at
-- Usado em: SELECT * FROM orders WHERE status = 'paid' ORDER BY paid_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_paid_at_desc 
ON orders(paid_at DESC) 
WHERE paid_at IS NOT NULL;

-- ==========================================
-- ÍNDICES PARA TABELA JOBS
-- ==========================================

-- Índice composto para queries que filtram por status e ordenam por created_at
-- Usado em: SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at_desc 
ON jobs(status, created_at DESC);

-- Índice para queries que filtram por order_id e status
-- Usado em: SELECT * FROM jobs WHERE order_id = ? AND status = 'processing'
CREATE INDEX IF NOT EXISTS idx_jobs_order_id_status 
ON jobs(order_id, status);

-- Índice para queries que filtram por suno_task_id
-- Usado em: SELECT * FROM jobs WHERE suno_task_id = ?
CREATE INDEX IF NOT EXISTS idx_jobs_suno_task_id 
ON jobs(suno_task_id) 
WHERE suno_task_id IS NOT NULL AND suno_task_id != '';

-- ==========================================
-- ÍNDICES PARA TABELA SONGS
-- ==========================================

-- Índice composto para queries que filtram por status e ordenam por created_at
-- Usado em: SELECT * FROM songs WHERE status = 'released' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_songs_status_created_at_desc 
ON songs(status, created_at DESC);

-- Índice para queries que filtram por order_id e status
-- Usado em: SELECT * FROM songs WHERE order_id = ? AND status = 'released'
CREATE INDEX IF NOT EXISTS idx_songs_order_id_status 
ON songs(order_id, status);

-- Índice para queries que filtram por order_id e variant_number
-- Usado em: SELECT * FROM songs WHERE order_id = ? AND variant_number = ?
CREATE INDEX IF NOT EXISTS idx_songs_order_variant 
ON songs(order_id, variant_number);

-- Índice para queries que ordenam por released_at
-- Usado em: SELECT * FROM songs WHERE status = 'released' ORDER BY released_at DESC
CREATE INDEX IF NOT EXISTS idx_songs_released_at_desc 
ON songs(released_at DESC) 
WHERE released_at IS NOT NULL;

-- ==========================================
-- ÍNDICES PARA TABELA QUIZZES
-- ==========================================

-- Índice para queries que filtram por order_id (relacionamento com orders)
-- Usado em: SELECT * FROM quizzes WHERE id = ? (via order.quiz_id)
-- Nota: Como quiz_id é FK em orders, o índice primário já cobre isso, mas adicionamos para garantir

-- ==========================================
-- ÍNDICES PARA TABELA EMAIL_LOGS
-- ==========================================

-- Índice composto para queries que filtram por order_id e email_type
-- Usado em: SELECT * FROM email_logs WHERE order_id = ? AND email_type = 'music_released'
CREATE INDEX IF NOT EXISTS idx_email_logs_order_id_type 
ON email_logs(order_id, email_type);

-- Índice para queries que filtram por status e ordenam por sent_at
-- Usado em: SELECT * FROM email_logs WHERE status = 'sent' ORDER BY sent_at DESC
CREATE INDEX IF NOT EXISTS idx_email_logs_status_sent_at_desc 
ON email_logs(status, sent_at DESC);

-- ==========================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ==========================================

COMMENT ON INDEX idx_orders_status_created_at_desc IS 
'Índice composto para otimizar queries que filtram por status e ordenam por created_at (AdminOrders, AdminDashboard)';

COMMENT ON INDEX idx_orders_provider_status IS 
'Índice composto para otimizar queries que filtram por provider e status';

COMMENT ON INDEX idx_orders_payment_provider IS 
'Índice para otimizar queries que filtram por payment_provider';

COMMENT ON INDEX idx_orders_paid_at_desc IS 
'Índice para otimizar queries que ordenam por paid_at';

COMMENT ON INDEX idx_jobs_status_created_at_desc IS 
'Índice composto para otimizar queries que filtram por status e ordenam por created_at';

COMMENT ON INDEX idx_jobs_order_id_status IS 
'Índice composto para otimizar queries que filtram por order_id e status';

COMMENT ON INDEX idx_jobs_suno_task_id IS 
'Índice para otimizar queries que filtram por suno_task_id (suno-callback, poll-suno-status)';

COMMENT ON INDEX idx_songs_status_created_at_desc IS 
'Índice composto para otimizar queries que filtram por status e ordenam por created_at';

COMMENT ON INDEX idx_songs_order_id_status IS 
'Índice composto para otimizar queries que filtram por order_id e status';

COMMENT ON INDEX idx_songs_order_variant IS 
'Índice composto para otimizar queries que filtram por order_id e variant_number';

COMMENT ON INDEX idx_songs_released_at_desc IS 
'Índice para otimizar queries que ordenam por released_at';

COMMENT ON INDEX idx_email_logs_order_id_type IS 
'Índice composto para otimizar queries que filtram por order_id e email_type';

COMMENT ON INDEX idx_email_logs_status_sent_at_desc IS 
'Índice composto para otimizar queries que filtram por status e ordenam por sent_at';



