import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '@/pages/AdminDashboard';

const isE2EEnv = import.meta.env.VITE_E2E === 'true';

const AdminDashboardSkeleton = () => (
  <div className="container mx-auto p-2 md:p-6 space-y-3 md:space-y-6">
    <div className="flex items-center justify-between mb-3 md:mb-6">
      <div>
        <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2 md:mb-3 tracking-tight font-sans">
          Dashboard Administrativo
        </h1>
        <p className="text-sm md:text-base text-muted-foreground font-medium">Visão geral do sistema e vendas</p>
      </div>
      <div className="h-9 w-[110px] rounded-xl bg-black/5" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6">
      <div className="h-[110px] rounded-2xl bg-black/5" />
      <div className="h-[110px] rounded-2xl bg-black/5" />
      <div className="h-[110px] rounded-2xl bg-black/5" />
      <div className="h-[110px] rounded-2xl bg-black/5" />
    </div>

    <div className="h-[44px] rounded-xl bg-black/5" />
    <div className="h-[360px] rounded-2xl bg-black/5" />
  </div>
);

/**
 * Componente que redireciona colaboradores sem permissão de dashboard
 * para /admin/orders, ou renderiza o AdminDashboard se tiver permissão
 */
export default function AdminDashboardRedirect() {
  const navigate = useNavigate();
  const cachedRole =
    typeof window !== 'undefined' ? (localStorage.getItem('user_role') as 'admin' | 'collaborator' | null) : null;
  const [shouldRenderDashboard, setShouldRenderDashboard] = useState(cachedRole === 'admin');

  useEffect(() => {
    const shouldBypassForE2E =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      localStorage.getItem('admin_e2e_seed_orders') === 'true';
    const shouldBypassInDev = import.meta.env.DEV && shouldBypassForE2E;

    if (isE2EEnv || shouldBypassInDev || shouldBypassForE2E) {
      const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
      if (cachedRole === 'admin') {
        setShouldRenderDashboard(true);
        return;
      }
      if (cachedRole === 'collaborator') {
        navigate('/admin/orders', { replace: true });
        return;
      }
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

    const checkInBackground = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          navigate('/admin/auth');
          return;
        }
        
        const { data: rolesArray } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        const roleValue = resolveUserRole(rolesArray as Array<{ role: unknown }> | null);
        if (roleValue) {
          localStorage.setItem('user_role', roleValue);
        }
      } catch (error) {
        // Ignorar erros em background
      }
    };
    
    const checkAndRedirect = async () => {
      try {
        const cachedRole = localStorage.getItem('user_role');
        if (cachedRole === 'admin') {
          setShouldRenderDashboard(true);
          checkInBackground();
          return;
        }
        if (cachedRole === 'collaborator') {
          navigate('/admin/orders', { replace: true });
          checkInBackground();
          return;
        }
        
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        
        if (!user) {
          navigate('/admin/auth');
          return;
        }

        const { data: rolesArray } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const roleValue = resolveUserRole(rolesArray as Array<{ role: unknown }> | null);
        if (!roleValue) {
          navigate('/admin/auth');
          return;
        }
        
        // ✅ OTIMIZAÇÃO: Salvar no localStorage para próxima vez
        localStorage.setItem('user_role', roleValue);

        if (roleValue === 'admin') {
          setShouldRenderDashboard(true);
          return;
        }

        setShouldRenderDashboard(true);

        const { data: permissionsData } = await supabase
          .from('collaborator_permissions')
          .select('permission_key, granted')
          .eq('user_id', user.id)
          .eq('permission_key', 'dashboard')
          .maybeSingle();

        // Default é true se não houver registro
        const hasDashboardPermission = permissionsData?.granted ?? true;

        if (!hasDashboardPermission) {
          const { data: allPermissions } = await supabase
            .from('collaborator_permissions')
            .select('permission_key, granted')
            .eq('user_id', user.id);

          const permissionsMap: Record<string, boolean> = {
            orders: true,
          };

          if (allPermissions) {
            allPermissions.forEach(perm => {
              if (['orders'].includes(perm.permission_key)) {
                permissionsMap[perm.permission_key] = perm.granted;
              }
            });
          }

          const allowedRoutes = [
            { key: 'orders', path: '/admin/orders' },
          ];

          const firstAllowedRoute = allowedRoutes.find(route => permissionsMap[route.key]);
          if (firstAllowedRoute) {
            navigate(firstAllowedRoute.path, { replace: true });
          } else {
            navigate('/admin/orders', { replace: true });
          }
          return;
        }

      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        navigate('/admin/auth');
      }
    };

    checkAndRedirect();
  }, [navigate]);

  if (shouldRenderDashboard) {
    return <AdminDashboard />;
  }

  return <AdminDashboardSkeleton />;
}

