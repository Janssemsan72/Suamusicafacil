/**
 * Polyfills para compatibilidade com navegadores antigos
 * Garante que funcione em qualquer dispositivo
 */

// ✅ CORREÇÃO: Polyfill para Buffer (usado por algumas bibliotecas como Supabase)
// Buffer será definido globalmente - importar dinamicamente do pacote buffer
if (typeof window !== 'undefined' && typeof Buffer === 'undefined') {
  // Criar polyfill básico imediatamente (síncrono)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BufferPolyfill: any = {
    from: function(data: string | ArrayBuffer | Uint8Array, encoding?: string): Uint8Array {
      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        return encoder.encode(data);
      }
      if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
      }
      if (data instanceof Uint8Array) {
        return data;
      }
      return new Uint8Array(0);
    },
    isBuffer: function(obj: unknown): boolean {
      return obj instanceof Uint8Array || obj instanceof ArrayBuffer;
    },
    alloc: function(size: number): Uint8Array {
      return new Uint8Array(size);
    },
        concat: function(arrays: Uint8Array[]): Uint8Array {
          const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
          const result = new Uint8Array(totalLength);
          let offset = 0;
          for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
          }
          return result;
        },
        compare: function(a: Uint8Array | ArrayBuffer, b: Uint8Array | ArrayBuffer): number {
          // Comparar dois buffers/arrays
          if (!a || !b) {
            if (!a && !b) return 0;
            return !a ? -1 : 1;
          }
          const aArr = a instanceof Uint8Array ? a : new Uint8Array(a);
          const bArr = b instanceof Uint8Array ? b : new Uint8Array(b);
          const minLength = Math.min(aArr.length, bArr.length);
          for (let i = 0; i < minLength; i++) {
            if (aArr[i] < bArr[i]) return -1;
            if (aArr[i] > bArr[i]) return 1;
          }
          if (aArr.length < bArr.length) return -1;
          if (aArr.length > bArr.length) return 1;
          return 0;
        }
      };
  
  // Definir Buffer globalmente imediatamente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Buffer = BufferPolyfill;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Buffer = BufferPolyfill;
  
  // Tentar substituir pelo buffer real do npm quando disponível (assíncrono)
  import('buffer').then((bufferModule) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Buffer = bufferModule.Buffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Buffer = bufferModule.Buffer;
  }).catch(() => {
    // Se falhar, manter o polyfill básico
    // Já está definido acima
  });
}

// ✅ ANDROID ANTIGO: Polyfill para Promise (navegadores muito antigos)
// Nota: Promise é crítico - se não existir, a aplicação não funcionará
// Navegadores sem Promise são extremamente raros (Android 4.3 e anteriores)
if (typeof Promise === 'undefined') {
  console.error('[Polyfills] ❌ Promise não suportado - navegador muito antigo');
  // Promise é essencial, sem ele não podemos continuar
  // A mensagem de erro será mostrada no index.html
}

// ✅ FASE 9: Polyfill para Array.includes (IE11)
if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement: any, fromIndex?: number): boolean {
    const O = Object(this);
    const len = Number(O.length) || 0;
    if (len === 0) {
      return false;
    }
    const n = Number(fromIndex) || 0;
    let k = n >= 0 ? n : Math.max(len + n, 0);
    function sameValueZero(x: any, y: any): boolean {
      return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
    }
    for (; k < len; k++) {
      if (sameValueZero(O[k], searchElement)) {
        return true;
      }
    }
    return false;
  };
}

