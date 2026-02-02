import { useState, useEffect } from 'react';
import type { Locale } from '@/lib/detectLocale';
import { detectLocaleSimple, getCookieLocale, getCountryByIP, getStoredLocale, saveLocalePreference } from '@/lib/detectLocale';

export function useLocaleSimple() {
  const [locale, setLocale] = useState<Locale>('pt');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectLocale = async () => {
      console.log('🌍 [UseLocaleSimple] Iniciando detecção...');
      
      try {
        const storedLocale = getStoredLocale();
        if (storedLocale) {
          console.log('🌍 [UseLocaleSimple] Usando localStorage:', storedLocale);
          setLocale(storedLocale);
          setIsLoading(false);
          return;
        }

        const cookieLang = getCookieLocale();
        if (cookieLang === 'pt') {
          console.log('🌍 [UseLocaleSimple] Usando cookie:', cookieLang);
          setLocale(cookieLang as Locale);
          setIsLoading(false);
          return;
        }

        console.log('🌍 [UseLocaleSimple] Detectando país...');
        const countryCode = await getCountryByIP();

        const detectedLocale = await detectLocaleSimple({
          cookieLang,
          queryLang: null,
          navigatorLang: navigator.language,
          acceptLanguage: null,
          countryCode,
        });
        console.log('🌍 [UseLocaleSimple] Idioma detectado:', detectedLocale);
        setLocale(detectedLocale);
        saveLocalePreference(detectedLocale);
      } catch (error) {
        console.error('❌ [UseLocaleSimple] Erro:', error);
        setLocale('pt');
      } finally {
        setIsLoading(false);
      }
    };

    detectLocale();
  }, []);

  const changeLocale = (newLocale: Locale) => {
    console.log('🌍 [UseLocaleSimple] Mudando idioma para:', newLocale);
    setLocale(newLocale);
    saveLocalePreference(newLocale);
  };

  return {
    locale,
    isLoading,
    changeLocale
  };
}


