import type { Locale } from './detectLocale';

interface LanguageEvent {
  locale: Locale;
  source: 'detection' | 'manual' | 'url' | 'cookie';
  timestamp: number;
  userAgent?: string;
  country?: string;
  path?: string;
}

interface AnalyticsConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize: number;
  flushInterval: number;
  debug: boolean;
}

class LanguageAnalytics {
  private events: LanguageEvent[] = [];
  private config: AnalyticsConfig;
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enabled: true,
      batchSize: 10,
      flushInterval: 30000, // 30 segundos
      debug: false,
      ...config
    };

    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Registra um evento de idioma
   */
  trackLanguageUsage(locale: Locale, source: LanguageEvent['source'], metadata?: {
    userAgent?: string;
    country?: string;
    path?: string;
  }): void {
    if (!this.config.enabled) return;

    const event: LanguageEvent = {
      locale,
      source,
      timestamp: Date.now(),
      ...metadata
    };

    this.events.push(event);

    if (this.config.debug) {
      console.log('📊 [LanguageAnalytics] Evento registrado:', event);
    }

    // Flush se atingir o tamanho do batch
    if (this.events.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Registra detecção automática de idioma
   */
  trackAutoDetection(locale: Locale, country?: string): void {
    this.trackLanguageUsage(locale, 'detection', {
      country,
      userAgent: navigator.userAgent
    });
  }

  /**
   * Registra troca manual de idioma
   */
  trackManualChange(locale: Locale, fromPath?: string): void {
    this.trackLanguageUsage(locale, 'manual', {
      path: fromPath,
      userAgent: navigator.userAgent
    });
  }

  /**
   * Registra acesso via URL com prefixo
   */
  trackUrlAccess(locale: Locale, path: string): void {
    this.trackLanguageUsage(locale, 'url', {
      path,
      userAgent: navigator.userAgent
    });
  }

  /**
   * Registra uso de cookie salvo
   */
  trackCookieUsage(locale: Locale): void {
    this.trackLanguageUsage(locale, 'cookie', {
      userAgent: navigator.userAgent
    });
  }

  /**
   * Envia eventos para o servidor
   */
  private async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      if (this.config.endpoint) {
        await this.sendToServer(eventsToSend);
      } else {
        // Salvar localmente para análise
        this.saveLocally(eventsToSend);
      }

      if (this.config.debug) {
        console.log('📊 [LanguageAnalytics] Eventos enviados:', eventsToSend.length);
      }
    } catch (error) {
      console.error('❌ [LanguageAnalytics] Erro ao enviar eventos:', error);
      // Recolocar eventos na fila em caso de erro
      this.events.unshift(...eventsToSend);
    }
  }

  /**
   * Envia eventos para servidor
   */
  private async sendToServer(events: LanguageEvent[]): Promise<void> {
    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events,
        timestamp: Date.now(),
        sessionId: this.getSessionId()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Salva eventos localmente
   */
  private saveLocally(events: LanguageEvent[]): void {
    try {
      const existing = JSON.parse(localStorage.getItem('language_analytics') || '[]');
      const updated = [...existing, ...events];
      
      // Manter apenas os últimos 1000 eventos
      const trimmed = updated.slice(-1000);
      
      localStorage.setItem('language_analytics', JSON.stringify(trimmed));
      
      if (this.config.debug) {
        console.log('📊 [LanguageAnalytics] Eventos salvos localmente:', events.length);
      }
    } catch (error) {
      console.error('❌ [LanguageAnalytics] Erro ao salvar localmente:', error);
    }
  }

  /**
   * Inicia timer para flush automático
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Para o timer de flush
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Obtém estatísticas dos eventos
   */
  getStats(): {
    totalEvents: number;
    byLocale: Record<Locale, number>;
    bySource: Record<string, number>;
    recentEvents: LanguageEvent[];
  } {
    const allEvents = this.getStoredEvents();
    
    const byLocale = allEvents.reduce((acc, event) => {
      acc[event.locale] = (acc[event.locale] || 0) + 1;
      return acc;
    }, {} as Record<Locale, number>);

    const bySource = allEvents.reduce((acc, event) => {
      acc[event.source] = (acc[event.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents: allEvents.length,
      byLocale,
      bySource,
      recentEvents: allEvents.slice(-10)
    };
  }

  /**
   * Obtém eventos armazenados
   */
  private getStoredEvents(): LanguageEvent[] {
    try {
      return JSON.parse(localStorage.getItem('language_analytics') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Gera ID de sessão único
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('language_analytics_session');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('language_analytics_session', sessionId);
    }
    return sessionId;
  }

  /**
   * Limpa dados de analytics
   */
  clear(): void {
    this.events = [];
    localStorage.removeItem('language_analytics');
    sessionStorage.removeItem('language_analytics_session');
    this.stopFlushTimer();
    console.log('📊 [LanguageAnalytics] Dados limpos');
  }

  /**
   * Destrói a instância
   */
  destroy(): void {
    this.flush(); // Enviar eventos pendentes
    this.stopFlushTimer();
  }
}

// Instância singleton
export const languageAnalytics = new LanguageAnalytics({
  enabled: true,
  debug: true, // Habilitar em desenvolvimento
  batchSize: 5,
  flushInterval: 15000 // 15 segundos
});

export default languageAnalytics;


