import { Link, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect, useMemo, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { scheduleNonCriticalRender } from "@/utils/scheduleNonCriticalRender";
import Logo from "@/components/Logo";
import { LayoutDashboard,
  ShoppingCart,
  Users,
  BarChart3,
  type LucideIcon,
  ChevronDown, } from "@/lib/icons";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarHeader,
} from "@/components/ui/sidebar";

interface MenuItem {
  id: string;
  title: string;
  url: string;
  icon: LucideIcon;
  iconTestClass: string;
  permissionKey: string;
}

const adminMenuItems: MenuItem[] = [
  { id: "dashboard", title: "Dashboard", url: "/admin", icon: LayoutDashboard, iconTestClass: "layoutdashboard", permissionKey: "dashboard" },
  { id: "quiz-metrics", title: "Métricas de Quiz", url: "/admin/quiz-metrics", icon: BarChart3, iconTestClass: "barchart3", permissionKey: "dashboard" },
  { id: "orders", title: "Pedidos", url: "/admin/orders", icon: ShoppingCart, iconTestClass: "shoppingcart", permissionKey: "orders" },
  { id: "collaborators", title: "Colaboradores", url: "/admin/collaborators", icon: Users, iconTestClass: "users", permissionKey: "collaborators" },
];

const defaultCollaboratorPermissions: Record<string, boolean> = {
  dashboard: true,
  orders: true,
  collaborators: false,
};

/**
 * Determina a role do usuário priorizando admin sobre collaborator
 */
function determineUserRole(roleArray: Array<{ role: string }> | null): 'admin' | 'collaborator' | null {
  if (!roleArray || roleArray.length === 0) {
    return null;
  }

  const adminRole = roleArray.find(r => String(r.role) === 'admin');
  const collaboratorRole = roleArray.find(r => String(r.role) === 'collaborator');

  if (adminRole) return 'admin';
  if (collaboratorRole) return 'collaborator';

  const roleString = String(roleArray[0].role);
  if (roleString === 'admin' || roleString === 'collaborator') return roleString;
  return null;
}

/**
 * Processa permissões do colaborador a partir dos dados do banco
 */
function processCollaboratorPermissions(
  permissionsData: Array<{ permission_key: string; granted: boolean }> | null
): Record<string, boolean> {
  const permissionsMap: Record<string, boolean> = {};

  if (permissionsData && permissionsData.length > 0) {
    permissionsData.forEach(perm => {
      if (perm.granted === true) {
        permissionsMap[perm.permission_key] = true;
      }
    });
  } else {
    Object.keys(defaultCollaboratorPermissions).forEach(key => {
      if (defaultCollaboratorPermissions[key] === true) {
        permissionsMap[key] = true;
      }
    });
  }

  return permissionsMap;
}

/**
 * Verifica se um item do menu deve ser exibido baseado nas permissões
 */
function hasMenuPermission(item: MenuItem, permissions: Record<string, boolean>, isCollaborator: boolean): boolean {
  if (!isCollaborator) {
    return true;
  }

  if (!item.permissionKey) {
    return false;
  }

  return permissions[item.permissionKey] === true;
}

