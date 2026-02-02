import { useEffect, useState, useCallback } from "react";
import { pushService, PushSubscriptionData } from "@/services/pushService";

export interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  subscription: PushSubscriptionData | null;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: pushService.isSupported(),
    permission: "default",
    isSubscribed: false,
    subscription: null,
    isLoading: false,
    error: null,
  });

  /**
   * Atualizar estado da subscription
   */
  const updateSubscriptionState = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const permission = await pushService.getPermission();
      const subscription = await pushService.getSubscription();
      const subscriptionData = subscription
        ? await pushService.getSubscriptionData()
        : null;

      setState((prev) => ({
        ...prev,
        permission,
        isSubscribed: !!subscription,
        subscription: subscriptionData,
        isLoading: false,
      }));
    } catch (error) {
      console.error("[usePushNotifications] Erro ao atualizar estado:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        isLoading: false,
      }));
    }
  }, []);

  /**
   * Solicitar permissão e criar subscription
   */
  const subscribe = useCallback(
    async (applicationServerKey?: string | Uint8Array, userId?: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // Solicitar permissão
        const permission = await pushService.requestPermission();
        if (permission !== "granted") {
          setState((prev) => ({
            ...prev,
            permission,
            isLoading: false,
            error: "Permissão de notificação negada",
          }));
          return false;
        }

        // Criar subscription
        await pushService.subscribe(applicationServerKey);
        const subscriptionData = await pushService.getSubscriptionData();

        if (subscriptionData) {
          // Enviar para backend (opcional)
          await pushService.sendSubscriptionToBackend(subscriptionData, userId);
        }

        await updateSubscriptionState();
        return true;
      } catch (error) {
        console.error("[usePushNotifications] Erro ao criar subscription:", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Erro ao criar subscription",
          isLoading: false,
        }));
        return false;
      }
    },
    [updateSubscriptionState]
  );

  /**
   * Cancelar subscription
   */
  const unsubscribe = useCallback(
    async (userId?: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const subscription = await pushService.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await pushService.unsubscribe();
          await pushService.removeSubscriptionFromBackend(endpoint, userId);
        }

        await updateSubscriptionState();
        return true;
      } catch (error) {
        console.error("[usePushNotifications] Erro ao cancelar subscription:", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Erro ao cancelar subscription",
          isLoading: false,
        }));
        return false;
      }
    },
    [updateSubscriptionState]
  );

  /**
   * Testar notificação
   */
  const testNotification = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      await pushService.testNotification();
    } catch (error) {
      console.error("[usePushNotifications] Erro ao testar notificação:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Erro ao testar notificação",
      }));
    }
  }, []);

  /**
   * Inicializar e atualizar estado
   */
  useEffect(() => {
    if (!state.isSupported) {
      return;
    }

    updateSubscriptionState();

    // Escutar mudanças de permissão
    if ("Notification" in window) {
      const checkPermission = () => {
        setState((prev) => ({
          ...prev,
          permission: Notification.permission,
        }));
      };

      // Verificar permissão periodicamente (alguns navegadores não têm evento)
      const interval = setInterval(checkPermission, 5000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [state.isSupported, updateSubscriptionState]);

  /**
   * Escutar cliques em notificações
   */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Nota: notificationclick é tratado no service worker
    // Este listener é apenas para tracking/logging se necessário
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "NOTIFICATION_CLICKED") {
        console.log("[usePushNotifications] Notificação clicada via message:", event.data);
      }
    });
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    testNotification,
    refresh: updateSubscriptionState,
  };
}


