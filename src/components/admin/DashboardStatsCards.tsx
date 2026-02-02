import { Button } from "@/components/ui/button";
import { TrendingUp, 
  Eye, 
  EyeOff, 
  Globe, 
  ShoppingCart, 
  Wallet,
  RefreshCw } from "@/lib/icons";
import { useDashboardStats, useSunoCredits } from "@/hooks/useAdminData";
import { useState } from "react";

// Cores dos cards
const CARD_COLORS = {
  receita: '#8b5cf6',
  hotmart: '#ec4899',
  pedidos: '#6366f1',
  conversao: '#f43f5e',
  creditos: '#a855f7',
} as const;

// Estilo base para os cards
const getCardStyle = (color: string): React.CSSProperties => ({
  backgroundColor: color,
  border: 'none',
  borderRadius: '20px',
  padding: '1.5rem 1.75rem',
  boxShadow: `0 1px 3px ${color}30, 0 4px 12px ${color}25, 0 8px 24px ${color}15`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  color: '#ffffff',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
});

// Handlers de hover
const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, color: string) => {
  e.currentTarget.style.boxShadow = `0 1px 3px ${color}40, 0 8px 16px ${color}35, 0 16px 32px ${color}20`;
  e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
};

const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>, color: string) => {
  e.currentTarget.style.boxShadow = `0 1px 3px ${color}30, 0 4px 12px ${color}25, 0 8px 24px ${color}15`;
  e.currentTarget.style.transform = 'translateY(0) scale(1)';
};