export function AdminSidebar() {
  const { openMobile, setOpenMobile, open, setOpen } = useSidebar();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [hasHover, setHasHover] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'collaborator' | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [hasCachedState, setHasCachedState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHasHover(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canUseIconCollapse = !isMobile && hasHover;
    if (!canUseIconCollapse && open === false) {
      setOpen(true);
    }
  }, [hasHover, isMobile, open, setOpen]);

  const loadUserRoleAndPermissions = useCallback(async () => {
    if (!hasCachedState) {
      setIsLoading(true);
    }

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        setIsLoading(false);
        return;
      }

      const roleResult = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleArray = roleResult.data;
      const roleError = roleResult.error;
      const roleValue = determineUserRole(roleArray as Array<{ role: string }> | null);

      if (roleValue) {
        setUserRole(roleValue);
        if (typeof window !== 'undefined') {
          localStorage.setItem('user_role', roleValue);
        }

        if (roleValue === 'collaborator') {
          const permissionsResult = await supabase
            .from("collaborator_permissions")
            .select("permission_key, granted")
            .eq("user_id", user.id);

          const permissionsData = permissionsResult.data;
          const permissionsMap = processCollaboratorPermissions(permissionsData);
          setPermissions(permissionsMap);
          if (typeof window !== 'undefined') {
            localStorage.setItem('user_permissions', JSON.stringify(permissionsMap));
          }
        } else {
          setPermissions({});
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user_permissions');
          }
        }
      } else if (roleError) {
        console.error('Erro ao buscar role:', roleError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasCachedState]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedRole = localStorage.getItem('user_role') as 'admin' | 'collaborator' | null;
      const cachedPermissionsRaw = localStorage.getItem('user_permissions');
      
      if (cachedRole) {
        setUserRole(cachedRole);
      }
      if (cachedPermissionsRaw) {
        try {
          const parsed = JSON.parse(cachedPermissionsRaw);
          if (parsed && typeof parsed === 'object') {
            setPermissions(parsed);
          }
        } catch {
          localStorage.removeItem('user_permissions');
        }
      }

      if (cachedRole || cachedPermissionsRaw) {
        setHasCachedState(true);
        setIsLoading(false);
      }
    }

    const hasAnyCache =
      typeof window !== 'undefined' &&
      (localStorage.getItem('user_role') || localStorage.getItem('user_permissions'));

    let cancelScheduledLoad: (() => void) | null = null;
    if (hasAnyCache) {
      cancelScheduledLoad = scheduleNonCriticalRender(loadUserRoleAndPermissions, { timeoutMs: 2000, delayMs: 250 });
    } else {
      loadUserRoleAndPermissions();
    }
    
    let channel: RealtimeChannel | null = null;
    
    const setupListener = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      
      try {
        const cachedRole = typeof window !== 'undefined'
          ? (localStorage.getItem('user_role') as 'admin' | 'collaborator' | null)
          : null;
        if (cachedRole !== 'collaborator') return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        channel = supabase
          .channel('collaborator-permissions-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'collaborator_permissions',
            },
            () => {
              loadUserRoleAndPermissions();
            }
          )
          .subscribe();
      } catch (error) {
        // Erro silencioso
      }
    };
    
    setupListener();
    
    return () => {
      if (cancelScheduledLoad) {
        cancelScheduledLoad();
      }
      if (channel) {
        import("@/integrations/supabase/client").then(({ supabase }) => {
          supabase.removeChannel(channel);
        }).catch(() => {
          // Ignorar erros no cleanup
        });
      }
    };
  }, [loadUserRoleAndPermissions]);

  const menuItems = useMemo(() => {
    if (isLoading) {
      return [];
    }
    
    if (!userRole) {
      return [];
    }
    
    const isCollaborator = userRole === 'collaborator';
    
    if (isCollaborator) {
      const grantedPermissions = Object.keys(permissions).filter(k => permissions[k] === true);
      if (grantedPermissions.length === 0) {
        return [];
      }
      
      return adminMenuItems.filter(item => 
        hasMenuPermission(item, permissions, isCollaborator)
      );
    }
    
    return adminMenuItems;
  }, [userRole, permissions, isLoading]);

  const handleItemClick = useCallback(
    (targetUrl: string, isActive: boolean) => {
      if (!isActive && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("admin:navigation-start", { detail: { to: targetUrl } }));
      }

      if (isMobile && openMobile) {
        window.setTimeout(() => {
          setOpenMobile(false);
        }, 150);
      }
    },
    [isMobile, openMobile, setOpenMobile],
  );

  const isItemActive = useCallback(
    (url: string) => {
      const pathname = location.pathname;
      if (url === "/admin") return pathname === "/admin";
      return pathname === url || pathname.startsWith(`${url}/`);
    },
    [location.pathname],
  );

  return (
    <Sidebar 
      data-testid="admin-sidebar"
      className="border-none admin-slide-in-left" 
      collapsible="icon" 
      variant="sidebar" 
      side="left" 
    >
      <SidebarHeader className="pt-4 pb-2 px-4 flex items-center justify-center">
        <div className="group-data-[collapsible=icon]:hidden w-full flex justify-center">
          <Logo width={280} height={84} variant="white" className="opacity-90 hover:opacity-100 transition-opacity" />
        </div>
        {/* Logo removido no modo colapsado conforme solicitado */}
      </SidebarHeader>

      <SidebarContent className="bg-transparent py-2">
        <SidebarGroup className="px-4 group-data-[collapsible=icon]:px-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {menuItems.map((item, index) => {
                const isActive = isItemActive(item.url);
                return (
                  <SidebarMenuItem key={item.id} className={`admin-stagger-${Math.min(index + 1, 6)}`}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "text-white/85 transition-all duration-200 h-11 w-full px-2 rounded-[14px] mx-auto flex items-center justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:p-0",
                        isActive
                          ? "bg-black/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.06)] hover:bg-black/15 text-white data-[active=true]:bg-black/10 data-[active=true]:text-white"
                          : "hover:bg-black/5"
                      )}
                    >
                      <Link
                        to={item.url}
                        onClick={() => handleItemClick(item.url, isActive)}
                        className="flex items-center w-full group-data-[collapsible=icon]:justify-center"
                      >
                        <span className="flex items-center justify-center h-11 w-11 shrink-0 rounded-[14px]">
                          <item.icon className={cn("h-6 w-6 shrink-0", item.iconTestClass)} />
                        </span>
                        <span className="truncate ml-3 text-sm font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
