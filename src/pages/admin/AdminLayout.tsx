import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Download, Shield, User } from "@/lib/icons";
import { toast } from "sonner";
import { getDeviceInfo, getOptimizedTimeout } from "@/utils/deviceDetection";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { scheduleNonCriticalRender } from "@/utils/scheduleNonCriticalRender";
import { usePWA } from "@/hooks/usePWA";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";

// Verificar se está em desenvolvimento
const isDev = import.meta.env.DEV;
const isE2EEnv = import.meta.env.VITE_E2E === 'true';

const InstallPrompt = lazyWithRetry(() => import("@/components/admin/InstallPrompt"));
const OfflineIndicator = lazyWithRetry(() => import("@/components/admin/OfflineIndicator").then(m => ({ default: m.OfflineIndicator })));
const WeatherWidget = lazyWithRetry(() => import("@/components/admin/WeatherWidget").then(m => ({ default: m.WeatherWidget })));
const LazyAdminSidebar = lazyWithRetry(() => import("@/components/AdminSidebar").then(m => ({ default: m.AdminSidebar })));

function AdminOutletReady({ onReady }: { onReady: (pathname: string) => void }) {
  const location = useLocation();

  useEffect(() => {
    onReady(location.pathname);
  }, [location.pathname, onReady]);

  return <Outlet />;
}

