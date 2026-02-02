-- ==========================================
-- Adicionar política UPDATE para quizzes (necessária para UPSERT com on_conflict)
-- ==========================================
-- O upsert com on_conflict=session_id requer UPDATE quando já existe quiz com mesmo session_id.
-- A migração simplify_quiz_policies criou apenas INSERT e SELECT, causando 401 no upsert.

DROP POLICY IF EXISTS "Anyone can update quizzes" ON quizzes;
CREATE POLICY "Anyone can update quizzes" 
ON quizzes 
FOR UPDATE 
USING (true) 
WITH CHECK (true);
