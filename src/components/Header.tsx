import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUtmParams } from "@/hooks/useUtmParams";
import { scrollManager } from "@/utils/scrollManager";
import Logo from "@/components/Logo";
import { Menu, X } from "@/lib/icons";
import { NAV_ITEMS, getMonthlyBannerCopy, type NavItem } from "@/constants/header";

type HeaderProps = {
  onOpenQuiz?: () => void;
};

const Header = React.memo(function Header({ onOpenQuiz }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { navigateWithUtms } = useUtmParams();
  const monthlyBannerCopy = useMemo(() => getMonthlyBannerCopy(), []);

  // ✅ OTIMIZAÇÃO: useCallback para evitar recriação do handler
  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    setScrolled(scrollY > 20);
  }, []);

  useEffect(() => {
    // ✅ OTIMIZAÇÃO: Throttle com requestAnimationFrame para melhor performance
    let rafId: number | null = null;
    const throttledScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          handleScroll();
          rafId = null;
        });
      }
    };
    
    window.addEventListener('scroll', throttledScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', throttledScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [handleScroll]);

  // ✅ OTIMIZAÇÃO: useCallback para handlers para evitar re-renders desnecessários
  const handleSectionClick = useCallback((sectionId: string) => {
    setMobileMenuOpen(false);
    
    if (location.pathname === '/') {
      scrollManager.scrollToElement(sectionId, 80, null);
    } else {
      navigateWithUtms(`/#${sectionId}`, { replace: false });
      setTimeout(() => {
        scrollManager.scrollToElement(sectionId, 80, null);
      }, 400);
    }
  }, [location.pathname, navigateWithUtms]);

  const handleQuizAction = useCallback((event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (onOpenQuiz) {
      onOpenQuiz();
      return;
    }
    navigateWithUtms('/quiz');
  }, [navigateWithUtms, onOpenQuiz]);

  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isOnHomePage = location.pathname === '/';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (!isOnHomePage) {
      navigateWithUtms('/');
    }
  }, [location.pathname, navigateWithUtms]);

  const handleNavClick = useCallback((item: NavItem) => {
    setMobileMenuOpen(false);
    if (item.sectionId) {
      handleSectionClick(item.sectionId);
    } else if (item.path) {
      navigateWithUtms(item.path);
    }
  }, [handleSectionClick, navigateWithUtms]);

  return (
    <>
      {/* Promotional Banner */}
      <div className="bg-purple-600 text-white text-center py-2 px-4 text-sm font-medium">
        <span>{monthlyBannerCopy} </span>
        <button
          onClick={() => handleQuizAction()}
          className="underline font-bold hover:text-purple-100 transition-colors ml-1 focus:outline-none focus:ring-1 focus:ring-white rounded"
        >
          {monthlyBannerCopy.includes('Free') || monthlyBannerCopy.includes('Grátis') ? 'Aproveite Agora' : 'Clique aqui'}
        </button>
      </div>

      {/* Main Header */}
      <header className={`sticky top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300 ${scrolled ? 'shadow-md' : 'shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-0">
          <div className="flex items-center justify-between min-h-14 sm:min-h-16 py-0">
            {/* Logo: menor que o footer (~1/3 do tamanho) */}
            <div 
              className="flex items-center cursor-pointer ml-10 sm:ml-12 h-9 sm:h-10 shrink-0 overflow-hidden"
              onClick={handleLogoClick}
              role="banner"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleLogoClick(e as any);
                }
              }}
              aria-label="Ir para o início"
            >
              <Logo width={150} height={27} className="h-full max-h-9 sm:max-h-10" align="left" />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8" aria-label="Navegação principal">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className="text-brown-dark-300 hover:text-terracotta-800 transition-colors font-medium text-base"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center">
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-6 py-2.5 font-semibold shadow-md hover:shadow-lg transition-all animate-pulse-scale"
                onClick={handleQuizAction}
              >
                Crie minha música
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-brown-dark-400 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-cream-300 animate-in slide-in-from-top-2 duration-200" role="dialog" aria-modal="true" aria-label="Menu móvel">
            <nav className="px-4 py-4 flex flex-col gap-2" aria-label="Navegação móvel">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className="text-brown-dark-50 hover:text-brown-dark-400 hover:bg-gray-100 transition-colors font-medium py-3 px-4 rounded-lg text-left"
                >
                  {item.label}
                </button>
              ))}
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-full w-full mt-2 font-semibold py-3 animate-pulse-scale"
                onClick={(event) => {
                  handleQuizAction(event);
                  setMobileMenuOpen(false);
                }}
              >
                Crie minha música
              </Button>
            </nav>
          </div>
        )}
      </header>
    </>
  );
});

export default Header;
