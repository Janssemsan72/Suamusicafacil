import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBehaviorAnalytics } from "@/hooks/useBehaviorAnalytics";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useMemo, useState, useEffect } from "react";

const COLORS = ['#F59E0B', '#EF4444', '#DC2626'];

export function ProblemsDistributionChart() {
  const { data, loading } = useBehaviorAnalytics();
  const [isMobile, setIsMobile] = useState(false);

  // ✅ CORREÇÃO: Detectar se é mobile para ajustar tamanho do gráfico
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const chartData = useMemo(() => {
    if (!data.clarity?.metrics) {
      return [];
    }

    const metrics = data.clarity.metrics;
    const total = metrics.totalDeadClicks + metrics.totalRageClicks + metrics.totalJsErrors;

    if (total === 0) {
      return [];
    }

    return [
      { name: 'Dead Clicks', value: metrics.totalDeadClicks, color: COLORS[0] },
      { name: 'Rage Clicks', value: metrics.totalRageClicks, color: COLORS[1] },
      { name: 'Erros JS', value: metrics.totalJsErrors, color: COLORS[2] },
    ].filter(item => item.value > 0);
  }, [data]);

  if (loading) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Distribuição de Problemas</CardTitle>
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
          <CardTitle className="text-lg font-semibold">Distribuição de Problemas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            Nenhum problema identificado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 shadow-lg bg-gradient-to-br from-white to-orange-50/30">
      <CardHeader>
        <CardTitle className="text-lg font-semibold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
          Distribuição de Problemas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* ✅ CORREÇÃO: Altura menor no mobile para evitar cortes */}
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 320}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              // ✅ CORREÇÃO: outerRadius menor no mobile para não cortar bordas
              outerRadius={isMobile ? 70 : 100}
              // ✅ CORREÇÃO: innerRadius também ajustado para manter proporção
              innerRadius={isMobile ? 20 : 30}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number) => value.toLocaleString('pt-BR')}
            />
            <Legend 
              // ✅ CORREÇÃO: Legend mais compacta no mobile
              wrapperStyle={isMobile ? { fontSize: '12px', paddingTop: '10px' } : {}}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

