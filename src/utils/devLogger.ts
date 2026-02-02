/**
 * Utilitário para logs condicionais - apenas em desenvolvimento
 * Evita poluição do console em produção
 */

const isDev = import.meta.env.DEV;
const isVerbose = import.meta.env.VITE_VERBOSE_LOGGING === 'true';
// ✅ Por padrão, não emitir nada no console (especialmente em dev).
// Só habilite se você realmente precisar depurar.
const allowConsole = import.meta.env.VITE_ALLOW_CONSOLE === 'true';
const devMetricsEnabled = import.meta.env.VITE_DEV_METRICS === 'true';
const devMetricsEndpoint = import.meta.env.VITE_DEV_METRICS_ENDPOINT;

type DevMetricsEvent = {
  event: string;
  timestamp: number;
  data?: unknown;
  location?: string;
};

function toNonLocalHttpUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input, typeof window !== 'undefined' ? window.location.origin : undefined);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') return null;
  return url;
}

export const trackDevEvent = (event: string, data?: unknown, location?: string) => {
  if (!isDev || !devMetricsEnabled) return;
  if (typeof window === 'undefined') return;

  const payload: DevMetricsEvent = {
    event,
    timestamp: Date.now(),
    data,
    location,
  };

  window.__DEV_METRICS__ ||= [];
  window.__DEV_METRICS__.push(payload);

  if (allowConsole && isVerbose) {
    console.debug('[DevMetrics]', payload);
  }

  if (!devMetricsEndpoint) return;

  const url = toNonLocalHttpUrl(devMetricsEndpoint);
  if (!url) return;

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url.toString(), blob);
    return;
  }

  fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
};

export const devLog = {
  /**
   * Log informativo - apenas em desenvolvimento verbose
   */
  info: (...args: any[]) => {
    if (isDev && allowConsole && isVerbose) {
      console.log(...args);
    }
  },

  /**
   * Log de warning - apenas em desenvolvimento
   */
  warn: (...args: any[]) => {
    if (isDev && allowConsole) {
      console.warn(...args);
    }
  },

  /**
   * Log de erro - sempre mostrar, mas com contexto
   */
  error: (...args: any[]) => {
    if (isDev) {
      if (!allowConsole) return;
      console.error(...args);
    } else {
      // Em produção, logar apenas o essencial
      console.error('[Error]', args[0]);
    }
  },

  /**
   * Log de debug - apenas em desenvolvimento verbose
   */
  debug: (...args: any[]) => {
    if (isDev && allowConsole && isVerbose) {
      console.debug(...args);
    }
  },

  /**
   * Log de sucesso - apenas em desenvolvimento verbose
   */
  success: (...args: any[]) => {
    if (isDev && allowConsole && isVerbose) {
      console.log(...args);
    }
  },
};

/**
 * Helper para logs de performance - apenas em desenvolvimento verbose
 */
export const perfLog = (label: string, startTime: number) => {
  if (isDev && allowConsole && isVerbose) {
    const duration = Date.now() - startTime;
    console.log(`⏱️ [Performance] ${label}: ${duration}ms`);
  }
};

/**
 * Helper para logs de tracking - apenas em desenvolvimento verbose
 */
export const trackingLog = (event: string, data?: any) => {
  if (isDev && allowConsole && isVerbose) {
    console.log(`📊 [Tracking] ${event}`, data || '');
  }
};

/**
 * Helper para logs de tradução - apenas em desenvolvimento verbose
 */
export const i18nLog = (message: string, data?: any) => {
  if (isDev && allowConsole && isVerbose) {
    console.log(`🌍 [i18n] ${message}`, data || '');
  }
};

/**
 * Helper para logs de áudio/música - apenas em desenvolvimento verbose
 */
export const audioLog = (message: string, data?: any) => {
  if (isDev && allowConsole && isVerbose) {
    console.log(`🎵 [Audio] ${message}`, data || '');
  }
};

