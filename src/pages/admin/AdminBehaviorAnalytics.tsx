import { useState, useMemo, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, BarChart3, AlertCircle, Trash2 } from "@/lib/icons";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BehaviorAnalyticsKPICards } from "@/components/admin/BehaviorAnalyticsKPICards";
import { BehaviorAnalyticsFilters } from "@/components/admin/BehaviorAnalyticsFilters";
import { HeatmapLinks } from "@/components/admin/HeatmapLinks";
import { useBehaviorAnalytics } from "@/hooks/useBehaviorAnalytics";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

const VisitsOverTimeChart = lazyWithRetry(() =>
  import("@/components/admin/VisitsOverTimeChart").then((m) => ({ default: m.VisitsOverTimeChart })),
);
const ProblemsDistributionChart = lazyWithRetry(() =>
  import("@/components/admin/ProblemsDistributionChart").then((m) => ({ default: m.ProblemsDistributionChart })),
);
const FunnelVisualization = lazyWithRetry(() =>
  import("@/components/admin/FunnelVisualization").then((m) => ({ default: m.FunnelVisualization })),
);
const PagesPerformanceChart = lazyWithRetry(() =>
  import("@/components/admin/PagesPerformanceChart").then((m) => ({ default: m.PagesPerformanceChart })),
);

const ChartsFallback = () => (
  <div className="h-80 flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground text-xs md:text-sm">Carregando gráfico...</div>
  </div>
);

