import { useOfflineSync } from "@/hooks/useOfflineSync";
import { WifiOff, Wifi, RefreshCw, CheckCircle2, AlertCircle } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    syncAllQueues,
  } = useOfflineSync();

  const formatLastSync = (date: Date | null) => {
    if (!date) return "Nunca";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return "Agora";
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return date.toLocaleDateString();
  };

  if (isOnline && pendingCount === 0) {
    return null; // Não mostrar quando tudo está sincronizado
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-2",
                !isOnline && "text-destructive",
                isSyncing && "animate-pulse"
              )}
              onClick={() => {
                if (isOnline && pendingCount > 0) {
                  syncAllQueues();
                }
              }}
              disabled={isSyncing || (!isOnline && pendingCount === 0)}
            >
              {isOnline ? (
                isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Sincronizando...</span>
                  </>
                ) : pendingCount > 0 ? (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                    </span>
                    <Badge variant="secondary" className="ml-1">
                      {pendingCount}
                    </Badge>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="hidden sm:inline">Sincronizado</span>
                  </>
                )
              ) : (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold">
              {isOnline ? (
                pendingCount > 0 ? (
                  "Ações Pendentes de Sincronização"
                ) : (
                  "Online e Sincronizado"
                )
              ) : (
                "Modo Offline"
              )}
            </div>
            {isOnline && pendingCount > 0 && (
              <div className="text-sm text-muted-foreground">
                {pendingCount} ação{pendingCount > 1 ? "ões" : ""} será
                {pendingCount > 1 ? "ão" : ""} sincronizada
                {pendingCount > 1 ? "s" : ""} quando a conexão for restaurada.
              </div>
            )}
            {!isOnline && (
              <div className="text-sm text-muted-foreground">
                Você está offline. As ações serão sincronizadas automaticamente
                quando a conexão for restaurada.
              </div>
            )}
            {lastSyncTime && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                Última sincronização: {formatLastSync(lastSyncTime)}
              </div>
            )}
            {isOnline && pendingCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={() => syncAllQueues()}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Sincronizar Agora
                  </>
                )}
              </Button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


