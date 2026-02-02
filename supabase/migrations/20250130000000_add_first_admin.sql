-- ============================================================
-- MIGRAÇÃO: Adicionar primeiro administrador
-- Data: 2025-01-30
-- Descrição: Adiciona o primeiro usuário admin (janssemteclas@gmail.com)
-- ============================================================

-- Inserir o primeiro administrador
INSERT INTO public.user_roles (user_id, role)
VALUES ('5036daea-237e-448a-9d60-5a3951881dba', 'admin')
ON CONFLICT (user_id) DO UPDATE
SET role = 'admin';

-- Verificar se foi inserido corretamente
SELECT 
  ur.user_id,
  ur.role,
  au.email,
  ur.created_at
FROM public.user_roles ur
LEFT JOIN auth.users au ON au.id = ur.user_id
WHERE ur.user_id = '5036daea-237e-448a-9d60-5a3951881dba';

