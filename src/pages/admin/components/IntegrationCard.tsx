import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, RefreshCw, ExternalLink, Settings } from "@/lib/icons";
import { useState } from "react";

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'connected' | 'error' | 'unknown';
  lastCheck?: Date;
  metrics?: {
    label: string;
    value: string | number;
  }[];
  onTest?: () => Promise<void>;
  onConfigure?: () => void;
  dashboardUrl?: string;
}

export default function IntegrationCard({
  name,
  description,
  icon,
  status,
  lastCheck,
  metrics = [],
  onTest,
  onConfigure,
  dashboardUrl
}: IntegrationCardProps) {
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!onTest) return;
    setTesting(true);
    try {
      await onTest();
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'default';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-3 w-3" />;
      case 'error': return <XCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Card className="mobile-compact-card apple-card">
      <CardHeader className="p-4 md:p-6 border-b border-border/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            <div className="p-2.5 bg-primary/10 rounded-xl shrink-0 backdrop-blur-sm">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base md:text-lg font-semibold truncate tracking-tight">{name}</CardTitle>
              <p className="text-xs md:text-sm text-muted-foreground truncate mt-1">{description}</p>
            </div>
          </div>
          <Badge variant={getStatusColor()} className="flex items-center gap-1.5 shrink-0 text-xs md:text-sm px-2.5 py-1 rounded-full font-medium">
            <span className="h-3 w-3 md:h-4 md:w-4 inline-flex">{getStatusIcon()}</span>
            <span className="hidden sm:inline">
              {status === 'connected' ? 'Conectado' : status === 'error' ? 'Erro' : 'Desconhecido'}
            </span>
            <span className="sm:hidden">
              {status === 'connected' ? 'OK' : status === 'error' ? 'Erro' : '?'}
            </span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-5 p-4 md:p-6">
        {lastCheck && (
          <p className="text-xs text-muted-foreground">
            Última verificação: {new Date(lastCheck).toLocaleString('pt-BR')}
          </p>
        )}

        {metrics.length > 0 && (
          <div className="bg-muted/40 rounded-xl p-4 space-y-3 backdrop-blur-sm border border-border/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Últimas 24 horas</p>
            {metrics.map((metric, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground font-medium">{metric.label}</span>
                <span className="text-sm font-semibold">{metric.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5">
          {onTest && (
            <Button 
              variant="default"
              size="default"
              onClick={handleTest}
              disabled={testing}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
              Testar
            </Button>
          )}
          {onConfigure && (
            <Button 
              variant="default" 
              size="default"
              onClick={onConfigure}
              className="w-full sm:w-auto"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          )}
          {dashboardUrl && (
            <Button 
              variant="outline" 
              size="default"
              asChild
              className="w-full sm:w-auto"
            >
              <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Dashboard
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
