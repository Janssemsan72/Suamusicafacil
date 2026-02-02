/**
 * ✅ FASE 3: Sistema de detecção robusto de navegador
 * Detecta versão exata, recursos disponíveis e limitações específicas
 */

export interface BrowserInfo {
  name: string;
  version: number;
  fullVersion: string;
  isMobile: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  androidVersion?: number;
  iosVersion?: number;
  isOldBrowser: boolean;
  isVeryOldBrowser: boolean;
  supportsES6: boolean;
  supportsModules: boolean;
  supportsServiceWorker: boolean;
  supportsLocalStorage: boolean;
  supportsFetch: boolean;
  supportsPromise: boolean;
  supportsCSSVariables: boolean;
  supportsFlexbox: boolean;
  supportsGrid: boolean;
  userAgent: string;
}

/**
 * Detecta informações completas do navegador
 */
export function detectBrowser(): BrowserInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  
  // Detectar versão do Android
  let androidVersion: number | undefined;
  if (isAndroid) {
    const match = ua.match(/android\s([0-9\.]*)/i);
    if (match && match[1]) {
      androidVersion = parseFloat(match[1]);
    }
  }
  
  // Detectar versão do iOS
  let iosVersion: number | undefined;
  if (isIOS) {
    const match = ua.match(/os\s([\d_]+)/i);
    if (match && match[1]) {
      iosVersion = parseFloat(match[1].replace(/_/g, '.'));
    }
  }
  
  // Detectar navegador
  let browserName = 'unknown';
  let browserVersion = 0;
  let fullVersion = '0';
  
  if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) {
    browserName = 'chrome';
    const match = ua.match(/chrome\/([\d\.]+)/i);
    if (match && match[1]) {
      fullVersion = match[1];
      browserVersion = parseFloat(match[1]);
    }
  } else if (/firefox/i.test(ua)) {
    browserName = 'firefox';
    const match = ua.match(/firefox\/([\d\.]+)/i);
    if (match && match[1]) {
      fullVersion = match[1];
      browserVersion = parseFloat(match[1]);
    }
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browserName = 'safari';
    const match = ua.match(/version\/([\d\.]+)/i);
    if (match && match[1]) {
      fullVersion = match[1];
      browserVersion = parseFloat(match[1]);
    }
  } else if (/edge|edg/i.test(ua)) {
    browserName = 'edge';
    const match = ua.match(/edge\/([\d\.]+)/i) || ua.match(/edg\/([\d\.]+)/i);
    if (match && match[1]) {
      fullVersion = match[1];
      browserVersion = parseFloat(match[1]);
    }
  } else if (/opera|opr/i.test(ua)) {
    browserName = 'opera';
    const match = ua.match(/(?:opera|opr)\/([\d\.]+)/i);
    if (match && match[1]) {
      fullVersion = match[1];
      browserVersion = parseFloat(match[1]);
    }
  } else if (/msie|trident/i.test(ua)) {
    browserName = 'ie';
    const match = ua.match(/(?:msie |rv:)([\d\.]+)/i);
    if (match && match[1]) {
      fullVersion = match[1];
      browserVersion = parseFloat(match[1]);
    }
  }
  
  // Detectar recursos disponíveis
  const supportsES6 = typeof Promise !== 'undefined' && typeof Symbol !== 'undefined';
  const supportsModules = 'noModule' in HTMLScriptElement.prototype;
  const supportsServiceWorker = 'serviceWorker' in navigator;
  const supportsLocalStorage = (() => {
    try {
      const test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  })();
  const supportsFetch = typeof fetch !== 'undefined';
  const supportsPromise = typeof Promise !== 'undefined';
  
  // Detectar suporte a CSS
  const supportsCSSVariables = (() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    try {
      return CSS.supports('color', 'var(--test)');
    } catch {
      // Fallback para navegadores antigos
      const el = document.createElement('div');
      el.style.setProperty('--test', '1');
      return el.style.getPropertyValue('--test') === '1';
    }
  })();
  
  const supportsFlexbox = (() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    try {
      return CSS.supports('display', 'flex');
    } catch {
      return true; // Assumir suporte se não conseguir verificar
    }
  })();
  
  const supportsGrid = (() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    try {
      return CSS.supports('display', 'grid');
    } catch {
      return false;
    }
  })();
  
  // Determinar se é navegador antigo
  const isOldBrowser = 
    (isAndroid && androidVersion !== undefined && androidVersion < 5) ||
    (isIOS && iosVersion !== undefined && iosVersion < 9) ||
    (browserName === 'ie' && browserVersion < 11) ||
    (browserName === 'chrome' && browserVersion < 30) ||
    (browserName === 'firefox' && browserVersion < 30) ||
    (browserName === 'safari' && browserVersion < 9) ||
    (browserName === 'edge' && browserVersion < 12) ||
    !supportsES6;
  
  const isVeryOldBrowser = 
    (isAndroid && androidVersion !== undefined && androidVersion < 4.4) ||
    (browserName === 'ie' && browserVersion < 10) ||
    !supportsPromise ||
    !supportsLocalStorage;
  
  return {
    name: browserName,
    version: browserVersion,
    fullVersion,
    isMobile,
    isAndroid,
    isIOS,
    androidVersion,
    iosVersion,
    isOldBrowser,
    isVeryOldBrowser,
    supportsES6,
    supportsModules,
    supportsServiceWorker,
    supportsLocalStorage,
    supportsFetch,
    supportsPromise,
    supportsCSSVariables,
    supportsFlexbox,
    supportsGrid,
    userAgent: ua
  };
}

