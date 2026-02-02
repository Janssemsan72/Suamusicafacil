import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Map, Video, BarChart3, AlertCircle, TrendingUp, MessageSquare } from "@/lib/icons";
import { useBehaviorAnalytics } from "@/hooks/useBehaviorAnalytics";

export function HeatmapLinks() {
  const { data, loading } = useBehaviorAnalytics();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i} className="border-2 animate-pulse">
            <CardHeader>
              <div className="h-5 bg-gray-200 rounded w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const clarityLinks = data.clarity?.links || {};
  const hotjarLinks = data.hotjar?.links || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Microsoft Clarity */}
      <Card className="border-2 shadow-lg bg-gradient-to-br from-white to-blue-50/30 hover:shadow-xl transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Microsoft Clarity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {clarityLinks.dashboard && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={() => window.open(clarityLinks.dashboard, "_blank")}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Dashboard Principal
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {clarityLinks.heatmaps && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={() => window.open(clarityLinks.heatmaps, "_blank")}
            >
              <span className="flex items-center gap-2">
                <Map className="h-4 w-4 text-blue-600" />
                Heatmaps
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {clarityLinks.recordings && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={() => window.open(clarityLinks.recordings, "_blank")}
            >
              <span className="flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-600" />
                Gravações de Sessão
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {clarityLinks.insights && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={() => window.open(clarityLinks.insights, "_blank")}
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Insights
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {clarityLinks.errors && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={() => window.open(clarityLinks.errors, "_blank")}
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                Erros JavaScript
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {!clarityLinks.dashboard && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Clarity não configurado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Hotjar */}
      <Card className="border-2 shadow-lg bg-gradient-to-br from-white to-orange-50/30 hover:shadow-xl transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            <BarChart3 className="h-5 w-5 text-orange-600" />
            Hotjar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hotjarLinks.dashboard && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-orange-50 hover:border-orange-300 transition-colors"
              onClick={() => window.open(hotjarLinks.dashboard, "_blank")}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-orange-600" />
                Dashboard Principal
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {hotjarLinks.heatmaps && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-orange-50 hover:border-orange-300 transition-colors"
              onClick={() => window.open(hotjarLinks.heatmaps, "_blank")}
            >
              <span className="flex items-center gap-2">
                <Map className="h-4 w-4 text-orange-600" />
                Heatmaps
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {hotjarLinks.recordings && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-orange-50 hover:border-orange-300 transition-colors"
              onClick={() => window.open(hotjarLinks.recordings, "_blank")}
            >
              <span className="flex items-center gap-2">
                <Video className="h-4 w-4 text-orange-600" />
                Gravações de Sessão
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {hotjarLinks.funnels && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-orange-50 hover:border-orange-300 transition-colors"
              onClick={() => window.open(hotjarLinks.funnels, "_blank")}
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                Funis de Conversão
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {hotjarLinks.feedback && (
            <Button
              variant="outline"
              className="w-full justify-between hover:bg-orange-50 hover:border-orange-300 transition-colors"
              onClick={() => window.open(hotjarLinks.feedback, "_blank")}
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-orange-600" />
                Feedback de Usuários
              </span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {!hotjarLinks.dashboard && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Hotjar não configurado
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

