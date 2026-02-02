-- ==========================================
-- Políticas INSERT e SELECT para quizzes + INSERT para quiz_retry_queue
-- Aplicado via Supabase MCP para funcionamento do fluxo público
-- ==========================================

-- QUIZZES: INSERT e SELECT (necessárias para fluxo anônimo)
-- A tabela tinha apenas UPDATE; INSERT e SELECT estavam ausentes.

DROP POLICY IF EXISTS "Anyone can create quizzes" ON quizzes;
CREATE POLICY "Anyone can create quizzes" 
ON quizzes 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read quizzes" ON quizzes;
CREATE POLICY "Anyone can read quizzes" 
ON quizzes 
FOR SELECT 
USING (true);

-- QUIZ_RETRY_QUEUE: INSERT anônimo (fallback quando insert em quizzes falha)
-- O frontend usa enqueueQuizToServer para salvar na fila quando o insert direto falha.
-- Apenas INSERT público; SELECT/UPDATE/DELETE permanecem restritos a admins.

DROP POLICY IF EXISTS "Anyone can insert into quiz_retry_queue" ON quiz_retry_queue;
CREATE POLICY "Anyone can insert into quiz_retry_queue"
ON quiz_retry_queue
FOR INSERT
WITH CHECK (true);
