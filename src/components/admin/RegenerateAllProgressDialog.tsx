import React, { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, RotateCcw, AlertCircle, Pause, Play, Trash2 } from "@/lib/icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { RegenerateItem, RegenerateProgress } from "@/hooks/useRegenerateAllLyrics";

interface RegenerateAllProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: RegenerateProgress | null;
  isRunning: boolean;
  onPause: () => void;
  onResume: () => Promise<void>;
  onClear: () => void;
  onClose?: () => void;
}

export function RegenerateAllProgressDialog({
  open,
  onOpenChange,
  progress,
  isRunning,
  onPause,
  onResume,
  onClear,
  onClose
}: RegenerateAllProgressDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const total = progress?.items.length || 0;
  const currentIndex = progress?.currentIndex || 0;
  const items = progress?.items || [];
  const isComplete = progress?.isComplete || false;
  
  const progressPercent = total > 0 ? ((currentIndex) / total) * 100 : 0;
  const successCount = items.filter(item => item.status === 'success').length;
  const errorCount = items.filter(item => item.status === 'error').length;
  const processingCount = items.filter(item => item.status === 'processing').length;
  const pendingCount = items.filter(item => item.status === 'pending').length;

  // Auto-scroll para o item atual
  useEffect(() => {
    if (scrollRef.current && currentIndex > 0) {
      const currentItem = scrollRef.current.querySelector(`[data-index="${currentIndex - 1}"]`);
      if (currentItem) {
        currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentIndex]);

  // Calcular tempo estimado
  const getEstimatedTime = () => {
    if (!progress || isComplete) return null;
    const remaining = total - currentIndex;
    const avgTimePerItem = 2; // segundos (1.5s delay + processamento)
    const totalSeconds = remaining * avgTimePerItem;
    
    if (totalSeconds < 60) return `~${totalSeconds}s`;
    if (totalSeconds < 3600) return `~${Math.ceil(totalSeconds / 60)}min`;
    return `~${Math.ceil(totalSeconds / 3600)}h ${Math.ceil((totalSeconds % 3600) / 60)}min`;
  };

  const getStatusIcon = (status: RegenerateItem['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RotateCcw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'skipped':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: RegenerateItem['status']) => {
    switch (status) {
      case 'success':
        return 'Sucesso';
      case 'error':
        return 'Erro';
      case 'processing':
        return 'Processando...';
      case 'skipped':
        return 'Pulado';
      default:
        return 'Aguardando';
    }
  };

  const handleClose = () => {
    if (isRunning) {
      if (window.confirm('O processo está em andamento. Deseja pausar e fechar?\n\nO progresso será salvo e você poderá continuar depois.')) {
        onPause();
        onOpenChange(false);
        onClose?.();
      }
    } else {
      onOpenChange(false);
      onClose?.();
    }
  };

  const handleClearAndClose = () => {
    if (window.confirm('Tem certeza que deseja limpar o progresso?\n\nIsso não pode ser desfeito.')) {
      onClear();
      onOpenChange(false);
      onClose?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        handleClose();
      } else {
        onOpenChange(open);
      }
    }}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col" onInteractOutside={(e) => {
        if (isRunning) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className={cn("h-5 w-5", isRunning && "animate-spin")} />
            Regenerando Letras Pendentes
            {isRunning && (
              <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                Em execução
              </span>
            )}
            {!isRunning && !isComplete && progress && (
              <span className="ml-2 text-xs font-normal text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
                Pausado
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            <span>Processando {currentIndex} de {total} letras</span>
            {isRunning && getEstimatedTime() && (
              <span className="text-xs text-muted-foreground">
                Tempo restante: {getEstimatedTime()}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Estatísticas */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2.5 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{successCount}</div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">Sucesso</div>
            </div>
            <div className="text-center p-2.5 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{errorCount}</div>
              <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">Erros</div>
            </div>
            <div className="text-center p-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{processingCount}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Processando</div>
            </div>
            <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-950/20 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="text-xl font-bold text-gray-600 dark:text-gray-400">{pendingCount}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Restantes</div>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{currentIndex} de {total} letras processadas</span>
              {progress?.startedAt && (
                <span>Iniciado: {new Date(progress.startedAt).toLocaleTimeString('pt-BR')}</span>
              )}
            </div>
          </div>

          {/* Lista de Itens */}
          <div className="flex-1 min-h-0">
            <div className="text-sm font-medium mb-2 flex items-center justify-between">
              <span>Detalhes:</span>
              <span className="text-xs text-muted-foreground">
                {items.length} itens
              </span>
            </div>
            <ScrollArea className="h-[300px] border rounded-md p-2" ref={scrollRef}>
              <div className="space-y-1.5">
                {items.map((item, index) => (
                  <div
                    key={item.approval_id}
                    data-index={index}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md border transition-colors text-sm",
                      item.status === 'processing' && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 ring-2 ring-blue-400/50",
                      item.status === 'success' && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
                      item.status === 'error' && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",
                      item.status === 'pending' && "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-900 opacity-60"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {item.customer_email || `Pedido ${item.order_id?.slice(0, 8) || item.approval_id.slice(0, 8)}...`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getStatusText(item.status)}
                        {item.error && (
                          <span className="text-red-600 dark:text-red-400 ml-2" title={item.error}>
                            - {item.error.length > 40 ? item.error.slice(0, 40) + '...' : item.error}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Mensagem de Conclusão */}
          {isComplete && (
            <div className={cn(
              "p-4 rounded-lg border flex items-start gap-3",
              errorCount > 0 
                ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900"
                : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
            )}>
              {errorCount > 0 ? (
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {errorCount > 0 
                    ? `Regeneração concluída com ${errorCount} erro(s)`
                    : '🎉 Todas as letras foram regeneradas com sucesso!'
                  }
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {successCount} sucesso(s) • {errorCount} erro(s) • {total} total
                </div>
              </div>
            </div>
          )}

          {/* Mensagem de Pausado */}
          {!isRunning && !isComplete && progress && (
            <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900 flex items-start gap-3">
              <Pause className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-sm text-yellow-700 dark:text-yellow-300">
                  Regeneração pausada
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Clique em "Continuar" para retomar de onde parou ({currentIndex}/{total}).
                  O progresso foi salvo automaticamente.
                </div>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex justify-between gap-2 pt-2 border-t">
            <div>
              {!isRunning && progress && !isComplete && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearAndClose}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Progresso
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              {isComplete ? (
                <>
                  <Button variant="outline" onClick={handleClearAndClose}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                  <Button onClick={() => {
                    onClear();
                    onOpenChange(false);
                    onClose?.();
                  }}>
                    Fechar
                  </Button>
                </>
              ) : isRunning ? (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    onPause();
                  }}
                  className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pausar
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={handleClose}
                  >
                    Fechar
                  </Button>
                  <Button 
                    onClick={onResume}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Continuar ({total - currentIndex} restantes)
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
