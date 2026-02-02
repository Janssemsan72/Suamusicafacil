import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminCard } from "@/components/admin/AdminCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, CheckCircle, Clock, X, User } from "@/lib/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { LogFilters, FilterState } from "./components/LogFilters";
import { LogDetailModal } from "./components/LogDetailModal";
import { LogsKPICards } from "./components/LogsKPICards";

interface CheckoutEvent {
  id: string;
  transaction_id: string;
  order_id: string | null;
  event_type: string;
  payload: any;
  error: string | null;
  created_at: string;
}

interface AdminLog {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  changes: any;
  created_at: string;
}

export default function AdminLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const adminUserIdParam = searchParams.get('admin_user_id');
  
  const [checkoutEvents, setCheckoutEvents] = useState<CheckoutEvent[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'checkout' | 'admin'>(adminUserIdParam ? 'admin' : 'checkout');
  const [filters, setFilters] = useState<FilterState>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<CheckoutEvent | AdminLog | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [adminUserInfo, setAdminUserInfo] = useState<{ id: string; name?: string; email?: string } | null>(null);
  
  const pageSize = 25;
  
  // Carregar informações do admin quando admin_user_id estiver na URL
  useEffect(() => {
    const loadAdminUserInfo = async () => {
      if (adminUserIdParam) {
        try {
          // Buscar informações do perfil
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('id', adminUserIdParam)
            .single();
          
          // Buscar email via edge function
          let email = '';
          try {
            const { data: emailData } = await supabase.functions.invoke('admin-get-collaborator-emails', {
              body: { user_ids: [adminUserIdParam] }
            });
            if (emailData?.emails) {
              email = emailData.emails[adminUserIdParam] || '';
            }
          } catch (err) {
            console.warn('Erro ao buscar email:', err);
          }
          
          setAdminUserInfo({
            id: adminUserIdParam,
            name: profile?.display_name || email || 'Colaborador',
            email: email
          });
        } catch (error) {
          console.error('Erro ao carregar informações do admin:', error);
          setAdminUserInfo({
            id: adminUserIdParam,
            name: 'Colaborador',
            email: ''
          });
        }
      } else {
        setAdminUserInfo(null);
      }
    };
    
    loadAdminUserInfo();
  }, [adminUserIdParam]);
  
  // Mudar para aba admin quando admin_user_id estiver na URL
  useEffect(() => {
    if (adminUserIdParam) {
      setActiveTab('admin');
    }
  }, [adminUserIdParam]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Verificar autenticação antes de fazer a query
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      if (activeTab === 'checkout') {
        let query = supabase
          .from('checkout_events')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        // Apply filters
        if (filters.dateRange?.from) {
          const fromDate = filters.dateRange.from;
          if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
            query = query.gte('created_at', fromDate.toISOString());
          }
        }
        if (filters.dateRange?.to) {
          const toDate = filters.dateRange.to;
          if (toDate instanceof Date && !isNaN(toDate.getTime())) {
            query = query.lte('created_at', toDate.toISOString());
          }
        }
        if (filters.eventType) {
          query = query.eq('event_type', filters.eventType);
        }
        if (filters.transactionId && filters.transactionId.trim()) {
          query = query.ilike('transaction_id', `%${filters.transactionId.trim()}%`);
        }
        if (filters.hasError === 'true') {
          query = query.not('error', 'is', null);
        } else if (filters.hasError === 'false') {
          query = query.is('error', null);
        }

        const { data, error, count } = await query;

        // ✅ CORREÇÃO: Tratar erros 400/404 graciosamente
        if (error) {
          const isTableNotFound = error.code === 'PGRST116' || 
                                 error.code === '42P01' || 
                                 error.code === '404' ||
                                 error.message?.includes('does not exist') ||
                                 error.message?.includes('relation') ||
                                 error.message?.includes('not found');
          
          if (isTableNotFound || error.code === '400') {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Tabela checkout_events não encontrada, retornando array vazio:', error);
            }
            setCheckoutEvents([]);
            setTotalCount(0);
            return;
          }
          
          // Outro tipo de erro, logar mas não quebrar
          if (process.env.NODE_ENV === 'development') {
            console.error('Erro ao carregar checkout_events:', error);
          }
          setCheckoutEvents([]);
          setTotalCount(0);
          return;
        }
        
        setCheckoutEvents(data || []);
        setTotalCount(count || 0);
      } else {
        let query = supabase
          .from('admin_logs')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        // Filtrar por admin_user_id se estiver na URL
        if (adminUserIdParam) {
          query = query.eq('admin_user_id', adminUserIdParam);
        }

        // Apply filters
        if (filters.dateRange?.from) {
          const fromDate = filters.dateRange.from;
          if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
            query = query.gte('created_at', fromDate.toISOString());
          }
        }
        if (filters.dateRange?.to) {
          const toDate = filters.dateRange.to;
          if (toDate instanceof Date && !isNaN(toDate.getTime())) {
            query = query.lte('created_at', toDate.toISOString());
          }
        }
        if (filters.action) {
          query = query.eq('action', filters.action);
        }
        if (filters.transactionId && filters.transactionId.trim()) {
          // Simplificar: buscar apenas em target_id primeiro
          // Se necessário, podemos fazer duas queries e combinar
          query = query.ilike('target_id', `%${filters.transactionId.trim()}%`);
        }

        const { data, error, count } = await query;

        if (error) {
          console.error('Erro ao carregar admin_logs:', error);
          throw new Error(`Erro ao carregar logs admin: ${error.message || JSON.stringify(error)}`);
        }
        setAdminLogs(data || []);
        setTotalCount(count || 0);
      }
      
      setLastUpdate(new Date());
    } catch (error: unknown) {
      console.error('Erro completo ao carregar logs:', error);
      
      let errorMessage = 'Erro desconhecido ao carregar logs';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Tentar extrair mensagem de erro do Supabase
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if ('error' in error && typeof error.error === 'object' && error.error !== null) {
          if ('message' in error.error) {
            errorMessage = String(error.error.message);
          }
        } else {
          errorMessage = JSON.stringify(error);
        }
      }
      
      toast.error(`Erro ao carregar logs: ${errorMessage}`);
      
      // Se o erro for relacionado a tabela não encontrada, mostrar mensagem mais clara
      if (errorMessage.includes('relation') || errorMessage.includes('does not exist') || errorMessage.includes('permission denied')) {
        console.error('Possível problema de permissão ou tabela não existe:', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, currentPage, pageSize, adminUserIdParam]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getEventTypeBadge = (eventType: string, hasError: boolean) => {
    if (hasError) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          {eventType}
        </Badge>
      );
    }

    const successTypes = ['checkout_received', 'order_created', 'quiz_created'];
    if (successTypes.includes(eventType)) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500">
          <CheckCircle className="h-3 w-3" />
          {eventType}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        {eventType}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const handleRowClick = (log: CheckoutEvent | AdminLog) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };
  
  const handleClearAdminFilter = () => {
    setSearchParams({});
    setAdminUserInfo(null);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const currentData = activeTab === 'checkout' ? checkoutEvents : adminLogs;
  const errorCount = activeTab === 'checkout' 
    ? checkoutEvents.filter(e => e.error).length 
    : 0;
  const successRate = totalCount > 0 
    ? ((totalCount - errorCount) / totalCount) * 100 
    : 100;

  return (
    <div className="w-full max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brown-dark-400 text-serif-primary">
            Logs do Sistema
          </h1>
          <p className="text-muted-foreground">
            Monitoramento e auditoria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LogFilters activeTab={activeTab} onFilterChange={handleFilterChange} />
          <Button onClick={loadLogs} variant="outline" size="sm" className="bg-background/50">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Banner de filtro por admin */}
      {adminUserIdParam && adminUserInfo && (
        <AdminCard className="border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">
                  Filtrando atividades de: <span className="text-primary">{adminUserInfo.name}</span>
                </p>
                {adminUserInfo.email && (
                  <p className="text-xs text-muted-foreground">{adminUserInfo.email}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAdminFilter}
            >
              <X className="h-4 w-4 mr-2" />
              Limpar filtro
            </Button>
          </div>
        </AdminCard>
      )}

      <LogsKPICards 
        totalEvents={totalCount}
        errorCount={errorCount}
        successRate={successRate}
        lastUpdate={lastUpdate}
      />

      <div className="flex gap-2 w-full max-w-md">
        <Button
          variant={activeTab === 'checkout' ? 'default' : 'outline'}
          onClick={() => setActiveTab('checkout')}
          className="flex-1"
        >
          Eventos de Checkout
        </Button>
        <Button
          variant={activeTab === 'admin' ? 'default' : 'outline'}
          onClick={() => setActiveTab('admin')}
          className="flex-1"
        >
          Logs Administrativos
        </Button>
      </div>

      <AdminCard className="admin-hover-lift overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-brown-600" />
          </div>
        ) : activeTab === 'checkout' ? (
          <div className="table-responsive">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Transação</TableHead>
                  <TableHead className="hidden md:table-cell">Pedido</TableHead>
                  <TableHead>Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkoutEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum evento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  checkoutEvents.map((event) => (
                    <TableRow 
                      key={event.id} 
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => handleRowClick(event)}
                    >
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {formatDate(event.created_at)}
                      </TableCell>
                      <TableCell>
                        {getEventTypeBadge(event.event_type, !!event.error)}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden sm:table-cell">
                        {event.transaction_id ? `${event.transaction_id.slice(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden md:table-cell">
                        {event.order_id ? `${String(event.order_id).slice(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {event.error ? (
                          <span className="text-destructive text-xs truncate block" title={event.error}>
                            {event.error}
                          </span>
                        ) : event.payload ? (
                          <span className="text-xs text-muted-foreground truncate block" title={JSON.stringify(event.payload)}>
                            {JSON.stringify(event.payload)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="table-responsive">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="hidden sm:table-cell">Tabela</TableHead>
                  <TableHead className="hidden md:table-cell">Target</TableHead>
                  <TableHead className="hidden lg:table-cell">Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  adminLogs.map((log) => (
                    <TableRow 
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => handleRowClick(log)}
                    >
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-background/50">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden sm:table-cell">
                        {log.target_table}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden md:table-cell">
                        {log.target_id ? `${String(log.target_id).slice(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden lg:table-cell">
                        {log.admin_user_id ? `${String(log.admin_user_id).slice(0, 8)}...` : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalCount)} de {totalCount} registros
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </AdminCard>

      <LogDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        log={selectedLog}
        type={activeTab}
      />
    </div>
  );
}
