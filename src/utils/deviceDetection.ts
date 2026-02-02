/**
 * Utilitário para detecção de dispositivo e conexão
 * Usado para otimizar carregamento em mobile e conexões lentas
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSlowConnection: boolean;
  connectionType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
}

let cachedDeviceInfo: DeviceInfo | null = null;

/**
 * Detecta se o dispositivo é mobile
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Verificar user agent
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  
  // Verificar largura da tela (mobile geralmente < 768px)
  const isSmallScreen = window.innerWidth < 768;
  
  // Verificar touch support
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return mobileRegex.test(userAgent) || (isSmallScreen && hasTouchSupport);
}

/**
 * Detecta se o dispositivo é tablet
 */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const tabletRegex = /ipad|android(?!.*mobile)|tablet/i;
  const isTabletScreen = window.innerWidth >= 768 && window.innerWidth < 1024;
  
  return tabletRegex.test(userAgent) || isTabletScreen;
}

/**
 * Detecta tipo de conexão usando Network Information API
 */
export function getConnectionType(): 'slow-2g' | '2g' | '3g' | '4g' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';
  
  // Network Information API (suportado em Chrome/Edge mobile)
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;
  
  if (connection) {
    const effectiveType = connection.effectiveType;
    const downlink = connection.downlink;
    
    if (effectiveType) {
      if (effectiveType === 'slow-2g' || effectiveType === '2g') return '2g';
      if (effectiveType === '3g') return '3g';
      if (effectiveType === '4g') return '4g';
    }
    
    // Fallback para downlink speed
    if (downlink !== undefined) {
      if (downlink < 0.5) return 'slow-2g';
      if (downlink < 1.5) return '2g';
      if (downlink < 3) return '3g';
      return '4g';
    }
  }
  
  // Fallback: assumir conexão lenta se for mobile (mais conservador)
  if (isMobileDevice()) {
    return '3g'; // Assumir 3G em mobile por padrão
  }
  
  return 'unknown';
}

/**
 * Detecta se a conexão é lenta
 */
export function isSlowConnection(): boolean {
  const connectionType = getConnectionType();
  return connectionType === 'slow-2g' || connectionType === '2g' || connectionType === '3g';
}

/**
 * Obtém informações completas do dispositivo (com cache)
 * ✅ OTIMIZAÇÃO MOBILE: Com tratamento de erro para evitar crashes
 */
export function getDeviceInfo(): DeviceInfo {
  if (cachedDeviceInfo) {
    return cachedDeviceInfo;
  }
  
  try {
    const isMobile = isMobileDevice();
    const isTablet = isTabletDevice();
    const isDesktop = !isMobile && !isTablet;
    const connectionType = getConnectionType();
    const isSlow = isSlowConnection();
    
    cachedDeviceInfo = {
      isMobile,
      isTablet,
      isDesktop,
      isSlowConnection: isSlow,
      connectionType
    };
    
    return cachedDeviceInfo;
  } catch (error) {
    // ✅ OTIMIZAÇÃO MOBILE: Fallback seguro em caso de erro
    console.warn('⚠️ [DeviceDetection] Erro ao detectar dispositivo, usando fallback:', error);
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isSlowConnection: false,
      connectionType: 'unknown'
    };
  }
}

/**
 * Limpa o cache de informações do dispositivo
 * Útil quando a orientação ou conexão muda
 */
export function clearDeviceInfoCache(): void {
  cachedDeviceInfo = null;
}

/**
 * Obtém timeout otimizado baseado no dispositivo e conexão
 */
export function getOptimizedTimeout(baseTimeout: number): number {
  const deviceInfo = getDeviceInfo();
  
  if (deviceInfo.isSlowConnection) {
    // Reduzir timeout em conexões lentas
    return Math.min(baseTimeout, 3000);
  }
  
  if (deviceInfo.isMobile) {
    // Reduzir timeout em mobile
    return Math.min(baseTimeout, 5000);
  }
  
  return baseTimeout;
}

/**
 * Obtém número de retries otimizado baseado no dispositivo
 */
export function getOptimizedRetries(baseRetries: number): number {
  const deviceInfo = getDeviceInfo();
  
  if (deviceInfo.isSlowConnection) {
    // Reduzir retries em conexões lentas
    return Math.max(1, baseRetries - 1);
  }
  
  if (deviceInfo.isMobile) {
    // Reduzir retries em mobile
    return Math.max(1, baseRetries - 1);
  }
  
  return baseRetries;
}

/**
 * Obtém delay entre retries otimizado baseado no dispositivo
 */
export function getOptimizedRetryDelay(baseDelay: number): number {
  const deviceInfo = getDeviceInfo();
  
  if (deviceInfo.isSlowConnection) {
    // Reduzir delay em conexões lentas (tentar mais rápido)
    return Math.max(300, baseDelay - 200);
  }
  
  if (deviceInfo.isMobile) {
    // Reduzir delay em mobile
    return Math.max(400, baseDelay - 300);
  }
  
  return baseDelay;
}

