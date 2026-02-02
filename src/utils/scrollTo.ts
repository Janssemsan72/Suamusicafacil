import { scrollManager } from './scrollManager';

/**
 * Função para scroll para elementos com parada garantida
 * Agora usa o scrollManager centralizado para evitar conflitos
 */
export const scrollToId = (elementId: string): void => {
  const scrollContainer = document.getElementById('main-scroll-container');
  scrollManager.scrollToElement(elementId, 80, scrollContainer || null);
};
