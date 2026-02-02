/**
 * Serviço de Push Notifications
 * Gerencia subscriptions e comunicação com service worker
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class PushService {
  private subscription: PushSubscription | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  /**
   * Inicializar service worker
   */
  async initialize(): Promise<ServiceWorkerRegistration> {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker não suportado");
    }

    if (!("PushManager" in window)) {
      throw new Error("Push Notifications não suportado");
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      return this.registration;
    } catch (error) {
      console.error("[PushService] Erro ao inicializar service worker:", error);
      throw error;
    }
  }

  /**
   * Verificar se push notifications são suportados
   */
  isSupported(): boolean {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  /**
   * Verificar permissão atual
   */
  async getPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      return "denied";
    }
    return Notification.permission;
  }

  /**
   * Solicitar permissão de notificações
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      throw new Error("Notifications não suportado");
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Obter subscription atual
   */
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.initialize();
    }

    if (!this.registration) {
      return null;
    }

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      return this.subscription;
    } catch (error) {
      console.error("[PushService] Erro ao obter subscription:", error);
      return null;
    }
  }

  /**
   * Criar nova subscription
   */
  async subscribe(
    applicationServerKey?: string | Uint8Array
  ): Promise<PushSubscription> {
    if (!this.registration) {
      await this.initialize();
    }

    if (!this.registration) {
      throw new Error("Service Worker não disponível");
    }

    try {
      // Verificar se já existe subscription
      const existingSubscription = await this.getSubscription();
      if (existingSubscription) {
        this.subscription = existingSubscription;
        return existingSubscription;
      }

      // Criar nova subscription
      const options: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };

      if (applicationServerKey) {
        options.applicationServerKey =
          typeof applicationServerKey === "string"
            ? this.base64UrlToUint8Array(applicationServerKey)
            : this.toArrayBufferUint8Array(applicationServerKey);
      }

      this.subscription = await this.registration.pushManager.subscribe(options);
      console.log("[PushService] Subscription criada:", this.subscription.endpoint);
      return this.subscription;
    } catch (error) {
      console.error("[PushService] Erro ao criar subscription:", error);
      throw error;
    }
  }

  /**
   * Cancelar subscription
   */
  async unsubscribe(): Promise<boolean> {
    const subscription = await this.getSubscription();
    if (!subscription) {
      return false;
    }

    try {
      const result = await subscription.unsubscribe();
      if (result) {
        this.subscription = null;
        console.log("[PushService] Subscription cancelada");
      }
      return result;
    } catch (error) {
      console.error("[PushService] Erro ao cancelar subscription:", error);
      return false;
    }
  }

  /**
   * Obter subscription data para enviar ao backend
   */
  async getSubscriptionData(): Promise<PushSubscriptionData | null> {
    const subscription = await this.getSubscription();
    if (!subscription) {
      return null;
    }

    const key = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");

    if (!key || !auth) {
      return null;
    }

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(key),
        auth: this.arrayBufferToBase64(auth),
      },
    };
  }

  /**
   * Converter ArrayBuffer para Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private toArrayBufferUint8Array(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
    const buffer = new ArrayBuffer(bytes.byteLength);
    const output = new Uint8Array(buffer);
    output.set(bytes);
    return output;
  }

  /**
   * Enviar subscription para o backend
   * Nota: Implementar endpoint no backend para receber subscriptions
   */
  async sendSubscriptionToBackend(
    subscriptionData: PushSubscriptionData,
    _userId?: string
  ): Promise<boolean> {
    try {
      // TODO: Implementar chamada para API do backend
      // Exemplo:
      // const response = await fetch('/api/push/subscribe', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ subscription: subscriptionData, userId })
      // });
      // return response.ok;

      console.log("[PushService] Subscription data:", subscriptionData);
      console.warn(
        "[PushService] Envio para backend não implementado. Implementar endpoint /api/push/subscribe"
      );
      return false;
    } catch (error) {
      console.error("[PushService] Erro ao enviar subscription:", error);
      return false;
    }
  }

  /**
   * Remover subscription do backend
   */
  async removeSubscriptionFromBackend(
    endpoint: string,
    _userId?: string
  ): Promise<boolean> {
    try {
      // TODO: Implementar chamada para API do backend
      // Exemplo:
      // const response = await fetch('/api/push/unsubscribe', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ endpoint, userId })
      // });
      // return response.ok;

      console.log("[PushService] Removendo subscription:", endpoint);
      console.warn(
        "[PushService] Remoção do backend não implementada. Implementar endpoint /api/push/unsubscribe"
      );
      return false;
    } catch (error) {
      console.error("[PushService] Erro ao remover subscription:", error);
      return false;
    }
  }

  /**
   * Testar notificação local
   */
  async testNotification(): Promise<void> {
    if (!this.registration) {
      await this.initialize();
    }

    if (!this.registration) {
      throw new Error("Service Worker não disponível");
    }

    const permission = await this.getPermission();
    if (permission !== "granted") {
      throw new Error("Permissão de notificação não concedida");
    }

    await this.registration.showNotification("Teste de Notificação", {
      body: "Esta é uma notificação de teste do MusicLovely Admin",
      icon: "/icon-admin-192.png",
      badge: "/icon-admin-192.png",
      tag: "test",
      requireInteraction: false,
    });
  }
}

// Exportar instância singleton
export const pushService = new PushService();


