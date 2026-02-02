/**
 * Utilitários protegidos para tracking do Meta Pixel
 * Protege contra crashes quando o pixel está bloqueado ou não carregou
 */

/**
 * Verifica se o Meta Pixel (fbq) está disponível
 */
export function isFbqAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 
           typeof (window as any).fbq === 'function';
  } catch {
    return false;
  }
}

/**
 * Rastreia evento de Lead de forma segura
 * @param eventData - Dados opcionais do evento
 * @returns true se o evento foi rastreado com sucesso, false caso contrário
 */
export function safeTrackLead(eventData?: Record<string, unknown>): boolean {
  try {
    if (!isFbqAvailable()) {
      if (import.meta.env.DEV) {
        console.debug('[Pixel] fbq não disponível - Lead não rastreado');
      }
      return false;
    }

    const fbq = (window as any).fbq;
    if (eventData) {
      fbq('track', 'Lead', eventData);
    } else {
      fbq('track', 'Lead');
    }
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Pixel] Erro ao rastrear Lead:', error);
    }
    return false;
  }
}

/**
 * Rastreia evento de AddToCart de forma segura
 * @param eventData - Dados opcionais do evento (ex: { value: 1 })
 * @returns true se o evento foi rastreado com sucesso, false caso contrário
 */
export function safeTrackAddToCart(eventData?: Record<string, unknown>): boolean {
  try {
    if (!isFbqAvailable()) {
      if (import.meta.env.DEV) {
        console.debug('[Pixel] fbq não disponível - AddToCart não rastreado');
      }
      return false;
    }

    const fbq = (window as any).fbq;
    const defaultData = { value: 1, currency: 'BRL' };
    const finalData = eventData ? { ...defaultData, ...eventData } : defaultData;
    
    fbq('track', 'AddToCart', finalData);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Pixel] Erro ao rastrear AddToCart:', error);
    }
    return false;
  }
}

/**
 * Rastreia evento de InitiateCheckout de forma segura
 * @param eventData - Dados opcionais do evento
 * @returns true se o evento foi rastreado com sucesso, false caso contrário
 */
export function safeTrackCheckout(eventData?: Record<string, unknown>): boolean {
  try {
    if (!isFbqAvailable()) {
      if (import.meta.env.DEV) {
        console.debug('[Pixel] fbq não disponível - InitiateCheckout não rastreado');
      }
      return false;
    }

    const fbq = (window as any).fbq;
    if (eventData) {
      fbq('track', 'InitiateCheckout', eventData);
    } else {
      fbq('track', 'InitiateCheckout');
    }
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Pixel] Erro ao rastrear InitiateCheckout:', error);
    }
    return false;
  }
}

/**
 * Rastreia evento de Purchase de forma segura
 * @param eventData - Dados do evento (deve incluir value e currency)
 * @returns true se o evento foi rastreado com sucesso, false caso contrário
 */
export function safeTrackPurchase(eventData: { value: number; currency: string; [key: string]: unknown }): boolean {
  try {
    if (!isFbqAvailable()) {
      if (import.meta.env.DEV) {
        console.debug('[Pixel] fbq não disponível - Purchase não rastreado');
      }
      return false;
    }

    const fbq = (window as any).fbq;
    fbq('track', 'Purchase', eventData);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Pixel] Erro ao rastrear Purchase:', error);
    }
    return false;
  }
}

/**
 * Função genérica para rastrear qualquer evento do Meta Pixel de forma segura
 * @param eventName - Nome do evento (ex: 'Lead', 'AddToCart', 'InitiateCheckout')
 * @param eventData - Dados opcionais do evento
 * @returns true se o evento foi rastreado com sucesso, false caso contrário
 */
export function safeTrackEvent(eventName: string, eventData?: Record<string, unknown>): boolean {
  try {
    if (!isFbqAvailable()) {
      if (import.meta.env.DEV) {
        console.debug(`[Pixel] fbq não disponível - ${eventName} não rastreado`);
      }
      return false;
    }

    const fbq = (window as any).fbq;
    if (eventData) {
      fbq('track', eventName, eventData);
    } else {
      fbq('track', eventName);
    }
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[Pixel] Erro ao rastrear ${eventName}:`, error);
    }
    return false;
  }
}

/**
 * Executa função de tracking de forma segura, garantindo que erros não quebrem o código
 * @param trackingFunction - Função de tracking a ser executada
 * @returns true se executou sem erros, false caso contrário
 */
export function safeExecuteTracking(trackingFunction: () => void): boolean {
  try {
    trackingFunction();
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[Pixel] Erro ao executar função de tracking:', error);
    }
    return false;
  }
}



