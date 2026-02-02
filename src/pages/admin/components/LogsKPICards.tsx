import { ADMIN_CARD_COLORS, SolidStatCard } from "@/components/admin/SolidStatCard";
import { Activity, AlertTriangle, CheckCircle2, Clock } from "@/lib/icons";

interface LogsKPICardsProps {
  totalEvents: number;
  errorCount: number;
  successRate: number;
  lastUpdate: Date | null;
}

export function LogsKPICards({ totalEvents, errorCount, successRate, lastUpdate }: LogsKPICardsProps) {
  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Nunca';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h atrás`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <SolidStatCard
        title="Total de Eventos"
        value={totalEvents.toLocaleString()}
        icon={Activity}
        color={ADMIN_CARD_COLORS.primary}
        className="admin-hover-lift"
      />
      <SolidStatCard
        title="Erros"
        value={errorCount.toString()}
        icon={AlertTriangle}
        color={ADMIN_CARD_COLORS.red}
        className="admin-hover-lift"
      />
      <SolidStatCard
        title="Taxa de Sucesso"
        value={`${successRate.toFixed(1)}%`}
        icon={CheckCircle2}
        color={ADMIN_CARD_COLORS.green}
        className="admin-hover-lift"
      />
      <SolidStatCard
        title="Última Atualização"
        value={formatLastUpdate(lastUpdate)}
        icon={Clock}
        color={ADMIN_CARD_COLORS.blue}
        className="admin-hover-lift"
      />
    </div>
  );
}
