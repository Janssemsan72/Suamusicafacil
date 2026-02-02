import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { scheduleNonCriticalRender } from '@/utils/scheduleNonCriticalRender';

// Verificar se está em desenvolvimento
const isDev = import.meta.env.DEV;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWA_NOTIFICATION_DISMISSED_KEY = 'pwa-install-notification-dismissed';
const PWA_NOTIFICATION_DISMISSED_EXPIRY_DAYS = 7; // Mostrar novamente após 7 dias
const PWA_INSTALL_ATTEMPTS_KEY = 'pwa-install-attempts';
const PWA_LAST_SHOWN_KEY = 'pwa-last-shown';

// Analytics helper
const trackPWAEvent = (event: string, data?: Record<string, any>) => {
  try {
    // Enviar para analytics (pode ser Google Analytics, Mixpanel, etc.)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, {
        event_category: 'PWA',
        ...data,
      });
    }
    if (isDev) {
      console.log(`[PWA Analytics] ${event}`, data);
    }
  } catch (error) {
    if (isDev) {
      console.warn('[PWA] Erro ao rastrear evento:', error);
    }
  }
};

export function usePWA() {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [shouldShowNotification, setShouldShowNotification] = useState(false);
  const notificationShownRef = useRef(false); // ✅ Evitar múltiplas notificações
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Registrar service worker apenas na área admin
  useEffect(() => {
    if (!isAdminRoute) {
      if (isDev) {
        console.log('[PWA] Não está na área admin, pulando registro');
      }
      return;
    }
    
    if (!('serviceWorker' in navigator)) {
      if (isDev) {
        console.warn('[PWA] Service Worker não suportado neste navegador');
      }
      return;
    }

    // Log removido para reduzir verbosidade

    let updateInterval: NodeJS.Timeout | null = null;
    let focusHandler: (() => void) | null = null;

    const registerServiceWorker = () => navigator.serviceWorker
      .register('/sw-admin.js', { 
        scope: '/admin/',
        updateViaCache: 'none'
      })
      .then((registration) => {
        // Logs removidos para reduzir verbosidade - apenas erros serão logados

        // Verificar se o service worker está ativo
        if (registration.active) {
          // Service Worker ativo - log removido para reduzir verbosidade
        } else if (registration.installing) {
          // Service Worker instalando - log removido para reduzir verbosidade
          registration.installing.addEventListener('statechange', () => {
            if (isDev) {
              console.log('[PWA] Estado do Service Worker:', registration.installing?.state);
            }
          });
        } else if (registration.waiting) {
          if (isDev) {
            console.log('[PWA] ⏳ Service Worker está esperando para ativar...');
          }
        }

        updateInterval = setInterval(() => {
          registration.update().catch(err => {
            if (isDev) {
              console.warn('[PWA] Erro ao atualizar Service Worker:', err);
            }
          });
        }, 300000);

        // Escutar atualizações
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (isDev) {
                console.log('[PWA] Estado do novo Service Worker:', newWorker.state);
              }
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                if (isDev) {
                  console.log('[PWA] Nova versão disponível!');
                }
                // Notificar usuário sobre nova versão
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('Nova versão disponível', {
                    body: 'Uma nova versão do app está disponível. Recarregue a página para atualizar.',
                    icon: '/icon-admin-192.png',
                    tag: 'sw-update',
                  });
                }
              }
            });
          }
        });

        focusHandler = () => {
          registration.update().catch(err => {
            if (isDev) {
              console.warn('[PWA] Erro ao verificar atualizações:', err);
            }
          });
        };
        window.addEventListener('focus', focusHandler);
      })
      .catch((error) => {
        // Suprimir erros de sandbox que são comuns em desenvolvimento e não afetam funcionalidade
        const errorMessage = error?.message || '';
        const isSandboxError = errorMessage.includes('sandboxed') || 
                               errorMessage.includes('allow-scripts') ||
                               errorMessage.includes('about:blank') ||
                               errorMessage.includes('Blocked script execution') ||
                               errorMessage.includes('document\'s frame is sandboxed');
        
        if (isSandboxError) {
          // Erro de sandbox é comum em desenvolvimento e não afeta funcionalidade
          // Geralmente causado por extensões do navegador ou contextos restritos
          if (isDev) {
            console.debug('[PWA] ⚠️ Erro de sandbox suprimido (não afeta funcionalidade):', errorMessage);
          }
          return;
        }
        
        if (isDev) {
          console.error('[PWA] ❌ Erro ao registrar Service Worker:', error);
          console.error('[PWA] Detalhes do erro:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
        }
      });

    scheduleNonCriticalRender(registerServiceWorker, { timeoutMs: 2000, delayMs: 500 });

    // Verificar se já está instalado - Melhorado para mobile
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    const isInWebAppChrome = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    const isInWebAppMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;
    
    // Verificar também se está em modo PWA através de outras formas
    const isPWAInstalled = isStandalone || isInWebAppiOS || isInWebAppChrome || 
                          isInWebAppFullscreen || isInWebAppMinimalUI ||
                          window.matchMedia('(display-mode: browser)').matches === false;
    
    // Verificar se está em modo standalone no iOS
    const isIOSStandalone = /iPhone|iPad|iPod/.test(navigator.userAgent) && 
                           ((window.navigator as any).standalone === true || 
                            window.matchMedia('(display-mode: standalone)').matches);
    
    if (isPWAInstalled || isIOSStandalone) {
      if (isDev) {
        console.log('[PWA] ✅ App já está instalado (standalone mode)', {
          isStandalone,
          isInWebAppiOS,
          isInWebAppChrome,
          isInWebAppFullscreen,
          isInWebAppMinimalUI,
          isIOSStandalone
        });
      }
      setIsInstalled(true);
      setIsInstallable(false);
      trackPWAEvent('pwa_already_installed', {
        platform: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : 'other',
      });
    } else {
      if (isDev) {
        console.log('[PWA] App não está instalado ainda', {
          isStandalone,
          isInWebAppiOS,
          userAgent: navigator.userAgent
        });
      }
    }

    // Verificar se a notificação foi descartada recentemente
    const checkNotificationDismissed = () => {
      try {
        const dismissed = localStorage.getItem(PWA_NOTIFICATION_DISMISSED_KEY);
        if (!dismissed) return true; // Nunca foi descartada, pode mostrar
        
        const dismissedDate = new Date(dismissed);
        const now = new Date();
        const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // Se passou mais de X dias, pode mostrar novamente
        return daysSinceDismissed >= PWA_NOTIFICATION_DISMISSED_EXPIRY_DAYS;
      } catch {
        return true; // Em caso de erro, permitir mostrar
      }
    };

    // Escutar evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      if (isDev) {
        console.log('[PWA] ✅ Evento beforeinstallprompt recebido!');
      }
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      
      trackPWAEvent('pwa_installable', {
        platform: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : 
                  /Android/.test(navigator.userAgent) ? 'android' : 'desktop',
      });
      
      // ✅ CORREÇÃO: Verificar se já mostrou notificação para evitar duplicatas
      if (notificationShownRef.current) {
        if (isDev) {
          console.log('[PWA] Notificação já foi exibida, ignorando evento beforeinstallprompt');
        }
        return;
      }
      
      // Verificar se deve mostrar a notificação
      if (checkNotificationDismissed() && !isInstalled) {
        if (isDev) {
          console.log('[PWA] Evento beforeinstallprompt recebido, mostrando notificação em 1 segundo...');
        }
        // Aguardar um pouco para garantir que a página carregou
        setTimeout(() => {
          if (!notificationShownRef.current) {
            if (isDev) {
              console.log('[PWA] Exibindo notificação de instalação (via beforeinstallprompt)');
            }
            notificationShownRef.current = true; // Marcar como exibida ANTES de setar o estado
            setShouldShowNotification(true);
            setIsInstallable(true);
            
            // Salvar timestamp da última exibição
            try {
              localStorage.setItem(PWA_LAST_SHOWN_KEY, new Date().toISOString());
            } catch (e) {
              // Ignorar erro
            }
            
            trackPWAEvent('pwa_prompt_shown');
          } else {
            if (isDev) {
              console.log('[PWA] Notificação já foi exibida, ignorando');
            }
          }
        }, 1000); // ✅ Reduzido para 1 segundo já que o evento já disparou
      } else {
        if (isDev) {
          console.log('[PWA] Notificação não será mostrada:', {
            checkNotificationDismissed: checkNotificationDismissed(),
            isInstalled
          });
        }
      }
    };

    // Verificar se o evento já foi disparado antes de adicionar o listener
    if (isDev) {
      console.log('[PWA] Adicionando listener para beforeinstallprompt...');
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Log de diagnóstico (apenas em dev)
    if (isDev) {
      const diagnostics = {
        isAdminRoute,
        serviceWorkerSupported: 'serviceWorker' in navigator,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        isHTTPS: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
        userAgent: navigator.userAgent,
        manifestLink: document.querySelector('link[rel="manifest"]')?.getAttribute('href')
      };
      console.log('[PWA] Diagnóstico:', diagnostics);
    }
    
    // Escutar evento appinstalled (declarar ANTES de usar no cleanup)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShouldShowNotification(false);
      if (isDev) {
        console.log('[PWA] App instalado!');
      }
      
      // Limpar dados de tracking
      try {
        localStorage.removeItem(PWA_NOTIFICATION_DISMISSED_KEY);
        localStorage.removeItem(PWA_INSTALL_ATTEMPTS_KEY);
        localStorage.removeItem(PWA_LAST_SHOWN_KEY);
      } catch (e) {
        // Ignorar erro
      }
      
      trackPWAEvent('pwa_installed', {
        platform: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : 
                  /Android/.test(navigator.userAgent) ? 'android' : 'desktop',
      });
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // ✅ CORREÇÃO: Mostrar notificação mesmo se o evento não disparar
    // Alguns navegadores não disparam beforeinstallprompt, mas ainda permitem instalação
    // Vamos mostrar a notificação após um delay se o service worker estiver registrado
    let fallbackTimeout: NodeJS.Timeout | null = null;
    let promptReceived = false;
    
    const cleanupListener = () => {
      promptReceived = true;
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
      }
    };
    
    // Escutar se o prompt chegar antes do timeout
    window.addEventListener('beforeinstallprompt', cleanupListener, { once: true });
    
    // Verificar se deve mostrar fallback (usar verificação direta, não estado)
    const currentIsInstalled = window.matchMedia('(display-mode: standalone)').matches;
    const canShowNotification = checkNotificationDismissed();
    
    // ✅ CORREÇÃO: Só configurar fallback se ainda não mostrou notificação
    // E aumentar o delay para 4 segundos para dar tempo do evento beforeinstallprompt disparar primeiro
    if (!currentIsInstalled && canShowNotification && !notificationShownRef.current) {
      if (isDev) {
        console.log('[PWA] Configurando fallback para mostrar notificação em 4 segundos (se evento não disparar)...');
      }
      fallbackTimeout = setTimeout(() => {
        // ✅ CORREÇÃO: Verificar se já mostrou notificação antes de exibir
        if (notificationShownRef.current) {
          if (isDev) {
            console.log('[PWA] Notificação já foi exibida, cancelando fallback');
          }
          return;
        }
        
        // Verificar novamente se ainda não está instalado, não foi descartado e o prompt não chegou
        const stillNotInstalled = !window.matchMedia('(display-mode: standalone)').matches;
        const stillNotDismissed = checkNotificationDismissed();
        
        if (stillNotInstalled && stillNotDismissed && !promptReceived && !notificationShownRef.current) {
          if (isDev) {
            console.log('[PWA] ✅ Evento beforeinstallprompt não disparou após 4s, mostrando notificação de fallback');
          }
          notificationShownRef.current = true; // Marcar como exibida
          setShouldShowNotification(true);
          setIsInstallable(true); // Permitir tentar instalar mesmo sem o prompt
        } else {
          if (isDev) {
            console.log('[PWA] Fallback não será exibido:', {
              stillNotInstalled,
              stillNotDismissed,
              promptReceived,
              alreadyShown: notificationShownRef.current
            });
          }
        }
      }, 4000); // ✅ Aumentado para 4 segundos para dar tempo do evento disparar primeiro
    } else {
      if (isDev) {
        console.log('[PWA] Fallback não será configurado:', {
          currentIsInstalled,
          canShowNotification,
          alreadyShown: notificationShownRef.current
        });
      }
    }
    
    // Limpar no cleanup do useEffect
    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      if (focusHandler) {
        window.removeEventListener('focus', focusHandler);
      }
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
      window.removeEventListener('beforeinstallprompt', cleanupListener);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isAdminRoute]);

  // Adicionar manifest apenas na área admin
  useEffect(() => {
    if (!isAdminRoute) {
      // Remover manifest se não estiver na área admin
      const existingManifest = document.querySelector('link[rel="manifest"]');
      if (existingManifest && existingManifest.getAttribute('href') === '/manifest-admin.json') {
        existingManifest.remove();
      }
      return;
    }

      // Log removido para reduzir verbosidade
    
    // Verificar se o manifest já existe
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
      // Log removido para reduzir verbosidade
    }

    manifestLink.href = '/manifest-admin.json';
    // Log removido para reduzir verbosidade
    
    // Verificar se o manifest está acessível
    fetch('/manifest-admin.json')
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          if (isDev) {
            console.error('[PWA] ❌ Manifest não está acessível:', res.status);
          }
        }
      })
      .then(manifest => {
        // Manifest carregado - log removido para reduzir verbosidade
      })
      .catch(error => {
        if (isDev) {
          console.error('[PWA] ❌ Erro ao carregar manifest:', error);
        }
      });

    return () => {
      // Não remover o manifest ao sair, pois pode estar sendo usado
    };
  }, [isAdminRoute]);

  const installPWA = async () => {
    // Rastrear tentativa de instalação
    try {
      const attempts = parseInt(localStorage.getItem(PWA_INSTALL_ATTEMPTS_KEY) || '0', 10);
      localStorage.setItem(PWA_INSTALL_ATTEMPTS_KEY, String(attempts + 1));
      trackPWAEvent('pwa_install_attempt', { attempt: attempts + 1 });
    } catch (e) {
      // Ignorar erro
    }
    
    // Se temos o prompt nativo, usar ele
    if (deferredPrompt) {
      try {
        if (isDev) {
          console.log('[PWA] Usando prompt nativo de instalação');
        }
        trackPWAEvent('pwa_prompt_triggered');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          if (isDev) {
            console.log('[PWA] Usuário aceitou a instalação');
          }
          setIsInstallable(false);
          setDeferredPrompt(null);
          trackPWAEvent('pwa_install_accepted');
          return true;
        } else {
          if (isDev) {
            console.log('[PWA] Usuário rejeitou a instalação');
          }
          trackPWAEvent('pwa_install_rejected');
          return false;
        }
      } catch (error) {
        if (isDev) {
          console.error('[PWA] Erro ao usar prompt nativo:', error);
        }
        trackPWAEvent('pwa_install_error', { error: error instanceof Error ? error.message : 'unknown' });
        // Continuar para fallback
      }
    }
    
    // Fallback: Mostrar instruções de instalação manual
    if (isDev) {
      console.log('[PWA] Prompt nativo não disponível, mostrando instruções');
    }
    
    // Detectar navegador e mostrar instruções apropriadas
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let instructions = '';
    let steps: string[] = [];
    
    if (isMobile) {
      if (isIOS) {
        // iOS Safari
        steps = [
          '1. Toque no botão "Compartilhar" (□↑) na barra inferior',
          '2. Role para baixo e toque em "Adicionar à Tela de Início"',
          '3. Toque em "Adicionar" no canto superior direito'
        ];
        instructions = steps.join('\n');
      } else if (isAndroid) {
        // Android Chrome/Edge
        steps = [
          '1. Toque no menu (⋮) no canto superior direito',
          '2. Procure por "Adicionar à tela inicial" ou "Instalar app"',
          '3. Toque para instalar'
        ];
        instructions = steps.join('\n');
      } else {
        instructions = 'No menu do navegador, procure por "Adicionar à tela inicial" ou "Instalar app"';
      }
    } else {
      // Desktop
      if (isChrome || isEdge) {
        steps = [
          '1. Procure o ícone de instalação (➕) na barra de endereços (canto direito)',
          '2. Clique no ícone ou vá em Menu (⋮) > "Instalar MusicLovely Admin"',
          '3. Confirme a instalação na janela que aparecer'
        ];
        instructions = steps.join('\n');
      } else if (isFirefox) {
        steps = [
          '1. Clique no ícone de casa na barra de endereços',
          '2. Clique em "Instalar" ou "Adicionar à Tela de Início"',
          '3. Confirme a instalação'
        ];
        instructions = steps.join('\n');
      } else if (isSafari) {
        steps = [
          '1. Vá em Arquivo > "Adicionar à Tela de Início"',
          '2. Ou use o menu Compartilhar (□↑) > "Adicionar à Tela de Início"',
          '3. Confirme a instalação'
        ];
        instructions = steps.join('\n');
      } else {
        instructions = 'Use o menu do navegador para instalar este site como um app. Procure por "Instalar" ou "Adicionar à Tela de Início".';
      }
    }
    
    // Retornar false mas com instruções (será tratado no componente)
    return { fallback: true, instructions, steps, isMobile, isIOS, isAndroid };
  };

  const dismissNotification = () => {
    try {
      localStorage.setItem(PWA_NOTIFICATION_DISMISSED_KEY, new Date().toISOString());
      setShouldShowNotification(false);
      notificationShownRef.current = true; // Marcar como exibida para evitar mostrar novamente
      
      // Rastrear dismiss
      trackPWAEvent('pwa_prompt_dismissed');
    } catch (error) {
      if (isDev) {
        console.error('[PWA] Erro ao salvar preferência de notificação:', error);
      }
    }
  };

  // Função para verificar atualizações do service worker
  const checkForUpdates = async () => {
    if (!('serviceWorker' in navigator) || !isAdminRoute) return;
    
    try {
      const registration = await navigator.serviceWorker.getRegistration('/admin/');
      if (registration) {
        await registration.update();
        if (isDev) {
          console.log('[PWA] Verificação de atualizações concluída');
        }
      }
    } catch (error) {
      if (isDev) {
        console.error('[PWA] Erro ao verificar atualizações:', error);
      }
    }
  };

  return {
    isInstallable,
    isInstalled,
    installPWA,
    shouldShowNotification,
    dismissNotification,
    checkForUpdates,
  };
}

