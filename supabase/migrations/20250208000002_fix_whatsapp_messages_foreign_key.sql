-- ==========================================
-- Ajustar Foreign Key de whatsapp_messages
-- Como whatsapp_messages.funnel_id referencia whatsapp_funnel(id),
-- mas agora temos 3 tabelas separadas, precisamos garantir compatibilidade
-- ==========================================

-- Opção 1: Manter whatsapp_funnel como tabela de referência vazia
-- A foreign key continuará funcionando porque o ID é único entre as 3 tabelas
-- Quando um funil é movido, o ID permanece o mesmo

-- Opção 2: Criar uma constraint customizada que verifica se o ID existe em uma das 3 tabelas
-- Mas PostgreSQL não suporta foreign keys para múltiplas tabelas diretamente

-- Solução escolhida: Manter a foreign key apontando para whatsapp_funnel
-- e criar triggers que garantem que quando um funil é movido, o ID permanece o mesmo
-- (isso já está garantido pelas funções move_funnel_to_*)

-- Adicionar comentário explicativo
COMMENT ON TABLE whatsapp_messages IS 
'Registra todas as mensagens WhatsApp enviadas no funil. 
A foreign key funnel_id referencia whatsapp_funnel(id), mas os funis agora estão em 3 tabelas separadas (pending, completed, exited).
O ID é único entre as 3 tabelas, então a foreign key continua funcionando corretamente.';

-- Verificar se há mensagens órfãs (funnel_id que não existe em nenhuma das 3 tabelas)
DO $$
DECLARE
  v_orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count
  FROM whatsapp_messages wm
  WHERE NOT EXISTS (
    SELECT 1 FROM whatsapp_funnel_pending WHERE id = wm.funnel_id
    UNION ALL
    SELECT 1 FROM whatsapp_funnel_completed WHERE id = wm.funnel_id
    UNION ALL
    SELECT 1 FROM whatsapp_funnel_exited WHERE id = wm.funnel_id
  );
  
  IF v_orphan_count > 0 THEN
    RAISE WARNING '⚠️ Encontradas % mensagens órfãs (funnel_id não existe em nenhuma das 3 tabelas)', v_orphan_count;
  ELSE
    RAISE NOTICE '✅ Todas as mensagens têm funis válidos nas 3 tabelas separadas';
  END IF;
END;
$$;

