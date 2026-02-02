import { useState, useEffect, useCallback } from 'react';
import { RobustIPDetection, type Locale } from '@/lib/robustIPDetection';
import languageAnalytics from '@/lib/languageAnalytics';

export interface UseLocaleReturn {
  locale: Locale;
  isLoading: boolean;
  changeLocale: (newLocale: Locale) => void;
  error: string | null;
  redetect: () => void;
}

/**
 * Hook para gerenciar detecção e mudança de idioma
 */
export function useLocale(): UseLocaleReturn {
  const [locale, setLocale] = useState<Locale>('pt');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectAndSetLocale = useCallback(async (forceRefresh = false) => {
    console.log('🌍 [UseLocale] Iniciando detecção de idioma...');
    setIsLoading(true);
    setError(null);

    try {
      // Se não é refresh forçado, verificar preferências salvas primeiro
      if (!forceRefresh) {
        const storedLang = localStorage.getItem('clamorenmusica_language');
        const cookieLang = document.cookie.split(';').find(c => c.trim().startsWith('lang='))?.split('=')[1];
        
        if (storedLang === 'pt') {
          console.log('🌍 [UseLocale] Usando idioma salvo:', storedLang);
          setLocale(storedLang as Locale);
          setIsLoading(false);
          
          // Registrar uso de preferência no analytics
          languageAnalytics.trackCookieUsage(storedLang as Locale);
          return;
        }
        
        if (cookieLang === 'pt') {
          console.log('🌍 [UseLocale] Usando idioma do cookie:', cookieLang);
          setLocale(cookieLang as Locale);
          setIsLoading(false);
          
          // Registrar uso de preferência no analytics
          languageAnalytics.trackCookieUsage(cookieLang as Locale);
          return;
        }
      }

      // Usar sistema robusto de detecção
      console.log('🌍 [UseLocale] Usando sistema robusto de detecção...');
      const detectedLocale = await RobustIPDetection.detectLocale();

      console.log('🌍 [UseLocale] Idioma final detectado:', detectedLocale);
      setLocale(detectedLocale);

      // Salvar preferência
      RobustIPDetection.saveLocalePreference(detectedLocale);
      
      // Registrar detecção automática no analytics
      languageAnalytics.trackAutoDetection(detectedLocale);

    } catch (err) {
      console.error('❌ [UseLocale] Erro na detecção:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setLocale('pt'); // Fallback para português (padrão do sistema)
      RobustIPDetection.saveLocalePreference('pt');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Detectar idioma na montagem
    console.log('🌍 [UseLocale] useEffect executado - iniciando detecção');
    console.log('🌍 [UseLocale] Estado atual:', { locale, isLoading, error });
    
    // Aguardar um pouco para garantir que o DOM esteja pronto
    const timeoutId = setTimeout(() => {
      detectAndSetLocale();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [detectAndSetLocale]);

  const changeLocale = useCallback((newLocale: Locale) => {
    console.log('🌍 [UseLocale] Mudando idioma para:', newLocale);
    setLocale(newLocale);
    RobustIPDetection.saveLocalePreference(newLocale);
  }, []);

  return {
    locale,
    isLoading,
    changeLocale,
    error,
    redetect: () => detectAndSetLocale(true)
  };
}