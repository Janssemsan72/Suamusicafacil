// Service Worker Avançado para área administrativa do MusicLovely
// Versão: v3.0.0 - PWA Avançado com Background Sync, Push Notifications e Cache Inteligente
const VERSION = "v3.0.0";
const PRECACHE = `precache-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const SYNC_QUEUE = "sync-queue";

// URLs para pré-cache (shell da aplicação)
const PRECACHE_URLS = [
  "/admin",
  "/admin/",
  // "/admin/offline", // Removed to prevent 404 during install if not a static file
  "/manifest-admin.json",
  "/favicon.ico"
];

// Install event - pré-cache do shell
self.addEventListener("install", (event) => {
  console.log("[SW Admin] Installing service worker v" + VERSION);
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => {
        console.log("[SW Admin] Caching static assets");
        return cache.addAll(
          PRECACHE_URLS.filter((url) => {
            // Filtrar apenas URLs válidas
            try {
              new URL(url, self.location.origin);
              return true;
            } catch {
              return false;
            }
          })
        );
      })
      .catch((error) => {
        console.warn("[SW Admin] Error caching static assets:", error);
      })
  );
  // Forçar ativação imediata
  self.skipWaiting();
});

// Activate event - limpar caches antigos
self.addEventListener("activate", (event) => {
  console.log("[SW Admin] Activating service worker v" + VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => ![PRECACHE, RUNTIME].includes(name))
          .map((name) => {
            console.log("[SW Admin] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  // Assumir controle imediato de todas as páginas
  return self.clients.claim();
});

// Helper: Stale-While-Revalidate - Retorna cache imediatamente e atualiza em background
const swr = async (request) => {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  
  const networkPromise = fetch(request)
    .then((resp) => {
      // Apenas cachear respostas de sucesso
      if (resp && resp.status === 200 && resp.type === "basic") {
        cache.put(request, resp.clone());
      }
      return resp;
    })
    .catch(() => null);

  // Retornar cache imediatamente se disponível, senão aguardar rede
  if (cached) {
    // Atualizar cache em background (não bloquear resposta)
    networkPromise.catch(() => {});
    return cached;
  }

  const network = await networkPromise;
  return network || caches.match("/admin/offline");
};

// Helper: Network First - Tenta rede primeiro, usa cache como fallback
const networkFirst = async (request, cacheName = RUNTIME) => {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      // Atualizar cache com resposta da rede
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error("Network response not ok");
  } catch (error) {
    // Usar cache se rede falhar
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    // Fallback para página offline se não houver cache
    return caches.match("/admin/offline");
  }
};

// Helper: Cache First - Usa cache primeiro, atualiza em background
const cacheFirst = async (request, cacheName = RUNTIME) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    // Atualizar cache em background
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
      })
      .catch(() => {});
    return cached;
  }
  
  // Se não houver cache, buscar da rede
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return caches.match("/admin/offline");
  }
};

// Gerenciar fila de sincronização no IndexedDB (definir antes de usar)
async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("PWA_SYNC_DB", 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SYNC_QUEUE)) {
        const store = db.createObjectStore(SYNC_QUEUE, { keyPath: "id" });
        store.createIndex("queue", "queue", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

async function getSyncQueue(queueName) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction([SYNC_QUEUE], "readonly");
    const store = transaction.objectStore(SYNC_QUEUE);
    const index = store.index("queue");
    const request = index.getAll(queueName);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[SW Admin] Erro ao obter fila de sincronização:", error);
    return [];
  }
}

async function addToSyncQueue(queueName, action) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction([SYNC_QUEUE], "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE);
    
    const queueItem = {
      id: action.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      queue: queueName,
      ...action,
      timestamp: new Date().toISOString(),
      retries: 0
    };
    
    await new Promise((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Registrar sync tag para processamento
    if ("sync" in self.registration) {
      try {
        await self.registration.sync.register(`sync-${queueName}`);
      } catch (syncError) {
        console.warn("[SW Admin] Background Sync não disponível:", syncError);
      }
    }
  } catch (error) {
    console.error("[SW Admin] Erro ao adicionar à fila de sincronização:", error);
  }
}

async function removeFromSyncQueue(queueName, actionId) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction([SYNC_QUEUE], "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE);
    await store.delete(actionId);
  } catch (error) {
    console.error("[SW Admin] Erro ao remover da fila de sincronização:", error);
  }
}

async function updateSyncQueueItem(queueName, action) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction([SYNC_QUEUE], "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE);
    await store.put(action);
  } catch (error) {
    console.error("[SW Admin] Erro ao atualizar item da fila:", error);
  }
}

// Fetch event - interceptar requisições
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Evitar interferir em navegação do DevTools/Vite hot reload
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/@vite/") ||
    url.pathname.includes("webpack-hmr") ||
    url.pathname.includes("vite-hmr")
  ) {
    return;
  }

  // Apenas processar requisições da área admin
  if (!url.pathname.startsWith("/admin")) {
    return; // Deixar passar sem interceptar
  }

  // Interceptar requisições POST/PUT/DELETE para sincronização offline
  if (request.method !== "GET") {
    // Tentar fazer a requisição, se falhar, enfileirar
    event.respondWith(
      (async () => {
        try {
          // Tentar fazer a requisição normalmente
          const response = await fetch(request);
          return response;
        } catch (error) {
          // Se falhar (provavelmente offline), enfileirar para sincronização
          console.log("[SW Admin] Requisição falhou, enfileirando para sincronização:", request.url);
          
          try {
            const clonedRequest = request.clone();
            const body = await clonedRequest.json().catch(() => null);
            
            const action = {
              method: request.method,
              url: request.url,
              headers: Object.fromEntries(request.headers.entries()),
              body: body
            };

            // Determinar fila baseada na URL
            let queueName = "default";
            if (url.pathname.includes("/orders")) queueName = "orders";
            else if (url.pathname.includes("/lyrics")) queueName = "lyrics";
            else if (url.pathname.includes("/songs")) queueName = "songs";
            else if (url.pathname.includes("/releases")) queueName = "releases";

            await addToSyncQueue(queueName, action);

            // Retornar resposta de sucesso (ação será sincronizada depois)
            return new Response(
              JSON.stringify({ 
                success: true, 
                queued: true, 
                message: "Ação será sincronizada quando a conexão for restaurada" 
              }),
              {
                status: 202,
                headers: { "Content-Type": "application/json" }
              }
            );
          } catch (queueError) {
            console.error("[SW Admin] Erro ao enfileirar ação:", queueError);
            return new Response(
              JSON.stringify({ error: "Erro ao enfileirar ação" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        }
      })()
    );
    return;
  }

  // Ignorar requisições de WebSocket
  if (url.protocol === "ws:" || url.protocol === "wss:") {
    return;
  }

  // HTML: Network First com fallback para cache e página offline
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Fontes: Cache First (raramente mudam, melhor performance)
  if (request.destination === "font") {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Imagens: Stale-While-Revalidate (mostra cache rápido, atualiza em background)
  if (request.destination === "image") {
    event.respondWith(swr(request));
    return;
  }

  // APIs GET: Network First com fallback inteligente
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase.co")) {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(request);
          if (net.ok) {
            const cache = await caches.open(RUNTIME);
            // Cachear apenas respostas de sucesso
            cache.put(request, net.clone());
          }
          return net;
        } catch (error) {
          // Tentar cache primeiro
          const cached = await caches.match(request);
          if (cached) {
            // Verificar se cache não está muito antigo (opcional: 5 minutos)
            const cacheDate = cached.headers.get("sw-cached-date");
            if (cacheDate) {
              const age = Date.now() - parseInt(cacheDate);
              if (age < 5 * 60 * 1000) { // 5 minutos
                return cached;
              }
            } else {
              return cached;
            }
          }
          // Retornar resposta JSON indicando offline
          return new Response(
            JSON.stringify({ 
              offline: true, 
              error: "Sem conexão",
              cached: false 
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      })()
    );
    return;
  }

  // CSS, JS e outros assets estáticos: Cache First (mudam raramente)
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // JSON e dados: Network First
  if (
    request.destination === "json" ||
    url.pathname.endsWith(".json") ||
    request.headers.get("accept")?.includes("application/json")
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Demais requisições: Stale-While-Revalidate padrão
  event.respondWith(swr(request));
});

// Message event - comunicação com a página
self.addEventListener("message", async (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;

    case "CACHE_URLS":
      event.waitUntil(
        caches.open(PRECACHE).then((cache) => {
          return cache.addAll(data.urls || []);
        })
      );
      break;

    case "GET_VERSION":
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ version: VERSION });
      }
      break;

    case "QUEUE_SYNC":
      // Adicionar ação à fila de sincronização
      await addToSyncQueue(data.queue || "default", data.action);
      // Responder ao cliente
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, queued: true });
      }
      break;

    case "GET_SYNC_QUEUE":
      // Obter fila de sincronização
      const queue = await getSyncQueue(data.queue || "default");
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ queue });
      }
      break;

    case "CLEAR_CACHE":
      // Limpar cache específico
      event.waitUntil(
        caches.delete(data.cacheName || RUNTIME).then((deleted) => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ deleted });
          }
        })
      );
      break;

    case "UPDATE_AVAILABLE":
      // Notificar sobre atualização disponível
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({ type: "UPDATE_AVAILABLE", version: VERSION });
      });
      break;

    default:
      console.log("[SW Admin] Mensagem desconhecida:", type);
  }
});

// Background Sync - Sincronização de ações offline
self.addEventListener("sync", async (event) => {
  console.log("[SW Admin] Background sync triggered:", event.tag);
  
  if (event.tag.startsWith("sync-")) {
    event.waitUntil(processSyncQueue(event.tag));
  } else if (event.tag === "sync-all") {
    event.waitUntil(syncAllPendingActions());
  }
});

// Processar fila de sincronização específica
async function processSyncQueue(tag) {
  try {
    const queueName = tag.replace("sync-", "");
    const queue = await getSyncQueue(queueName);
    
    if (!queue || queue.length === 0) {
      console.log(`[SW Admin] Nenhuma ação pendente na fila: ${queueName}`);
      return;
    }

    console.log(`[SW Admin] Processando ${queue.length} ações da fila: ${queueName}`);
    
    const results = [];
    for (const action of queue) {
      try {
        const result = await syncAction(action);
        results.push({ success: true, action, result });
        // Remover ação sincronizada com sucesso
        await removeFromSyncQueue(queueName, action.id);
      } catch (error) {
        console.error(`[SW Admin] Erro ao sincronizar ação ${action.id}:`, error);
        results.push({ success: false, action, error: error.message });
        // Incrementar tentativas
        action.retries = (action.retries || 0) + 1;
        if (action.retries < 5) {
          // Manter na fila para retry
          await updateSyncQueueItem(queueName, action);
        } else {
          // Remover após muitas tentativas
          console.warn(`[SW Admin] Removendo ação ${action.id} após ${action.retries} tentativas`);
          await removeFromSyncQueue(queueName, action.id);
        }
      }
    }

    console.log(`[SW Admin] Sincronização concluída: ${results.filter(r => r.success).length}/${results.length} sucessos`);
    
    // Notificar clientes sobre sincronização
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: "SYNC_COMPLETE",
        queue: queueName,
        results: results.length,
        successes: results.filter(r => r.success).length
      });
    });
  } catch (error) {
    console.error("[SW Admin] Erro ao processar fila de sincronização:", error);
  }
}

// Sincronizar todas as ações pendentes
async function syncAllPendingActions() {
  try {
    const db = await openIndexedDB();
    const objectStore = db.transaction([SYNC_QUEUE], "readonly").objectStore(SYNC_QUEUE);
    const queues = await objectStore.getAllKeys();
    
    for (const queueName of queues) {
      await processSyncQueue(`sync-${queueName}`);
    }
  } catch (error) {
    console.error("[SW Admin] Erro ao sincronizar todas as ações:", error);
  }
}

// Sincronizar uma ação individual
async function syncAction(action) {
  const { method, url, body, headers } = action;
  
  const fetchOptions = {
    method,
    headers: headers || {},
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json().catch(() => response.text());
}

// Push Notifications - Sistema completo de notificações
self.addEventListener("push", (event) => {
  console.log("[SW Admin] Push notification received");
  
  let notificationData = {
    title: "MusicLovely Admin",
    body: "Nova notificação",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "default",
    data: {},
    requireInteraction: false,
    silent: false
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        data: data.data || notificationData.data,
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        actions: data.actions || [],
        image: data.image,
        timestamp: data.timestamp || Date.now()
      };
    } catch (error) {
      console.error("[SW Admin] Erro ao processar dados de push:", error);
      // Usar dados como texto se não for JSON
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    requireInteraction: notificationData.requireInteraction,
    silent: notificationData.silent,
    vibrate: [200, 100, 200],
    timestamp: notificationData.timestamp
  };

  // Adicionar ações se disponíveis
  if (notificationData.actions && notificationData.actions.length > 0) {
    options.actions = notificationData.actions;
  }

  // Adicionar imagem se disponível
  if (notificationData.image) {
    options.image = notificationData.image;
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification Click - Abrir página relevante
self.addEventListener("notificationclick", (event) => {
  console.log("[SW Admin] Notification clicked:", event.notification.tag);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || "/admin";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Verificar se já existe uma janela aberta
      for (const client of clientList) {
        if (client.url.includes("/admin") && "focus" in client) {
          return client.focus().then(() => {
            // Navegar para URL específica se necessário
            if (notificationData.url && !client.url.includes(notificationData.url)) {
              return client.navigate(notificationData.url);
            }
          });
        }
      }
      
      // Abrir nova janela se não houver nenhuma aberta
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification Close - Tracking
self.addEventListener("notificationclose", (event) => {
  console.log("[SW Admin] Notification closed:", event.notification.tag);
  
  // Opcional: Enviar métrica de fechamento
  const clients = self.clients.matchAll();
  clients.then(clientList => {
    clientList.forEach(client => {
      client.postMessage({
        type: "NOTIFICATION_CLOSED",
        tag: event.notification.tag,
        data: event.notification.data
      });
    });
  });
});
