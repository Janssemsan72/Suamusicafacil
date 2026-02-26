import { useState, useEffect } from 'react';
// ✅ OTIMIZAÇÃO CRÍTICA: Lazy load de Supabase - carregar apenas quando necessário
// import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Valores padrão para colaboradores
const defaultCollaboratorPermissions: Record<string, boolean> = {
  dashboard: true,
  orders: true,
  collaborators: false,
};

export function useCollaboratorPermissions(requiredPermission?: string) {
  const navigate = useNavigate();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'collaborator' | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      setIsLoading(true);
      
      try {
        const isDev = import.meta.env.DEV;
        const isE2EEnv = import.meta.env.VITE_E2E === 'true';
        const shouldBypassForE2E =
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
          localStorage.getItem('admin_e2e_seed_orders') === 'true';
        const shouldBypassInDev = isDev && shouldBypassForE2E;

        // ✅ OTIMIZAÇÃO: Verificar cache do localStorage PRIMEIRO (antes de verificar sessão)
        // Isso evita redirecionamentos prematuros quando a sessão ainda está sendo estabelecida
        const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;

        if ((isE2EEnv || shouldBypassInDev || shouldBypassForE2E) && (cachedRole === 'admin' || cachedRole === 'collaborator')) {
          setUserRole(cachedRole);
          if (cachedRole === 'admin') {
            setHasPermission(true);
            setIsLoading(false);
            return;
          }
          if (!requiredPermission) {
            setHasPermission(true);
            setIsLoading(false);
            return;
          }
          const allowed = defaultCollaboratorPermissions[requiredPermission] ?? false;
          if (!allowed) {
            navigate('/admin/orders', { replace: true });
            setHasPermission(false);
          } else {
            setHasPermission(true);
          }
          setIsLoading(false);
          return;
        }
        
        if (isDev) {
          console.log('🔍 [useCollaboratorPermissions] Cache encontrado:', cachedRole, 'RequiredPermission:', requiredPermission);
        }
        
        // Se temos cache válido e não precisa verificar permissões específicas, usar cache imediatamente
        if (cachedRole && !requiredPermission) {
          if (isDev) {
            console.log('✅ [useCollaboratorPermissions] Usando cache, permitindo acesso imediatamente');
          }
          setUserRole(cachedRole);
          setHasPermission(true);
          setIsLoading(false);
          
          // Verificar sessão em background (não bloquear UI)
          // Aguardar um pouco antes de verificar para dar tempo da sessão ser estabelecida
          setTimeout(async () => {
            // ✅ OTIMIZAÇÃO CRÍTICA: Lazy load de Supabase apenas quando necessário
            const { supabase } = await import('@/integrations/supabase/client');
            supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
              if (sessionError || !session?.user) {
                if (isDev) {
                  console.warn('⚠️ [useCollaboratorPermissions] Sessão não encontrada em background check, mas cache existe. Aguardando...');
                }
                // Não redirecionar imediatamente - pode ser que a sessão ainda esteja sendo estabelecida
                // O AdminLayout vai verificar novamente se necessário
              }
            });
          }, 500);
          return;
        }
        
        // ✅ OTIMIZAÇÃO CRÍTICA: Lazy load de Supabase apenas quando necessário
        const { supabase } = await import('@/integrations/supabase/client');
        
        // ✅ OTIMIZAÇÃO: Usar getSession() que é mais rápido (usa cache)
        // Aguardar um pouco para garantir que a sessão está estabelecida após login
        await new Promise(resolve => setTimeout(resolve, 200));
        
        let session: any = null;
        let user: any = null;
        
        const firstAttempt = await supabase.auth.getSession();
        session = firstAttempt.data.session;
        
        if (firstAttempt.error || !session?.user) {
          // Se não houver sessão, verificar novamente após mais um delay
          // (pode ser que a sessão ainda esteja sendo estabelecida)
          if (isDev) {
            console.warn('⚠️ [useCollaboratorPermissions] Sessão não encontrada na primeira tentativa, tentando novamente...');
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          const retryAttempt = await supabase.auth.getSession();
          
          if (retryAttempt.error || !retryAttempt.data.session?.user) {
            if (isDev) {
              console.warn('⚠️ [useCollaboratorPermissions] Sessão não encontrada após retry');
            }
            // Só limpar cache e redirecionar se realmente não houver sessão após retry
            localStorage.removeItem('user_role');
            navigate('/admin/auth');
            return;
          }
          // Se retry funcionou, usar a sessão retry
          session = retryAttempt.data.session;
          user = session.user;
          if (isDev) {
            console.log('✅ [useCollaboratorPermissions] Sessão encontrada após retry');
          }
        } else {
          user = session.user;
        }
        
        if (!user) {
          if (isDev) {
            console.error('❌ [useCollaboratorPermissions] Não foi possível obter usuário da sessão');
          }
          localStorage.removeItem('user_role');
          navigate('/admin/auth');
          return;
        }

        const resolveUserRole = (rolesArray: Array<{ role: unknown }> | null): 'admin' | 'collaborator' | null => {
          if (!rolesArray || rolesArray.length === 0) return null;
          const roles = rolesArray.map((r) => String(r.role));
          if (roles.includes('admin')) return 'admin';
          if (roles.includes('collaborator')) return 'collaborator';
          const first = roles[0];
          if (first === 'admin' || first === 'collaborator') return first;
          return null;
        };

        // Buscar role do banco (apenas se não tiver cache ou precisar verificar permissão)
        if (isDev) {
          console.log('🔍 [useCollaboratorPermissions] Buscando role do banco para user_id:', user.id);
        }
        
        const { data: rolesArray, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (isDev) {
          console.log('📊 [useCollaboratorPermissions] Roles array:', rolesArray, 'Error:', roleError);
        }

        // Verificar cache novamente (pode ter sido definido no início)
        const currentCache = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
        
        if (roleError) {
          if (isDev) {
            console.error('❌ [useCollaboratorPermissions] Erro ao buscar role:', roleError);
          }
          // Se houver erro mas tiver cache, usar cache
          if (currentCache) {
            if (isDev) {
              console.log('⚠️ [useCollaboratorPermissions] Erro ao buscar role, mas usando cache:', currentCache);
            }
            setUserRole(currentCache);
            setHasPermission(true);
            setIsLoading(false);
            return;
          }
          navigate('/admin/auth');
          return;
        }

        const resolvedRole = resolveUserRole(rolesArray as Array<{ role: unknown }> | null);

        if (!resolvedRole) {
          if (isDev) {
            console.warn('⚠️ [useCollaboratorPermissions] Nenhuma role encontrada no banco');
          }
          // Se não houver role mas tiver cache, usar cache
          if (currentCache) {
            if (isDev) {
              console.log('⚠️ [useCollaboratorPermissions] Nenhuma role no banco, mas usando cache:', currentCache);
            }
            setUserRole(currentCache);
            setHasPermission(true);
            setIsLoading(false);
            return;
          }
          navigate('/admin/auth');
          return;
        }

        const roleValue = resolvedRole;
        setUserRole(roleValue);
        
        // ✅ OTIMIZAÇÃO: Atualizar cache
        localStorage.setItem('user_role', roleValue);

        // Se for admin, tem todas as permissões
        if (roleValue === 'admin') {
          setHasPermission(true);
          setIsLoading(false);
          return;
        }

        // Se for colaborador e não há permissão requerida, permitir
        if (!requiredPermission) {
          setHasPermission(true);
          setIsLoading(false);
          return;
        }

        // Buscar permissões do colaborador
        // ✅ CORREÇÃO: Tratar erro 404 se a tabela não existir
        const { data: permissionsData, error: permissionsError } = await supabase
          .from('collaborator_permissions')
          .select('permission_key, granted')
          .eq('user_id', user.id);
        
        // Se a tabela não existir (404), usar permissões padrão
        if (permissionsError && (permissionsError.code === 'PGRST116' || permissionsError.code === '42P01' || permissionsError.message?.includes('does not exist'))) {
          console.warn('Tabela collaborator_permissions não encontrada, usando permissões padrão');
        }

        const permissionsMap: Record<string, boolean> = { ...defaultCollaboratorPermissions };
        
        if (permissionsData) {
          permissionsData.forEach(perm => {
            permissionsMap[perm.permission_key] = perm.granted;
          });
        }

        // Verificar se tem a permissão requerida
        const hasRequiredPermission = permissionsMap[requiredPermission] ?? defaultCollaboratorPermissions[requiredPermission] ?? false;
        
        if (!hasRequiredPermission) {
          toast.error('Você não tem permissão para acessar esta página');
          
          // Redirecionar para a primeira página que o colaborador tem acesso
          // Evitar redirecionar para /admin se não tiver permissão de dashboard (evita loop)
          const allowedRoutes = [
            { key: 'orders', path: '/admin/orders' },
          ];
          
          const firstAllowedRoute = allowedRoutes.find(route => permissionsMap[route.key]);
          if (firstAllowedRoute) {
            navigate(firstAllowedRoute.path);
          } else {
            // Se não tem nenhuma permissão, redirecionar para auth
            navigate('/admin/auth');
          }
          
          setHasPermission(false);
        } else {
          setHasPermission(true);
        }
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        navigate('/admin/auth');
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [requiredPermission, navigate]); // Remover navigate das dependências (função estável)

  return { hasPermission, isLoading, userRole };
}