// ✅ FASE 9: Polyfill para Array.find (IE11)
if (!Array.prototype.find) {
  Array.prototype.find = function<T>(predicate: (value: T, index: number, obj: T[]) => boolean, thisArg?: any): T | undefined {
    if (this == null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    const list = Object(this);
    const length = Number(list.length) || 0;
    const thisArgValue = arguments[1];
    let value: T;

    for (let i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArgValue, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}

// ✅ FASE 9: Polyfill para String.includes (IE11)
if (!String.prototype.includes) {
  String.prototype.includes = function(search: string, start?: number): boolean {
    if (typeof start !== 'number') {
      start = 0;
    }
    if (start + search.length > this.length) {
      return false;
    } else {
      return this.indexOf(search, start) !== -1;
    }
  };
}

// ✅ FASE 9: Polyfill para String.startsWith (IE11)
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString: string, position?: number): boolean {
    position = position || 0;
    return this.substr(position, searchString.length) === searchString;
  };
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Polyfill para String.endsWith (IE11)
if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString: string, length?: number): boolean {
    if (typeof length === 'undefined' || length > this.length) {
      length = this.length;
    }
    return this.substring(length - searchString.length, length) === searchString;
  };
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Polyfill para Array.from() (IE11, Android antigo)
if (!Array.from) {
  Array.from = function<T>(arrayLike: ArrayLike<T> | Iterable<T>, mapFn?: (value: T, index: number) => any, thisArg?: any): any[] {
    const C = this;
    const items = Object(arrayLike);
    if (arrayLike == null) {
      throw new TypeError('Array.from requires an array-like object - not null or undefined');
    }
    const mapFunction = mapFn ? (typeof thisArg === 'undefined' ? mapFn : mapFn.bind(thisArg)) : undefined;
    const len = parseInt(items.length) || 0;
    const A = typeof C === 'function' ? Object(new C(len)) : new Array(len);
    let k = 0;
    let kValue;
    while (k < len) {
      kValue = items[k];
      if (mapFunction) {
        A[k] = typeof thisArg === 'undefined' ? mapFunction(kValue, k) : mapFunction.call(thisArg, kValue, k);
      } else {
        A[k] = kValue;
      }
      k += 1;
    }
    A.length = len;
    return A;
  };
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Polyfill para Array.findIndex() (IE11)
if (!Array.prototype.findIndex) {
  Array.prototype.findIndex = function<T>(predicate: (value: T, index: number, obj: T[]) => boolean, thisArg?: any): number {
    if (this == null) {
      throw new TypeError('Array.prototype.findIndex called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    const list = Object(this);
    const length = parseInt(list.length) || 0;
    const boundThis = arguments.length > 1 ? arguments[1] : undefined;
    let value: T;

    for (let i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(boundThis, value, i, list)) {
        return i;
      }
    }
    return -1;
  };
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Polyfill para Number.isNaN() (IE11)
if (!Number.isNaN) {
  Number.isNaN = function(value: any): boolean {
    return typeof value === 'number' && isNaN(value);
  };
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Polyfill para Number.isFinite() (IE11)
if (!Number.isFinite) {
  Number.isFinite = function(value: any): boolean {
    return typeof value === 'number' && isFinite(value);
  };
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Polyfill para Element.closest() (Android 4.x)
if (!Element.prototype.closest) {
  Element.prototype.closest = function(selector: string): Element | null {
    let element: Element | null = this;
    while (element && element.nodeType === 1) {
      if (element.matches(selector)) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  };
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Polyfill para Element.matches() (Android 4.x)
if (!Element.prototype.matches) {
  Element.prototype.matches = 
    (Element.prototype as any).matchesSelector ||
    (Element.prototype as any).mozMatchesSelector ||
    (Element.prototype as any).msMatchesSelector ||
    (Element.prototype as any).oMatchesSelector ||
    (Element.prototype as any).webkitMatchesSelector ||
    function(selector: string): boolean {
      const matches = (this.document || this.ownerDocument).querySelectorAll(selector);
      let i = matches.length;
      while (--i >= 0 && matches.item(i) !== this) {}
      return i > -1;
    };
}

// ✅ FASE 9: Polyfill para Object.assign (IE11)
if (typeof Object.assign !== 'function') {
  Object.assign = function(target: any, ...sources: any[]): any {
    if (target == null) {
      throw new TypeError('Cannot convert undefined or null to object');
    }
    const to = Object(target);
    for (let index = 0; index < sources.length; index++) {
      const nextSource = sources[index];
      if (nextSource != null) {
        for (const nextKey in nextSource) {
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    return to;
  };
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Polyfill melhorado para fetch (navegadores antigos)
if (typeof fetch === 'undefined') {
  // Se fetch não existe, tentar usar XMLHttpRequest como fallback
  (window as any).fetch = function(url: string, options?: any): Promise<Response> {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        const method = (options && options.method) ? String(options.method).toUpperCase() : 'GET';
        const requestUrl = String(url);
        
        xhr.open(method, requestUrl, true);
        
        // Configurar headers
        if (options && options.headers) {
          const headers = options.headers;
          if (typeof headers === 'object') {
            // Headers pode ser um objeto ou um Headers object
            if (headers.forEach) {
              // Headers object
              headers.forEach((value: string, key: string) => {
                xhr.setRequestHeader(key, value);
              });
            } else {
              // Objeto simples
              Object.keys(headers).forEach(key => {
                const value = headers[key];
                if (value !== null && value !== undefined) {
                  xhr.setRequestHeader(key, String(value));
                }
              });
            }
          }
        }
        
        // Configurar responseType para JSON se necessário
        if (options && options.responseType) {
          xhr.responseType = options.responseType;
        }
        
        // Handler de sucesso
        xhr.onload = function() {
          try {
            // Criar objeto Response básico
            const responseInit: ResponseInit = {
              status: xhr.status,
              statusText: xhr.statusText || '',
            };
            
            // Tentar criar Headers object se disponível
            let responseHeaders: Headers;
            if (typeof Headers !== 'undefined') {
              responseHeaders = new Headers();
              const headerString = xhr.getAllResponseHeaders();
              if (headerString) {
                const headerPairs = headerString.split('\r\n');
                for (let i = 0; i < headerPairs.length; i++) {
                  const headerPair = headerPairs[i];
                  const index = headerPair.indexOf(': ');
                  if (index > 0) {
                    const key = headerPair.substring(0, index);
                    const value = headerPair.substring(index + 2);
                    responseHeaders.append(key, value);
                  }
                }
              }
            } else {
              // Fallback: criar objeto Headers simples
              responseHeaders = {} as Headers;
            }
            
            responseInit.headers = responseHeaders;
            
            // Obter body da resposta
            let body: any = null;
            if (xhr.responseType === 'json' && xhr.response) {
              body = xhr.response;
            } else if (xhr.responseText) {
              body = xhr.responseText;
            } else if (xhr.response) {
              body = xhr.response;
            }
            
            const response = new Response(body, responseInit);
            resolve(response);
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Failed to create response'));
          }
        };
        
        // Handler de erro
        xhr.onerror = function() {
          reject(new Error('Network request failed'));
        };
        
        // Handler de timeout
        if (options && options.timeout) {
          xhr.timeout = options.timeout;
          xhr.ontimeout = function() {
            reject(new Error('Request timeout'));
          };
        }
        
        // Enviar request
        const body = options && options.body ? options.body : null;
        xhr.send(body);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to create request'));
      }
    });
  };
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Polyfill melhorado para localStorage (modo privado e casos edge)
export function safeLocalStorage(): Storage | null {
  try {
    // Verificar se localStorage existe
    if (typeof localStorage === 'undefined' || localStorage === null) {
      console.warn('[Polyfills] localStorage não está disponível, usando fallback em memória');
      return createMemoryStorage();
    }
    
    // Testar se localStorage funciona (pode falhar em modo privado ou com quota excedida)
    const test = '__localStorage_test__';
    try {
      localStorage.setItem(test, test);
      const retrieved = localStorage.getItem(test);
      localStorage.removeItem(test);
      
      if (retrieved !== test) {
        throw new Error('localStorage não está funcionando corretamente');
      }
      
      return localStorage;
    } catch (e) {
      // localStorage existe mas não funciona (modo privado, quota excedida, etc.)
      console.warn('[Polyfills] localStorage não está funcionando, usando fallback em memória:', e);
      return createMemoryStorage();
    }
  } catch (e) {
    // Erro ao acessar localStorage
    console.warn('[Polyfills] Erro ao acessar localStorage, usando fallback em memória:', e);
    return createMemoryStorage();
  }
}

// ✅ FASE 9: Storage em memória como fallback
function createMemoryStorage(): Storage {
  const storage: { [key: string]: string } = {};
  
  return {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach(key => delete storage[key]);
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (index: number) => {
      const keys = Object.keys(storage);
      return keys[index] || null;
    }
  } as Storage;
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Detectar versão do Android/iOS
export function detectDeviceVersion(): { platform: string; version: number; isOld: boolean } {
  try {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    
    // Detectar Android
    const androidMatch = userAgent.match(/android\s([0-9\.]*)/i);
    if (androidMatch && androidMatch[1]) {
      const version = parseFloat(androidMatch[1]);
      return {
        platform: 'android',
        version: version,
        isOld: version < 5.0 // Android 5.0 (Lollipop) é o mínimo recomendado
      };
    }
    
    // Detectar iOS
    const iosMatch = userAgent.match(/os\s([\d_]+)/i);
    if (iosMatch && iosMatch[1]) {
      const version = parseFloat(iosMatch[1].replace(/_/g, '.'));
      return {
        platform: 'ios',
        version: version,
        isOld: version < 9.0 // iOS 9.0 é o mínimo recomendado
      };
    }
    
    return {
      platform: 'unknown',
      version: 0,
      isOld: false
    };
  } catch (error) {
    console.warn('[Polyfills] Erro ao detectar versão do dispositivo:', error);
    return {
      platform: 'unknown',
      version: 0,
      isOld: false
    };
  }
}

// ✅ COMPATIBILIDADE CELULARES ANTIGOS: Detectar capacidades do navegador
export function detectBrowserCapabilities() {
  const deviceInfo = detectDeviceVersion();
  const capabilities = {
    // APIs básicas
    serviceWorker: 'serviceWorker' in navigator,
    localStorage: (() => {
      try {
        const test = '__test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch {
        return false;
      }
    })(),
    sessionStorage: (() => {
      try {
        const test = '__test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        return true;
      } catch {
        return false;
      }
    })(),
    fetch: typeof fetch !== 'undefined',
    promise: typeof Promise !== 'undefined',
    indexedDB: 'indexedDB' in window,
    webSocket: 'WebSocket' in window,
    
    // APIs de DOM
    querySelector: typeof document !== 'undefined' && typeof document.querySelector === 'function',
    addEventListener: typeof window !== 'undefined' && typeof window.addEventListener === 'function',
    requestAnimationFrame: typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function',
    
    // Métodos de Array/String
    arrayIncludes: typeof Array.prototype.includes === 'function',
    arrayFind: typeof Array.prototype.find === 'function',
    arrayFrom: typeof Array.from === 'function',
    stringIncludes: typeof String.prototype.includes === 'function',
    stringStartsWith: typeof String.prototype.startsWith === 'function',
    stringEndsWith: typeof String.prototype.endsWith === 'function',
    
    // Métodos de Element
    elementClosest: typeof Element !== 'undefined' && typeof Element.prototype.closest === 'function',
    elementMatches: typeof Element !== 'undefined' && typeof Element.prototype.matches === 'function',
    
    // Detecção de dispositivo
    touchSupport: 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    deviceVersion: deviceInfo,
  };

  if (import.meta.env.DEV) {
    console.log('[Polyfills] Capacidades do navegador:', capabilities);
  }

  return capabilities;
}

// ✅ FASE 9: Verificar suporte de recursos (mantido para compatibilidade)
export function checkFeatureSupport() {
  const capabilities = detectBrowserCapabilities();
  return {
    serviceWorker: capabilities.serviceWorker,
    localStorage: capabilities.localStorage,
    fetch: capabilities.fetch,
    promise: capabilities.promise,
    indexedDB: capabilities.indexedDB,
    webSocket: capabilities.webSocket,
  };
}

// ✅ ANDROID ANTIGO: Polyfill para Array.isArray (Android 4.x)
if (!Array.isArray) {
  Array.isArray = function(arg: any): arg is any[] {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

// ✅ ANDROID ANTIGO: Polyfill para Array.forEach (muito raro, mas possível)
if (!Array.prototype.forEach) {
  Array.prototype.forEach = function<T>(callback: (value: T, index: number, array: T[]) => void, thisArg?: any): void {
    if (this == null) {
      throw new TypeError('Array.prototype.forEach called on null or undefined');
    }
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function');
    }
    const O = Object(this);
    const len = parseInt(O.length) || 0;
    let k = 0;
    while (k < len) {
      if (k in O) {
        callback.call(thisArg, O[k], k, O);
      }
      k++;
    }
  };
}

// ✅ ANDROID ANTIGO: Polyfill para Array.map (muito raro, mas possível)
if (!Array.prototype.map) {
  Array.prototype.map = function<T, U>(callback: (value: T, index: number, array: T[]) => U, thisArg?: any): U[] {
    if (this == null) {
      throw new TypeError('Array.prototype.map called on null or undefined');
    }
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function');
    }
    const O = Object(this);
    const len = parseInt(O.length) || 0;
    const A = new Array(len);
    let k = 0;
    while (k < len) {
      if (k in O) {
        A[k] = callback.call(thisArg, O[k], k, O);
      }
      k++;
    }
    return A;
  };
}

// ✅ ANDROID ANTIGO: Polyfill para Array.filter (muito raro, mas possível)
if (!Array.prototype.filter) {
  Array.prototype.filter = function<T>(callback: (value: T, index: number, array: T[]) => boolean, thisArg?: any): T[] {
    if (this == null) {
      throw new TypeError('Array.prototype.filter called on null or undefined');
    }
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function');
    }
    const O = Object(this);
    const len = Number(O.length) || 0;
    const A: T[] = [];
    let k = 0;
    while (k < len) {
      if (k in O) {
        const kValue = O[k];
        if (callback.call(thisArg, kValue, k, O)) {
          A.push(kValue);
        }
      }
      k++;
    }
    return A;
  };
}

// ✅ ANDROID ANTIGO: Polyfill para String.trim (Android 4.x)
if (!String.prototype.trim) {
  String.prototype.trim = function(): string {
    return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
  };
}

// ✅ FASE 2: Polyfill para IntersectionObserver (Android 4.x, IE11)
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  (window as any).IntersectionObserver = class IntersectionObserver {
    private callback: IntersectionObserverCallback;
    private root: Element | Document | null;
    private rootMargin: string;
    private thresholds: number[];
    
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.root = options?.root || null;
      this.rootMargin = options?.rootMargin || '0px';
      this.thresholds = Array.isArray(options?.threshold) ? options.threshold : [options?.threshold || 0];
    }
    
    observe(target: Element): void {
      // Fallback simples: sempre disparar callback com isIntersecting: true
      // Implementação completa seria muito complexa, então usamos fallback básico
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          const boundingClientRect = target.getBoundingClientRect();
          const rootBounds = this.root
            ? (this.root instanceof Document
              ? this.root.documentElement.getBoundingClientRect()
              : this.root.getBoundingClientRect())
            : null;

          const entry = {
            target,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect,
            rootBounds,
            intersectionRect: boundingClientRect,
            time: Date.now()
          } as unknown as IntersectionObserverEntry;

          this.callback([entry], this as any);
        });
      }
    }
    
    unobserve(target: Element): void {
      // No-op
    }
    
    disconnect(): void {
      // No-op
    }
    
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
}

// ✅ FASE 2: Polyfill para ResizeObserver (Android 4.x, IE11)
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  (window as any).ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback;
    
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    
    observe(target: Element): void {
      // Fallback usando MutationObserver ou polling
      if (typeof window !== 'undefined' && window.MutationObserver) {
        const observer = new MutationObserver(() => {
          this.callback([{
            target: target,
            contentRect: target.getBoundingClientRect(),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: []
          }], this as any);
        });
        observer.observe(target, { attributes: true, attributeFilter: ['style', 'class'] });
        (target as any).__resizeObserver = observer;
      }
    }
    
    unobserve(target: Element): void {
      if ((target as any).__resizeObserver) {
        (target as any).__resizeObserver.disconnect();
        delete (target as any).__resizeObserver;
      }
    }
    
    disconnect(): void {
      // No-op
    }
  };
}

// ✅ FASE 2: Polyfill para CustomEvent (IE11, Android 4.x)
if (typeof window !== 'undefined' && typeof window.CustomEvent !== 'function') {
  (window as any).CustomEvent = function(event: string, params?: any) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  };
  (window as any).CustomEvent.prototype = (window as any).Event.prototype;
}

// ✅ FASE 2: Polyfill para URL e URLSearchParams (IE11, Android 4.x)
if (typeof window !== 'undefined') {
  if (!window.URL) {
    // Fallback básico - usar implementação nativa se disponível via polyfill
    // Em navegadores muito antigos, pode ser necessário carregar polyfill externo
    console.warn('[Polyfills] URL não suportado - pode causar problemas');
  }
  
  if (!window.URLSearchParams) {
    (window as any).URLSearchParams = class URLSearchParams {
      private params: { [key: string]: string[] } = {};
      
      constructor(init?: string | URLSearchParams | { [key: string]: string }) {
        if (typeof init === 'string') {
          this.parseString(init);
        } else if (init instanceof URLSearchParams) {
          init.forEach((value, key) => {
            this.append(key, value);
          });
        } else if (init) {
          Object.keys(init).forEach(key => {
            this.set(key, init[key]);
          });
        }
      }
      
      private parseString(str: string): void {
        if (str.charAt(0) === '?') {
          str = str.substring(1);
        }
        const pairs = str.split('&');
        for (let i = 0; i < pairs.length; i++) {
          const pair = pairs[i].split('=');
          const key = decodeURIComponent(pair[0] || '');
          const value = decodeURIComponent(pair[1] || '');
          this.append(key, value);
        }
      }
      
      append(name: string, value: string): void {
        if (!this.params[name]) {
          this.params[name] = [];
        }
        this.params[name].push(value);
      }
      
      delete(name: string): void {
        delete this.params[name];
      }
      
      get(name: string): string | null {
        return this.params[name] ? this.params[name][0] : null;
      }
      
      getAll(name: string): string[] {
        return this.params[name] || [];
      }
      
      has(name: string): boolean {
        return name in this.params;
      }
      
      set(name: string, value: string): void {
        this.params[name] = [value];
      }
      
      forEach(callback: (value: string, key: string) => void): void {
        Object.keys(this.params).forEach(key => {
          this.params[key].forEach(value => {
            callback(value, key);
          });
        });
      }
      
      toString(): string {
        const pairs: string[] = [];
        Object.keys(this.params).forEach(key => {
          this.params[key].forEach(value => {
            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
          });
        });
        return pairs.join('&');
      }
    };
  }
}

// ✅ FASE 9: Executar verificação ao carregar
checkFeatureSupport();
