import { useEffect, useRef } from 'react';

export const useScrollAnimations = () => {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Configuração do Intersection Observer para animações
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in-up');
            entry.target.classList.remove('opacity-0', 'translate-y-8');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    // Observar apenas elementos que não estão na seção radiola
    const elements = document.querySelectorAll('.scroll-animate:not(#radiola)');
    elements.forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return observerRef.current;
};

export const useSmoothScrollToElement = () => {
  const scrollToElement = (elementId: string, offset: number = 80) => {
    const element = document.getElementById(elementId);
    if (element) {
      // ✅ OTIMIZAÇÃO: Batch DOM reads usando requestAnimationFrame
      requestAnimationFrame(() => {
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
        });
      });
    }
  };

  return { scrollToElement };
};
