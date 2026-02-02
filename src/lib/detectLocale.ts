export type Locale = 'pt';

const SUPPORTED: Locale[] = ['pt'];
const DEFAULT_LOCALE: Locale = 'pt';
const LOCALE_STORAGE_KEY = 'suamusicafacil_language';
const LEGACY_LOCALE_STORAGE_KEY = 'clamorenmusica_language'; // Migração: clamorenmusica → suamusicafacil
const OLD_LEGACY_KEY = 'musiclovely_language';

const PT_COUNTRIES = new Set(['BR','PT','AO','MZ','CV','GW','ST','TL','MO']);
const ES_COUNTRIES = new Set(['ES','MX','AR','CO','CL','PE','VE','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','GQ','PR']);
const EN_COUNTRIES = new Set(['US','GB','CA','AU','NZ','IE','ZA','NG','KE','GH','UG','TZ','ZW','ZM','BW','LS','SZ','MW','JM','BB','TT','GY','BZ','AG','BS','DM','GD','KN','LC','VC','SG','MY','PH','IN','PK','BD','LK','MM','FJ','PG','SB','VU','TO','WS','KI','TV','NR','PW','FM','MH','CK','NU','TK','NF']);

function mapCountryToLocale(_country?: string): Locale | null {
  return 'pt';
}

function fromAcceptLanguage(_accept?: string): Locale | null {
  return 'pt';
}

function normalize(lang?: string): Locale | null {
  if (!lang) return null;
  const base = lang.slice(0,2).toLowerCase() as Locale;
  return SUPPORTED.includes(base) ? base : null;
}

export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    const normalizedStored = normalize(stored || undefined);
    if (normalizedStored) return normalizedStored;

    // Migração: clamorenmusica_language → suamusicafacil_language
    const legacy = localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
    const normalizedLegacy = normalize(legacy || undefined);
    if (normalizedLegacy) {
      localStorage.setItem(LOCALE_STORAGE_KEY, normalizedLegacy);
      localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
      return normalizedLegacy;
    }

    const oldLegacy = localStorage.getItem(OLD_LEGACY_KEY);
    const normalizedOld = normalize(oldLegacy || undefined);
    if (normalizedOld) {
      localStorage.setItem(LOCALE_STORAGE_KEY, normalizedOld);
      localStorage.removeItem(OLD_LEGACY_KEY);
      return normalizedOld;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detecta o país do usuário via API ipapi.co (gratuita)
 */
export async function getCountryByIP(): Promise<string | null> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (import.meta.env.DEV) console.log('🌍 [DetectLocale] País detectado via ipapi.co:', data.country_code);
      return data.country_code || null;
    }

    const fallbackResponse = await fetch('https://api.country.is/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json();
      if (import.meta.env.DEV) console.log('🌍 [DetectLocale] País detectado via api.country.is:', data.country);
      return data.country || null;
    }
    
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    console.warn('⚠️ [DetectLocale] Erro ao detectar país por IP:', error);
    return null;
  }
}

/**
 * Detecta o locale com prioridades: cookie > query > geolocalização > navigator > default
 */
export async function detectLocaleSimple(opts: {
  cookieLang?: string | null;       // ex.: valor do cookie "lang"
  queryLang?: string | null;        // ex.: ?lang=pt
  navigatorLang?: string | null;    // ex.: navigator.language no client
  acceptLanguage?: string | null;   // ex.: req.headers['accept-language'] no server
  countryCode?: string | null;      // ex.: código ISO do país (BR/US/ES)
}): Promise<Locale> {
  if (import.meta.env.DEV) console.log('🌍 [DetectLocale] Iniciando detecção com opções:', opts);

  // 1. Cookie (preferência salva)
  const cookieResult = normalize(opts.cookieLang);
  if (cookieResult) {
    if (import.meta.env.DEV) console.log('🌍 [DetectLocale] Usando idioma do cookie:', cookieResult);
    return cookieResult;
  }

  // 2. Query string
  const queryResult = normalize(opts.queryLang);
  if (queryResult) {
    if (import.meta.env.DEV) console.log('🌍 [DetectLocale] Usando idioma da query:', queryResult);
    return queryResult;
  }

  // 3. Geolocalização por IP (mais confiável para detecção automática)
  if (opts.countryCode) {
    const geoResult = mapCountryToLocale(opts.countryCode);
    if (geoResult) {
      if (import.meta.env.DEV) console.log('🌍 [DetectLocale] Usando idioma por país fornecido:', geoResult, 'país:', opts.countryCode);
      return geoResult;
    }
  }

  // 4. Idioma do navegador (fallback)
  const navigatorResult = normalize(opts.navigatorLang || undefined) ?? fromAcceptLanguage(opts.acceptLanguage || undefined);
  if (navigatorResult) {
    if (import.meta.env.DEV) console.log('🌍 [DetectLocale] Usando idioma do navegador:', navigatorResult);
    return navigatorResult;
  }

  // 5. Fallback para português (padrão do sistema)
  if (import.meta.env.DEV) console.log('🌍 [DetectLocale] Usando idioma padrão:', DEFAULT_LOCALE);
  return DEFAULT_LOCALE;
}

/**
 * Função para salvar preferência de idioma em cookie
 */
export function saveLocalePreference(locale: Locale): void {
  try {
    document.cookie = `lang=${locale};path=/;max-age=${60*60*24*365};samesite=lax`;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
      localStorage.removeItem(OLD_LEGACY_KEY);
    } catch {
      // ignore
    }
    if (import.meta.env.DEV) console.log('🌍 [DetectLocale] Preferência salva:', locale);
  } catch (error) {
    console.warn('⚠️ [DetectLocale] Erro ao salvar preferência:', error);
  }
}

/**
 * Função para ler preferência de idioma do cookie
 */
export function getCookieLocale(): string | null {
  try {
    const match = document.cookie.match(/(?:^|; )lang=([^;]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.warn('⚠️ [DetectLocale] Erro ao ler cookie:', error);
    return null;
  }
}

/**
 * Extrai o locale da URL (pathname)
 */
export function getLocaleFromPath(pathname: string): Locale | null {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (firstSegment && SUPPORTED.includes(firstSegment as Locale)) {
    return firstSegment as Locale;
  }
  
  return null;
}
