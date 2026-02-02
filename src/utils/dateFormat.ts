import { useTranslation } from '@/hooks/useTranslation';

/**
 * Formata uma data usando o locale baseado no idioma atual
 */
export function formatDateWithLocale(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const locale = 'pt-BR';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString(locale, options);
}

/**
 * Formata uma data para exibição simples
 */
export function formatDate(date: Date | string): string {
  return formatDateWithLocale(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Formata uma data com hora
 */
export function formatDateTime(date: Date | string): string {
  return formatDateWithLocale(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formata uma data para exibição longa
 */
export function formatDateLong(date: Date | string): string {
  return formatDateWithLocale(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
