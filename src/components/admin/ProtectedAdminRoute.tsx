import { ReactNode } from 'react';
import { useCollaboratorPermissions } from '@/hooks/useCollaboratorPermissions';
import { Navigate } from 'react-router-dom';
import { AdminPageLoading } from '@/components/admin/AdminPageLoading';

interface ProtectedAdminRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}

export function ProtectedAdminRoute({ children, requiredPermission }: ProtectedAdminRouteProps) {
  const { hasPermission, isLoading } = useCollaboratorPermissions(requiredPermission);

  if (isLoading) {
    return <AdminPageLoading />;
  }

  if (hasPermission === false) {
    // O hook tenta redirecionar, mas garantimos aqui com Navigate
    // Redireciona para login se não tiver sessão, ou orders se for logado mas sem permissão
    return <Navigate to="/admin/auth" replace />;
  }

  return <>{children}</>;
}

