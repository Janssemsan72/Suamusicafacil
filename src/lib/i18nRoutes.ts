import type { Locale } from './detectLocale';

const SUPPORTED_LOCALES: Locale[] = ['pt'];

/**
 * Extrai o locale da URL atual
 */
export function getCurrentLocale(pathname: string): Locale | null {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (firstSegment && SUPPORTED_LOCALES.includes(firstSegment as Locale)) {
    return firstSegment as Locale;
  }
  
  return null;
}

/**
 * Gera um caminho localizado com prefixo de idioma
 */
export function getLocalizedPath(path: string, locale: Locale): string {
  // Remove prefixo de idioma existente se houver
  const cleanPath = path.replace(/^\/(pt|en|es)/, '');
  
  // Adiciona o novo prefixo
  return `/${locale}${cleanPath}`;
}

/**
 * Remove o prefixo de idioma de um caminho
 */
export function removeLocalePrefix(path: string): string {
  return path.replace(/^\/(pt|en|es)/, '') || '/';
}

/**
 * Troca o idioma na URL atual
 */
export function switchLocale(currentPath: string, newLocale: Locale): string {
  const pathWithoutLocale = removeLocalePrefix(currentPath);
  return getLocalizedPath(pathWithoutLocale, newLocale);
}

/**
 * Verifica se um caminho tem prefixo de idioma
 */
export function hasLocalePrefix(path: string): boolean {
  return /^\/(pt|en|es)/.test(path); // en/es para URLs legadas
}

/**
 * Obtém o caminho base sem locale para comparação
 */
export function getBasePath(path: string): string {
  return removeLocalePrefix(path);
}
