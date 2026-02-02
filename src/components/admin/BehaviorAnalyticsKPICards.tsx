import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, AlertTriangle, MousePointerClick, Scroll, Bug } from "@/lib/icons";
import { useBehaviorAnalytics } from "@/hooks/useBehaviorAnalytics";

export function BehaviorAnalyticsKPICards() {
  const { data, loading } = useBehaviorAnalytics();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const clarityMetrics = data.clarity?.metrics || {
    totalVisits: 0,
    totalDeadClicks: 0,
    totalRageClicks: 0,
    totalJsErrors: 0,
    averageScrollDepth: 0,
  };

  const hotjarMetrics = data.hotjar?.metrics || {
    totalVisits: 0,
    totalRecordings: 0,
    totalFeedback: 0,
  };

  const totalVisits = clarityMetrics.totalVisits || hotjarMetrics.totalVisits || 0;
  const totalProblems = clarityMetrics.totalDeadClicks + clarityMetrics.totalRageClicks + clarityMetrics.totalJsErrors;
  const averageScrollDepth = clarityMetrics.averageScrollDepth || 0;
  const totalRecordings = hotjarMetrics.totalRecordings || 0;

  // Calcular taxa de conversão (simplificado)
  const conversionRate = totalVisits > 0 
    ? ((data.clarity?.analytics?.filter((a: any) => a.event_type === 'funnel_complete').reduce((sum: number, a: any) => sum + (a.event_count || 0), 0) || 0) / totalVisits) * 100
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Visitas Totais */}
      <Card className="relative overflow-hidden border-2 hover:shadow-lg transition-shadow">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Visitas Totais</CardTitle>
          <Users className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalVisits.toLocaleString('pt-BR')}</div>
          <p className="text-xs text-muted-foreground mt-2">
            Últimos 30 dias
          </p>
        </CardContent>
      </Card>

      {/* Taxa de Conversão */}
      <Card className="relative overflow-hidden border-2 border-green-200 hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-green-100/50">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/10 rounded-bl-full" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {conversionRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Funil completo
          </p>
        </CardContent>
      </Card>

      {/* Problemas Identificados */}
      <Card className="relative overflow-hidden border-2 border-orange-200 hover:shadow-lg transition-shadow">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200/10 rounded-bl-full" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Problemas</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">
            {totalProblems.toLocaleString('pt-BR')}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>Dead: {clarityMetrics.totalDeadClicks}</span>
            <span>•</span>
            <span>Rage: {clarityMetrics.totalRageClicks}</span>
            <span>•</span>
            <span>Erros: {clarityMetrics.totalJsErrors}</span>
          </div>
        </CardContent>
      </Card>

      {/* Scroll Depth / Gravações */}
      <Card className="relative overflow-hidden border-2 hover:shadow-lg transition-shadow">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/10 rounded-bl-full" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Engajamento</CardTitle>
          <Scroll className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">
            {averageScrollDepth > 0 ? `${averageScrollDepth.toFixed(0)}%` : totalRecordings > 0 ? totalRecordings.toLocaleString('pt-BR') : '0'}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {averageScrollDepth > 0 ? 'Profundidade média' : totalRecordings > 0 ? 'Gravações disponíveis' : 'Sem dados'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

