import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBehaviorAnalytics } from "@/hooks/useBehaviorAnalytics";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useMemo } from "react";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export function PagesPerformanceChart() {
  const { data, loading } = useBehaviorAnalytics();

  const chartData = useMemo(() => {
    if (!data.clarity?.metrics?.pages) {
      return [];
    }

    return Object.entries(data.clarity.metrics.pages)
      .map(([page, metrics]: [string, any]) => ({
        page: page === '/' ? 'Homepage' : page,
        visitas: metrics.visits || 0,
        deadClicks: metrics.deadClicks || 0,
        rageClicks: metrics.rageClicks || 0,
        erros: metrics.jsErrors || 0,
      }))
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 6); // Top 6 páginas
  }, [data]);

  if (loading) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Performance por Página</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Performance por Página</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 shadow-lg bg-gradient-to-br from-white to-purple-50/30">
      <CardHeader>
        <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Performance por Página
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="page" 
              angle={-45}
              textAnchor="end"
              height={80}
              stroke="#666"
              style={{ fontSize: '11px' }}
            />
            <YAxis stroke="#666" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number, name: string) => [
                value.toLocaleString('pt-BR'),
                name === 'visitas' ? 'Visitas' : 
                name === 'deadClicks' ? 'Dead Clicks' :
                name === 'rageClicks' ? 'Rage Clicks' : 'Erros JS',
              ]}
            />
            <Legend />
            <Bar dataKey="visitas" name="Visitas" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            <Bar dataKey="deadClicks" name="Dead Clicks" fill="#F59E0B" radius={[8, 8, 0, 0]} />
            <Bar dataKey="rageClicks" name="Rage Clicks" fill="#EF4444" radius={[8, 8, 0, 0]} />
            <Bar dataKey="erros" name="Erros JS" fill="#DC2626" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

