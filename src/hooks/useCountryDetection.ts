import { useState, useEffect } from 'react';
import { getCountryByIP } from '@/lib/detectLocale';

export type Country = 'BR' | 'PT' | 'ES' | 'MX' | 'AR' | 'CO' | 'CL' | 'PE' | 'VE' | 'EC' | 'GT' | 'CU' | 'BO' | 'DO' | 'HN' | 'PY' | 'SV' | 'NI' | 'CR' | 'PA' | 'UY' | 'GQ' | 'PR' | 'AO' | 'MZ' | 'CV' | 'GW' | 'ST' | 'TL' | 'MO' | 'US' | 'CA' | 'GB' | 'AU' | 'DE' | 'FR' | 'IT' | 'NL' | 'SE' | 'NO' | 'DK' | 'FI' | 'PL' | 'CZ' | 'HU' | 'RO' | 'BG' | 'HR' | 'SI' | 'SK' | 'EE' | 'LV' | 'LT' | 'MT' | 'CY' | 'LU' | 'IE' | 'AT' | 'BE' | 'CH' | 'LI' | 'IS' | 'AD' | 'MC' | 'SM' | 'VA' | 'AL' | 'BA' | 'ME' | 'MK' | 'RS' | 'XK' | 'MD' | 'UA' | 'BY' | 'RU' | 'TR' | 'GR' | 'OTHER';

export type Language = 'pt';

export function countryToLanguage(_country: Country): Language {
  return 'pt';
}

export function useCountryDetection() {
  const [country, setCountry] = useState<Country | null>(null);
  const [language, setLanguage] = useState<Language>('pt');
  const [isLoading, setIsLoading] = useState(true);
  const [lastDetection, setLastDetection] = useState<number>(0);

  const normalizeCountryCode = (code: string): Country => {
    const normalized = code.toUpperCase();
    if (/^[A-Z]{2}$/.test(normalized)) return normalized as Country;
    return 'OTHER';
  };

  const detectCountry = async (forceRefresh = false) => {
    // Evitar detecções muito frequentes (máximo a cada 30 segundos)
    const now = Date.now();
    if (!forceRefresh && now - lastDetection < 30000) {
      return;
    }

    setIsLoading(true);
    setLastDetection(now);
    const timestamp = Date.now();

    try {
      const countryCode = await getCountryByIP();
      if (!countryCode) throw new Error('No country code received from any API');

      const detectedCountry = normalizeCountryCode(countryCode);
      const detectedLanguage = countryToLanguage(detectedCountry);

      console.log('🌍 [CountryDetection] País detectado:', detectedCountry, '→ Idioma:', detectedLanguage);

      setCountry(detectedCountry);
      setLanguage(detectedLanguage);

      localStorage.setItem('detectedCountry', detectedCountry);
      localStorage.setItem('detectedLanguage', detectedLanguage);
      localStorage.setItem('lastDetection', now.toString());
    } catch (error) {
      console.warn('⚠️ [CountryDetection] Erro na detecção, tentando fallback:', error);
      
      // Último fallback: idioma do navegador
      const browserLang = navigator.language.split('-')[0];
      let fallbackLanguage: Language = 'en';
      
      if (browserLang === 'pt') {
        fallbackLanguage = 'pt';
      } else if (browserLang === 'es') {
        fallbackLanguage = 'es';
      }
      
      console.log('🌍 [CountryDetection] Usando idioma do navegador:', fallbackLanguage);
      setLanguage(fallbackLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Verificar se há detecção recente no localStorage
    const lastDetection = localStorage.getItem('lastDetection');
    const storedCountry = localStorage.getItem('detectedCountry');
    const storedLanguage = localStorage.getItem('detectedLanguage');
    
    if (lastDetection && storedCountry && storedLanguage) {
      const timeSinceLastDetection = Date.now() - parseInt(lastDetection);
      
      // Se a detecção foi feita há menos de 5 minutos, usar dados salvos
      if (timeSinceLastDetection < 300000) {
        console.log('🌍 [CountryDetection] Usando dados salvos:', storedCountry, '→', storedLanguage);
        setCountry(storedCountry as Country);
        setLanguage(storedLanguage as Language);
        setIsLoading(false);
        return;
      }
    }
    
    // Detectar país
    detectCountry();
  }, []);

  // Adicionar listener para mudanças de visibilidade da página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Página ficou visível novamente, re-detectar
        console.log('🌍 [CountryDetection] Página visível, re-detectando...');
        detectCountry(true);
      }
    };

    const handleFocus = () => {
      // Página recebeu foco, re-detectar
      console.log('🌍 [CountryDetection] Página com foco, re-detectando...');
      detectCountry(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const clearCache = () => {
    localStorage.removeItem('detectedCountry');
    localStorage.removeItem('detectedLanguage');
    localStorage.removeItem('lastDetection');
    localStorage.removeItem('lastIPDetection');
    localStorage.removeItem('detectedIP');
    setCountry(null);
    setLanguage('pt');
    setLastDetection(0);
    console.log('🗑️ [CountryDetection] Cache limpo');
  };

  const forceDetect = async () => {
    clearCache();
    await detectCountry(true);
  };

  const overrideCountry = (newCountry: Country) => {
    const newLanguage = countryToLanguage(newCountry);
    setCountry(newCountry);
    setLanguage(newLanguage);
    localStorage.setItem('detectedCountry', newCountry);
    localStorage.setItem('detectedLanguage', newLanguage);
    localStorage.setItem('lastDetection', Date.now().toString());
    localStorage.setItem('countryOverride', 'true');
    console.log('🎯 [CountryDetection] Override ativo:', newCountry, '→', newLanguage);
  };

  return {
    country,
    language,
    isLoading,
    setLanguage,
    redetect: () => detectCountry(true),
    clearCache,
    forceDetect,
    overrideCountry
  };
}
