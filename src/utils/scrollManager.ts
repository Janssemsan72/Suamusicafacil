/**
 * Sistema centralizado de gerenciamento de scroll
 * Previne múltiplos scrolls simultâneos e garante comportamento consistente
 */

interface ScrollTask {
  id: string;
  target: number;
  container: HTMLElement | Window;
  timeoutId?: NodeJS.Timeout;
  animationFrameId?: number;
}

class ScrollManager {
  private activeScrolls: Map<string, ScrollTask> = new Map();
  private scrollLock: boolean = false;
  private lastScrollTime: number = 0;
  private readonly SCROLL_DEBOUNCE_MS = 50;
  private readonly MAX_SCROLL_DURATION_MS = 2000;

  /**
   * Cancela todos os scrolls ativos
   */
  cancelAllScrolls(): void {
    this.activeScrolls.forEach((task) => {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      if (task.animationFrameId) {
        cancelAnimationFrame(task.animationFrameId);
      }
    });
    this.activeScrolls.clear();
    this.scrollLock = false;
  }

  /**
   * Cancela scrolls para um container específico
   */
  cancelScrollsForContainer(container: HTMLElement | Window): void {
    const containerId = container === window ? 'window' : (container as HTMLElement).id || 'unknown';
    const tasksToCancel: string[] = [];

    this.activeScrolls.forEach((task, id) => {
      if (task.container === container) {
        tasksToCancel.push(id);
        if (task.timeoutId) {
          clearTimeout(task.timeoutId);
        }
        if (task.animationFrameId) {
          cancelAnimationFrame(task.animationFrameId);
        }
      }
    });

    tasksToCancel.forEach((id) => {
      this.activeScrolls.delete(id);
    });
  }

  /**
   * Scroll para o topo (instantâneo, para navegação de páginas)
   */
  scrollToTop(container?: HTMLElement | null): void {
    // Cancelar todos os scrolls anteriores
    this.cancelAllScrolls();

    const now = Date.now();
    // Reduzir debounce para scrolls para o topo (mais responsivo)
    if (now - this.lastScrollTime < 10) {
      return;
    }
    this.lastScrollTime = now;

    const scrollContainer = container || document.getElementById('main-scroll-container');
    const taskId = `scroll-to-top-${Date.now()}`;

    const executeScroll = () => {
      // Prevenir scroll para o final - garantir que sempre vai para o topo
      if (scrollContainer) {
        // Container customizado
        scrollContainer.scrollTop = 0;
        scrollContainer.scrollTo({
          top: 0,
          left: 0,
          behavior: 'auto'
        });
        // Forçar novamente para garantir
        if (scrollContainer.scrollTop !== 0) {
          scrollContainer.scrollTop = 0;
        }
      } else {
        // Window scroll
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'auto'
        });
        document.documentElement.scrollTop = 0;
        if (document.body) {
          document.body.scrollTop = 0;
        }
        // Forçar novamente para garantir
        if (window.pageYOffset !== 0) {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          document.documentElement.scrollTop = 0;
          if (document.body) {
            document.body.scrollTop = 0;
          }
        }
      }

      // Garantir que ficou no topo após um pequeno delay (múltiplas verificações)
      const verifyTimeout = setTimeout(() => {
        if (scrollContainer) {
          if (scrollContainer.scrollTop > 5) {
            scrollContainer.scrollTop = 0;
            scrollContainer.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          }
        } else {
          if (window.pageYOffset > 5) {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            document.documentElement.scrollTop = 0;
            if (document.body) {
              document.body.scrollTop = 0;
            }
          }
        }
        
        // Verificação adicional após mais tempo
        setTimeout(() => {
          if (scrollContainer) {
            if (scrollContainer.scrollTop > 5) {
              scrollContainer.scrollTop = 0;
            }
          } else {
            if (window.pageYOffset > 5) {
              window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            }
          }
        }, 200);
        
        this.activeScrolls.delete(taskId);
      }, 100);

      const task: ScrollTask = {
        id: taskId,
        target: 0,
        container: scrollContainer || window,
        timeoutId: verifyTimeout
      };

      this.activeScrolls.set(taskId, task);

