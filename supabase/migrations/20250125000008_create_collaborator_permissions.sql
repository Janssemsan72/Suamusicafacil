-- ============================================================
-- CRIAR TABELA DE PERMISSÕES DE COLABORADORES
-- ============================================================
-- Esta migration cria a tabela collaborator_permissions
-- que armazena as permissões específicas de cada colaborador
-- ============================================================

-- 1. Criar tabela de permissões
CREATE TABLE IF NOT EXISTS public.collaborator_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission_key text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

-- 2. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_collaborator_permissions_user_id ON public.collaborator_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborator_permissions_permission_key ON public.collaborator_permissions(permission_key);

-- 3. Habilitar RLS
ALTER TABLE public.collaborator_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas existentes (se houver) antes de criar novas
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.collaborator_permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON public.collaborator_permissions;
DROP POLICY IF EXISTS "Admins can insert permissions" ON public.collaborator_permissions;
DROP POLICY IF EXISTS "Admins can update permissions" ON public.collaborator_permissions;
DROP POLICY IF EXISTS "Admins can delete permissions" ON public.collaborator_permissions;

-- 5. Política: Usuários podem ver suas próprias permissões
CREATE POLICY "Users can view their own permissions"
ON public.collaborator_permissions FOR SELECT
USING (auth.uid() = user_id);

-- 6. Política: Admins podem ver todas as permissões
CREATE POLICY "Admins can view all permissions"
ON public.collaborator_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

-- 7. Política: Admins podem inserir permissões
CREATE POLICY "Admins can insert permissions"
ON public.collaborator_permissions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

-- 8. Política: Admins podem atualizar permissões
CREATE POLICY "Admins can update permissions"
ON public.collaborator_permissions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

-- 9. Política: Admins podem deletar permissões
CREATE POLICY "Admins can delete permissions"
ON public.collaborator_permissions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

-- 10. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_collaborator_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_collaborator_permissions_updated_at ON public.collaborator_permissions;
CREATE TRIGGER trigger_update_collaborator_permissions_updated_at
  BEFORE UPDATE ON public.collaborator_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborator_permissions_updated_at();

-- 12. Comentários
COMMENT ON TABLE public.collaborator_permissions IS 'Tabela de permissões específicas de colaboradores';
COMMENT ON COLUMN public.collaborator_permissions.user_id IS 'ID do usuário colaborador';
COMMENT ON COLUMN public.collaborator_permissions.permission_key IS 'Chave da permissão (ex: orders, songs, lyrics)';
COMMENT ON COLUMN public.collaborator_permissions.granted IS 'Se a permissão está concedida (true) ou negada (false)';

