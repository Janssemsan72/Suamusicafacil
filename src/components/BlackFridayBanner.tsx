import React, { useState, useEffect } from "react";
import { X, Zap } from "@/lib/icons";

interface BlackFridayBannerProps {
  onClose?: () => void;
}

const BlackFridayBanner: React.FC<BlackFridayBannerProps> = ({ onClose }) => {
  const [timeLeft, setTimeLeft] = useState(5 * 60 * 1000); // 5 minutos em milissegundos
  const [isVisible, setIsVisible] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(64);

  useEffect(() => {
    // ✅ OTIMIZAÇÃO: Cachear valores geométricos para evitar forced reflows
    let cachedHeaderHeight = 64;
    let cachedBannerRect: DOMRect | null = null;
    let lastHeaderCheck = 0;
    const HEADER_CHECK_THROTTLE = 100; // Verificar header apenas a cada 100ms
    
    // Calcular altura do header dinamicamente (com cache)
    const updateHeaderHeight = () => {
      if (typeof window === 'undefined') return;
      
      const now = Date.now();
      // ✅ OTIMIZAÇÃO: Throttle para evitar leituras frequentes
      if (now - lastHeaderCheck < HEADER_CHECK_THROTTLE) {
        return cachedHeaderHeight;
      }
      lastHeaderCheck = now;
      
      const header = document.querySelector('header');
      if (header) {
        // ✅ OTIMIZAÇÃO: Ler offsetHeight apenas quando necessário
        cachedHeaderHeight = header.offsetHeight;
        setHeaderHeight(cachedHeaderHeight);
      } else {
        cachedHeaderHeight = 0;
        setHeaderHeight(0);
      }
      
      return cachedHeaderHeight;
    };

    // Aguardar o DOM estar pronto
    if (typeof window !== 'undefined') {
      // Tentar imediatamente
      updateHeaderHeight();
      
      // Tentar após um pequeno delay para garantir que o header foi renderizado
      const timeoutId = setTimeout(updateHeaderHeight, 100);
      
      // ✅ OTIMIZAÇÃO: Throttle resize listener
      let resizeTimeout: ReturnType<typeof setTimeout>;
      const throttledResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateHeaderHeight, 100);
      };
      window.addEventListener('resize', throttledResize);
      
      // ✅ Detectar quando o teclado abre/fecha no mobile para manter banner fixo
      let bannerFixedTop = cachedHeaderHeight; // Armazenar posição fixa do banner
      let isLocked = false; // Flag para prevenir mudanças
      
      // ✅ OTIMIZAÇÃO: Batch DOM operations para evitar forced reflows
      const forceBannerPosition = (lock = false) => {
        if (lock) isLocked = true;
        
        requestAnimationFrame(() => {
          const banner = document.querySelector('.banner-fixed') as HTMLElement;
          if (!banner) return;
          
          // ✅ OTIMIZAÇÃO: Ler valores geométricos apenas uma vez e cachear
          const header = document.querySelector('header');
          const currentHeaderHeight = header ? (header.offsetHeight || cachedHeaderHeight) : cachedHeaderHeight;
          
          // Se não estiver travado, atualizar posição fixa
          if (!isLocked) {
            bannerFixedTop = currentHeaderHeight;
            cachedHeaderHeight = currentHeaderHeight;
          }
          
          const targetTop = bannerFixedTop;
          
          // ✅ OTIMIZAÇÃO: Batch todas as mudanças de estilo em uma única operação
          // Ler getBoundingClientRect apenas uma vez, após todas as mudanças
          requestAnimationFrame(() => {
            // Aplicar todas as mudanças de estilo de uma vez
            Object.assign(banner.style, {
              position: 'fixed',
              zIndex: '9999',
              top: `${targetTop}px`,
              left: '0',
              right: '0',
              width: '100%',
              display: 'block',
              visibility: 'visible',
              opacity: '1',
              transform: 'translateZ(0)',
              webkitTransform: 'translateZ(0)',
              pointerEvents: 'auto',
              maxHeight: 'none',
              overflow: 'visible',
              marginTop: '0',
              marginBottom: '0',
              paddingTop: '0',
              paddingBottom: '0',
              bottom: 'auto'
            });
            
            // ✅ OTIMIZAÇÃO: Verificar posição apenas uma vez, após todas as mudanças
            requestAnimationFrame(() => {
              // Cachear rect para evitar múltiplas leituras
              if (!cachedBannerRect) {
                cachedBannerRect = banner.getBoundingClientRect();
              } else {
                // Atualizar cache apenas se necessário
                const rect = banner.getBoundingClientRect();
                cachedBannerRect = rect;
              }
              
              const expectedTop = bannerFixedTop;
              if (cachedBannerRect && Math.abs(cachedBannerRect.top - expectedTop) > 1) {
                banner.style.top = `${expectedTop}px`;
                // Invalidar cache para próxima verificação
                cachedBannerRect = null;
              }
            });
          });
        });
      };
      
      const handleViewportChange = () => {
        updateHeaderHeight();
        // Forçar banner na posição correta após mudança no viewport
        setTimeout(forceBannerPosition, 50);
        setTimeout(forceBannerPosition, 150);
        setTimeout(forceBannerPosition, 300);
        setTimeout(forceBannerPosition, 500);
      };
      
      // Detectar mudanças no viewport (teclado abrindo/fechando)
      window.addEventListener('resize', handleViewportChange);
      window.addEventListener('orientationchange', handleViewportChange);
      
      // Listener de scroll que respeita o lock
      const handleScroll = () => {
        if (isLocked) {
          // Se está travado, forçar posição fixa
          forceBannerPosition(true);
        } else {
          forceBannerPosition();
        }
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      
      // Detectar quando inputs recebem foco (teclado pode abrir)
      const handleInputFocus = (e: Event) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          // TRAVAR a posição do banner ANTES do teclado abrir
          forceBannerPosition(true);
          
          // Forçar banner na posição fixa IMEDIATAMENTE (antes do teclado abrir)
          requestAnimationFrame(() => forceBannerPosition(true));
          requestAnimationFrame(() => forceBannerPosition(true));
          
          // Múltiplas tentativas para garantir que o banner permaneça FIXO durante preenchimento
          setTimeout(() => forceBannerPosition(true), 0);
          setTimeout(() => forceBannerPosition(true), 5);
          setTimeout(() => forceBannerPosition(true), 10);
          setTimeout(() => forceBannerPosition(true), 20);
          setTimeout(() => forceBannerPosition(true), 30);
          setTimeout(() => forceBannerPosition(true), 50);
          setTimeout(() => forceBannerPosition(true), 100);
          setTimeout(() => forceBannerPosition(true), 150);
          setTimeout(() => forceBannerPosition(true), 250);
          setTimeout(() => forceBannerPosition(true), 400);
          setTimeout(() => forceBannerPosition(true), 600);
          setTimeout(() => forceBannerPosition(true), 800);
          setTimeout(() => forceBannerPosition(true), 1200);
          setTimeout(() => forceBannerPosition(true), 1800);
        }
      };
      
      // Monitorar enquanto o usuário digita
      const handleInput = (e: Event) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          // Garantir que o banner permaneça FIXO enquanto digita
          forceBannerPosition(true);
        }
      };
      
      const handleInputBlur = (e: Event) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          // Destravar após um delay
          setTimeout(() => {
            isLocked = false;
            forceBannerPosition();
          }, 300);
          setTimeout(() => forceBannerPosition(), 50);
          setTimeout(() => forceBannerPosition(), 200);
          setTimeout(() => forceBannerPosition(), 400);
        }
      };
      
      // Monitorar mudanças no viewport height (indicativo de teclado)
      let lastViewportHeight = window.innerHeight;
      const checkViewportChange = () => {
        const currentHeight = window.innerHeight;
        if (Math.abs(currentHeight - lastViewportHeight) > 50) {
          // Mudança significativa no viewport (provavelmente teclado)
          // Forçar banner a permanecer na posição fixa
          forceBannerPosition();
          lastViewportHeight = currentHeight;
        }
        // Sempre verificar se o banner está na posição correta
        forceBannerPosition();
      };
      
      const viewportCheckInterval = setInterval(checkViewportChange, 30);
      
      // Função para adicionar listeners aos inputs
      const attachInputListeners = () => {
        // Monitorar inputs especificamente (email e WhatsApp)
        const emailInputs = document.querySelectorAll('input[type="email"]');
        const telInputs = document.querySelectorAll('input[type="tel"]');
        const allInputs = [...emailInputs, ...telInputs];
        
        allInputs.forEach(input => {
          // Remover listeners antigos antes de adicionar novos (evitar duplicatas)
          input.removeEventListener('focus', handleInputFocus);
          input.removeEventListener('input', handleInput);
          input.removeEventListener('blur', handleInputBlur);
          
          // Adicionar listeners
          input.addEventListener('focus', handleInputFocus);
          input.addEventListener('input', handleInput);
          input.addEventListener('blur', handleInputBlur);
        });
      };
      
      // Adicionar listeners inicialmente
      attachInputListeners();
      
      // Usar MutationObserver para detectar quando novos inputs são adicionados ao DOM
      const observer = new MutationObserver(() => {
        attachInputListeners();
      });
      
      // Observar mudanças no DOM
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
      
      // Também adicionar listeners globais
      document.addEventListener('focusin', handleInputFocus);
      document.addEventListener('focusout', handleInputBlur);
      
      // Monitorar continuamente se há inputs em foco
      const checkInputsFocused = () => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          // Se há input em foco, TRAVAR o banner na posição fixa
          forceBannerPosition(true);
        } else {
          // Se não há input em foco, destravar
          if (isLocked) {
            isLocked = false;
            forceBannerPosition();
          }
        }
        // Sempre verificar posição do banner
        forceBannerPosition(isLocked);
      };
      
      const inputCheckInterval = setInterval(checkInputsFocused, 50);
      
      return () => {
        clearTimeout(timeoutId);
        clearInterval(viewportCheckInterval);
        clearInterval(inputCheckInterval);
        observer.disconnect();
        window.removeEventListener('resize', updateHeaderHeight);
        window.removeEventListener('resize', handleViewportChange);
        window.removeEventListener('orientationchange', handleViewportChange);
        window.removeEventListener('scroll', handleScroll);
        document.removeEventListener('focusin', handleInputFocus);
        document.removeEventListener('focusout', handleInputBlur);
        
        // Remover listeners de todos os inputs
        const emailInputs = document.querySelectorAll('input[type="email"]');
        const telInputs = document.querySelectorAll('input[type="tel"]');
        const allInputs = [...emailInputs, ...telInputs];
        allInputs.forEach(input => {
          input.removeEventListener('focus', handleInputFocus);
          input.removeEventListener('input', handleInput);
          input.removeEventListener('blur', handleInputBlur);
        });
      };
    }
  }, []);

  // ✅ Garantir que o banner permaneça na posição correta quando headerHeight mudar
  useEffect(() => {
    const forceBannerPosition = () => {
      requestAnimationFrame(() => {
        const banner = document.querySelector('.banner-fixed') as HTMLElement;
        if (banner) {
          const header = document.querySelector('header');
          const currentHeaderHeight = header ? header.offsetHeight : headerHeight;
          
          banner.style.position = 'fixed';
          banner.style.zIndex = '9999';
          banner.style.top = `${currentHeaderHeight}px`;
          banner.style.left = '0';
          banner.style.right = '0';
          banner.style.width = '100%';
          banner.style.display = 'block';
          banner.style.visibility = 'visible';
          banner.style.opacity = '1';
          banner.style.transform = 'translateZ(0)';
          banner.style.webkitTransform = 'translateZ(0)';
        }
      });
    };
    
    forceBannerPosition();
    // Forçar novamente após delays para garantir posição correta
    const timeouts = [
      setTimeout(forceBannerPosition, 50),
      setTimeout(forceBannerPosition, 150),
      setTimeout(forceBannerPosition, 300),
    ];
    
    return () => timeouts.forEach(clearTimeout);
  }, [headerHeight]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 100) {
          clearInterval(timer);
          return 0;
        }
        return prev - 100;
      });
    }, 100); // Atualizar a cada 100ms para mostrar milissegundos

    return () => {
      clearInterval(timer);
    };
  }, []);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 100); // Centésimos de segundo
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  // Calcular porcentagem do tempo restante
  const totalTime = 5 * 60 * 1000; // 5 minutos em milissegundos
  const progressPercentage = (timeLeft / totalTime) * 100;

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible || timeLeft === 0) {
    return null;
  }

  return (
    <>
      <style>{`
        .banner-fixed {
          position: fixed !important;
          z-index: 9999 !important;
          will-change: transform;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          /* Garantir que fique fixo mesmo quando o teclado abrir no mobile */
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          /* Forçar layer de composição independente */
          isolation: isolate;
          contain: layout style paint;
        }
        
        @media screen and (max-width: 768px) {
          .banner-fixed {
            position: fixed !important;
            z-index: 9999 !important;
            /* Forçar layer de composição para garantir que fique fixo */
            transform: translateZ(0) !important;
            -webkit-transform: translateZ(0) !important;
            will-change: transform !important;
            /* Usar viewport fixo para evitar problemas com teclado */
            top: var(--header-height, 64px) !important;
            left: 0 !important;
            right: 0 !important;
            width: 100vw !important;
            /* Prevenir movimento quando teclado abre */
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            /* Garantir que não seja afetado por mudanças no viewport */
            position: fixed !important;
            /* Forçar posição absoluta em relação ao viewport, não ao documento */
            position: -webkit-sticky !important;
            position: sticky !important;
            position: fixed !important;
          }
          
          /* Prevenir que o body/html mova o banner quando teclado abre */
          body:has(input:focus) .banner-fixed,
          body:has(textarea:focus) .banner-fixed {
            position: fixed !important;
            top: var(--header-height, 64px) !important;
            transform: translateZ(0) !important;
            -webkit-transform: translateZ(0) !important;
          }
        }
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      <div
        className="banner-fixed left-0 right-0 bg-black border-t-0 border-b border-yellow-500/30 shadow-lg overflow-hidden"
        style={{
          animation: "slideDown 0.5s ease-out",
          marginTop: 0,
          top: `${headerHeight}px`,
          position: 'fixed',
          zIndex: 9999,
          left: 0,
          right: 0,
          width: '100%',
          '--header-height': `${headerHeight}px`,
        } as React.CSSProperties & { '--header-height': string }}
      >
        {/* Efeito de brilho de fundo simples */}
        <div className="absolute inset-0 bg-yellow-500/5" />
        
          <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-2.5 relative z-10">
            <div className="flex items-center justify-center gap-1 sm:gap-3 md:gap-4 flex-nowrap">
              {/* BLACK NOVEMBER - Texto branco simples */}
              <span className="text-white font-bold text-xs sm:text-xl md:text-2xl whitespace-nowrap">
                BLACK NOVEMBER
              </span>

              {/* Ícone de raio */}
              <Zap 
                className="h-3 w-3 sm:h-5 sm:w-5 text-yellow-400 flex-shrink-0" 
              />

              {/* Desconto por Tempo Limitado! */}
              <span className="text-yellow-400 font-semibold text-[10px] sm:text-base md:text-lg whitespace-nowrap">
                Desconto por Tempo Limitado!
              </span>

              {/* Timer */}
              <span 
                className="text-white font-mono font-bold text-xs sm:text-xl md:text-2xl tabular-nums whitespace-nowrap glow-text"
                style={{
                  animation: "blink 1s infinite",
                }}
              >
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Botão Fechar - Posicionado absolutamente */}
            <button
              onClick={handleClose}
              className="absolute top-2 right-3 sm:right-4 p-1.5 hover:bg-white/10 rounded-lg transition-colors group"
              aria-label="Fechar banner"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5 text-white/80 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Barra de progresso vermelha embaixo */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/20 overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-100 ease-linear"
              style={{
                width: `${progressPercentage}%`,
                boxShadow: "0 0 10px rgba(239, 68, 68, 0.6)",
              }}
            />
          </div>
      </div>
    </>
  );
};

export default BlackFridayBanner;

