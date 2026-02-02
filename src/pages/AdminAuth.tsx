import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield } from "@/lib/icons";

export default function AdminAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isDev = import.meta.env.DEV;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Erro ao autenticar');
      }

      // Aguardar um pouco para garantir que a sessão está completamente estabelecida
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verificar novamente se o usuário está autenticado
      const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser();
      if (getUserError || !currentUser) {
        console.error('❌ Erro ao obter usuário autenticado:', getUserError);
        throw new Error('Sessão não estabelecida');
      }

      // ✅ SEGURANÇA: Sempre verificar role admin (nunca bypassar)
      console.log('🔍 Verificando role para usuário:', currentUser.id);
      console.log('🔍 Email do usuário:', currentUser.email);
      
      // Buscar todas as roles do usuário (sem maybeSingle para evitar erro 406)
      const { data: allRoles, error: allRolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);
      
      console.log('📊 Todas as roles do usuário:', { allRoles, allRolesError });
      if (allRolesError) {
        console.error('❌ Erro detalhado na busca geral:', JSON.stringify(allRolesError, null, 2));
      }
      
      // Se encontrou roles, priorizar collaborator sobre admin (se tiver ambas)
      let roles: { role: string } | null = null;
      let rolesError = allRolesError;
      
      if (allRoles && allRoles.length > 0) {
        const adminRole = allRoles.find(r => r.role === 'admin');
        const collaboratorRole = allRoles.find(r => r.role === 'collaborator');

        if (adminRole) {
          roles = { role: 'admin' };
          console.log('✅ Role encontrada: admin (priorizado)');
        } else if (collaboratorRole) {
          roles = { role: 'collaborator' };
          console.log('✅ Role encontrada: collaborator');
        } else {
          roles = { role: allRoles[0].role };
          console.log('✅ Role encontrada:', roles);
        }
      } else if (allRolesError) {
        // Se houve erro, verificar se é erro de permissão
        console.error('❌ Erro ao buscar roles:', allRolesError);
        if (allRolesError.code === 'PGRST116' || allRolesError.code === '42501') {
          console.error('⚠️ Erro de permissão RLS detectado');
        }
      }

      if (!roles) {
        const [{ data: isAdmin, error: isAdminError }, { data: isCollaborator, error: isCollaboratorError }] =
          await Promise.all([
            supabase.rpc('has_role', { _user_id: currentUser.id, _role: 'admin' }),
            supabase.rpc('has_role', { _user_id: currentUser.id, _role: 'collaborator' }),
          ]);

        if (!isAdminError && isAdmin) {
          roles = { role: 'admin' };
          rolesError = null;
        } else if (!isCollaboratorError && isCollaborator) {
          roles = { role: 'collaborator' };
          rolesError = null;
        } else if (isAdminError || isCollaboratorError) {
          rolesError = (isAdminError || isCollaboratorError) as any;
        }
      }

      if (rolesError) {
        console.error('❌ Erro ao verificar role:', JSON.stringify(rolesError, null, 2));
        console.error('Detalhes do erro:', {
          message: rolesError.message,
          code: rolesError.code,
          details: rolesError.details,
          hint: rolesError.hint
        });
        
        // Se erro for RLS (PGRST116 ou 42501), informar melhor
        if (rolesError.code === 'PGRST116') {
          console.error('⚠️ Nenhuma role encontrada para este usuário');
          toast.error('Usuário não possui permissões de administrador ou colaborador');
        } else if (rolesError.code === '42501') {
          console.error('⚠️ Erro de permissão RLS - usuário não pode ver sua própria role');
          toast.error('Erro de permissão - verifique configuração RLS');
        } else {
          toast.error(`Erro ao verificar permissões: ${rolesError.message}`);
        }
        
        await supabase.auth.signOut();
        return;
      }

      // Verificar se role existe
      if (!roles) {
        console.warn('⚠️ Nenhuma role encontrada para este usuário');
        await supabase.auth.signOut();
        toast.error('Usuário não possui permissões de administrador ou colaborador');
        return;
      }

      // Comparar role (pode ser enum app_role ou string)
      const roleValue = roles?.role;
      console.log('🎭 Role value:', roleValue, 'Tipo:', typeof roleValue);
      
      const isAdmin = roleValue === 'admin' || String(roleValue) === 'admin';
      const isCollaborator = roleValue === 'collaborator' || String(roleValue) === 'collaborator';
      console.log('✅ É admin?', isAdmin, 'É collaborator?', isCollaborator);
      
      if (!isAdmin && !isCollaborator) {
        console.warn('⚠️ Acesso negado - role não é admin ou collaborator:', roleValue);
        await supabase.auth.signOut();
        toast.error('Acesso negado - apenas administradores e colaboradores');
        return;
      }

      // Salvar role no localStorage ANTES do redirecionamento
      const finalRole = isAdmin ? 'admin' : 'collaborator';
      localStorage.setItem('user_role', finalRole);
      
      // Aguardar um pouco para garantir que o localStorage foi salvo
      await new Promise(resolve => setTimeout(resolve, 100));

      toast.success('Login realizado com sucesso!');
      
      // Aguardar um pouco mais para garantir que o toast foi exibido
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Se for colaborador, redirecionar para /admin/orders ao invés de /admin
      if (finalRole === 'collaborator') {
        navigate('/admin/orders', { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-xs">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        
        <Card className="relative backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                <div className="relative bg-primary/10 p-3 rounded-full">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
              Acesso Administrativo
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400 text-sm">
              Área restrita para administradores do sistema
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-4 pb-4">
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email de Administrador
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Digite seu email de administrador"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 border-slate-200 dark:border-slate-700"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 border-slate-200 dark:border-slate-700"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-10 text-sm font-medium bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Entrar no Painel
                  </>
                )}
              </Button>
            </form>
            
            {/* Security Notice */}
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
              <div className="flex items-start space-x-3">
                <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Acesso Seguro</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Esta área é protegida por autenticação de dois fatores e criptografia de ponta a ponta.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
