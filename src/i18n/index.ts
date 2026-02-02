import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importar traduções
import pt from './locales/pt.json';

// Configuração do i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Recursos de tradução
    resources: {
      pt: { translation: pt },
    },
    
    // Idioma padrão
    fallbackLng: 'pt',
    lng: 'pt', // Forçar idioma inicial
    
    // Idioma de debug (desenvolvimento)
    debug: false, // Desabilitar debug para evitar problemas
    
    // Configurações de detecção
    detection: {
      // Ordem de detecção
      order: ['localStorage', 'navigator', 'htmlTag'],
      
      // Chaves para localStorage
      lookupLocalStorage: 'suamusicafacil_language',
      
      // Cache da linguagem
      caches: ['localStorage'],
    },
    
    // Configurações de interpolação
    interpolation: {
      escapeValue: false, // React já faz escape
    },
    
    // Configurações de namespace
    defaultNS: 'translation',
    ns: ['translation'],
    
    // Configurações de react
    react: {
      useSuspense: false,
    },
  });

export default i18n;
