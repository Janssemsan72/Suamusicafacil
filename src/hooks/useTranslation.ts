import { useLocaleContext } from '@/contexts/LocaleContext';

/**
 * Hook para tradução que usa o LocaleContext
 * Mantém compatibilidade com código existente
 */
export const useTranslation = () => {
  const { t, locale, changeLocale, isLoading, error, redetect } = useLocaleContext();

  return {
    t,
    locale,
    redetect,
    i18n: {
      language: locale,
      changeLanguage: changeLocale,
      dir: () => 'ltr' // Por enquanto sempre LTR
    },
    currentLanguage: locale,
    isRTL: false,
    isLoading,
    error
  };
};
