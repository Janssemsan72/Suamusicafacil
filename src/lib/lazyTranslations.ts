import type { Locale } from './detectLocale';
import translationCache from './translationCache';
import pt from '@/i18n/locales/pt.json';

interface LazyTranslationLoader {
  load: (locale: Locale) => Promise<Record<string, any>>;
  preload: (locale: Locale) => Promise<void>;
  isLoaded: (locale: Locale) => boolean;
  getStats: () => { loaded: Locale[]; loading: Locale[] };
}

class LazyTranslationManager implements LazyTranslationLoader {
  private loadingPromises = new Map<Locale, Promise<Record<string, any>>>();
  private loadedLocales = new Set<Locale>();
  private bundledTranslations: Record<Locale, Record<string, any>> = {
    pt,
    en,
    es,
  };

  /**
   * Carrega traduções de forma lazy
   */
  async load(locale: Locale): Promise<Record<string, any>> {
    // Verificar cache primeiro
    const cached = translationCache.get(locale);
    if (cached) {
      this.loadedLocales.add(locale);
      return cached;
    }

    // Se já está carregando, aguardar a promise existente
    if (this.loadingPromises.has(locale)) {
      if (import.meta.env.DEV) {
        console.log('🌍 [LazyTranslations] Aguardando carregamento existente para:', locale);
      }
      return await this.loadingPromises.get(locale)!;
    }

    // Iniciar carregamento lazy
    const loadPromise = this.loadTranslations(locale);
    this.loadingPromises.set(locale, loadPromise);

    try {
      const translations = await loadPromise;
      this.loadedLocales.add(locale);
      this.loadingPromises.delete(locale);
      
      // Armazenar no cache
      translationCache.set(locale, translations);
      
      if (import.meta.env.DEV) {
        console.log('🌍 [LazyTranslations] Traduções carregadas para:', locale);
      }
      return translations;
    } catch (error) {
      this.loadingPromises.delete(locale);
      if (import.meta.env.DEV) {
        console.error('❌ [LazyTranslations] Erro ao carregar traduções para:', locale, error);
      }
      throw error;
    }
  }

  /**
   * Carrega traduções dinamicamente com retry logic
   */
  private async loadTranslations(locale: Locale, retryCount = 0): Promise<Record<string, any>> {
    const bundled = this.bundledTranslations[locale];
    if (!bundled) {
      throw new Error(`Locale não suportado: ${locale}`);
    }

    if (import.meta.env.DEV) {
      console.log('🌍 [LazyTranslations] Usando traduções empacotadas para:', locale, retryCount > 0 ? `(retry ${retryCount})` : '');
    }

    return bundled;
  }

  /**
   * Pré-carrega traduções em background
   */
  async preload(locale: Locale): Promise<void> {
    if (this.isLoaded(locale) || this.loadingPromises.has(locale)) {
      if (import.meta.env.DEV) {
        console.log('🌍 [LazyTranslations] Traduções já carregadas ou carregando para:', locale);
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log('🌍 [LazyTranslations] Pré-carregando traduções para:', locale);
    }
    
    // Carregar em background sem aguardar
    this.load(locale).catch(error => {
      if (import.meta.env.DEV) {
        console.warn('⚠️ [LazyTranslations] Erro no pré-carregamento para:', locale, error);
      }
    });
  }

  /**
   * Verifica se um locale está carregado
   */
  isLoaded(locale: Locale): boolean {
    return this.loadedLocales.has(locale) || translationCache.has(locale);
  }

  /**
   * Obtém estatísticas de carregamento
   */
  getStats(): { loaded: Locale[]; loading: Locale[] } {
    return {
      loaded: Array.from(this.loadedLocales),
      loading: Array.from(this.loadingPromises.keys())
    };
  }

  /**
   * Pré-carrega todos os idiomas suportados
   */
  async preloadAll(): Promise<void> {
    const supportedLocales: Locale[] = ['pt'];
    
    if (import.meta.env.DEV) {
      console.log('🌍 [LazyTranslations] Pré-carregando todos os idiomas...');
    }
    
    const preloadPromises = supportedLocales.map(locale => 
      this.preload(locale).catch(error => 
        import.meta.env.DEV ? console.warn(`⚠️ [LazyTranslations] Erro ao pré-carregar ${locale}:`, error) : undefined
      )
    );

    await Promise.allSettled(preloadPromises);
    if (import.meta.env.DEV) {
      console.log('🌍 [LazyTranslations] Pré-carregamento concluído');
    }
  }

  /**
   * Limpa cache e estado
   */
  clear(): void {
    this.loadedLocales.clear();
    this.loadingPromises.clear();
    translationCache.clear();
    if (import.meta.env.DEV) {
      console.log('🌍 [LazyTranslations] Estado limpo');
    }
  }
}

// Instância singleton
export const lazyTranslations = new LazyTranslationManager();

export default lazyTranslations;