/**
 * Detecta recursos disponíveis e retorna lista de limitações
 */
export function detectCapabilities(): {
  available: string[];
  missing: string[];
  limitations: string[];
} {
  const browser = detectBrowser();
  const available: string[] = [];
  const missing: string[] = [];
  const limitations: string[] = [];
  
  if (browser.supportsPromise) available.push('Promise');
  else missing.push('Promise');
  
  if (browser.supportsES6) available.push('ES6');
  else missing.push('ES6');
  
  if (browser.supportsModules) available.push('ES6 Modules');
  else missing.push('ES6 Modules');
  
  if (browser.supportsServiceWorker) available.push('Service Worker');
  else missing.push('Service Worker');
  
  if (browser.supportsLocalStorage) available.push('LocalStorage');
  else missing.push('LocalStorage');
  
  if (browser.supportsFetch) available.push('Fetch API');
  else missing.push('Fetch API');
  
  if (browser.supportsCSSVariables) available.push('CSS Variables');
  else missing.push('CSS Variables');
  
  if (browser.supportsFlexbox) available.push('Flexbox');
  else missing.push('Flexbox');
  
  if (browser.supportsGrid) available.push('CSS Grid');
  else missing.push('CSS Grid');
  
  // Adicionar limitações específicas
  if (browser.isVeryOldBrowser) {
    limitations.push('Navegador muito antigo - funcionalidades limitadas');
  }
  
  if (browser.isOldBrowser) {
    limitations.push('Navegador antigo - algumas funcionalidades podem não funcionar');
  }
  
  if (!browser.supportsModules) {
    limitations.push('Não suporta módulos ES6 - usando build legacy');
  }
  
  if (!browser.supportsServiceWorker) {
    limitations.push('Não suporta Service Worker - funcionalidade offline limitada');
  }
  
  if (!browser.supportsCSSVariables) {
    limitations.push('Não suporta CSS Variables - usando fallbacks');
  }
  
  return { available, missing, limitations };
}

/**
 * Determina qual build usar (moderno ou legacy)
 */
export function shouldUseLegacyBuild(): boolean {
  const browser = detectBrowser();
  return browser.isOldBrowser || !browser.supportsModules;
}

/**
 * Obtém mensagem de compatibilidade para o usuário
 */
export function getCompatibilityMessage(): string | null {
  const browser = detectBrowser();
  
  if (browser.isVeryOldBrowser) {
    return `Seu navegador (${browser.name} ${browser.fullVersion}) é muito antigo. Algumas funcionalidades podem não estar disponíveis. Recomendamos atualizar para uma versão mais recente.`;
  }
  
  if (browser.isOldBrowser) {
    return `Seu navegador (${browser.name} ${browser.fullVersion}) é antigo. Para melhor experiência, recomendamos atualizar.`;
  }
  
  return null;
}



