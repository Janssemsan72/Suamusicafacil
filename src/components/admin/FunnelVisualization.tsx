import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBehaviorAnalytics } from "@/hooks/useBehaviorAnalytics";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";

interface FunnelStep {
  step: number;
  name: string;
  users: number;
  conversions: number;
  conversionRate: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

export function FunnelVisualization() {
  const { funnelMetrics, loading } = useBehaviorAnalytics();

  if (loading) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-lg">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Garantir que funnelMetrics é um array válido
  const safeFunnelMetrics: FunnelStep[] = Array.isArray(funnelMetrics) ? funnelMetrics : [];

  if (!safeFunnelMetrics || safeFunnelMetrics.length === 0) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-lg">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível ainda
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preparar dados para o gráfico de funil com validação completa
  // ✅ CORREÇÃO: Garantir que todos os campos estejam sempre definidos
  const funnelData = safeFunnelMetrics.map((step: FunnelStep, index: number) => {
    const safeStep = {
      step: step?.step || index + 1,
      name: step?.name || `Etapa ${step?.step || index + 1}`,
      users: typeof step?.users === 'number' ? step.users : 0,
      conversions: typeof step?.conversions === 'number' ? step.conversions : 0,
      conversionRate: typeof step?.conversionRate === 'number' && !isNaN(step.conversionRate) 
        ? step.conversionRate 
        : 0,
    };
    
    // ✅ CORREÇÃO: Garantir que conversionRate sempre esteja presente no objeto retornado
    return {
      name: safeStep.name,
      value: safeStep.users,
      fill: COLORS[index % COLORS.length],
      conversionRate: safeStep.conversionRate, // Sempre definido, nunca undefined
      conversions: safeStep.conversions,
      step: safeStep.step,
      index: index, // Adicionar índice para facilitar busca
    };
  });

  return (
    <Card className="border-2 shadow-lg bg-gradient-to-br from-white to-green-50/30">
      <CardHeader>
        <CardTitle className="text-lg font-semibold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Gráfico de Barras Horizontal (Funil) */}
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={funnelData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                {funnelData.map((entry: any, index: number) => (
                  <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={entry.fill} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={entry.fill} stopOpacity={0.4}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                type="number" 
                stroke="#666"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={120}
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
                formatter={(value: any, name: string, props: any) => {
                  try {
                    // ✅ CORREÇÃO: Validação completa e segura do payload
                    const safeValue = typeof value === 'number' ? value : 0;
                    
                    // Se não há props ou payload, retornar valor seguro
                    if (!props) {
                      return [`${safeValue.toLocaleString('pt-BR')} usuários`, 'Usuários'];
                    }
                    
                    // Tentar obter step de diferentes formas
                    let step: FunnelStep | null = null;
                    
                    // Método 1: Tentar acessar diretamente do payload
                    if (props.payload && props.payload.conversionRate !== undefined) {
                      const conversionRate = typeof props.payload.conversionRate === 'number' 
                        ? props.payload.conversionRate 
                        : 0;
                      return [
                        `${safeValue.toLocaleString('pt-BR')} usuários (${conversionRate.toFixed(1)}% conversão)`,
                        'Usuários',
                      ];
                    }
                    
                    // Método 2: Tentar obter pelo índice do payload ou do funnelData
                    let stepIndex: number | undefined = undefined;
                    
                    // Tentar obter índice do payload
                    if (props.payload?.index !== undefined) {
                      stepIndex = props.payload.index;
                    } else if (props.payloadIndex !== undefined) {
                      stepIndex = props.payloadIndex;
                    }
                    
                    // Se não encontrou pelo payload, tentar pelo valor
                    if (stepIndex === undefined) {
                      const foundData = funnelData.find((d: any) => d.value === value);
                      if (foundData && foundData.index !== undefined) {
                        stepIndex = foundData.index;
                      } else {
                        stepIndex = funnelData.findIndex((d: any) => d.value === value);
                      }
                    }
                    
                    // Validar e obter step
                    if (stepIndex !== undefined && stepIndex >= 0 && stepIndex < safeFunnelMetrics.length) {
                      step = safeFunnelMetrics[stepIndex];
                    }
                    
                    // Método 3: Tentar encontrar pelo valor diretamente no funnelData
                    if (!step) {
                      const foundData = funnelData.find((d: any) => d.value === value);
                      if (foundData && foundData.conversionRate !== undefined) {
                        // Se encontrou no funnelData, usar diretamente
                        const conversionRate = typeof foundData.conversionRate === 'number' 
                          ? foundData.conversionRate 
                          : 0;
                        return [
                          `${safeValue.toLocaleString('pt-BR')} usuários (${conversionRate.toFixed(1)}% conversão)`,
                          'Usuários',
                        ];
                      }
                    }
                    
                    // Se encontrou step válido com conversionRate
                    if (step && typeof step.conversionRate === 'number') {
                      return [
                        `${safeValue.toLocaleString('pt-BR')} usuários (${step.conversionRate.toFixed(1)}% conversão)`,
                        'Usuários',
                      ];
                    }
                    
                    // Fallback: retornar apenas o valor
                    return [`${safeValue.toLocaleString('pt-BR')} usuários`, 'Usuários'];
                  } catch (error) {
                    // ✅ CORREÇÃO: Em caso de qualquer erro, retornar valor seguro
                    console.warn('⚠️ [FunnelVisualization] Erro no formatter do Tooltip:', error);
                    const safeValue = typeof value === 'number' ? value : 0;
                    return [`${safeValue.toLocaleString('pt-BR')} usuários`, 'Usuários'];
                  }
                }}
              />
              <Legend />
              <Bar dataKey="value" name="Usuários" radius={[0, 8, 8, 0]}>
                {funnelData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={`url(#gradient-${index})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Tabela de Detalhes */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3">Detalhes por Etapa</h3>
            <div className="space-y-2">
              {safeFunnelMetrics.map((step: FunnelStep, index: number) => (
                <div
                  key={step.step}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  style={{ borderLeftColor: COLORS[index % COLORS.length], borderLeftWidth: 4 }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    >
                      {step.step}
                    </div>
                    <div>
                      <div className="font-medium">{step.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {step.conversions.toLocaleString('pt-BR')} conversões
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {(step.conversionRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(step.users || 0).toLocaleString('pt-BR')} usuários
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

