import { useEffect, useState, useCallback, useRef } from "react";
import { syncService, SyncQueueItem } from "@/services/syncService";

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  queues: Record<string, SyncQueueItem[]>;
}

export function useOfflineSync() {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
    lastSyncTime: null,
    queues: {},
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Atualizar status online/offline
   */
  const updateOnlineStatus = useCallback(() => {
    const isOnline = navigator.onLine;
    setState((prev) => ({ ...prev, isOnline }));

    // Se voltou online, tentar sincronizar
    if (isOnline && state.pendingCount > 0) {
      syncAllQueues();
    }
  }, [state.pendingCount]);

  /**
   * Atualizar contagem de ações pendentes
   */
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await syncService.getPendingCount();
      const queues = await syncService.getAllQueues();
      setState((prev) => ({
        ...prev,
        pendingCount: count,
        queues,
      }));
    } catch (error) {
      console.error("[useOfflineSync] Erro ao atualizar contagem:", error);
    }
  }, []);

  /**
   * Sincronizar todas as filas
   */
  const syncAllQueues = useCallback(async () => {
    if (state.isSyncing || !state.isOnline) {
      return;
    }

    setState((prev) => ({ ...prev, isSyncing: true }));

    try {
      await syncService.syncAllQueues();
      setState((prev) => ({
        ...prev,
        lastSyncTime: new Date(),
      }));

      // Aguardar um pouco e atualizar contagem
      setTimeout(() => {
        updatePendingCount();
        setState((prev) => ({ ...prev, isSyncing: false }));
      }, 2000);
    } catch (error) {
      console.error("[useOfflineSync] Erro ao sincronizar:", error);
      setState((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [state.isSyncing, state.isOnline, updatePendingCount]);

  /**
   * Sincronizar fila específica
   */
  const syncQueue = useCallback(
    async (queueName: string) => {
      if (state.isSyncing || !state.isOnline) {
        return;
      }

      setState((prev) => ({ ...prev, isSyncing: true }));

      try {
        await syncService.syncQueue(queueName);
        setState((prev) => ({
          ...prev,
          lastSyncTime: new Date(),
        }));

        // Aguardar um pouco e atualizar contagem
        setTimeout(() => {
          updatePendingCount();
          setState((prev) => ({ ...prev, isSyncing: false }));
        }, 2000);
      } catch (error) {
        console.error("[useOfflineSync] Erro ao sincronizar fila:", error);
        setState((prev) => ({ ...prev, isSyncing: false }));
      }
    },
    [state.isSyncing, state.isOnline, updatePendingCount]
  );

  /**
   * Limpar fila específica
   */
  const clearQueue = useCallback(
    async (queueName: string) => {
      try {
        await syncService.clearQueue(queueName);
        await updatePendingCount();
      } catch (error) {
        console.error("[useOfflineSync] Erro ao limpar fila:", error);
      }
    },
    [updatePendingCount]
  );

  /**
   * Limpar todas as filas
   */
  const clearAllQueues = useCallback(async () => {
    try {
      await syncService.clearAllQueues();
      await updatePendingCount();
    } catch (error) {
      console.error("[useOfflineSync] Erro ao limpar todas as filas:", error);
    }
  }, [updatePendingCount]);

  /**
   * Escutar eventos online/offline
   */
  useEffect(() => {
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, [updateOnlineStatus]);

  /**
   * Escutar mensagens do service worker sobre sincronização
   */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        console.log("[useOfflineSync] Sincronização concluída:", event.data);
        updatePendingCount();
        setState((prev) => ({
          ...prev,
          isSyncing: false,
          lastSyncTime: new Date(),
        }));
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [updatePendingCount]);

  /**
   * Atualizar contagem periodicamente
   */
  useEffect(() => {
    // Atualizar imediatamente
    updatePendingCount();

    // Atualizar a cada 5 segundos
    checkIntervalRef.current = setInterval(() => {
      updatePendingCount();
    }, 5000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [updatePendingCount]);

  /**
   * Sincronizar automaticamente quando voltar online
   */
  useEffect(() => {
    if (state.isOnline && state.pendingCount > 0 && !state.isSyncing) {
      // Aguardar um pouco antes de sincronizar (dar tempo para conexão estabilizar)
      const timeout = setTimeout(() => {
        syncAllQueues();
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [state.isOnline, state.pendingCount, state.isSyncing, syncAllQueues]);

  return {
    ...state,
    syncAllQueues,
    syncQueue,
    clearQueue,
    clearAllQueues,
    refresh: updatePendingCount,
  };
}


