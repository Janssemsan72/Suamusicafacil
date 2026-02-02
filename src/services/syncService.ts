/**
 * Serviço de Sincronização Offline
 * Gerencia fila de ações offline usando IndexedDB e Background Sync
 */

export interface SyncAction {
  id?: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  queue?: string;
  timestamp?: string;
  retries?: number;
}

export interface SyncQueueItem extends SyncAction {
  id: string;
  queue: string;
  timestamp: string;
  retries: number;
}

const DB_NAME = "PWA_SYNC_DB";
const DB_VERSION = 1;
const STORE_NAME = "sync-queue";

class SyncService {
  private db: IDBDatabase | null = null;

  /**
   * Abrir conexão com IndexedDB
   */
  private async openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("[SyncService] Erro ao abrir IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Criar object store se não existir
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("queue", "queue", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  /**
   * Adicionar ação à fila de sincronização
   */
  async queueAction(action: SyncAction, queueName: string = "default"): Promise<string> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const queueItem: SyncQueueItem = {
        id: action.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        queue: queueName,
        timestamp: new Date().toISOString(),
        retries: 0,
        ...action,
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.add(queueItem);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Registrar sync tag no service worker
      if ("serviceWorker" in navigator && "sync" in (navigator as any).serviceWorker.registration) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if ("sync" in registration) {
            await (registration as any).sync.register(`sync-${queueName}`);
          }
        } catch (error) {
          console.warn("[SyncService] Background Sync não disponível:", error);
        }
      }

      // Notificar service worker via message
      await this.notifyServiceWorker("QUEUE_SYNC", {
        queue: queueName,
        action: queueItem,
      });

      console.log(`[SyncService] Ação enfileirada: ${queueItem.id} na fila ${queueName}`);
      return queueItem.id;
    } catch (error) {
      console.error("[SyncService] Erro ao enfileirar ação:", error);
      throw error;
    }
  }

  /**
   * Obter todas as ações de uma fila
   */
  async getQueue(queueName: string = "default"): Promise<SyncQueueItem[]> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("queue");

      return new Promise((resolve, reject) => {
        const request = index.getAll(queueName);
        request.onsuccess = () => {
          const items = (request.result || []) as SyncQueueItem[];
          // Ordenar por timestamp (mais antigas primeiro)
          items.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          resolve(items);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("[SyncService] Erro ao obter fila:", error);
      return [];
    }
  }

  /**
   * Obter todas as filas
   */
  async getAllQueues(): Promise<Record<string, SyncQueueItem[]>> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("queue");

      return new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onsuccess = () => {
          const items = (request.result || []) as SyncQueueItem[];
          const queues: Record<string, SyncQueueItem[]> = {};

          items.forEach((item) => {
            if (!queues[item.queue]) {
              queues[item.queue] = [];
            }
            queues[item.queue].push(item);
          });

          // Ordenar cada fila por timestamp
          Object.keys(queues).forEach((queueName) => {
            queues[queueName].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });

          resolve(queues);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("[SyncService] Erro ao obter todas as filas:", error);
      return {};
    }
  }

  /**
   * Remover ação da fila
   */
  async removeAction(actionId: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(actionId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`[SyncService] Ação removida: ${actionId}`);
    } catch (error) {
      console.error("[SyncService] Erro ao remover ação:", error);
      throw error;
    }
  }

  /**
   * Limpar fila específica
   */
  async clearQueue(queueName: string): Promise<void> {
    try {
      const items = await this.getQueue(queueName);
      await Promise.all(items.map((item) => this.removeAction(item.id)));
      console.log(`[SyncService] Fila limpa: ${queueName}`);
    } catch (error) {
      console.error("[SyncService] Erro ao limpar fila:", error);
      throw error;
    }
  }

  /**
   * Limpar todas as filas
   */
  async clearAllQueues(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log("[SyncService] Todas as filas foram limpas");
    } catch (error) {
      console.error("[SyncService] Erro ao limpar todas as filas:", error);
      throw error;
    }
  }

  /**
   * Obter contagem de ações pendentes
   */
  async getPendingCount(queueName?: string): Promise<number> {
    try {
      if (queueName) {
        const queue = await this.getQueue(queueName);
        return queue.length;
      } else {
        const queues = await this.getAllQueues();
        return Object.values(queues).reduce((total, queue) => total + queue.length, 0);
      }
    } catch (error) {
      console.error("[SyncService] Erro ao obter contagem:", error);
      return 0;
    }
  }

  /**
   * Notificar service worker
   */
  private async notifyServiceWorker(type: string, data: any): Promise<void> {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({ type, data });
      }
    } catch (error) {
      console.warn("[SyncService] Erro ao notificar service worker:", error);
    }
  }

  /**
   * Forçar sincronização de uma fila
   */
  async syncQueue(queueName: string = "default"): Promise<void> {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker não disponível");
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if ("sync" in registration) {
        await (registration as any).sync.register(`sync-${queueName}`);
        console.log(`[SyncService] Sincronização solicitada para fila: ${queueName}`);
      } else {
        // Fallback: notificar service worker diretamente
        await this.notifyServiceWorker("SYNC_QUEUE", { queue: queueName });
      }
    } catch (error) {
      console.error("[SyncService] Erro ao solicitar sincronização:", error);
      throw error;
    }
  }

  /**
   * Sincronizar todas as filas
   */
  async syncAllQueues(): Promise<void> {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker não disponível");
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if ("sync" in registration) {
        await (registration as any).sync.register("sync-all");
        console.log("[SyncService] Sincronização de todas as filas solicitada");
      } else {
        // Fallback: notificar service worker diretamente
        await this.notifyServiceWorker("SYNC_ALL", {});
      }
    } catch (error) {
      console.error("[SyncService] Erro ao solicitar sincronização completa:", error);
      throw error;
    }
  }
}

// Exportar instância singleton
export const syncService = new SyncService();