      // Auto-remover após duração máxima
      setTimeout(() => {
        this.activeScrolls.delete(taskId);
      }, this.MAX_SCROLL_DURATION_MS);
    };

    // Executar imediatamente
    executeScroll();

    // Verificar novamente após renderização (múltiplas vezes para garantir)
    requestAnimationFrame(() => {
      executeScroll();
      
      // Verificações adicionais
      setTimeout(() => {
        executeScroll();
      }, 50);
      
      setTimeout(() => {
        executeScroll();
      }, 150);
    });
  }

  /**
   * Scroll para um elemento específico (suave, para seções na mesma página)
   */
  scrollToElement(
    elementId: string,
    offset: number = 80,
    container?: HTMLElement | null,
    retries: number = 3
  ): void {
    // Cancelar scrolls anteriores para o mesmo container
    const scrollContainer = container || document.getElementById('main-scroll-container');
    if (scrollContainer) {
      this.cancelScrollsForContainer(scrollContainer);
    } else {
      this.cancelScrollsForContainer(window);
    }

    const element = document.getElementById(elementId);
    if (!element) {
      if (retries > 0) {
        // Tentar novamente após um delay
        setTimeout(() => {
          this.scrollToElement(elementId, offset, container, retries - 1);
        }, 300);
      }
      return;
    }

    const now = Date.now();
    if (now - this.lastScrollTime < this.SCROLL_DEBOUNCE_MS) {
      return;
    }
    this.lastScrollTime = now;

    const taskId = `scroll-to-${elementId}-${Date.now()}`;

    const executeScroll = () => {
      if (scrollContainer) {
        // ✅ OTIMIZAÇÃO: Batch DOM reads para evitar forced reflows
        // Ler todas as propriedades geométricas de uma vez antes de qualquer escrita
        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const currentScrollTop = scrollContainer.scrollTop;
        const elementTopRelativeToContainer = elementRect.top - containerRect.top;
        const elementTopInContainer = currentScrollTop + elementTopRelativeToContainer;
        const targetScroll = Math.max(0, elementTopInContainer - offset);

        // ✅ OTIMIZAÇÃO: Aplicar scroll em requestAnimationFrame após todas as leituras
        requestAnimationFrame(() => {
          scrollContainer.scrollTo({
            top: targetScroll,
            left: 0,
            behavior: 'smooth'
          });
        });

        // Garantir posição após scroll
        const verifyTimeout = setTimeout(() => {
          scrollContainer.scrollTop = targetScroll;
          // Verificar novamente
          setTimeout(() => {
            if (Math.abs(scrollContainer.scrollTop - targetScroll) > 10) {
              scrollContainer.scrollTop = targetScroll;
            }
            this.activeScrolls.delete(taskId);
          }, 200);
        }, 1000);

        const task: ScrollTask = {
          id: taskId,
          target: targetScroll,
          container: scrollContainer,
          timeoutId: verifyTimeout
        };

        this.activeScrolls.set(taskId, task);
      } else {
        // ✅ OTIMIZAÇÃO: Window scroll - batch DOM reads
        // Ler todas as propriedades geométricas de uma vez antes de qualquer escrita
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        const targetScroll = Math.max(0, offsetPosition);

        // ✅ OTIMIZAÇÃO: Aplicar scroll em requestAnimationFrame após todas as leituras
        requestAnimationFrame(() => {
          window.scrollTo({
            top: targetScroll,
            left: 0,
            behavior: 'smooth'
          });
        });

        // Garantir posição após scroll
        const verifyTimeout = setTimeout(() => {
          window.scrollTo({
            top: targetScroll,
            left: 0,
            behavior: 'auto'
          });
          // Verificar novamente
          setTimeout(() => {
            if (Math.abs(window.pageYOffset - targetScroll) > 10) {
              window.scrollTo({
                top: targetScroll,
                left: 0,
                behavior: 'auto'
              });
            }
            this.activeScrolls.delete(taskId);
          }, 200);
        }, 1000);

        const task: ScrollTask = {
          id: taskId,
          target: targetScroll,
          container: window,
          timeoutId: verifyTimeout
        };

        this.activeScrolls.set(taskId, task);
      }

      // Auto-remover após duração máxima
      setTimeout(() => {
        this.activeScrolls.delete(taskId);
      }, this.MAX_SCROLL_DURATION_MS);
    };

    // Executar após um pequeno delay para garantir que o DOM está pronto
    requestAnimationFrame(() => {
      executeScroll();
    });
  }
}

// Singleton instance
export const scrollManager = new ScrollManager();

