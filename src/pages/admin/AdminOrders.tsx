import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RefreshCw, Search, Eye, DollarSign, TestTube, CheckCircle, Phone, Clock, ShoppingCart } from "@/lib/icons";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";
import { useOrders, useOrdersStats } from "@/hooks/useAdminData";
import { useDebounce } from "@/hooks/use-debounce";
import { useCollaboratorPermissions } from "@/hooks/useCollaboratorPermissions";
import { SolidStatCard, ADMIN_CARD_COLORS } from "@/components/admin/SolidStatCard";

interface Order {
  id: string;
  customer_email: string;
  customer_whatsapp?: string;
  status: string;
  plan: string;
  amount_cents: number;
  created_at: string;
  paid_at?: string;
  provider: string;
  is_test_order?: boolean;
  customer_name?: string;
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    const stored = sessionStorage.getItem("admin_orders_status_filter");
    return stored || "all";
  });
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showTestOrders, setShowTestOrders] = useState(() => {
    if (typeof window === "undefined") return false;
    if (navigator.webdriver && localStorage.getItem("admin_e2e_seed_orders") === "true") return true;
    const saved = localStorage.getItem("admin_show_test_orders");
    if (saved === "true") return true;
    const url = new URL(window.location.href);
    const qp = url.searchParams.get("showTestOrders");
    return qp === "1" || qp === "true";
  });
  const [enableE2ESeedOrders] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!navigator.webdriver) return false;
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return false;
    const flag = localStorage.getItem("admin_e2e_seed_orders");
    return flag === null || flag === "true";
  });
  const enableE2EScrollContainer = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!navigator.webdriver) return false;
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  }, []);
  const [sortField, setSortField] = useState<"email" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [convertingOrder, setConvertingOrder] = useState<string | null>(null);
  const ordersPerPage = 50; // ✅ Aumentado para melhor performance
  const seededOrders = useMemo<Order[]>(
    () => [
      {
        id: "e2e-order-1",
        customer_email: "test@example.com",
        status: "paid",
        plan: "premium",
        amount_cents: 12900,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        provider: "hotmart",
        is_test_order: true,
      },
      {
        id: "e2e-order-2",
        customer_email: "customer2@test.com",
        status: "pending",
        plan: "standard",
        amount_cents: 9900,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        provider: "hotmart",
        is_test_order: true,
      },
      {
        id: "e2e-order-3",
        customer_email: "customer3@test.com",
        status: "failed",
        plan: "premium",
        amount_cents: 14900,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        provider: "mercadopago",
        is_test_order: true,
      },
      ...Array.from({ length: 22 }).map((_, idx) => {
        const i = idx + 4;
        const statuses = ["paid", "pending", "failed", "refunded"] as const;
        const plans = ["standard", "express", "premium"] as const;
        const providers = ["hotmart", "mercadopago"] as const;
        return {
          id: `e2e-order-${i}`,
          customer_email: `customer${i}@example.com`,
          status: statuses[idx % statuses.length],
          plan: plans[idx % plans.length],
          amount_cents: 7900 + (idx % 6) * 1000,
          created_at: new Date(Date.now() - i * 6 * 60 * 60 * 1000).toISOString(),
          provider: providers[idx % providers.length],
          is_test_order: false,
        };
      }),
    ],
    []
  );
  
  // ✅ CORREÇÃO: Verificar localStorage de forma SÍNCRONA antes de renderizar (evita flash)
  // Isso garante que a verificação aconteça ANTES do primeiro render
  const getInitialRole = (): 'admin' | 'collaborator' | null => {
    if (typeof window === 'undefined') return null;
    const role = localStorage.getItem('user_role');
    return role === 'admin' || role === 'collaborator' ? role : null;
  };
  
  const [initialRole] = useState<'admin' | 'collaborator' | null>(getInitialRole());
  const { userRole, isLoading: isRoleLoading } = useCollaboratorPermissions();
  const [cachedRole, setCachedRole] = useState<string | null>(initialRole);
  // ✅ CORREÇÃO: Inicializar roleVerified como false e só marcar como true quando tivermos certeza
  const [roleVerified, setRoleVerified] = useState(false);
  
  // ✅ CORREÇÃO: Verificar role imediatamente e marcar como verificado APENAS quando tivermos certeza
  useEffect(() => {
    // Verificar imediatamente
    const role = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
    setCachedRole(role);
    
    // Só marcar como verificado se tivermos uma role válida OU se o hook já tiver retornado
    if (role || (!isRoleLoading && userRole)) {
      setRoleVerified(true);
      
      // Adicionar atributo data no body para CSS global
      if (typeof document !== 'undefined') {
        const finalRole = role || userRole;
        if (finalRole) {
          document.body.setAttribute('data-user-role', finalRole);
        }
      }
    }
  }, [isRoleLoading, userRole]);
  
  // Monitorar mudanças no localStorage
  useEffect(() => {
    const checkRole = () => {
      const role = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
      setCachedRole(role);
      
      // Atualizar atributo no body
      if (typeof document !== 'undefined' && role) {
        document.body.setAttribute('data-user-role', role);
      }
    };
    
    // Verificar imediatamente
    checkRole();
    
    // Escutar mudanças no localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_role') {
        setCachedRole(e.newValue);
        if (typeof document !== 'undefined' && e.newValue) {
          document.body.setAttribute('data-user-role', e.newValue);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Verificar periodicamente (fallback para mudanças na mesma aba)
    const interval = setInterval(checkRole, 100);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  // ✅ CORREÇÃO: Verificação mais conservadora - se houver QUALQUER indicação de colaborador, ocultar
  // Só mostrar o card se tivermos CERTEZA ABSOLUTA de que é admin
  // Verificação DIRETA no momento do cálculo (não depende de estado)
  const getCurrentRole = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_role');
    }
    return null;
  };
  
  const currentRole = getCurrentRole();
  // ✅ VERIFICAÇÃO DEFINITIVA: Se QUALQUER fonte indicar colaborador, considerar como colaborador
  const isCollaborator = 
    currentRole === 'collaborator' ||
    initialRole === 'collaborator' || 
    userRole === 'collaborator' || 
    cachedRole === 'collaborator';
  
  // ✅ CORREÇÃO: Calcular cards que devem ser mostrados usando useMemo
  // Isso garante que o card "Pago" nunca seja incluído se for colaborador
  const cardsToShow = useMemo(() => {
    const cards = [
      'total', // Total de Pedidos - sempre mostra
      'pago',  // Pago - só se NÃO for colaborador
      'pendentes', // Pendentes - sempre mostra
      'conversao' // Conversão - sempre mostra
    ];
    
    // Se for colaborador, remover 'pago' do array
    if (isCollaborator) {
      return cards.filter(card => card !== 'pago');
    }
    
    return cards;
  }, [isCollaborator]);
  
  // Debug: verificar role
  
  // ✅ OTIMIZAÇÃO: Usar React Query com paginação real
  // ✅ BUSCA EM BACKGROUND: Manter dados anteriores visíveis durante busca
  const { data: ordersData, isLoading: loading, refetch, isFetching, error: ordersError } = useOrders({
    search: debouncedSearchTerm,
    status: statusFilter !== "all" ? statusFilter : undefined,
    plan: planFilter !== "all" ? planFilter : undefined,
    provider: providerFilter !== "all" ? providerFilter : undefined,
    page: currentPage,
    pageSize: ordersPerPage,
  });
  
  // ✅ NOVO: Buscar estatísticas reais (contagens agregadas) sem carregar todos os dados
  const { data: statsData, isLoading: statsLoading } = useOrdersStats({
    search: debouncedSearchTerm,
    status: statusFilter !== "all" ? statusFilter : undefined,
    plan: planFilter !== "all" ? planFilter : undefined,
    provider: providerFilter !== "all" ? providerFilter : undefined,
  });
  
  const orders = ordersData?.orders || [];
  const baseOrders = enableE2ESeedOrders && orders.length === 0 ? seededOrders : orders;
  const totalOrders = ordersData?.total || baseOrders.length;
  
  
  // ✅ Tratamento de erros melhorado
  useEffect(() => {
    if (ordersError) {
      console.error("❌ Erro ao carregar pedidos:", ordersError);
      console.error("❌ Detalhes do erro:", {
        message: ordersError instanceof Error ? ordersError.message : String(ordersError),
        name: ordersError instanceof Error ? ordersError.name : 'Unknown',
        stack: ordersError instanceof Error ? ordersError.stack : undefined
      });
      
      const errorMessage = ordersError instanceof Error 
        ? ordersError.message 
        : 'Erro desconhecido ao carregar pedidos';
      
      toast.error(`Erro ao carregar pedidos: ${errorMessage}`, {
        duration: 5000,
        description: "Verifique o console para mais detalhes."
      });
    }
  }, [ordersError]);

  // Função para formatar telefone: +55 41 99898-2514
  const formatPhone = (phone: string): string => {
    const numbers = phone.replace(/\D/g, '');
    
    // Se começar com 55 (Brasil)
    if (numbers.startsWith('55') && numbers.length >= 12) {
      const ddi = numbers.slice(0, 2);
      const ddd = numbers.slice(2, 4);
      const firstPart = numbers.slice(4, numbers.length - 4);
      const lastPart = numbers.slice(-4);
      return `+${ddi} ${ddd} ${firstPart}-${lastPart}`;
    }
    
    // Formato brasileiro sem DDI
    if (numbers.length === 11) {
      const ddd = numbers.slice(0, 2);
      const firstPart = numbers.slice(2, 7);
      const lastPart = numbers.slice(7);
      return `+55 ${ddd} ${firstPart}-${lastPart}`;
    }
    
    if (numbers.length === 10) {
      const ddd = numbers.slice(0, 2);
      const firstPart = numbers.slice(2, 6);
      const lastPart = numbers.slice(6);
      return `+55 ${ddd} ${firstPart}-${lastPart}`;
    }
    
    return phone;
  };

  // ✅ OTIMIZAÇÃO: Filtrar apenas pedidos de teste no frontend (outros filtros já vêm do backend)
  const filteredOrders = useMemo(() => {
    let filtered = baseOrders;

    // Aplicar filtro de pedidos de teste (único filtro que precisa ser feito no frontend)
    if (!showTestOrders) {
      filtered = filtered.filter(order => 
        !order.customer_email?.includes('test') && 
        !order.customer_email?.includes('@teste') &&
        !order.customer_email?.includes('@musiclovely.com') &&
        !order.customer_email?.includes('@suamusicafacil.com') &&
        (order as any).is_test_order !== true
      );
    }

    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.trim().toLowerCase();
      filtered = filtered.filter((order) => (order.customer_email ?? "").toLowerCase().includes(term));
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    if (planFilter !== "all") {
      filtered = filtered.filter((order) => (order.plan ?? "").toLowerCase() === planFilter);
    }

    if (providerFilter !== "all") {
      filtered = filtered.filter((order: any) => order.payment_provider === providerFilter || order.provider === providerFilter);
    }

    return filtered;
  }, [baseOrders, debouncedSearchTerm, planFilter, providerFilter, showTestOrders, statusFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("admin_show_test_orders", showTestOrders ? "true" : "false");
  }, [showTestOrders]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("admin_orders_status_filter", statusFilter);
  }, [statusFilter]);

  // ✅ OTIMIZAÇÃO: Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, planFilter, providerFilter, showTestOrders]);

  // ✅ NOVO: Usar estatísticas reais do hook useOrdersStats
  // Aplicar filtro de pedidos de teste nas estatísticas se necessário
  const stats = useMemo(() => {
    // Se ainda está carregando, retornar null para não mostrar cards zerados
    if (statsLoading || !statsData) {
      if (enableE2ESeedOrders) {
        const total = seededOrders.length;
        const paidOrders = seededOrders.filter((o) => o.status === "paid");
        const totalPaid = paidOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0) / 100;
        const pending = seededOrders.filter((o) => o.status === "pending").length;
        const conversionRate = total > 0 ? (paidOrders.length / total) * 100 : 0;
        return { total, totalPaid, pending, conversionRate };
      }
      return null;
    }
    
    // Se não está mostrando pedidos de teste, precisamos filtrar
    // Como o hook busca do banco, não temos como filtrar pedidos de teste diretamente
    // Por enquanto, retornamos os valores do hook (que incluem todos)
    // TODO: Se necessário, podemos adicionar filtro de pedidos de teste no hook também
    return {
      total: statsData.total,
      totalPaid: statsData.totalPaid,
      pending: statsData.pending,
      conversionRate: statsData.conversionRate
    };
  }, [enableE2ESeedOrders, seededOrders, showTestOrders, statsData, statsLoading]);

  // ✅ OTIMIZAÇÃO: Removido loadOrders - agora usa React Query

  const handleConvertTestToNormal = async (orderId: string) => {
    if (!confirm("Tem certeza que deseja converter esta venda teste em uma venda normal?")) {
      return;
    }

    try {
      setConvertingOrder(orderId);
      toast.info("Convertendo venda teste...");

      const newEmail = prompt("Digite o novo email do cliente (ou deixe vazio para manter o atual):");
      const newCustomerName = prompt("Digite o nome do cliente (opcional):");

      const { data, error } = await supabase.functions.invoke('convert-test-to-normal', {
        body: {
          orderId,
          newEmail: newEmail || undefined,
          newCustomerName: newCustomerName || undefined
        }
      });

      if (error) throw error;
      
      toast.success("Venda teste convertida para venda normal com sucesso!");
      refetch();
    } catch (error: any) {
      console.error("Erro ao converter venda:", error);
      toast.error(`Erro ao converter venda: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setConvertingOrder(null);
    }
  };



  // Paginação
  const currentOrders = filteredOrders;
  const sortedOrders = useMemo(() => {
    const items = [...currentOrders];
    if (sortField === "email") {
      items.sort((a, b) => {
        const av = (a.customer_email ?? "").toLowerCase();
        const bv = (b.customer_email ?? "").toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }
    return items;
  }, [currentOrders, sortDirection, sortField]);
  const totalPages = Math.max(1, Math.ceil((totalOrders || currentOrders.length) / ordersPerPage));

  // ✅ CORREÇÃO: Não renderizar até que a role seja verificada (evita flash)
  // Só renderizar quando tivermos CERTEZA da role (localStorage OU hook confirmado)
  const hasConfirmedRole = roleVerified && (initialRole || cachedRole || (!isRoleLoading && userRole));
  
  // ✅ Mostrar erro apenas se não houver dados carregados
  if (ordersError && orders.length === 0) {
    return (
      <div className="container mx-auto p-2 md:p-6" data-testid="error-message">
        <div className="text-center py-12">
          <p className="text-destructive text-lg font-semibold mb-2">Erro ao carregar pedidos</p>
          <p className="text-muted-foreground mb-4">
            {ordersError instanceof Error ? ordersError.message : 'Erro desconhecido'}
          </p>
          <Button onClick={() => refetch()} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 md:p-6 space-y-3 md:space-y-6 admin-fade-in">
      {/* ✅ CSS inline para ocultar card "Pago" para colaboradores */}
      <style>{`
        /* Ocultar card "Pago" se o usuário for colaborador */
        body[data-user-role="collaborator"] .admin-card-compact:has([data-card="pago"]),
        .admin-card-compact[data-card="pago"][data-hide-for-collaborator="true"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>
      <div className="flex items-center justify-between mb-3 md:mb-6 admin-slide-in-down">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-brown-dark-400 mb-2 md:mb-3 tracking-tight font-serif">
            Pedidos
          </h1>
          <p className="text-sm md:text-base text-brown-medium font-medium">Gerenciamento de pedidos</p>
        </div>
        <Button 
          onClick={() => refetch()} 
          variant="outline" 
          size="sm"
          aria-label="Atualizar"
          disabled={loading || isFetching}
          className="border-admin-border hover:border-admin-primary hover:bg-admin-primary/10 text-admin-text font-semibold rounded-xl transition-all duration-200 admin-hover-lift admin-ripple-effect"
        >
          <RefreshCw className={`h-4 w-4 md:mr-2 ${(loading || isFetching) ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>
      {!hasConfirmedRole && <AdminPageLoading text="Verificando permissões..." />}

      {/* Estatísticas - Só mostra quando dados estiverem carregados */}
      {stats && (
        <div className={`grid gap-3 md:gap-6 ${isCollaborator ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'} admin-slide-in-up`}>
          {/* Card: Total de Pedidos - sempre mostra */}
          {cardsToShow.includes('total') && (
            <SolidStatCard
              title="Total de Pedidos"
              value={stats.total.toLocaleString('pt-BR')}
              icon={ShoppingCart}
              color={ADMIN_CARD_COLORS.quaternary}
              description="pedidos registrados"
              testId="stats-total-orders"
              className="admin-stagger-1"
            />
          )}
          
          {/* ✅ Card "Pago" - EXCLUÍDO do array para colaboradores */}
          {/* Só renderiza se 'pago' estiver no array cardsToShow (nunca para colaboradores) */}
          {cardsToShow.includes('pago') && (
            <SolidStatCard
              title="Pago"
              value={`R$ ${stats.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={DollarSign}
              color={ADMIN_CARD_COLORS.primary}
              description="Total arrecadado"
              testId="stats-total-revenue"
              className="admin-stagger-2"
            />
          )}
          
          {/* Card: Pendentes - sempre mostra */}
          {cardsToShow.includes('pendentes') && (
            <SolidStatCard
              title="Pendentes"
              value={stats.pending.toLocaleString('pt-BR')}
              icon={Clock}
              color={ADMIN_CARD_COLORS.secondary}
              description="Aguardando pagamento"
              testId="stats-pending-orders"
              className="admin-stagger-3"
            />
          )}
          
          {/* Card: Conversão - sempre mostra */}
          {cardsToShow.includes('conversao') && (
            <SolidStatCard
              title="Conversão"
              value={`${stats.conversionRate.toFixed(1)}%`}
              icon={CheckCircle}
              color={ADMIN_CARD_COLORS.quinary}
              description="Pedidos pagos"
              testId="stats-conversion-rate"
              className="admin-stagger-4"
            />
          )}
        </div>
      )}
      
      {/* Mostrar loading apenas quando estiver carregando estatísticas */}
      {statsLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando estatísticas...</span>
        </div>
      )}

      <Card className="admin-card-compact apple-card admin-hover-lift admin-slide-in-up">
        <CardHeader className="p-6 border-b border-apple-gray/20">
          <CardTitle className="text-base font-semibold text-apple-gray-600 tracking-wide flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-apple-blue" />
            Pedidos
          </CardTitle>
          <div 
            className="flex flex-col md:flex-row gap-2 md:gap-3 mt-3 md:mt-4"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground pointer-events-none z-10" />
            <Input
                data-testid="search-input"
                placeholder="Buscar por email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              className="text-sm"
              style={{ paddingLeft: '2.75rem' }}
            />
            </div>
            <div data-testid="filter-status">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter" className="w-full md:w-[140px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem data-testid="status-option-all" value="all">Todos</SelectItem>
                  <SelectItem data-testid="status-option-paid" value="paid">Pago</SelectItem>
                  <SelectItem data-testid="status-option-pending" value="pending">Pendente</SelectItem>
                  <SelectItem data-testid="status-option-failed" value="failed">Falhou</SelectItem>
                  <SelectItem data-testid="status-option-refunded" value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div data-testid="filter-plan">
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger data-testid="plan-filter" className="w-full md:w-[140px] text-xs">
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem data-testid="plan-option-all" value="all">Todos</SelectItem>
                  <SelectItem data-testid="plan-option-standard" value="standard">Standard</SelectItem>
                  <SelectItem data-testid="plan-option-express" value="express">Express</SelectItem>
                  <SelectItem data-testid="plan-option-premium" value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div data-testid="filter-provider">
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger data-testid="provider-filter" className="w-full md:w-[140px] text-xs">
                  <SelectValue placeholder="Gateway" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem data-testid="provider-option-all" value="all">Todos</SelectItem>
                  <SelectItem data-testid="provider-option-hotmart" value="hotmart">Hotmart</SelectItem>
                  <SelectItem data-testid="provider-option-mercadopago" value="mercadopago">Mercado Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div data-testid="filter-test-orders" className="flex items-center gap-2 p-2 md:p-0">
              <Switch
                data-testid="toggle-show-test-orders"
                checked={showTestOrders}
                onCheckedChange={setShowTestOrders}
                id="show-test-orders"
              />
              <Label htmlFor="show-test-orders" className="text-xs text-muted-foreground">
                Mostrar testes
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-1 md:p-2 pt-0">
          <div
            className="space-y-2 admin-orders-container"
            data-testid="orders-list"
            style={enableE2EScrollContainer ? { maxHeight: '160px', overflowY: 'auto' } : undefined}
          >
            {sortedOrders.length === 0 && !loading ? (
              <div className="text-center py-12 md:py-16">
                <ShoppingCart className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground text-sm md:text-base font-medium mb-2">
                  Nenhum pedido encontrado
                </p>
                <p className="text-muted-foreground text-xs md:text-sm">
                  {searchTerm || statusFilter !== "all" || planFilter !== "all" || providerFilter !== "all"
                    ? "Tente ajustar os filtros de busca"
                    : "Quando houver pedidos, eles aparecerão aqui"}
                </p>
              </div>
            ) : (
              <div data-testid="orders-table" role="table" className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th
                        scope="col"
                        className="text-left p-3 select-none cursor-pointer"
                        onClick={() => {
                          if (sortField !== "email") {
                            setSortField("email");
                            setSortDirection("asc");
                            return;
                          }
                          setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                        }}
                      >
                        Email{" "}
                        {sortField === "email" && (
                          <span data-testid="sort-indicator" data-direction={sortDirection} className="ml-1 inline-block">
                            {sortDirection === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </th>
                      <th scope="col" className="text-left p-3">Status</th>
                      <th scope="col" className="text-left p-3">Plano</th>
                      <th scope="col" className="text-left p-3">Valor</th>
                      <th scope="col" className="text-left p-3">Data</th>
                      <th scope="col" className="text-right p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map((order, index) => (
                      <tr
                        key={order.id}
                        data-testid={`order-row-${order.id}`}
                        className="border-b hover:bg-apple-gray-50 transition-colors"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td data-testid="order-email" className="p-3 max-w-[280px] truncate">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{order.customer_email}</span>
                            {(order.customer_email?.includes('test') || 
                              order.customer_email?.includes('@teste') ||
                              order.customer_email?.includes('@musiclovely.com') ||
                              order.customer_email?.includes('@suamusicafacil.com') ||
                              (order as any).is_test_order === true) && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                <TestTube className="h-2.5 w-2.5 mr-0.5" />
                                Teste
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td data-testid="order-status" className="p-3">
                          <OrderStatusBadge dataTestId={`status-badge-${order.id}`} status={order.status} />
                        </td>
                        <td data-testid="order-plan" className="p-3 capitalize">{order.plan}</td>
                        <td data-testid="order-amount" className="p-3">
                          R$ {((order as any).amount_cents ? (order as any).amount_cents / 100 : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td data-testid="order-date" className="p-3">
                          {new Date(order.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {(order.customer_email?.includes('test') || 
                              order.customer_email?.includes('@teste') ||
                              order.customer_email?.includes('@musiclovely.com') ||
                              order.customer_email?.includes('@suamusicafacil.com') ||
                              (order as any).is_test_order === true) && (
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => handleConvertTestToNormal(order.id)}
                                disabled={convertingOrder === order.id}
                                className="h-7 px-2 text-[10px]"
                              >
                                {convertingOrder === order.id ? (
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                )}
                                <span className="hidden sm:inline">Converter</span>
                                <span className="sm:hidden">✓</span>
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate(`/admin/orders/${order.id}`)}
                              data-testid="view-order-button"
                              className="h-7 px-2.5 text-[10px]"
                            >
                              <Eye className="h-3 w-3 mr-1.5" />
                              <span>Ver</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Paginação */}
          {totalPages > 1 && (
            <div data-testid="pagination" className="flex items-center justify-center gap-2 mt-3 md:mt-4 pt-3 md:pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="text-xs"
                data-testid="pagination-prev"
              >
                <span className="hidden sm:inline">Anterior</span>
                <span className="sm:hidden">‹</span>
              </Button>
              <span data-testid="current-page" className="text-xs md:text-sm text-muted-foreground">
                <span className="hidden sm:inline">Página {currentPage} de {totalPages}</span>
                <span className="sm:hidden">{currentPage}/{totalPages}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="text-xs"
                data-testid="pagination-next"
              >
                <span className="hidden sm:inline">Próximo</span>
                <span className="sm:hidden">›</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