export default function AdminLayout() {
  // 1. Todos os hooks no topo
  const navigate = useNavigate();
  const location = useLocation();
  const shouldBypassForE2E =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    localStorage.getItem('admin_e2e_seed_orders') === 'true';
  const initialCachedRole =
    typeof window !== 'undefined' ? (localStorage.getItem('user_role') as 'admin' | 'collaborator' | null) : null;
  const initialRole = shouldBypassForE2E
    ? initialCachedRole === 'admin' || initialCachedRole === 'collaborator'
      ? initialCachedRole
      : 'admin'
    : initialCachedRole === 'admin' || initialCachedRole === 'collaborator'
      ? initialCachedRole
      : null;
  const [isCheckingAuth, setIsCheckingAuth] = useState(!shouldBypassForE2E && !initialRole);
  const [isAuthorized, setIsAuthorized] = useState(shouldBypassForE2E || Boolean(initialRole));
  const [userRole, setUserRole] = useState<'admin' | 'collaborator' | null>(initialRole);
  const [shouldRenderNonCritical, setShouldRenderNonCritical] = useState(false);
  const { isInstallable, isInstalled, installPWA, shouldShowNotification, dismissNotification } = usePWA();
  const hasCheckedRef = useRef(false); // ✅ OTIMIZAÇÃO MOBILE: Evitar múltiplas verificações
  const isMountedRef = useRef(true); // ✅ Verificação de montagem para prevenir erros de DOM
  const checkInProgressRef = useRef(false); // ✅ FASE 2: Proteção contra execuções simultâneas
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null); // ✅ FASE 2: Timeout máximo
  const maxCheckAttemptsRef = useRef(0); // ✅ FASE 2: Contador de tentativas
  const notificationShownRef = useRef(false); // ✅ PWA: Evitar múltiplas notificações
  const authStateChangeSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null); // ✅ SESSÃO PERSISTENTE: Referência para subscription do auth state
  const MAX_CHECK_ATTEMPTS = 3; // ✅ FASE 2: Máximo de 3 tentativas
  const MAX_CHECK_TIMEOUT_MS = 30000; // ✅ FASE 2: 30 segundos máximo
  const [isManualNavigating, setIsManualNavigating] = useState(false);
  const manualNavigationActiveRef = useRef(false);

  type AuthUser = { id: string };
  type AuthSession = { user: AuthUser };
  type AuthError = { message?: string } | null;
  type RolesQueryResult = {
    data: Array<{ role: unknown }> | null;
    error: { message?: string; code?: string } | null;
  };

  const resolveUserRole = (rolesArray: Array<{ role: unknown }> | null): 'admin' | 'collaborator' | null => {
    if (!rolesArray || rolesArray.length === 0) return null;
    const roles = rolesArray.map((r) => String(r.role));
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('collaborator')) return 'collaborator';
    const first = roles[0];
    if (first === 'admin' || first === 'collaborator') return first;
    return null;
  };

  // 2. Todos os useEffects (devem ser sempre executados na mesma ordem)
  
  // Error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // ✅ CORREÇÃO: Filtrar erros de bibliotecas externas minificadas
      const errorSource = event.filename || '';
      const errorMessage = event.message || '';
      
      // Verificar se é erro de código minificado (VM*.js) ou bibliotecas externas
      const isMinifiedCode = errorSource.includes('VM') || 
                            errorSource.includes('js.js') ||
                            errorSource.includes('eval') ||
                            errorSource.includes('Function');
      
      // Verificar se é erro de biblioteca externa conhecida
      const isExternalLibraryError = errorMessage.includes('Cannot read properties of undefined') ||
                                    errorMessage.includes('reading \'forEach\'');
      
      // ✅ OTIMIZAÇÃO: Filtrar erros de recursos do navegador (não são erros críticos do código)
      const isResourceError = errorMessage.includes('ERR_INSUFFICIENT_RESOURCES') ||
                             errorMessage.includes('ERR_QUIC_PROTOCOL_ERROR') ||
                             errorMessage.includes('ERR_NETWORK_CHANGED') ||
                             errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
                             errorMessage.includes('Failed to load resource') ||
                             (errorSource.includes('.mp3') && errorMessage.includes('Failed'));
      
      // Suprimir erros de código minificado, bibliotecas externas e recursos do navegador
      if (isMinifiedCode || isExternalLibraryError || isResourceError) {
        event.preventDefault(); // Suprimir o erro
        return;
      }
      
      // Logar outros erros normalmente
      console.error('Erro capturado:', event.error);
    };

    window.addEventListener('error', handleError, true); // Usar capture phase
    return () => window.removeEventListener('error', handleError, true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ to?: string }>;
      const to = customEvent.detail?.to;
      if (typeof to !== "string" || to.length === 0) return;
      manualNavigationActiveRef.current = true;
      setIsManualNavigating(true);
    };

    window.addEventListener("admin:navigation-start", handler as EventListener);
    return () => window.removeEventListener("admin:navigation-start", handler as EventListener);
  }, []);

  const handleOutletReady = useCallback((pathname: string) => {
    if (!manualNavigationActiveRef.current) return;
    if (!pathname.startsWith("/admin")) return;
    manualNavigationActiveRef.current = false;
    setIsManualNavigating(false);
  }, []);

  useEffect(() => {
    return scheduleNonCriticalRender(() => {
      if (isMountedRef.current) {
        setShouldRenderNonCritical(true);
      }
    }, { timeoutMs: 2500, delayMs: 500 });
  }, []);

  // Data-admin attribute (verifica isAuthorized dentro do useEffect)
  useEffect(() => {
    // ✅ Verificar montagem antes de manipular DOM
    if (!isMountedRef.current) return;
    
    try {
      if (isAuthorized) {
        document.body.setAttribute('data-admin', 'true');
      } else {
        document.body.removeAttribute('data-admin');
      }
    } catch {
      // Suprimir erros de manipulação do DOM se o componente foi desmontado
    }
    
    return () => {
      try {
        if (document.body) {
          document.body.removeAttribute('data-admin');
        }
      } catch {
        // Suprimir erros de cleanup
      }
    };
  }, [isAuthorized]);

  // 3. Funções auxiliares
  const checkAdminAccess = async () => {
    const shouldBypassForE2E =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      localStorage.getItem('admin_e2e_seed_orders') === 'true';
    const shouldBypassInDev = isDev && shouldBypassForE2E;

    if (isE2EEnv || shouldBypassInDev || shouldBypassForE2E) {
      const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
      const finalRole = cachedRole === 'admin' || cachedRole === 'collaborator' ? cachedRole : 'admin';
      localStorage.setItem('user_role', finalRole);
      checkInProgressRef.current = false;
      hasCheckedRef.current = true;
      maxCheckAttemptsRef.current = 0;
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
      if (isMountedRef.current) {
        setIsAuthorized(true);
        setIsCheckingAuth(false);
        setUserRole(finalRole);
      }
      return;
    }

    // ✅ FASE 2: Proteção adicional contra múltiplas execuções simultâneas
    if (checkInProgressRef.current) {
      return;
    }
    
    // ✅ FASE 2: Verificar se excedeu o limite de tentativas
    if (maxCheckAttemptsRef.current >= MAX_CHECK_ATTEMPTS) {
      if (isMountedRef.current) {
        navigate("/admin/auth");
        setIsCheckingAuth(false);
      }
      return;
    }
    
    // ✅ FASE 2: Limpar timeout anterior se existir
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = null;
    }
    
    // ✅ FASE 2: Configurar timeout máximo
    checkTimeoutRef.current = setTimeout(() => {
      checkInProgressRef.current = false;
      hasCheckedRef.current = false;
      
      if (isMountedRef.current) {
        toast.error("Timeout na verificação de autenticação");
        navigate("/admin/auth");
        setIsCheckingAuth(false);
      }
    }, MAX_CHECK_TIMEOUT_MS);
    
    checkInProgressRef.current = true;
    hasCheckedRef.current = true;
    maxCheckAttemptsRef.current++;
    setIsCheckingAuth(true);
    setIsAuthorized(false);

    try {
      let supabase: any;
      try {
        ({ supabase } = await import("@/integrations/supabase/client"));
      } catch {
        checkInProgressRef.current = false;
        hasCheckedRef.current = false;
        maxCheckAttemptsRef.current = 0; // Resetar contador em caso de erro de inicialização
        if (checkTimeoutRef.current) {
          clearTimeout(checkTimeoutRef.current);
          checkTimeoutRef.current = null;
        }
        if (isMountedRef.current) {
          toast.error("Erro de inicialização. Recarregue a página.");
          setIsCheckingAuth(false);
        }
        return;
      }

      if (!supabase?.auth) {
        checkInProgressRef.current = false;
        hasCheckedRef.current = false;
        maxCheckAttemptsRef.current = 0;
        if (checkTimeoutRef.current) {
          clearTimeout(checkTimeoutRef.current);
          checkTimeoutRef.current = null;
        }
        if (isMountedRef.current) {
          toast.error("Erro de inicialização. Recarregue a página.");
          setIsCheckingAuth(false);
        }
        return;
      }
      
      // ✅ SESSÃO PERSISTENTE: Verificar se já está autorizado e tem sessão válida
      // Se já está autorizado, não precisa verificar novamente (evita interrupções)
      if (isAuthorized && hasCheckedRef.current) {
        const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
        if (cachedRole && (cachedRole === 'admin' || cachedRole === 'collaborator')) {
          // Verificar sessão rapidamente sem bloquear
          const quickSessionCheck = await supabase.auth.getSession();
          if (quickSessionCheck.data.session?.user) {
            checkInProgressRef.current = false;
            setIsCheckingAuth(false);
            if (checkTimeoutRef.current) {
              clearTimeout(checkTimeoutRef.current);
              checkTimeoutRef.current = null;
            }
            return;
          }
        }
      }
      
      // ✅ OTIMIZAÇÃO MOBILE: getSession() é mais rápido que getUser() (usa cache)
      // Aguardar um pouco para garantir que a sessão está estabelecida após login
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let session: AuthSession | null = null;
      let sessionError: AuthError = null;
      let user: AuthUser | null = null;
      
      // Primeira tentativa
      const firstAttempt = await supabase.auth.getSession();
      session = firstAttempt.data.session;
      sessionError = firstAttempt.error;
      
      // ✅ SESSÃO PERSISTENTE: Tentar renovar token se sessão expirou mas há refresh token
      if ((sessionError || !session?.user) && !sessionError?.message?.includes('Invalid')) {
        const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
        
        if (cachedRole && (cachedRole === 'admin' || cachedRole === 'collaborator')) {
          // Tentar renovar token automaticamente
          try {
            const refreshResult = await supabase.auth.refreshSession();
            if (refreshResult.data.session?.user) {
              session = refreshResult.data.session;
              user = session.user;
            } else {
              // Se renovação falhou, aguardar um pouco e tentar novamente
              await new Promise(resolve => setTimeout(resolve, 300));
              const retryAttempt = await supabase.auth.getSession();

              if (retryAttempt.error || !retryAttempt.data.session?.user) {
                localStorage.removeItem('user_role');
                checkInProgressRef.current = false;
                hasCheckedRef.current = false;
                maxCheckAttemptsRef.current = 0;
                if (checkTimeoutRef.current) {
                  clearTimeout(checkTimeoutRef.current);
                  checkTimeoutRef.current = null;
                }
                if (isMountedRef.current) {
                  navigate("/admin/auth");
                  setIsCheckingAuth(false);
                }
                return;
              }
              session = retryAttempt.data.session;
              user = session.user;
            }
          } catch (refreshError) {
            console.error('Erro ao renovar token:', refreshError);
            // Se renovação falhou, tentar getSession novamente
            await new Promise(resolve => setTimeout(resolve, 300));
            const retryAttempt = await supabase.auth.getSession();
            
            if (retryAttempt.error || !retryAttempt.data.session?.user) {
              localStorage.removeItem('user_role');
              checkInProgressRef.current = false;
              hasCheckedRef.current = false;
              maxCheckAttemptsRef.current = 0;
              if (checkTimeoutRef.current) {
                clearTimeout(checkTimeoutRef.current);
                checkTimeoutRef.current = null;
              }
              if (isMountedRef.current) {
                navigate("/admin/auth");
                setIsCheckingAuth(false);
              }
              return;
            }
            session = retryAttempt.data.session;
            user = session.user;
          }
        } else {
          // Limpar cache se não houver sessão
          localStorage.removeItem('user_role');
          checkInProgressRef.current = false;
          hasCheckedRef.current = false;
          maxCheckAttemptsRef.current = 0; // Resetar contador em caso de erro esperado
          if (checkTimeoutRef.current) {
            clearTimeout(checkTimeoutRef.current);
            checkTimeoutRef.current = null;
          }
          if (isMountedRef.current) {
            navigate("/admin/auth");
            setIsCheckingAuth(false);
          }
          return;
        }
      } else {
        user = session?.user;
      }
      
      if (!user) {
        console.error('Não foi possível obter usuário da sessão');
        localStorage.removeItem('user_role');
        checkInProgressRef.current = false;
        hasCheckedRef.current = false;
        if (isMountedRef.current) {
          navigate("/admin/auth");
          setIsCheckingAuth(false);
        }
        return;
      }
      
      // ✅ OTIMIZAÇÃO: Verificar cache do localStorage primeiro para resposta instantânea
      const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
      if (cachedRole && (cachedRole === 'admin' || cachedRole === 'collaborator')) {
        // Se temos cache válido, autorizar imediatamente e verificar em background
        if (isMountedRef.current) {
          setIsAuthorized(true);
          setIsCheckingAuth(false);
          setUserRole(cachedRole);
          if (cachedRole === 'collaborator' && location.pathname === '/admin') {
            navigate('/admin/orders', { replace: true });
          }
        }
        checkInProgressRef.current = false;
        hasCheckedRef.current = true;
        
        // Verificar em background para garantir que o cache está atualizado
        // (não bloquear a UI)
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .then(({ data: rolesArray }) => {
            const actualRole = resolveUserRole(rolesArray as Array<{ role: unknown }> | null);
            if (actualRole && actualRole !== cachedRole) {
              localStorage.setItem('user_role', actualRole);
              if (isMountedRef.current) {
                setUserRole(actualRole);
              }
            }
          })
          .catch(() => {
            // Ignorar erros em background check (não bloqueia a UI)
          });
        
        if (checkTimeoutRef.current) {
          clearTimeout(checkTimeoutRef.current);
          checkTimeoutRef.current = null;
        }
        maxCheckAttemptsRef.current = 0;
        return;
      }
      
      // ✅ OTIMIZAÇÃO: Timeout reduzido para carregamento mais rápido
      const deviceInfo = getDeviceInfo();
      const baseTimeout = (deviceInfo.isMobile || deviceInfo.isSlowConnection) ? 12000 : 10000;
      const timeoutMs = getOptimizedTimeout(baseTimeout);
      
      // Criar promise com timeout para evitar travamento em conexões lentas
      let timeoutId: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Timeout na verificação de permissões'));
        }, timeoutMs);
      });

      // Primeiro, tentar buscar todas as roles do usuário (sem maybeSingle para evitar 406)
      const rolesPromise = supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      let rolesResult: RolesQueryResult;
      try {
        rolesResult = (await Promise.race([
          rolesPromise.then((result) => {
            if (timeoutId) clearTimeout(timeoutId);
            return result as unknown as RolesQueryResult;
          }),
          timeoutPromise
        ])) as RolesQueryResult;
      } catch (raceError: unknown) {
        if (timeoutId) clearTimeout(timeoutId);
        const err = raceError instanceof Error ? raceError : new Error(String(raceError));
        throw err;
      }

      const { data: rolesArray, error: rolesError } = rolesResult;
      const resolvedRole = resolveUserRole(rolesArray);

      if (rolesError) {
        console.error("Erro ao verificar role:", rolesError);
        
        // Se for timeout, não mostrar erro genérico
        if (rolesError.message?.includes('Timeout')) {
          // Tentar uma vez mais sem timeout
          const { data: retryRolesArray, error: retryError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          
          if (retryError) {
            if (isMountedRef.current) {
              if (retryError.code === 'PGRST116') {
                toast.error("Usuário não possui permissões de administrador");
              } else if (retryError.code === '42501') {
                toast.error("Erro de permissão RLS");
              } else {
                toast.error(`Erro ao verificar permissões: ${retryError.message}`);
              }
              navigate("/admin/auth");
              setIsCheckingAuth(false);
            }
            hasCheckedRef.current = false;
            return;
          }
          
          // Se retry funcionou, usar os dados
          const retryResolvedRole = resolveUserRole(retryRolesArray);
          const roleValue = retryResolvedRole;
          const isAdmin = roleValue === 'admin';
          const isCollaborator = roleValue === 'collaborator';
          
          if (!retryResolvedRole || (!isAdmin && !isCollaborator)) {
            if (isMountedRef.current) {
              toast.error("Acesso negado - apenas administradores e colaboradores");
              navigate("/admin/auth");
              setIsCheckingAuth(false);
            }
            hasCheckedRef.current = false;
            return;
          }
          
          // Salvar role no localStorage
          localStorage.setItem('user_role', retryResolvedRole);
          setUserRole(retryResolvedRole);
          
          // Acesso permitido (retry)
          if (isMountedRef.current) {
            setIsAuthorized(true);
            setIsCheckingAuth(false);
          }
          hasCheckedRef.current = false;
          return;
        }
        
        if (isMountedRef.current) {
          if (rolesError.code === 'PGRST116') {
            toast.error("Usuário não possui permissões de administrador");
          } else if (rolesError.code === '42501') {
            toast.error("Erro de permissão RLS");
          } else {
            toast.error(`Erro ao verificar permissões: ${rolesError.message}`);
          }
          navigate("/admin/auth");
          setIsCheckingAuth(false);
        }
        hasCheckedRef.current = false;
        return;
      }

      // Comparar role (pode ser enum app_role ou string)
      const roleValue = resolvedRole;
      const isAdmin = roleValue === 'admin';
      const isCollaborator = roleValue === 'collaborator';
      
      if (!resolvedRole || (!isAdmin && !isCollaborator)) {
        if (isMountedRef.current) {
          toast.error("Acesso negado - apenas administradores e colaboradores");
          navigate("/admin/auth");
          setIsCheckingAuth(false);
        }
        hasCheckedRef.current = false;
        return;
      }
      
      // Salvar role no estado para usar no sidebar
      if (isMountedRef.current) {
        setIsAuthorized(true);
        setIsCheckingAuth(false);
        // Salvar role no localStorage para usar no sidebar
        localStorage.setItem('user_role', resolvedRole);
        setUserRole(resolvedRole);
        
        // Se for colaborador e está acessando /admin diretamente, redirecionar para /admin/orders
        if (resolvedRole === 'collaborator' && location.pathname === '/admin') {
          navigate('/admin/orders', { replace: true });
        }
      }
      
      // Acesso permitido - log removido para reduzir verbosidade
      
      // ✅ FASE 2: Limpar timeout e resetar contadores em caso de sucesso
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
      maxCheckAttemptsRef.current = 0; // Resetar contador em caso de sucesso
      hasCheckedRef.current = true; // ✅ Marcar como verificado
      checkInProgressRef.current = false;
    } catch (error: unknown) {
      console.error("Erro inesperado na verificação:", error);
      const err = error instanceof Error ? error : new Error(String(error));
      
      // ✅ FASE 2: Limpar timeout em caso de erro
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
      
      // ✅ FASE 2: Não tentar novamente se excedeu o limite
      if (maxCheckAttemptsRef.current >= MAX_CHECK_ATTEMPTS) {
        checkInProgressRef.current = false;
        hasCheckedRef.current = false;
        if (isMountedRef.current) {
          toast.error("Erro ao verificar autenticação. Limite de tentativas excedido.");
          navigate("/admin/auth");
          setIsCheckingAuth(false);
        }
        return;
      }
      
      // Se for timeout, tentar novamente apenas se não excedeu o limite
      if (err.message.includes('Timeout')) {
        checkInProgressRef.current = false;
        hasCheckedRef.current = false;
        // Tentar novamente após delay
        setTimeout(() => {
          if (isMountedRef.current && maxCheckAttemptsRef.current < MAX_CHECK_ATTEMPTS) {
            checkAdminAccess().catch((retryError: unknown) => {
              console.error('Erro no retry:', retryError);
            });
          }
        }, 1000);
        return;
      }
      
      if (isMountedRef.current) {
        toast.error("Erro ao verificar autenticação");
        navigate("/admin/auth");
        setIsCheckingAuth(false);
      }
      checkInProgressRef.current = false;
      hasCheckedRef.current = false;
    } finally {
      // ✅ FASE 2: Garantir que o estado seja atualizado mesmo em caso de erro
      checkInProgressRef.current = false;
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
      if (isMountedRef.current && !isAuthorized) {
        setIsCheckingAuth(false);
      }
    }
  };

  // ✅ SESSÃO PERSISTENTE: Listener de mudanças de autenticação
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let supabase: any;
      try {
        ({ supabase } = await import("@/integrations/supabase/client"));
      } catch {
        return;
      }

      if (cancelled || !supabase?.auth) return;

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event: string, session: any) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
              const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
              
              if (cachedRole && (cachedRole === 'admin' || cachedRole === 'collaborator')) {
                if (isMountedRef.current && isAuthorized) {
                  setIsCheckingAuth(false);
                  return;
                }

                if (isMountedRef.current && !isAuthorized) {
                  supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", session.user.id)
                    .then(({ data: rolesArray }: { data: Array<{ role: unknown }> | null }) => {
                      const finalRole = resolveUserRole(rolesArray);
                      if (finalRole && isMountedRef.current) {
                        setIsAuthorized(true);
                        setUserRole(finalRole);
                        setIsCheckingAuth(false);
                        localStorage.setItem('user_role', finalRole);
                      }
                    })
                    .catch((error: unknown) => {
                      console.error('Erro ao verificar role após renovação:', error);
                    });
                }
              }
            }
          } else if (event === 'SIGNED_OUT') {
            const shouldBypassForE2E =
              typeof window !== 'undefined' &&
              (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
              localStorage.getItem('admin_e2e_seed_orders') === 'true';
            const shouldBypassInDev = isDev && shouldBypassForE2E;
            if (isE2EEnv || shouldBypassInDev || shouldBypassForE2E) {
              return;
            }
            if (isMountedRef.current) {
              setIsAuthorized(false);
              setUserRole(null);
              setIsCheckingAuth(false);
              localStorage.removeItem('user_role');
            }
          } else if (event === 'USER_UPDATED') {
            // Nenhuma ação necessária para atualização de perfil
          }
        }
      );

      authStateChangeSubscriptionRef.current = subscription;
    })();

    // Cleanup: remover subscription quando componente desmontar
    return () => {
      cancelled = true;
      if (authStateChangeSubscriptionRef.current) {
        authStateChangeSubscriptionRef.current.unsubscribe();
        authStateChangeSubscriptionRef.current = null;
      }
    };
  }, [isAuthorized, isDev]);

  // ✅ Cleanup: Marcar componente como desmontado
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      hasCheckedRef.current = false;
      checkInProgressRef.current = false;
      maxCheckAttemptsRef.current = 0;
      // ✅ FASE 2: Limpar timeout no cleanup
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
      // ✅ SESSÃO PERSISTENTE: Limpar subscription de auth state
      if (authStateChangeSubscriptionRef.current) {
        authStateChangeSubscriptionRef.current.unsubscribe();
        authStateChangeSubscriptionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // ✅ SESSÃO PERSISTENTE: Verificar autenticação apenas uma vez ao montar
    // O cache do localStorage será verificado primeiro para resposta instantânea
    // Se já está autorizado e tem sessão válida, não verificar novamente
    
    if (isMountedRef.current && !hasCheckedRef.current && !checkInProgressRef.current) {
      // Verificar se já está autorizado com cache válido antes de fazer verificação completa
      const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
      const shouldBypassForE2E =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        localStorage.getItem('admin_e2e_seed_orders') === 'true';
      const shouldBypassInDev = isDev && shouldBypassForE2E;
      const isBypassEnv = isE2EEnv || shouldBypassInDev || shouldBypassForE2E;

      if (isBypassEnv) {
        const finalRole = cachedRole === 'admin' || cachedRole === 'collaborator' ? cachedRole : 'admin';
        localStorage.setItem('user_role', finalRole);
        if (isMountedRef.current) {
          setIsAuthorized(true);
          setUserRole(finalRole);
          setIsCheckingAuth(false);
          hasCheckedRef.current = true;
        }
        return;
      }

      if (cachedRole && (cachedRole === 'admin' || cachedRole === 'collaborator')) {
        (async () => {
          try {
            const { supabase } = await import("@/integrations/supabase/client");
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
              if (isMountedRef.current) {
                setIsAuthorized(true);
                setUserRole(cachedRole);
                setIsCheckingAuth(false);
                hasCheckedRef.current = true;
              }
              return;
            }
          } catch {
            // Sessão inválida, continuar para checkAdminAccess
          }

          checkAdminAccess().catch((error) => {
            console.error('Erro não tratado em checkAdminAccess:', error);
            hasCheckedRef.current = false;
            checkInProgressRef.current = false;
            if (isMountedRef.current) {
              setIsCheckingAuth(false);
            }
          });
        })();
      } else {
        // Sem cache, fazer verificação completa
        checkAdminAccess().catch((error) => {
          console.error('Erro não tratado em checkAdminAccess:', error);
          hasCheckedRef.current = false;
          checkInProgressRef.current = false;
          if (isMountedRef.current) {
            setIsCheckingAuth(false);
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ PWA: Mostrar notificação de instalação
  useEffect(() => {
    if (shouldShowNotification && isInstallable && !isInstalled && !notificationShownRef.current) {
      notificationShownRef.current = true; // Marcar como exibida
      const notificationId = toast.info(
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-base mb-1">📱 Instalar App Admin</p>
            <p className="text-sm text-muted-foreground">
              Instale o painel administrativo como um app para acesso rápido e melhor experiência.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                toast.dismiss(notificationId);
                const result = await installPWA();
                if (result === true) {
                  toast.success('App instalado com sucesso!');
                  dismissNotification();
                } else if (result && typeof result === 'object' && result.fallback) {
                  // Mostrar instruções de instalação manual melhoradas
                  const isMobile = result.isMobile || false;
                  const steps = result.steps || [];
                  
                  toast.info(
                    <div className="space-y-3 max-w-md">
                      <div>
                        <p className="font-semibold text-base mb-2">
                          {isMobile ? '📱 Instalar no Mobile' : '💻 Instalar no Desktop'}
                        </p>
                        {steps.length > 0 ? (
                          <ol className="space-y-1.5 text-sm list-decimal list-inside">
                            {steps.map((step, idx) => (
                              <li key={idx} className="text-muted-foreground">
                                {step.replace(/^\d+\.\s*/, '')}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {result.instructions}
                          </p>
                        )}
                      </div>
                      {!isMobile && (
                        <p className="text-xs text-muted-foreground italic">
                          💡 Dica: Procure o ícone ➕ na barra de endereços do navegador
                        </p>
                      )}
                    </div>,
                    { 
                      duration: 12000,
                      position: 'top-center',
                      className: 'max-w-md'
                    }
                  );
                } else {
                  toast.error('Não foi possível instalar o app. Tente usar o menu do navegador.');
                }
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Instalar Agora
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                toast.dismiss(notificationId);
                dismissNotification();
              }}
            >
              Agora não
            </Button>
          </div>
        </div>,
        {
          duration: 20000, // 20 segundos - mais tempo para ler
          position: 'top-center',
          closeButton: true,
          // ✅ Nota: O espaçamento é controlado via CSS global em index.css
        }
      );
    } else {
      // Notificação não será exibida - log removido para reduzir verbosidade
    }
  }, [shouldShowNotification, isInstallable, isInstalled, installPWA, dismissNotification]);

  const handleLogout = async () => {
    try {
      // ✅ SESSÃO PERSISTENTE: Limpar estado antes de fazer logout
      setIsAuthorized(false);
      setUserRole(null);
      localStorage.removeItem('user_role');
      hasCheckedRef.current = false;
      
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso");
      navigate("/admin/auth");
    } catch (error) {
      if (isDev) {
        console.error("Erro ao fazer logout:", error);
      }
      toast.error("Erro ao sair");
    }
  };


  // Mostrar loader enquanto verifica autenticação ou redireciona
  // ✅ UNIFICADO: Um único loading centralizado
  if (isCheckingAuth || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-gradient-to-br from-admin-bg via-white to-slate-50 fixed inset-0 z-50 admin-fade-in">
        <div className="text-center space-y-4 admin-scale-in">
          <Loader2 className="h-8 w-8 animate-spin text-admin-primary mx-auto" />
          <p className="text-sm text-admin-text-muted font-medium">
            {isCheckingAuth ? 'Verificando permissões...' : 'Redirecionando...'}
          </p>
        </div>
      </div>
    );
  }

  // 5. Return principal
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-[100dvh] flex w-full overflow-hidden bg-slate-100 dark:bg-slate-900 admin-fade-in">
        <nav aria-label="Admin navigation">
          <Suspense
            fallback={
              <div aria-hidden="true" className="hidden md:block w-[18rem] flex-shrink-0" />
            }
          >
            <LazyAdminSidebar />
          </Suspense>
        </nav>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100 dark:bg-slate-900">
          <header className="h-16 md:h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-[60] flex-shrink-0 admin-slide-in-down rounded-none border-none shadow-none bg-gradient-to-r from-purple-600 to-pink-600/95" style={{ backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' }}>
            {/* Esquerda: Menu + Tag de Autorização */}
            <div className="flex items-center gap-3 flex-shrink-0 z-[70] h-full relative">
              <SidebarTrigger 
                className="h-10 w-10 text-white hover:bg-white/20 hover:text-white transition-all duration-200 relative z-[70]"
                data-testid="sidebar-trigger"
              />
              {/* Tag de Autorização - Estilo Minimalista */}
              {userRole && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/10 border border-white/10 text-white/90 backdrop-blur-sm">
                  {userRole === 'admin' ? (
                    <Shield className="w-3.5 h-3.5" />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[11px] font-semibold tracking-wide uppercase">
                    {userRole === 'admin' ? 'Admin' : 'Colaborador'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Centro: Data, Hora e Clima - Estilo Apple */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center z-0 pointer-events-none">
              {shouldRenderNonCritical && (
                <Suspense fallback={null}>
                  <WeatherWidget />
                </Suspense>
              )}
            </div>
            
            {/* Direita: Outros botões */}
            <div className="flex items-center gap-2 flex-shrink-0 z-10">
              {/* ✅ PWA: Indicador de Status Offline/Online */}
              {shouldRenderNonCritical && (
                <Suspense fallback={null}>
                  <OfflineIndicator />
                </Suspense>
              )}
              
              {/* ✅ PWA: Botão de instalação no cabeçalho - Minimalista */}
              {isInstallable && !isInstalled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const result = await installPWA();
                    if (result === true) {
                      toast.success('App instalado com sucesso!');
                      dismissNotification();
                    } else if (result && typeof result === 'object' && result.fallback) {
                      const isMobile = result.isMobile || false;
                      const steps = result.steps || [];
                      toast.info(
                        <div className="space-y-3 max-w-md">
                          <div>
                            <p className="font-semibold text-base mb-2">
                              {isMobile ? '📱 Instalar no Mobile' : '💻 Instalar no Desktop'}
                            </p>
                            {steps.length > 0 ? (
                              <ol className="space-y-1.5 text-sm list-decimal list-inside">
                                {steps.map((step, idx) => (
                                  <li key={idx} className="text-muted-foreground">
                                    {step.replace(/^\d+\.\s*/, '')}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-sm text-muted-foreground whitespace-pre-line">
                                {result.instructions}
                              </p>
                            )}
                          </div>
                          {!isMobile && (
                            <p className="text-xs text-muted-foreground italic">
                              💡 Dica: Procure o ícone ➕ na barra de endereços do navegador
                            </p>
                          )}
                        </div>,
                        { duration: 12000, position: 'top-center', className: 'max-w-md' }
                      );
                    } else {
                      toast.error('Não foi possível instalar o app. Tente usar o menu do navegador.');
                    }
                  }}
                  className="flex items-center gap-2 text-white/90 hover:text-white hover:bg-white/10 h-9 px-3 rounded-full border border-white/10"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden md:inline text-xs font-medium">App</span>
                </Button>
              )}
              
              <div className="h-4 w-px bg-white/20 mx-1 hidden md:block" />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="logout-button"
                className="h-9 w-9 md:w-auto md:px-3 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline text-xs font-medium">Sair</span>
              </Button>
            </div>
          </header>
          <main role="main" className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-slate-100 dark:bg-slate-900">
            <div className="p-4 md:p-6 relative">
              {isManualNavigating && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white/70 backdrop-blur-sm">
                  <div className="text-center space-y-4 admin-scale-in">
                    <Loader2 className="h-8 w-8 animate-spin text-admin-primary mx-auto" />
                    <p className="text-sm text-admin-text-muted font-medium">Carregando...</p>
                  </div>
                </div>
              )}
              <Suspense fallback={<AdminPageLoading />}>
                <div className="admin-fade-in">
                  <AdminOutletReady onReady={handleOutletReady} />
                </div>
              </Suspense>
            </div>
          </main>
          <aside aria-label="PWA install prompt">
            {shouldRenderNonCritical && (
              <Suspense fallback={null}>
                <InstallPrompt />
              </Suspense>
            )}
          </aside>
        </div>
      </div>
    </SidebarProvider>
  );
}
