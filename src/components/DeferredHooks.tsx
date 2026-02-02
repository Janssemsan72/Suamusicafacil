import { useScrollAnimations } from '@/hooks/use-scroll-animations';

/**
 * Componente que carrega hooks pesados de forma deferida
 * Usado para não bloquear renderização inicial
 */
export function DeferredHooks() {
  useScrollAnimations();
  return null;
}