export function DashboardStatsCards() {
  const [showRevenue, setShowRevenue] = useState<boolean>(true);
  
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: sunoCredits, isLoading: creditsLoading, refetch: refetchCredits } = useSunoCredits();
  
  if (statsLoading && !stats) {
    const loadingTestIds = [
      'stats-card-receita-total',
      'stats-card-hotmart',
      'stats-card-total-pedidos',
      'stats-card-taxa-conversao',
      'stats-card-creditos-suno',
    ];
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
        {loadingTestIds.map((testId) => (
          <div 
            key={testId}
            data-testid={testId}
            role="region"
            style={{ 
              backgroundColor: CARD_COLORS.receita,
              borderRadius: '20px',
              padding: '1.5rem',
              minHeight: '180px'
            }}
          >
            <div className="h-4 bg-white/20 rounded w-1/2 mb-4" />
            <div className="h-12 bg-white/20 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }
  
  if (!stats) return null;
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
      {/* Receita Total */}
      <div data-testid="stats-card-revenue" role="region">
        <div 
          data-testid="stats-card-receita-total"
          role="region"
          style={getCardStyle(CARD_COLORS.receita)}
          onMouseEnter={(e) => handleMouseEnter(e, CARD_COLORS.receita)}
          onMouseLeave={(e) => handleMouseLeave(e, CARD_COLORS.receita)}
        >
          <span className="sr-only text-xl">
            {`R$ ${(stats.totalRevenueBRLConverted || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-[0.8125rem] font-semibold uppercase tracking-wider text-white/95">
              Receita Total
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white hover:bg-white/10"
              onClick={() => setShowRevenue(!showRevenue)}
              aria-label={showRevenue ? "Ocultar receita" : "Mostrar receita"}
            >
              {showRevenue ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
          </div>
          <div className="mb-6">
            <div className="text-[2.5rem] font-bold text-white leading-tight tracking-tight">
              {showRevenue 
                ? `R$ ${(stats.totalRevenueBRLConverted || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'R$ •••••••'
              }
            </div>
          </div>
          <div className="flex items-center gap-3 text-white/95">
            <TrendingUp className="w-[1.125rem] h-[1.125rem] opacity-90" />
            <span className="text-sm font-medium">{stats.paidOrders} pedidos</span>
          </div>
        </div>
      </div>

      {/* Hotmart */}
      <div 
        data-testid="stats-card-hotmart"
        role="region"
        style={getCardStyle(CARD_COLORS.hotmart)}
        onMouseEnter={(e) => handleMouseEnter(e, CARD_COLORS.hotmart)}
        onMouseLeave={(e) => handleMouseLeave(e, CARD_COLORS.hotmart)}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-[0.8125rem] font-semibold uppercase tracking-wider text-white/95">
            Hotmart (BRL)
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-white hover:bg-white/10"
            onClick={() => setShowRevenue(!showRevenue)}
            aria-label={showRevenue ? "Ocultar receita" : "Mostrar receita"}
          >
            {showRevenue ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
        </div>
        <div className="mb-6">
          <div className="text-[2.5rem] font-bold text-white leading-tight tracking-tight">
            {showRevenue 
              ? `R$ ${(stats.hotmartRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'R$ ••••••'
            }
          </div>
        </div>
        <div className="flex items-center gap-3 text-white/95">
          <Globe className="w-[1.125rem] h-[1.125rem] opacity-90" />
          <span className="text-sm font-medium">{stats.hotmartOrders} pedidos</span>
        </div>
      </div>

      {/* Total de Pedidos */}
      <div data-testid="stats-card-orders" role="region">
        <div 
          data-testid="stats-card-total-pedidos"
          role="region"
          style={getCardStyle(CARD_COLORS.pedidos)}
          onMouseEnter={(e) => handleMouseEnter(e, CARD_COLORS.pedidos)}
          onMouseLeave={(e) => handleMouseLeave(e, CARD_COLORS.pedidos)}
        >
          <span className="sr-only text-xl">{stats.totalOrders}</span>
          <div className="mb-5">
            <h3 className="text-[0.8125rem] font-semibold uppercase tracking-wider text-white/95">
              Total de Pedidos
            </h3>
          </div>
          <div className="mb-6">
            <div className="text-[2.5rem] font-bold text-white leading-tight tracking-tight">
              {stats.totalOrders}
            </div>
          </div>
          <div className="flex items-center gap-3 text-white/95">
            <ShoppingCart className="w-[1.125rem] h-[1.125rem] opacity-90" />
            <div>
              <div className="text-sm font-medium">{stats.paidOrders} pagos</div>
              <div className="text-xs opacity-85">
                {stats.paidOrders > 0 ? `${((stats.paidOrders / stats.totalOrders) * 100).toFixed(0)}%` : '0%'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Taxa de Conversão */}
      <div 
        data-testid="stats-card-taxa-conversao"
        role="region"
        style={getCardStyle(CARD_COLORS.conversao)}
        onMouseEnter={(e) => handleMouseEnter(e, CARD_COLORS.conversao)}
        onMouseLeave={(e) => handleMouseLeave(e, CARD_COLORS.conversao)}
      >
        <div className="mb-5">
          <h3 className="text-[0.8125rem] font-semibold uppercase tracking-wider text-white/95">
            Taxa de Conversão
          </h3>
        </div>
        <div className="mb-6">
          <div className="text-[2.5rem] font-bold text-white leading-tight tracking-tight">
            {stats.totalOrders > 0 ? ((stats.paidOrders / stats.totalOrders) * 100).toFixed(1) : '0'}%
          </div>
        </div>
        <div className="flex items-center gap-3 text-white/95">
          <TrendingUp className="w-[1.125rem] h-[1.125rem] opacity-90" />
          <div>
            <div className="text-sm font-medium">{stats.paidOrders} de {stats.totalOrders}</div>
            <div className="text-xs opacity-85">Pedidos convertidos</div>
          </div>
        </div>
      </div>

      {/* Créditos Suno */}
      <div 
        data-testid="stats-card-creditos-suno"
        role="region"
        style={getCardStyle(CARD_COLORS.creditos)}
        onMouseEnter={(e) => handleMouseEnter(e, CARD_COLORS.creditos)}
        onMouseLeave={(e) => handleMouseLeave(e, CARD_COLORS.creditos)}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-[0.8125rem] font-semibold uppercase tracking-wider text-white/95">
            Créditos Suno
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-white hover:bg-white/10"
            onClick={() => refetchCredits()}
            disabled={creditsLoading}
            aria-label="Atualizar créditos Suno"
          >
            <RefreshCw className={`w-4 h-4 ${creditsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="mb-6">
          <div className="text-[2.5rem] font-bold text-white leading-tight tracking-tight">
            {sunoCredits ? sunoCredits.remaining.toLocaleString('pt-BR') : 'Carregando...'}
          </div>
        </div>
        <div className="flex items-center gap-3 text-white/95">
          <Wallet className="w-[1.125rem] h-[1.125rem] opacity-90" />
          <div>
            <div className="text-sm font-medium">
              {sunoCredits && sunoCredits.total > 0 ? `${((sunoCredits.remaining / sunoCredits.total) * 100).toFixed(0)}% restante` : '0%'}
            </div>
            <div className="text-xs opacity-85">Disponível</div>
          </div>
        </div>
      </div>
    </div>
  );
}
