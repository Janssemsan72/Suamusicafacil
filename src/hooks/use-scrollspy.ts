import { useState, useEffect, useCallback } from 'react';

interface UseScrollspyOptions {
  offset?: number;
  rootMargin?: string;
  threshold?: number | number[];
}

export const useScrollspy = (
  sectionIds: string[],
  options: UseScrollspyOptions = {}
) => {
  const [activeId, setActiveId] = useState<string>('');

  const {
    offset = 80,
    rootMargin = `-${offset}px 0px -60% 0px`,
    threshold = [0.1, 0.3, 0.6]
  } = options;

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return;

    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });

    // Atualizar hash na URL sem recarregar a página
    history.replaceState(null, '', `#${sectionId}`);
    
    // Focar no heading da seção após scroll
    const heading = document.getElementById(`${sectionId}-title`) as HTMLElement;
    if (heading) {
      setTimeout(() => {
        heading.focus();
      }, 300);
    }
  }, [offset]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        
        if (visible?.target?.id) {
          setActiveId(visible.target.id);
        }
      },
      { 
        rootMargin,
        threshold
      }
    );

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [sectionIds, rootMargin, threshold]);

  // Deep link: verificar hash na URL ao carregar
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && sectionIds.includes(hash)) {
      // Aguardar um pouco para garantir que a página carregou
      setTimeout(() => {
        scrollToSection(hash);
      }, 100);
    }
  }, [sectionIds, scrollToSection]);

  return { activeId, scrollToSection };
};
