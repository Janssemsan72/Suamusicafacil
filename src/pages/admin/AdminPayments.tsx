import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, 
  Search, 
  Eye, 
  DollarSign, 
  CreditCard, 
  TrendingUp,
  Calendar,
  Filter,
  Download } from "@/lib/icons";
import { ADMIN_CARD_COLORS, SolidStatCard } from "@/components/admin/SolidStatCard";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { usePayments } from "@/hooks/useAdminData";

interface Payment {
  id: string;
  order_id: string;
  status: string;
  plan: string;
  amount_cents: number;
  provider: string;
  created_at: string;
  paid_at?: string;
  user_email?: string;
  user_name?: string;
}

export default function AdminPayments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  // ✅ OTIMIZAÇÃO: Usar React Query para cache automático
  const { data: paymentsData, isLoading: loading, refetch } = usePayments({
    search: searchTerm,
    status: statusFilter,
    plan: planFilter,
    provider: providerFilter,
    dateFilter,
  });
  
  const payments = useMemo(() => {
    if (!paymentsData) return [];
    return paymentsData.map((order: any) => ({
      id: order.id,
      order_id: order.id,
      status: order.status,
      plan: order.plan,
      amount_cents: order.amount_cents,
      provider: order.provider || order.payment_provider || 'hotmart',
      created_at: order.created_at,
      paid_at: order.paid_at,
      user_email: Array.isArray(order.profiles) ? order.profiles[0]?.email : order.profiles?.email,
      user_name: Array.isArray(order.profiles) ? order.profiles[0]?.display_name : order.profiles?.display_name,
    }));
  }, [paymentsData]);

  const filteredPayments = useMemo(() => {
    let filtered = payments;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.order_id.toLowerCase().includes(lowerSearch) ||
        payment.user_email?.toLowerCase().includes(lowerSearch) ||
        payment.user_name?.toLowerCase().includes(lowerSearch)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }

    if (planFilter !== "all") {
      filtered = filtered.filter(payment => payment.plan === planFilter);
    }

    if (providerFilter !== "all") {
      filtered = filtered.filter(payment => payment.provider === providerFilter);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();

      switch (dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case "year":
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.created_at);
        return paymentDate >= filterDate;
      });
    }

    return filtered;
  }, [dateFilter, payments, planFilter, providerFilter, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    if (!payments || payments.length === 0) {
      return {
        totalRevenueCents: 0,
        totalTransactions: 0,
        pendingPayments: 0,
        conversionRate: 0,
        averageOrderValueCents: 0,
        monthlyRevenueCents: 0,
      };
    }
    
    const paidPayments = payments.filter(p => p.status === 'paid');
    const totalRevenueCents = paidPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    const totalTransactions = paidPayments.length;
    const pendingPayments = payments.filter(p => p.status === 'pending').length;
    const conversionRate = payments.length > 0 ? (paidPayments.length / payments.length) * 100 : 0;
    const averageOrderValueCents = totalTransactions > 0 ? Math.round(totalRevenueCents / totalTransactions) : 0;
    
    // Receita do mês atual
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenueCents = paidPayments
      .filter(p => p.paid_at && new Date(p.paid_at) >= monthStart)
      .reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    
    return {
      totalRevenueCents,
      totalTransactions,
      pendingPayments,
      conversionRate,
      averageOrderValueCents,
      monthlyRevenueCents,
    };
  }, [payments]);

  const paymentsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, planFilter, providerFilter, searchTerm, statusFilter]);

  const formatCurrency = (cents: number, currency: string = 'BRL') => {
    const amount = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getProviderBadge = (provider: string) => {
    const colors = {
      hotmart: "bg-green-100 text-green-800",
      mercadopago: "bg-green-100 text-green-800"
    };
    
    return (
      <Badge className={colors[provider as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {provider.toUpperCase()}
      </Badge>
    );
  };

  const exportPayments = () => {
    const csvContent = [
      ['ID', 'Status', 'Plano', 'Valor', 'Provedor', 'Email', 'Data Criação', 'Data Pagamento'].join(','),
      ...filteredPayments.map(payment => [
        payment.order_id,
        payment.status,
        payment.plan,
        payment.amount_cents / 100,
        payment.provider,
        payment.user_email || '',
        payment.created_at,
        payment.paid_at || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagamentos-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(filteredPayments.length / paymentsPerPage);
  const startIndex = (currentPage - 1) * paymentsPerPage;
  const endIndex = startIndex + paymentsPerPage;
  const currentPayments = filteredPayments.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brown-dark-400 text-serif-primary">
            Gerenciar Pagamentos
          </h1>
          <p className="text-muted-foreground">
            Visualize e gerencie todos os pagamentos do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportPayments} variant="outline" className="bg-white/50">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => refetch()} className="bg-brown-600 hover:bg-brown-700 text-white">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SolidStatCard
          title="Receita Total"
          value={formatCurrency(stats.totalRevenueCents)}
          icon={DollarSign}
          color={ADMIN_CARD_COLORS.green}
          className="admin-hover-lift"
          description={`${stats.totalTransactions} transações`}
        />
        
        <SolidStatCard
          title="Receita Mensal"
          value={formatCurrency(stats.monthlyRevenueCents)}
          icon={TrendingUp}
          color={ADMIN_CARD_COLORS.blue}
          className="admin-hover-lift"
          description="Este mês"
        />
        
        <SolidStatCard
          title="Taxa de Conversão"
          value={`${stats.conversionRate.toFixed(1)}%`}
          icon={CreditCard}
          color={ADMIN_CARD_COLORS.purple}
          className="admin-hover-lift"
          description="Pagamentos aprovados"
        />
        
        <SolidStatCard
          title="Pagamentos Pendentes"
          value={stats.pendingPayments.toString()}
          icon={Calendar}
          color={ADMIN_CARD_COLORS.yellow}
          className="admin-hover-lift"
          description="Aguardando"
        />
      </div>

      {/* Filters */}
      <Card className="apple-card admin-card-compact">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-brown-dark-400">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="ID, email, nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-muted-foreground">Plano</label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-muted-foreground">Provedor</label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="hotmart">Hotmart</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-muted-foreground">Período</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                  <SelectItem value="year">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="apple-card admin-card-compact overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <CardTitle className="text-brown-dark-400">
            Pagamentos ({filteredPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/10">
                  <th className="text-left p-4 font-medium text-muted-foreground text-sm">ID</th>
                  <th className="text-left p-4 font-medium text-muted-foreground text-sm">Cliente</th>
                  <th className="text-left p-4 font-medium text-muted-foreground text-sm">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground text-sm">Plano</th>
                  <th className="text-left p-4 font-medium text-muted-foreground text-sm">Valor</th>
                  <th className="text-left p-4 font-medium text-muted-foreground text-sm">Provedor</th>
                  <th className="text-left p-4 font-medium text-muted-foreground text-sm">Data</th>
                  <th className="text-left p-4 font-medium text-muted-foreground text-sm">Ações</th>
                </tr>
              </thead>
              <tbody>
                {currentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-mono text-xs text-muted-foreground">
                      {payment.order_id.slice(0, 8)}...
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-brown-dark-400">{payment.user_name || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">
                          {payment.user_email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <OrderStatusBadge status={payment.status} />
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="bg-background/50">
                        {payment.plan}
                      </Badge>
                    </td>
                    <td className="p-4 font-medium text-brown-600">
                      {formatCurrency(payment.amount_cents)}
                    </td>
                    <td className="p-4">
                      {getProviderBadge(payment.provider)}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      <div>{formatDate(payment.created_at)}</div>
                      {payment.paid_at && (
                        <div className="text-green-600 text-xs mt-0.5">
                          Pago: {formatDate(payment.paid_at)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-brown-100 hover:text-brown-600">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="text-center py-12 md:py-16">
              <CreditCard className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground text-sm md:text-base font-medium mb-2">
                Nenhum pagamento encontrado
              </p>
              <p className="text-muted-foreground text-xs md:text-sm">
                {searchTerm || statusFilter !== "all" || planFilter !== "all" || providerFilter !== "all" || dateFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Quando houver pagamentos, eles aparecerão aqui"}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border/50 bg-muted/5">
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredPayments.length)} de {filteredPayments.length} pagamentos
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="bg-background/50"
                >
                  Anterior
                </Button>
                <span className="px-3 py-1 text-sm flex items-center font-medium">
                  {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="bg-background/50"
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
