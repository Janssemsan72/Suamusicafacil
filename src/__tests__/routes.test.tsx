import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LocaleProvider } from '@/contexts/LocaleContext';
import App from '@/App';

// Mock dos módulos de analytics e cache
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

vi.mock('@/lib/lazyTranslations', () => ({
  default: {
    load: vi.fn(() => Promise.resolve({
      hero: { title: 'Test Title' },
      navigation: { home: 'Home' }
    })),
    preload: vi.fn(),
    isLoaded: vi.fn(() => true),
    getStats: vi.fn(() => ({ loaded: [], loading: [] }))
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

// Mock do detectLocale
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

// Mock do i18nRoutes
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

describe('Sistema de Rotas Internacionalizadas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rotas com Prefixo de Idioma', () => {
    it('deve renderizar rota /pt/about corretamente', async () => {
      window.history.pushState({}, '', '/pt/about');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });

    it('deve renderizar rota /en/pricing corretamente', async () => {
      window.history.pushState({}, '', '/en/pricing');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });

    it('deve renderizar rota /es/quiz corretamente', async () => {
      window.history.pushState({}, '', '/es/quiz');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });
  });

  describe('Rota Raiz com Detecção Automática', () => {
    it('deve renderizar rota / com detecção automática', async () => {
      window.history.pushState({}, '', '/');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });

    it('deve renderizar rota /about com detecção automática', async () => {
      window.history.pushState({}, '', '/about');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });
  });

  describe('Rotas Admin sem Prefixo', () => {
    it('deve renderizar rota /admin sem prefixo', async () => {
      window.history.pushState({}, '', '/admin');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });

    it('deve renderizar rota /admin/orders sem prefixo', async () => {
      window.history.pushState({}, '', '/admin/orders');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
      });
    });
  });

  describe('Redirecionamentos', () => {
    it('deve redirecionar /pt para /pt/', async () => {
      window.history.pushState({}, '', '/pt');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/pt/');
      });
    });

    it('deve redirecionar /en para /en/', async () => {
      window.history.pushState({}, '', '/en');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/en/');
      });
    });
  });

  describe('Compatibilidade com URLs Antigas', () => {
    it('deve redirecionar /app/admin para /admin', async () => {
      window.history.pushState({}, '', '/app/admin');
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/admin');
      });
    });
  });
});


