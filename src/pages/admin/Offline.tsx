import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WifiOff, RefreshCw, Home, CheckCircle2, Clock, AlertCircle } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function Offline() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isChecking, setIsChecking] = useState(false);
  const {
    pendingCount,
    isSyncing,
    lastSyncTime,
    queues,
    syncAllQueues,
  } = useOfflineSync();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Tentar sincronizar automaticamente quando voltar online
      if (pendingCount > 0) {
        setTimeout(() => syncAllQueues(), 1000);
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [pendingCount, syncAllQueues]);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      // Tentar fazer uma requisição simples para verificar conexão
      const response = await fetch("/admin", { 
        method: "HEAD",
        cache: "no-cache"
      });
      if (response.ok) {
        setIsOnline(true);
        // Redirecionar após um pequeno delay
        setTimeout(() => {
          navigate("/admin");
        }, 500);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleGoHome = () => {
    navigate("/admin");
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return "Nunca";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return "Agora";
    if (minutes < 60) return `${minutes} minuto${minutes > 1 ? "s" : ""} atrás`;
    if (hours < 24) return `${hours} hora${hours > 1 ? "s" : ""} atrás`;
    return date.toLocaleDateString();
  };

  const totalQueued = Object.values(queues).reduce(
    (sum, queue) => sum + queue.length,
    0
  );

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            {isOnline ? (
              isSyncing ? (
                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              ) : pendingCount > 0 ? (
                <AlertCircle className="h-8 w-8 text-yellow-500" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              )
            ) : (
              <WifiOff className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isOnline
              ? isSyncing
                ? "Sincronizando..."
                : pendingCount > 0
                ? "Ações Pendentes"
                : "Conexão Restaurada"
              : "Você está offline"}
          </CardTitle>
          <CardDescription>
            {isOnline
              ? isSyncing
                ? "Sincronizando suas ações pendentes..."
                : pendingCount > 0
                ? `${pendingCount} ação${pendingCount > 1 ? "ões" : ""} aguardando sincronização`
                : "Tudo sincronizado! Redirecionando..."
              : "Não foi possível conectar à internet. Verifique sua conexão e tente novamente."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status de Sincronização */}
          {isOnline && pendingCount > 0 && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Ações Pendentes</span>
                <Badge variant="secondary">{pendingCount}</Badge>
              </div>
              {isSyncing && (
                <div className="space-y-2">
                  <Progress value={undefined} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Sincronizando em background...
                  </p>
                </div>
              )}
              {lastSyncTime && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Última sincronização: {formatLastSync(lastSyncTime)}</span>
                </div>
              )}
            </div>
          )}

          {/* Detalhes das Filas */}
          {!isOnline && totalQueued > 0 && (
            <div className="space-y-2 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  {totalQueued} ação{totalQueued > 1 ? "ões" : ""} será
                  {totalQueued > 1 ? "ão" : ""} sincronizada
                  {totalQueued > 1 ? "s" : ""} quando voltar online
                </span>
              </div>
              {Object.entries(queues).map(([queueName, items]) => 
                items.length > 0 ? (
                  <div key={queueName} className="text-xs text-yellow-800 dark:text-yellow-200 ml-6">
                    • {items.length} em {queueName}
                  </div>
                ) : null
              )}
            </div>
          )}

          {!isOnline && (
            <>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Alguns recursos podem não funcionar sem conexão:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Carregar novos dados</li>
                  <li>Sincronizar alterações</li>
                  <li>Acessar APIs externas</li>
                </ul>
                <p className="pt-2">
                  Recursos já carregados podem estar disponíveis offline.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleRetry}
                  disabled={isChecking}
                  className="w-full"
                >
                  {isChecking ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Tentar Novamente
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGoHome}
                  className="w-full"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Voltar ao Dashboard
                </Button>
              </div>
            </>
          )}

          {isOnline && pendingCount === 0 && !isSyncing && (
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Redirecionando para o dashboard...
              </p>
            </div>
          )}

          {isOnline && pendingCount > 0 && !isSyncing && (
            <Button
              onClick={() => syncAllQueues()}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar Agora
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

