import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SolidStatCard, ADMIN_CARD_COLORS } from "@/components/admin/SolidStatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, 
  AlertCircle,
  FileQuestion,
  ShoppingCart,
  TrendingUp } from "@/lib/icons";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { LazyComponent } from "@/components/LazyComponent";

const QuizTrendsChart = lazyWithRetry(() =>
  import("./AdminQuizMetricsCharts").then((m) => ({ default: m.QuizTrendsChart })),
);
const QuizSuccessRateChart = lazyWithRetry(() =>
  import("./AdminQuizMetricsCharts").then((m) => ({ default: m.QuizSuccessRateChart })),
);
const QuizOrdersBreakdownChart = lazyWithRetry(() =>
  import("./AdminQuizMetricsCharts").then((m) => ({ default: m.QuizOrdersBreakdownChart })),
);

function ChartsFallback({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div className="animate-pulse text-muted-foreground text-xs md:text-sm">Carregando gráfico...</div>
    </div>
  );
}

interface QuizMetrics {
  metric_date: string;
  quizzes_saved: number;
  quizzes_saved_with_session_id: number;
  orders_created: number;
  orders_with_quiz: number;
  orders_without_quiz: number;
  quizzes_lost: number;
  retry_queue_size: number;
  success_rate: number;
  session_id_adoption_rate: number;
}

interface AggregatedMetrics {
  total_quizzes_saved: number;
  total_orders_created: number;
  total_orders_with_quiz: number;
  total_orders_without_quiz: number;
  overall_success_rate: number;
}

