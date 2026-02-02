import React, { useState, useEffect } from 'react';
import { useSmoothScroll } from '@/hooks/use-smooth-scroll';
import { ChevronUp } from '@/lib/icons';
import { Button } from '@/components/ui/button';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const { scrollToTop } = useSmoothScroll();

  useEffect(() => {
    const toggleVisibility = () => {
      // Mostra o botão quando o usuário rola mais de 300px
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const handleScrollToTop = () => {
    // Verificar se há hash na URL - se houver, não fazer scroll automático
    if (window.location.hash) {
      console.log('[ScrollToTop] Hash detectado, não fazendo scroll automático');
      return;
    }
    scrollToTop();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Button
      onClick={handleScrollToTop}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full w-12 h-12 p-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white md:right-6 md:left-auto md:translate-x-0"
      aria-label="Voltar ao topo"
    >
      <ChevronUp className="h-5 w-5" />
    </Button>
  );
}














