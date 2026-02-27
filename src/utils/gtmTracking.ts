/**
 * Utilitários para tracking via Google Tag Manager (dataLayer)
 * Seguem o mesmo padrão seguro do pixelTracking.ts
 */

type DataLayerEvent = {
  event: string;
  [key: string]: unknown;
};

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

function isDataLayerAvailable(): boolean {
  try {
    return typeof window !== "undefined" && Array.isArray(window.dataLayer);
  } catch {
    return false;
  }
}

function pushEvent(payload: DataLayerEvent): boolean {
  try {
    if (!isDataLayerAvailable()) {
      if (import.meta.env.DEV) {
        console.debug("[GTM] dataLayer não disponível -", payload.event);
      }
      return false;
    }
    window.dataLayer!.push(payload);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[GTM] Erro ao enviar evento:", error);
    }
    return false;
  }
}

/** Virtual pageview — simula navegação para o GTM em SPAs / modais */
export function gtmVirtualPageview(path: string, title?: string): boolean {
  return pushEvent({
    event: "virtual_pageview",
    page_path: path,
    page_title: title ?? document.title,
  });
}

/** Checkout modal aberto */
export function gtmCheckoutOpen(): boolean {
  return pushEvent({
    event: "checkout_open",
    page_path: "/checkout",
    page_title: "Checkout – Crie Sua Música",
  });
}

/** Step 1 concluído — detalhes do quiz enviados */
export function gtmQuizDetailsSubmit(data?: {
  style?: string;
  occasion?: string;
}): boolean {
  return pushEvent({
    event: "quiz_details_submit",
    quiz_step: 1,
    page_path: "/checkout/detalhes",
    ...data,
  });
}

/** Step 2 → 3 — letra aprovada, indo para pagamento */
export function gtmInitiatePayment(data?: {
  quiz_id?: string | null;
  order_id?: string | null;
}): boolean {
  return pushEvent({
    event: "initiate_payment",
    quiz_step: 3,
    page_path: "/checkout/pagamento",
    ...data,
  });
}

/** Letra gerada com sucesso */
export function gtmLyricsGenerated(): boolean {
  return pushEvent({
    event: "lyrics_generated",
    quiz_step: 2,
    page_path: "/checkout/letra",
  });
}

/** Evento genérico — para casos não cobertos acima */
export function gtmCustomEvent(
  eventName: string,
  data?: Record<string, unknown>,
): boolean {
  return pushEvent({ event: eventName, ...data });
}
