import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBehaviorAnalytics } from "@/hooks/useBehaviorAnalytics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useMemo } from "react";

export function VisitsOverTimeChart() {
  const { data, loading } = useBehaviorAnalytics();

  const chartData = useMemo(() => {
    if (!data.clarity?.analytics && !data.hotjar?.analytics) {
      return [];
    }

    const visitsByDate: Record<string, { visits: number; errors: number }> = {};

    [...(data.clarity?.analytics || []), ...(data.hotjar?.analytics || [])].forEach((item: any) => {
      if (item.event_type === 'page_view') {
        const date = new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        if (!visitsByDate[date]) {
          visitsByDate[date] = { visits: 0, errors: 0 };
        }
        visitsByDate[date].visits += item.event_count || 0;
      } else if (item.event_type === 'js_error') {
        const date = new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        if (!visitsByDate[date]) {
          visitsByDate[date] = { visits: 0, errors: 0 };
        }
        visitsByDate[date].errors += item.event_count || 0;
      }
    });

    return Object.entries(visitsByDate)
      .map(([date, values]) => ({
        date,
        visitas: values.visits,
        erros: values.errors,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (loading) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Visitas ao Longo do Tempo</CardTitle>
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
          <CardTitle className="text-lg font-semibold">Visitas ao Longo do Tempo</CardTitle>
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
    <Card className="border-2 shadow-lg bg-gradient-to-br from-white to-blue-50/30">
      <CardHeader>
        <CardTitle className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Visitas ao Longo do Tempo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVisitas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorErros" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="date" 
              stroke="#666"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#666"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number, name: string) => [
                value.toLocaleString('pt-BR'),
                name === 'visitas' ? 'Visitas' : 'Erros',
              ]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="visitas"
              stroke="#3B82F6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorVisitas)"
              name="Visitas"
            />
            <Area
              type="monotone"
              dataKey="erros"
              stroke="#EF4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorErros)"
              name="Erros"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

