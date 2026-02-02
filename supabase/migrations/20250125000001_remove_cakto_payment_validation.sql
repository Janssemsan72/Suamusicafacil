-- ==========================================
-- REMOVER VALIDAÇÃO DE SEGURANÇA DE PAGAMENTOS CAKTO
-- ==========================================
-- Este script remove o trigger de validação que bloqueia
-- marcação direta de pedidos Cakto como pagos
-- ==========================================

-- Remover trigger de validação
DROP TRIGGER IF EXISTS trigger_validate_cakto_payment ON orders;

-- Comentário explicativo
COMMENT ON FUNCTION trigger_validate_cakto_payment() IS 
'Função de validação removida - permitindo marcação direta de pedidos Cakto como pagos.';

-- Nota: A função ainda existe mas não será mais executada pelo trigger
-- Se necessário, pode ser removida completamente com:
-- DROP FUNCTION IF EXISTS trigger_validate_cakto_payment();

