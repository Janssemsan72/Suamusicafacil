import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '@/lib/detectLocale';
import { detectLocaleSimple, getCookieLocale, getCountryByIP, getStoredLocale, saveLocalePreference } from '@/lib/detectLocale';
import lazyTranslations from '@/lib/lazyTranslations';
import { getCurrentLocale } from '@/lib/i18nRoutes';
interface LocaleContextType {
  locale: Locale;
  isLoading: boolean;
  changeLocale: (newLocale: Locale) => void;
  error: string | null;
  redetect: () => void;
  t: (key: string, fallback?: string | Record<string, string | number>) => string;
  translations: Record<string, any>;
  forceLocale: (locale: Locale) => void;
  isLocaleForced: boolean;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'pt',
  isLoading: false,
  changeLocale: () => {},
  error: null,
  redetect: () => {},
  t: (key: string, _fallback?: string | Record<string, string | number>) => key,
  translations: {},
  forceLocale: () => {},
  isLocaleForced: false
});

export const useLocaleContext = () => useContext(LocaleContext);

/**
 * Função auxiliar para buscar tradução aninhada
 * Ex: getNestedTranslation(translations, 'checkout.subtitle') retorna o valor de translations.checkout.subtitle
 */
const getNestedTranslation = (obj: any, path: string): string | undefined => {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return typeof current === 'string' ? current : undefined;
};

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'pt';
    const urlLocale = getCurrentLocale(window.location.pathname);
    if (urlLocale) return urlLocale;
    const storedLocale = getStoredLocale();
    if (storedLocale) return storedLocale;
    const cookieLocale = getCookieLocale();
    if (cookieLocale === 'pt') return cookieLocale;
    return 'pt';
  });
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocaleForced, setIsLocaleForced] = useState<boolean>(false);

  // Função de tradução que busca no objeto de traduções
  const t = useCallback((key: string, fallback?: string | Record<string, string | number>): string => {
    // Primeiro, tentar buscar a tradução no objeto
    const translation = getNestedTranslation(translations, key);
    
    // Se encontrou a tradução, usar ela
    if (translation) {
      let result = translation;
      
      // Se fallback é objeto, são variáveis para interpolação
      if (typeof fallback === 'object' && fallback !== null) {
        Object.entries(fallback).forEach(([varKey, varValue]) => {
          result = result.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue));
        });
      }
      
      return result;
    }
    
    // Se não encontrou e fallback é string, retornar fallback
    if (typeof fallback === 'string') {
      return fallback;
    }
    
    // Se fallback é objeto, são variáveis mas não temos tradução - retornar chave com variáveis interpoladas
    if (typeof fallback === 'object' && fallback !== null) {
      let result = key;
      Object.entries(fallback).forEach(([varKey, varValue]) => {
        result = result.replace(new RegExp(`\\{${varKey}\\}`, 'g'), String(varValue));
      });
      return result;
    }
    
    // Caso padrão: retornar a chave
    return key;
  }, [translations]);

  // ✅ OTIMIZAÇÃO: Memoizar valor do contexto para evitar re-renders desnecessários
  const contextValue = useMemo(() => ({
    locale,
    isLoading,
    changeLocale: setLocale,
    error,
    redetect: () => {}, // Implementar se necessário
    t,
    translations,
    forceLocale: (l: Locale) => {
      setLocale(l);
      setIsLocaleForced(true);
    },
    isLocaleForced
  }), [locale, isLoading, error, t, translations, isLocaleForced]);

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
};
