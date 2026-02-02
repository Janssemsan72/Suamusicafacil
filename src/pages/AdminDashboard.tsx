import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { RefreshCw, 
  Music, 
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Copy } from "@/lib/icons";

const isE2EEnv = import.meta.env.VITE_E2E === 'true';

let supabaseImportPromise: Promise<any> | null = null;
const getSupabase = async () => {
  if (!supabaseImportPromise) {
    supabaseImportPromise = import("@/integrations/supabase/client");
  }
  const mod = await supabaseImportPromise;
  return mod.supabase;
};

const DashboardStatsCards = lazyWithRetry(() =>
  import("@/components/admin/DashboardStatsCards").then((m) => ({ default: m.DashboardStatsCards }))
);

interface Job {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  error?: string;
  gpt_lyrics?: any;
  suno_task_id?: string;
  orders?: {
    customer_email: string;
    plan: string;
    status?: string; // ✅ CORREÇÃO: Adicionar status do pedido
    paid_at?: string; // ✅ CORREÇÃO: Adicionar paid_at do pedido
    created_at?: string; // ✅ CORREÇÃO: Adicionar created_at do pedido
  };
}

interface Song {
  id: string;
  order_id?: string;
  title: string;
  status: string;
  release_at: string;
  created_at: string;
  audio_url?: string;
  orders?: {
    customer_email: string;
  };
}

/**
 * Obtém a data atual no horário de Brasília
 * Retorna um objeto com year, month, day, e um objeto Date normalizado para início do dia em Brasília
 */
function getBrasiliaDate(): { year: number; month: number; day: number; date: Date } {
  const now = new Date();
  const brasiliaDateStr = now.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse da data de Brasília: "MM/DD/YYYY"
  const [monthStr, dayStr, yearStr] = brasiliaDateStr.split('/');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  
  // Criar data normalizada para início do dia em Brasília (00:00:00 BRT = 03:00:00 UTC)
  const date = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
  
  return { year, month, day, date };
}

/**
 * Cria uma data no horário de Brasília a partir de ano, mês e dia
 */