export default function AdminBehaviorAnalytics() {
  const { data, loading, error, refetch } = useBehaviorAnalytics();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedPage, setSelectedPage] = useState<string>("all");

  // Extrair páginas disponíveis dos dados
  const availablePages = useMemo(() => {
    const pages = new Set<string>();
    if (data.clarity?.analytics) {
      data.clarity.analytics.forEach((item: any) => {
        if (item.page_path) {
          pages.add(item.page_path);
        }
      });
    }
    if (data.hotjar?.analytics) {
      data.hotjar.analytics.forEach((item: any) => {
        if (item.page_path) {
          pages.add(item.page_path);
        }
      });
    }
    return Array.from(pages).sort();
  }, [data]);

  // Filtrar dados baseado nos filtros
  const filteredData = useMemo(() => {
    let filtered = { ...data };

    if (startDate || endDate || selectedPage !== "all") {
      const filterAnalytics = (analytics: any[]) => {
        return analytics.filter((item: any) => {
          // Filtro de data
          if (startDate || endDate) {
            const itemDate = new Date(item.date);
            if (startDate && itemDate < startDate) return false;
            if (endDate && itemDate > endDate) return false;
          }

          // Filtro de página
          if (selectedPage !== "all" && item.page_path !== selectedPage) {
            return false;
          }

          return true;
        });
      };

      if (filtered.clarity?.analytics) {
        filtered.clarity.analytics = filterAnalytics(filtered.clarity.analytics);
      }
      if (filtered.hotjar?.analytics) {
        filtered.hotjar.analytics = filterAnalytics(filtered.hotjar.analytics);
      }
    }

    return filtered;
  }, [data, startDate, endDate, selectedPage]);

  const [clearingProblems, setClearingProblems] = useState(false);

  const handleRefresh = async () => {
    try {
      toast.info("Atualizando dados...");
      await refetch();
      toast.success("Dados atualizados!");
    } catch (error: any) {
      console.error('❌ [AdminBehaviorAnalytics] Erro ao atualizar dados:', error);
      toast.error(error?.message || "Erro ao atualizar dados");
    }
  };

  const handleClearProblems = async () => {
    if (!confirm("Tem certeza que deseja zerar todos os dados de problemas?\n\nIsso irá remover:\n- Dead Clicks\n- Rage Clicks\n- Erros JavaScript\n\nEsta ação não pode ser desfeita.")) {
      return;
    }

    try {
      setClearingProblems(true);
      toast.info("Zerando dados de problemas...");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const { data, error } = await supabase.functions.invoke('admin-order-actions', {
        body: { action: 'clear_behavior_problems' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('❌ [AdminBehaviorAnalytics] Erro da Edge Function:', error);
        
        // Tentar extrair detalhes do erro se disponível
        let errorMessage = error.message || "Erro ao zerar dados de problemas";
        let errorDetails = '';
        
        // Se for erro de status não-2xx, tentar ler a resposta JSON se disponível
        if (error.message?.includes('non-2xx') || error.message?.includes('status code')) {
          // Tentar extrair detalhes do contexto do erro se disponível
          if (error.context) {
            try {
              const errorData = typeof error.context === 'string' ? JSON.parse(error.context) : error.context;
              if (errorData.error) {
                errorMessage = errorData.error;
              }
              if (errorData.details) {
                errorDetails = errorData.details;
              }
            } catch (e) {
              // Ignorar erro de parsing
            }
          }
          
          if (!errorDetails) {
            errorMessage = "Erro ao processar solicitação. Verifique se você tem permissões de administrador e se a tabela behavior_analytics existe.";
          }
        }
        
        // Se for erro de permissão
        if (error.message?.includes('permission') || error.message?.includes('RLS') || error.message?.includes('access')) {
          errorMessage = "Erro de permissão. Verifique se você tem permissões de administrador.";
        }
        
        const finalError = errorDetails ? `${errorMessage}\n\nDetalhes: ${errorDetails}` : errorMessage;
        throw new Error(finalError);
      }

      // Verificar se a resposta indica sucesso
      if (data?.success === false) {
        const errorMsg = data?.error || "Falha ao zerar dados de problemas";
        const errorDetails = data?.details ? `\n\nDetalhes: ${data.details}` : '';
        const errorHint = data?.hint ? `\n\nDica: ${data.hint}` : '';
        throw new Error(errorMsg + errorDetails + errorHint);
      }

      toast.success(data?.message || "Dados de problemas zerados com sucesso!");
      await refetch().catch((refetchError) => {
        console.error('❌ [AdminBehaviorAnalytics] Erro ao atualizar dados após limpeza:', refetchError);
        // Não mostrar toast de erro aqui para não confundir o usuário
      }); // Atualizar dados após limpeza
    } catch (error: any) {
      console.error("❌ [AdminBehaviorAnalytics] Erro ao zerar problemas:", error);
      const errorMessage = error?.message || error?.toString() || "Erro ao zerar dados de problemas";
      toast.error(errorMessage, {
        duration: 5000,
        description: "Verifique os logs do console para mais detalhes"
      });
    } finally {
      setClearingProblems(false);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-0">
        <Card className="border-2 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Erro ao Carregar Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-0 space-y-2 md:space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 md:gap-4 mb-2">
        <div>
          <h1 className="text-xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Analytics de Comportamento
          </h1>
          <p className="text-xs md:text-base text-muted-foreground mt-1 md:mt-2">
            Métricas detalhadas de comportamento do usuário (Clarity e Hotjar)
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleClearProblems} 
            variant="destructive" 
            size="sm" 
            disabled={loading || clearingProblems}
            className="shadow-md hover:shadow-lg transition-shadow"
          >
            <Trash2 className={`h-4 w-4 md:mr-2 ${clearingProblems ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Zerar Problemas</span>
          </Button>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm" 
            disabled={loading || clearingProblems}
            className="shadow-md hover:shadow-lg transition-shadow"
          >
            <RefreshCw className={`h-4 w-4 md:mr-2 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <BehaviorAnalyticsFilters
        onDateRangeChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
        onPageFilterChange={setSelectedPage}
        availablePages={availablePages}
      />

      {/* Cards de KPIs */}
      <BehaviorAnalyticsKPICards />

      {/* Tabs com diferentes visualizações */}
      <Tabs defaultValue="overview" className="space-y-2 md:space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-10 md:h-12 bg-gradient-to-r from-blue-50 to-purple-50 p-0.5 md:p-1 rounded-lg shadow-inner">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-white data-[state=active]:shadow-md transition-all"
          >
            Visão Geral
          </TabsTrigger>
          <TabsTrigger 
            value="funnel"
            className="data-[state=active]:bg-white data-[state=active]:shadow-md transition-all"
          >
            Funil
          </TabsTrigger>
          <TabsTrigger 
            value="heatmaps"
            className="data-[state=active]:bg-white data-[state=active]:shadow-md transition-all"
          >
            Heatmaps
          </TabsTrigger>
          <TabsTrigger 
            value="recordings"
            className="data-[state=active]:bg-white data-[state=active]:shadow-md transition-all"
          >
            Gravações
          </TabsTrigger>
          <TabsTrigger 
            value="errors"
            className="data-[state=active]:bg-white data-[state=active]:shadow-md transition-all"
          >
            Erros
          </TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-2 md:space-y-6">
          {/* Gráficos principais - 2 colunas em mobile */}
          <div className="admin-charts-grid grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-6">
            <Suspense fallback={<ChartsFallback />}>
              <VisitsOverTimeChart />
            </Suspense>
            <Suspense fallback={<ChartsFallback />}>
              <ProblemsDistributionChart />
            </Suspense>
          </div>
          
          {/* Funil e Performance - 2 colunas em mobile */}
          <div className="admin-charts-grid grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-6">
            <Suspense fallback={<ChartsFallback />}>
              <FunnelVisualization />
            </Suspense>
            <Suspense fallback={<ChartsFallback />}>
              <PagesPerformanceChart />
            </Suspense>
          </div>
        </TabsContent>

        {/* Funil */}
        <TabsContent value="funnel" className="space-y-2 md:space-y-6">
          <Suspense fallback={<ChartsFallback />}>
            <FunnelVisualization />
          </Suspense>
        </TabsContent>

        {/* Heatmaps */}
        <TabsContent value="heatmaps" className="space-y-2 md:space-y-6">
          <HeatmapLinks />
        </TabsContent>

        {/* Gravações */}
        <TabsContent value="recordings" className="space-y-2 md:space-y-6">
          <Card className="admin-card-compact border-2 shadow-lg bg-gradient-to-br from-white to-blue-50/30">
            <CardHeader className="p-2 md:p-6">
              <CardTitle className="text-sm md:text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Gravações de Sessão
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-6">
                Acesse as gravações completas de sessão através dos links abaixo:
              </p>
              <HeatmapLinks />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Erros */}
        <TabsContent value="errors" className="space-y-2 md:space-y-6">
          <Card className="admin-card-compact border-2 shadow-lg bg-gradient-to-br from-white to-red-50/30">
            <CardHeader className="p-2 md:p-6">
              <CardTitle className="text-sm md:text-lg font-semibold flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
                Erros JavaScript
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-6">
              {loading ? (
                <div className="h-32 md:h-64 flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground text-xs md:text-sm">Carregando...</div>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {filteredData.clarity?.analytics
                    ?.filter((item: any) => item.event_type === "js_error")
                    .map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-start justify-between p-2 md:p-3 border border-destructive/20 rounded-lg bg-destructive/5"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-destructive">
                            {item.metadata?.error_message || "Erro JavaScript"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Página: {item.page_path || "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Data: {new Date(item.date).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-destructive">
                            {item.event_count}
                          </div>
                          <div className="text-xs text-muted-foreground">ocorrências</div>
                        </div>
                      </div>
                    ))}
                  {(!filteredData.clarity?.analytics?.filter(
                    (item: any) => item.event_type === "js_error"
                  ) || filteredData.clarity.analytics.filter(
                    (item: any) => item.event_type === "js_error"
                  ).length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum erro JavaScript registrado
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

