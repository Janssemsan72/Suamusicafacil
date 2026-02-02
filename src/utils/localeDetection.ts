/**
 * Utilitário centralizado para detecção de idioma
 * Elimina código duplicado em múltiplos arquivos
 */

type SupportedLocale = 'pt';

const SUPPORTED_LOCALES: SupportedLocale[] = ['pt'];
const DEFAULT_LOCALE: SupportedLocale = 'pt';

/**
 * Detecta o idioma atual - apenas pt suportado
 */
export function detectCurrentLocale(): SupportedLocale {
  return DEFAULT_LOCALE;
}

/**
 * Persiste o idioma detectado em localStorage e cookie
 */
export function persistLocale(locale: SupportedLocale): void {
  localStorage.setItem('suamusicafacil_language', locale);
  document.cookie = `lang=${locale};path=/;max-age=${60*60*24*365};samesite=lax`;
  document.documentElement.lang = locale;
}

/**
 * Detecta e persiste o idioma em uma única chamada
 */
export function detectAndPersistLocale(): SupportedLocale {
  const locale = detectCurrentLocale();
  persistLocale(locale);
  return locale;
}

/**
 * Gera path localizado para uma rota
 */
export function getLocalizedPath(path: string, locale: SupportedLocale): string {
  const cleanPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  if (cleanPath.startsWith('/pt')) return cleanPath;
  return `/${locale}${cleanPath === '/' ? '' : cleanPath}`;
}

/**
 * Verifica se um locale é suportado
 */
export function isValidLocale(locale: string | null | undefined): locale is SupportedLocale {
  return !!locale && SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
export type { SupportedLocale };