function createBrasiliaDate(year: number, month: number, day: number): Date {
  // Criar data normalizada para início do dia em Brasília (00:00:00 BRT = 03:00:00 UTC)
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // ✅ Declarar estados antes de usar nos hooks
  const [activeTab, setActiveTab] = useState<'jobs' | 'songs'>('jobs');
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false); // ✅ Não bloquear inicialmente
  const [retryingJob, setRetryingJob] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Ref para debounce das atualizações do realtime
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ OTIMIZAÇÃO: Usar dados dos hooks
  // Nota: Os stats agora são gerenciados pelo componente DashboardStatsCards
  
  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };
  
  const invalidateDashboardStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.sunoCredits() });
  }, [queryClient]);

  // ✅ CORREÇÃO: Detectar mobile para ajustar gráficos
  // ✅ OTIMIZAÇÃO: checkAdminAccess não bloqueia mais o carregamento inicial
  // A verificação de acesso é feita pelo AdminSidebar e rotas protegidas
  const checkAdminAccess = useCallback(async () => {
    const shouldBypassForE2E =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      localStorage.getItem('admin_e2e_seed_orders') === 'true';
    const shouldBypassInDev = import.meta.env.DEV && shouldBypassForE2E;

    if (isE2EEnv || shouldBypassInDev || shouldBypassForE2E) {
      const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
      if (cachedRole === 'admin' || cachedRole === 'collaborator') {
        return;
      }
    }

    // Verificação não bloqueante - apenas valida se necessário
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/admin/auth");
      return;
    }
  }, [navigate]);
  
  // ✅ OTIMIZAÇÃO: Carregar apenas jobs e songs recentes (não bloquear render inicial)
  const loadLightData = useCallback(async () => {
    try {
      const supabase = await getSupabase();
      // ✅ OTIMIZAÇÃO: Carregar apenas os mais recentes (últimos 100) para não bloquear
      // Carregar em background, não bloquear render inicial dos cards
      const [jobsResult, songsResult] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, order_id, status, created_at, updated_at, error, gpt_lyrics, suno_task_id")
          .order("created_at", { ascending: false })
          .limit(100), // ✅ OTIMIZAÇÃO: Limitar a 100 mais recentes
        supabase
          .from("songs")
          .select("id, order_id, title, status, created_at, release_at")
          .order("created_at", { ascending: false })
          .limit(100), // ✅ OTIMIZAÇÃO: Limitar a 100 mais recentes
      ]);

      const orderIds = Array.from(
        new Set(
          [...(jobsResult.data || []), ...(songsResult.data || [])]
            .map((row: any) => row?.order_id)
            .filter(Boolean)
        )
      );

      const ordersById = new Map<string, any>();
      if (orderIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("id, customer_email, plan, status, created_at, paid_at")
          .in("id", orderIds);

        if (!ordersError && ordersData) {
          ordersData.forEach((o: any) => ordersById.set(o.id, o));
        }
      }
      
      // ✅ CORREÇÃO: Tratar erro 404 para jobs de forma robusta
      if (jobsResult.error) {
        const isTableNotFound = jobsResult.error.code === 'PGRST116' || 
                               jobsResult.error.code === '42P01' || 
                               jobsResult.error.code === '404' ||
                               jobsResult.error.message?.includes('does not exist') ||
                               jobsResult.error.message?.includes('relation') ||
                               jobsResult.error.message?.includes('not found');
        
        if (isTableNotFound) {
          // Tabela não existe, usar array vazio silenciosamente
          setJobs([]);
        } else {
          // Outro tipo de erro, logar mas não quebrar (apenas em desenvolvimento)
          if (process.env.NODE_ENV === 'development') {
            console.warn('Erro ao carregar jobs:', jobsResult.error);
          }
          setJobs([]);
        }
      } else if (jobsResult.data) {
        setJobs(
          jobsResult.data.map((job: any) => ({
            ...job,
            orders: job?.order_id ? ordersById.get(job.order_id) : null,
          }))
        );
      } else {
        // Sem dados e sem erro, usar array vazio
        setJobs([]);
      }

      if (songsResult.error) {
        setSongs([]);
      } else if (songsResult.data) {
        setSongs(
          songsResult.data.map((song: any) => ({
            ...song,
            orders: song?.order_id ? ordersById.get(song.order_id) : null,
          }))
        );
      } else {
        setSongs([]);
      }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro ao carregar dados:', error);
        }
        // Garantir que arrays estão vazios em caso de erro
        setJobs([]);
        setSongs([]);
      }
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // ✅ OTIMIZAÇÃO: Verificação não bloqueante
    checkAdminAccess();
    
    // ✅ OTIMIZAÇÃO: Carregar dados leves em background (não bloquear render)
    // Stats e créditos já são carregados pelos hooks do React Query
    // Usar setTimeout para não bloquear render inicial dos cards
    setTimeout(() => {
      loadLightData();
    }, 100); // Aguardar 100ms para não bloquear render inicial
    
    // ✅ OTIMIZAÇÃO: Função para atualizar com debounce usando hooks do React Query
    const debouncedUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        invalidateDashboardStats();
      }, 2000); // Aguardar 2 segundos antes de atualizar (debounce)
    };
    
    // ✅ CORREÇÃO ERRO 401: Verificar autenticação antes de criar subscription
    let channel: any = null;
    let supabaseClient: any = null;
    const setupRealtime = async () => {
      try {
        supabaseClient = await getSupabase();
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return; // Não criar subscription se não autenticado

        channel = supabaseClient
          .channel('admin-dashboard-realtime', {
            config: {
              broadcast: { self: true },
              presence: { key: 'admin-dashboard' }
            }
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'orders'
          }, (payload) => {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            
            // ✅ Verificar se status mudou para 'paid' ou 'refunded'
            if (newStatus === 'paid' && oldStatus !== 'paid') {
              debouncedUpdate();
            } else if (newStatus === 'refunded' && oldStatus !== 'refunded') {
              debouncedUpdate();
            }
          })
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'orders'
          }, (payload) => {
            // ✅ Verificar se novo pedido foi criado com status 'paid'
            if (payload.new?.status === 'paid') {
              // Recarregar dados do dashboard com debounce
              debouncedUpdate();
            }
          })
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'orders' 
          }, () => {
            debouncedUpdate();
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'suno_credits' 
          }, () => {
            // ✅ OTIMIZAÇÃO: Créditos são atualizados automaticamente pelo hook useSunoCredits
            // O hook tem refetchInterval configurado
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.error('Erro na subscription realtime');
            } else if (status === 'TIMED_OUT') {
              console.error('Timeout na subscription realtime');
            }
          });
      } catch (error) {
        // Erro ao verificar autenticação ou criar subscription
        // Não fazer nada - a página continuará funcionando sem Realtime
      }
    };

    setupRealtime();
    
    // ✅ OTIMIZAÇÃO: Hooks do React Query já têm refetchInterval configurado
    // Não precisamos de interval manual
    
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (channel && supabaseClient) {
        supabaseClient.removeChannel(channel);
      }
    };
  }, [checkAdminAccess, loadLightData, invalidateDashboardStats]);

  const retryJob = async (jobId: string) => {
    try {
      setRetryingJob(jobId);
      toast.info("Retentando job...");

      const supabase = await getSupabase();
      // ✅ CORREÇÃO: Usar generate-lyrics-internal (Anthropic Claude) em vez de generate-lyrics (Lovable)
      const { error } = await supabase.functions.invoke("generate-lyrics-internal", {
        body: { job_id: jobId }
      });

      if (error) throw error;

      toast.success("Job reenviado com sucesso!");
      invalidateDashboardStats();
      // ✅ CORREÇÃO: Recarregar jobs com tratamento robusto de erro 404
      try {
        const { data: jobsData, error: jobsError } = await supabase
          .from("jobs")
          .select("id, order_id, status, created_at, updated_at, error, gpt_lyrics, suno_task_id")
          .order("created_at", { ascending: false })
          .limit(100);
        
        if (jobsError) {
          const isTableNotFound = jobsError.code === 'PGRST116' || 
                                 jobsError.code === '42P01' || 
                                 jobsError.code === '404' ||
                                 jobsError.message?.includes('does not exist') ||
                                 jobsError.message?.includes('relation') ||
                                 jobsError.message?.includes('not found');
          
          if (isTableNotFound) {
            // Tabela não existe, usar array vazio silenciosamente
            setJobs([]);
          } else {
            // Outro tipo de erro, logar mas não quebrar (apenas em desenvolvimento)
            if (process.env.NODE_ENV === 'development') {
              console.warn('Erro ao recarregar jobs:', jobsError);
            }
          }
        } else if (jobsData) {
          const orderIds = Array.from(new Set((jobsData || []).map((j: any) => j?.order_id).filter(Boolean)));
          const ordersById = new Map<string, any>();
          if (orderIds.length > 0) {
            const { data: ordersData, error: ordersError } = await supabase
              .from("orders")
              .select("id, customer_email, plan, status, created_at, paid_at")
              .in("id", orderIds);

            if (!ordersError && ordersData) {
              ordersData.forEach((o: any) => ordersById.set(o.id, o));
            }
          }

          setJobs(
            jobsData.map((job: any) => ({
              ...job,
              orders: job?.order_id ? ordersById.get(job.order_id) : null,
            }))
          );
        } else {
          setJobs([]);
        }
      } catch (err: any) {
        // Tratar qualquer erro inesperado (apenas logar em desenvolvimento)
        if (process.env.NODE_ENV === 'development') {
          console.warn('Erro inesperado ao recarregar jobs:', err);
        }
      }
    } catch (error: any) {
      console.error("Erro ao retentar job:", error);
      toast.error("Erro ao retentar job");
    } finally {
      setRetryingJob(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: "secondary", icon: Clock, label: "Pendente" },
      processing: { variant: "default", icon: RefreshCw, label: "Processando" },
      lyrics_generated: { variant: "default", icon: Music, label: "Letra Gerada" },
      generating_audio: { variant: "default", icon: Music, label: "Gerando Áudio" },
      audio_processing: { variant: "default", icon: Music, label: "Processando Áudio" },
      completed: { variant: "default", icon: CheckCircle, label: "Completo" },
      released: { variant: "default", icon: CheckCircle, label: "Liberado" },
      failed: { variant: "destructive", icon: XCircle, label: "Falhou" },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-2 md:p-6 space-y-3 md:space-y-6 admin-fade-in">
      <div className="flex items-center justify-between mb-3 md:mb-6 admin-slide-in-down">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-brown-dark-400 mb-2 md:mb-3 tracking-tight font-serif">
            Dashboard Administrativo
          </h1>
          <p className="text-sm md:text-base text-brown-medium font-medium">Visão geral do sistema e vendas</p>
        </div>
        <Button 
          onClick={() => {
            invalidateDashboardStats();
            // Recarregar jobs e songs também
            loadLightData();
          }} 
          variant="outline" 
          size="sm"
          aria-label="Atualizar"
          className="border-admin-border hover:border-admin-primary hover:bg-admin-primary/10 text-admin-text font-semibold rounded-xl transition-all duration-200 admin-hover-lift admin-ripple-effect"
        >
          <RefreshCw className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>

      {/* Stats Cards - Usando componente DashboardStatsCards */}
      <DashboardStatsCards />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'jobs' | 'songs')} className="space-y-3 md:space-y-6 admin-slide-in-up">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid h-auto bg-muted/50 border border-border/50 rounded-xl p-1 shadow-sm">
          <TabsTrigger 
            value="jobs" 
            data-testid="tab-jobs"
            className={`gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3 rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md font-semibold transition-all duration-200 admin-hover-scale ${activeTab === 'jobs' ? 'active' : ''}`}
          >
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger 
            value="songs" 
            data-testid="tab-songs"
            className={`gap-1 md:gap-2 text-xs md:text-sm py-2 md:py-3 rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md font-semibold transition-all duration-200 admin-hover-scale ${activeTab === 'songs' ? 'active' : ''}`}
          >
            <Music className="h-3 w-3 md:h-4 md:w-4" />
            Músicas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="jobs" data-testid="jobs-content" className="space-y-3 md:space-y-4 admin-fade-in">
          <Card className="admin-card-compact apple-card admin-hover-lift">
            <CardHeader className="pb-3 p-6 border-b border-apple-gray/20">
              <CardTitle className="text-base md:text-lg font-semibold text-apple-gray-600 tracking-wide flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-apple-blue" />
                Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div data-testid="jobs-list" className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    Carregando jobs...
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    Nenhum job encontrado
                  </div>
                ) : (
                  jobs.map((job, index) => {
                    const orderStatus = job.orders?.status;
                    const isOrderPaid = orderStatus === 'paid';
                    const isOrderPending = orderStatus === 'pending';
                    const isJobProcessing = job.status === 'processing' || job.status === 'pending';
                    
                    return (
                      <div
                        data-testid={`job-item-${job.id}`}
                        key={job.id}
                        className={`flex flex-col md:flex-row items-start justify-between p-4 border rounded-xl gap-4 transition-all hover:shadow-md admin-slide-in-up admin-hover-lift ${
                          isJobProcessing && !isOrderPaid 
                            ? 'border-apple-warning bg-white ring-2 ring-apple-warning/20' 
                            : 'border-apple-gray-200 bg-white hover:border-apple-blue'
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="space-y-1 flex-1 min-w-0 w-full">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <p className="text-xs md:text-sm font-medium truncate">
                                {job.orders?.customer_email || "N/A"}
                              </p>
                              {job.orders?.customer_email && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 shrink-0"
                                  onClick={() => copyToClipboard(job.orders!.customer_email, "Email")}
                                  title="Copiar email"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {/* ✅ CORREÇÃO: Mostrar status do pedido */}
                            {orderStatus && (
                              <Badge 
                                variant={isOrderPaid ? "default" : isOrderPending ? "secondary" : "outline"}
                                className="text-xs shrink-0"
                              >
                                {isOrderPaid ? 'Pago' : isOrderPending ? 'Pendente' : orderStatus}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ID: {job.id.slice(0, 8)} • {job.orders?.plan || "N/A"}
                            {isJobProcessing && !isOrderPaid && (
                              <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                                ⚠️ Processando sem pagamento
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground hidden md:block">
                            {new Date(job.created_at).toLocaleString("pt-BR")}
                            {job.orders?.paid_at && (
                              <span className="ml-2 text-green-600 dark:text-green-400">
                                • Pago: {new Date(job.orders.paid_at).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </p>
                          {job.error && (
                            <div className="mt-1 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                              <p className="text-destructive font-medium mb-1">Erro:</p>
                              <p className="text-destructive/90 mb-2">{job.error}</p>
                              {(job.error.includes('LOVABLE_API_KEY') || job.error.includes('OPENAI_API_KEY') || job.error.includes('ANTHROPIC_API_KEY')) && (
                                <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
                                  <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                                    ⚠️ Como resolver:
                                  </p>
                                  <ol className="list-decimal list-inside space-y-1 text-yellow-700 dark:text-yellow-300 text-[11px]">
                                    <li>Acesse o Supabase Dashboard</li>
                                    <li>Vá em Settings → Edge Functions → Environment Variables</li>
                                    <li>Adicione a variável <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">ANTHROPIC_API_KEY</code></li>
                                    <li>Faça o deploy novamente das funções <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">generate-lyrics-internal</code> e <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">generate-lyrics-for-approval</code></li>
                                  </ol>
                                  <a 
                                    href="https://supabase.com/dashboard/project/pszyhjshppvrzhkrgmrz/settings/functions" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-block text-yellow-800 dark:text-yellow-200 underline text-[11px] hover:text-yellow-900 dark:hover:text-yellow-100"
                                  >
                                    Abrir Supabase Dashboard →
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                          {getStatusBadge(job.status)}
                          {job.status === "failed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => retryJob(job.id)}
                              disabled={retryingJob === job.id}
                              className="flex-1 md:flex-none text-xs"
                            >
                              {retryingJob === job.id ? (
                                <RefreshCw className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                                  <span className="hidden sm:inline">Retry</span>
                                  <span className="sm:hidden">R</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
      </TabsContent>

        <TabsContent value="songs" data-testid="songs-content" className="space-y-4 admin-fade-in">
          <Card className="mobile-compact-card apple-card admin-hover-lift">
            <CardHeader className="p-6 border-b border-apple-gray/20">
              <CardTitle className="text-base md:text-lg font-semibold text-apple-gray-600 tracking-wide flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-apple-blue" />
                Músicas Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <div data-testid="songs-list" className="space-y-4">
                {songs.length === 0 ? (
                  <div className="text-center py-12">
                    <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground text-sm font-medium mb-2">
                      Nenhuma música encontrada
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Quando houver músicas, elas aparecerão aqui
                    </p>
                  </div>
                ) : (
                  songs.map((song, index) => (
                    <div
                      data-testid={`song-item-${song.id}`}
                      key={song.id}
                      role={song.order_id ? "button" : undefined}
                      tabIndex={song.order_id ? 0 : undefined}
                      onClick={song.order_id ? () => navigate(`/admin/orders/${song.order_id}`) : undefined}
                      onKeyDown={song.order_id ? (e) => e.key === "Enter" && navigate(`/admin/orders/${song.order_id}`) : undefined}
                      className={`flex items-start justify-between p-4 border border-apple-gray-200 rounded-xl gap-3 bg-white hover:border-apple-blue hover:shadow-md transition-all admin-slide-in-up admin-hover-lift ${song.order_id ? "cursor-pointer" : ""}`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-medium truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {song.orders?.customer_email || "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground hidden md:block">
                          {new Date(song.release_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="shrink-0">{getStatusBadge(song.status)}</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