export default function AdminQuizMetrics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<QuizMetrics[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedMetrics | null>(null);
  const [daysRange, setDaysRange] = useState<string>("30");

  const loadMetrics = async (days: string = "30") => {
    try {
      setLoading(true);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // ✅ CORREÇÃO: Usar supabase.functions.invoke() que automaticamente adiciona autenticação
      // Isso garante que o token seja enviado corretamente
      const { data, error } = await supabase.functions.invoke('get-quiz-metrics', {
        body: {
          start_date: startDateStr,
          end_date: endDateStr
        }
      });

      if (error) {
        console.error('Erro ao carregar métricas:', error);
        toast.error('Erro ao carregar métricas');
        return;
      }

      if (data?.success) {
        setMetrics(data.daily_metrics || []);
        setAggregated(data.aggregated || null);
      } else {
        toast.error('Erro ao carregar métricas');
      }
    } catch (error: any) {
      console.error('Erro ao carregar métricas:', error);
      toast.error(`Erro ao carregar métricas: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics(daysRange);
  }, [daysRange]);

  if (loading) {
    return (
      <div className="container mx-auto p-2 md:p-6 space-y-3 md:space-y-6 admin-fade-in">
        <div className="flex items-center justify-between mb-3 md:mb-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-brown-dark-400 mb-2 md:mb-3 tracking-tight font-serif">
              Métricas de Quiz
            </h1>
            <p className="text-sm md:text-base text-brown-medium font-medium">
              Monitoramento de salvamento de quizzes e criação de pedidos
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-32 animate-pulse bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  // Preparar dados para gráficos
  const chartData = metrics.map(m => ({
    date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    'Quizzes Salvos': m.quizzes_saved,
    'Pedidos Criados': m.orders_created,
    'Pedidos com Quiz': m.orders_with_quiz,
    'Pedidos sem Quiz': m.orders_without_quiz,
    'Taxa de Sucesso (%)': m.success_rate,
    'Fila de Retry': m.retry_queue_size
  }));

  const successRateData = metrics.map(m => ({
    date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    'Taxa de Sucesso (%)': m.success_rate,
    'Adoção session_id (%)': m.session_id_adoption_rate
  }));

  const hasAlerts = aggregated && (
    aggregated.total_orders_without_quiz > 0 ||
    (metrics.length > 0 && metrics[metrics.length - 1].retry_queue_size > 10)
  );

  const chartsEnabled = metrics.length > 0;

  return (
    <div className="container mx-auto p-2 md:p-6 space-y-3 md:space-y-6 admin-fade-in">
      <div className="flex items-center justify-between mb-3 md:mb-6 admin-slide-in-down">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-brown-dark-400 mb-2 md:mb-3 tracking-tight font-serif">
            Métricas de Quiz
          </h1>
          <p className="text-sm md:text-base text-brown-medium font-medium">
            Monitoramento de salvamento de quizzes e criação de pedidos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={daysRange} onValueChange={setDaysRange}>
            <SelectTrigger className="w-[140px] text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => loadMetrics(daysRange)} 
            variant="outline" 
            size="sm"
            className="border-admin-border hover:border-admin-primary hover:bg-admin-primary/10 text-admin-text font-semibold rounded-xl transition-all duration-200 admin-hover-lift admin-ripple-effect h-9"
          >
            <RefreshCw className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {hasAlerts && (
        <Card className="border-orange-500/50 bg-orange-50/50 admin-slide-in-up">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 mb-2">Alertas</h3>
              <ul className="space-y-1 text-sm text-orange-800">
                {aggregated && aggregated.total_orders_without_quiz > 0 && (
                  <li>
                    ⚠️ <strong>{aggregated.total_orders_without_quiz}</strong> pedido(s) sem quiz vinculado
                  </li>
                )}
                {metrics.length > 0 && metrics[metrics.length - 1].retry_queue_size > 10 && (
                  <li>
                    ⚠️ Fila de retry com <strong>{metrics[metrics.length - 1].retry_queue_size}</strong> itens pendentes
                  </li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Resumo */}
      <div className="grid gap-3 md:gap-6 md:grid-cols-2 lg:grid-cols-4 admin-slide-in-up">
        <SolidStatCard
          title="Quizzes Salvos"
          value={aggregated?.total_quizzes_saved || 0}
          icon={FileQuestion}
          color={ADMIN_CARD_COLORS.primary}
          description="Total no período"
          testId="stats-quizzes-saved"
          className="admin-stagger-1"
        />

        <SolidStatCard
          title="Pedidos Criados"
          value={aggregated?.total_orders_created || 0}
          icon={ShoppingCart}
          color={ADMIN_CARD_COLORS.secondary}
          description="Total no período"
          testId="stats-orders-created"
          className="admin-stagger-2"
        />

        <SolidStatCard
          title="Taxa de Sucesso"
          value={`${aggregated?.overall_success_rate?.toFixed(1) || 0}%`}
          icon={TrendingUp}
          color={ADMIN_CARD_COLORS.tertiary}
          description="Pedidos com quiz / Total"
          testId="stats-success-rate"
          className="admin-stagger-3"
        />

        <SolidStatCard
          title="Pedidos sem Quiz"
          value={aggregated?.total_orders_without_quiz || 0}
          icon={AlertCircle}
          color={ADMIN_CARD_COLORS.quaternary}
          description="Requer atenção"
          testId="stats-orders-without-quiz"
          className="admin-stagger-4"
        />
      </div>

      {/* Gráfico de Tendências */}
      <Card className="admin-card-compact apple-card admin-hover-lift admin-slide-in-up">
        <CardHeader className="p-6 border-b border-apple-gray/20">
          <CardTitle className="text-base font-semibold text-apple-gray-600 tracking-wide flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Tendências Diárias
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {chartsEnabled ? (
            <LazyComponent
              rootMargin="800px 0px"
              minHeight={300}
              fallback={<ChartsFallback height={300} />}
            >
              <QuizTrendsChart data={chartData} height={300} />
            </LazyComponent>
          ) : (
            <div className="flex items-center justify-center text-muted-foreground text-xs md:text-sm" style={{ height: 300 }}>
              Sem dados no período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Taxa de Sucesso */}
      <Card className="admin-card-compact apple-card admin-hover-lift admin-slide-in-up">
        <CardHeader className="p-6 border-b border-apple-gray/20">
          <CardTitle className="text-base font-semibold text-apple-gray-600 tracking-wide flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Taxa de Sucesso e Adoção de session_id
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {chartsEnabled ? (
            <LazyComponent
              rootMargin="800px 0px"
              minHeight={300}
              fallback={<ChartsFallback height={300} />}
            >
              <QuizSuccessRateChart data={successRateData} height={300} />
            </LazyComponent>
          ) : (
            <div className="flex items-center justify-center text-muted-foreground text-xs md:text-sm" style={{ height: 300 }}>
              Sem dados no período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Pedidos com/sem Quiz */}
      <Card className="admin-card-compact apple-card admin-hover-lift admin-slide-in-up">
        <CardHeader className="p-6 border-b border-apple-gray/20">
          <CardTitle className="text-base font-semibold text-apple-gray-600 tracking-wide flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Pedidos com e sem Quiz
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {chartsEnabled ? (
            <LazyComponent
              rootMargin="800px 0px"
              minHeight={300}
              fallback={<ChartsFallback height={300} />}
            >
              <QuizOrdersBreakdownChart data={chartData} height={300} />
            </LazyComponent>
          ) : (
            <div className="flex items-center justify-center text-muted-foreground text-xs md:text-sm" style={{ height: 300 }}>
              Sem dados no período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card className="admin-card-compact apple-card admin-hover-lift admin-slide-in-up">
        <CardHeader className="p-6 border-b border-apple-gray/20">
          <CardTitle className="text-base font-semibold text-apple-gray-600 tracking-wide flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Detalhes Diários
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-apple-gray-50/50">
                  <th className="text-left p-4 font-semibold text-apple-gray-600">Data</th>
                  <th className="text-right p-4 font-semibold text-apple-gray-600">Quizzes</th>
                  <th className="text-right p-4 font-semibold text-apple-gray-600">Com session_id</th>
                  <th className="text-right p-4 font-semibold text-apple-gray-600">Pedidos</th>
                  <th className="text-right p-4 font-semibold text-apple-gray-600">Com Quiz</th>
                  <th className="text-right p-4 font-semibold text-apple-gray-600">Sem Quiz</th>
                  <th className="text-right p-4 font-semibold text-apple-gray-600">Taxa (%)</th>
                  <th className="text-right p-4 font-semibold text-apple-gray-600">Fila Retry</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, index) => (
                  <tr key={index} className="border-b hover:bg-apple-gray-50/50 transition-colors">
                    <td className="p-4">
                      {new Date(metric.metric_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="text-right p-4">{metric.quizzes_saved}</td>
                    <td className="text-right p-4">{metric.quizzes_saved_with_session_id}</td>
                    <td className="text-right p-4">{metric.orders_created}</td>
                    <td className="text-right p-4">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {metric.orders_with_quiz}
                      </Badge>
                    </td>
                    <td className="text-right p-4">
                      {metric.orders_without_quiz > 0 ? (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          {metric.orders_without_quiz}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="text-right p-4">
                      <span className={metric.success_rate >= 95 ? "text-green-600 font-semibold" : metric.success_rate >= 80 ? "text-yellow-600" : "text-red-600"}>
                        {metric.success_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right p-4">
                      {metric.retry_queue_size > 0 ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          {metric.retry_queue_size}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
