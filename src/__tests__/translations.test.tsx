import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LocaleProvider } from '@/contexts/LocaleContext';
import App from '@/App';

// Mock das traduções
const mockTranslations = {
  pt: {
    hero: { title: 'Crie Sua Música Personalizada' },
    navigation: { home: 'Início', about: 'Sobre' }
  },
  en: {
    hero: { title: 'Create Your Personalized Music' },
    navigation: { home: 'Home', about: 'About' }
  },
  es: {
    hero: { title: 'Crea Tu Música Personalizada' },
    navigation: { home: 'Inicio', about: 'Acerca' }
  }
};

// Mock dos módulos
vi.mock('@/lib/lazyTranslations', () => ({
  default: {
    load: vi.fn((locale) => Promise.resolve(mockTranslations[locale as keyof typeof mockTranslations])),
    preload: vi.fn(),
    isLoaded: vi.fn(() => true),
    getStats: vi.fn(() => ({ loaded: [], loading: [] }))
  }
}));

vi.mock('@/lib/languageAnalytics', () => ({
  default: {
    trackLanguageUsage: vi.fn(),
    trackAutoDetection: vi.fn(),
    trackManualChange: vi.fn(),
    trackUrlAccess: vi.fn(),
    trackCookieUsage: vi.fn(),
    getStats: vi.fn(() => ({
      totalEvents: 0,
      byLocale: {},
      bySource: {},
      recentEvents: []
    }))
  }
}));

vi.mock('@/lib/translationCache', () => ({
  default: {
    get: vi.fn(() => null),
    set: vi.fn(),
    has: vi.fn(() => false),
    clear: vi.fn(),
    getStats: vi.fn(() => ({ size: 0, maxSize: 5, entries: [] }))
  }
}));

vi.mock('@/lib/detectLocale', () => ({
  detectLocaleSimple: vi.fn(() => Promise.resolve('pt')),
  getCookieLocale: vi.fn(() => null),
  saveLocalePreference: vi.fn(),
  getLocaleFromPath: vi.fn((path) => {
    const segments = path.split('/').filter(Boolean);
    const firstSegment = segments[0];
    return firstSegment === 'pt' ? firstSegment : null;
  })
}));

vi.mock('@/lib/i18nRoutes', () => ({
  getCurrentLocale: vi.fn((path) => {
    const segments = path.split('/').filter(Boolean);
    const firstSegment = segments[0];
    return firstSegment === 'pt' ? firstSegment : null;
  }),
  getLocalizedPath: vi.fn((path, locale) => `/${locale}${path}`),
  removeLocalePrefix: vi.fn((path) => path.replace(/^\/(pt|en|es)/, '') || '/'),
  switchLocale: vi.fn((currentPath, newLocale) => `/${newLocale}${currentPath.replace(/^\/(pt|en|es)/, '')}`),
  hasLocalePrefix: vi.fn((path) => /^\/(pt|en|es)/.test(path)),
  getBasePath: vi.fn((path) => path.replace(/^\/(pt|en|es)/, ''))
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <LocaleProvider>
      {children}
    </LocaleProvider>
  </BrowserRouter>
);

describe('Sistema de Traduções', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Carregamento de Traduções', () => {
    it('deve carregar traduções em português para /pt/', async () => {
      window.history.pushState({}, '', '/pt/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Crie Sua Música Personalizada')).toBeInTheDocument();
      });
    });

    it('deve carregar traduções em inglês para /en/', async () => {
      window.history.pushState({}, '', '/en/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Create Your Personalized Music')).toBeInTheDocument();
      });
    });

    it('deve carregar traduções em espanhol para /es/', async () => {
      window.history.pushState({}, '', '/es/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Crea Tu Música Personalizada')).toBeInTheDocument();
      });
    });
  });

  describe('Cache de Traduções', () => {
    it('deve usar cache quando disponível', async () => {
      const { translationCache } = await import('@/lib/translationCache');
      translationCache.get = vi.fn(() => mockTranslations.pt);
      
      window.history.pushState({}, '', '/pt/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(translationCache.get).toHaveBeenCalledWith('pt');
      });
    });

    it('deve armazenar no cache após carregamento', async () => {
      const { translationCache } = await import('@/lib/translationCache');
      translationCache.get = vi.fn(() => null);
      translationCache.set = vi.fn();
      
      window.history.pushState({}, '', '/pt/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(translationCache.set).toHaveBeenCalledWith('pt', mockTranslations.pt);
      });
    });
  });

  describe('Lazy Loading', () => {
    it('deve carregar traduções de forma lazy', async () => {
      const { lazyTranslations } = await import('@/lib/lazyTranslations');
      
      window.history.pushState({}, '', '/pt/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(lazyTranslations.load).toHaveBeenCalledWith('pt');
      });
    });

    it('deve pré-carregar outros idiomas', async () => {
      const { lazyTranslations } = await import('@/lib/lazyTranslations');
      
      window.history.pushState({}, '', '/pt/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(lazyTranslations.preload).toHaveBeenCalled();
      });
    });
  });

  describe('Analytics de Idioma', () => {
    it('deve registrar uso de idioma no analytics', async () => {
      const { languageAnalytics } = await import('@/lib/languageAnalytics');
      
      window.history.pushState({}, '', '/pt/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(languageAnalytics.trackLanguageUsage).toHaveBeenCalledWith('pt', 'manual');
      });
    });

    it('deve registrar acesso via URL no analytics', async () => {
      const { languageAnalytics } = await import('@/lib/languageAnalytics');
      
      window.history.pushState({}, '', '/pt/about');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(languageAnalytics.trackUrlAccess).toHaveBeenCalledWith('pt', '/pt/about');
      });
    });
  });

  describe('Fallback de Tradução', () => {
    it('deve usar fallback quando tradução não encontrada', async () => {
      const { lazyTranslations } = await import('@/lib/lazyTranslations');
      lazyTranslations.load = vi.fn(() => Promise.resolve({}));
      
      window.history.pushState({}, '', '/pt/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        // Deve renderizar sem erro mesmo com traduções vazias
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });
  });
});


