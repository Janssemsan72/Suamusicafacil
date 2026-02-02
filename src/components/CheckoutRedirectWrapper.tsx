import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
// ✅ OTIMIZAÇÃO CRÍTICA: Lazy load do Supabase - carregar apenas quando necessário
// import { supabase } from '@/integrations/supabase/client';

/**
 * Wrapper component que intercepta URLs do WhatsApp ANTES do Checkout ser renderizado
 * Redireciona IMEDIATAMENTE para Hotmart se detectar message_id na URL
 */
export default function CheckoutRedirectWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const lastLocationKeyRef = useRef<string>('');
  
  useEffect(() => {
    const locationKey = `${location.pathname}${location.search}`;
    if (lastLocationKeyRef.current === locationKey) {
      return;
    }
    lastLocationKeyRef.current = locationKey;

    const isDev = import.meta.env.DEV;
    const urlParams = new URLSearchParams(location.search);
    const messageId = urlParams.get('message_id');
    const orderId = urlParams.get('order_id');
    const edit = urlParams.get('edit');
    
    // ✅ CORREÇÃO: NÃO redirecionar se for URL do quiz (com ou sem edit=true)
    // O botão "Ajustar Detalhes" deve permitir visualizar/editar o quiz, não redirecionar para Hotmart
    // Mesmo que tenha message_id, order_id, etc., se for rota de quiz, não redirecionar
    const isQuizRoute = location.pathname.includes('/quiz');
    
    if (isQuizRoute) {
      if (isDev) {
        console.log('✅ [CheckoutRedirectWrapper] URL do quiz detectada, NÃO redirecionando para Hotmart', {
          pathname: location.pathname,
          edit: edit,
          orderId: orderId,
          messageId: messageId
        });
      }
      return; // Não redirecionar, permitir que o quiz seja visualizado/editado
    }
    
    // Se tem message_id, significa que veio do WhatsApp e deve ir direto para Hotmart
    // ⚠️ CRÍTICO: Verificar também se a URL contém parâmetros do checkout interno (restore, quiz_id, token)
    // Se contém, significa que está tentando acessar o checkout interno mas deveria ir para Hotmart
    // Mas APENAS se for rota de checkout, não de quiz
    const isCheckoutRoute = location.pathname.includes('/checkout');
    // ✅ CORREÇÃO: Também redirecionar se for rota home (/pt, /en, /es) com order_id e message_id
    const isHomeRoute = /^\/(pt|en|es)(\/)?$/.test(location.pathname);
    const hasCheckoutParams = urlParams.get('restore') === 'true' || urlParams.get('quiz_id') || urlParams.get('token');
    
    // Redirecionar se:
    // 1. For rota de checkout E tiver os parâmetros necessários, OU
    // 2. For rota home (/pt, /en, /es) E tiver message_id e order_id (vindo do WhatsApp)
    const shouldRedirect = (
      (isCheckoutRoute && (messageId || hasCheckoutParams) && orderId) ||
      (isHomeRoute && messageId && orderId)
    ) && !window.location.href.includes('pay.hotmart.com');
    
    if (shouldRedirect) {
      if (isDev) {
        console.log('🔄 [CheckoutRedirectWrapper] REDIRECIONAMENTO IMEDIATO: URL do WhatsApp detectada, redirecionando para Hotmart...');
        console.log('🔍 [CheckoutRedirectWrapper] Parâmetros detectados:', { messageId, orderId, hasCheckoutParams, restore: urlParams.get('restore'), quiz_id: urlParams.get('quiz_id'), token: !!urlParams.get('token') });
      }
      
      // ✅ OTIMIZAÇÃO CRÍTICA: Lazy load do Supabase apenas quando necessário
      import('@/integrations/supabase/client').then(({ supabase }) => {
        // Buscar pedido e redirecionar IMEDIATAMENTE
        supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
        .then(({ data: orderData, error }) => {
          if (!error && orderData && orderData.status === 'pending' && orderData.customer_email && orderData.customer_whatsapp) {
            const HOTMART_PAYMENT_URL = 'https://pay.hotmart.com/XYZ'; // TODO: Update with real URL
            // ✅ CORREÇÃO: Detectar locale da rota atual para usar no redirect_url
            const localeMatch = location.pathname.match(/^\/(pt|en|es)/);
            const locale = localeMatch ? localeMatch[1] : 'pt';
            
            // ✅ CORREÇÃO: Normalizar WhatsApp e garantir prefixo 55
            let normalizedWhatsapp = orderData.customer_whatsapp.replace(/\D/g, '');
            if (!normalizedWhatsapp.startsWith('55')) {
              normalizedWhatsapp = `55${normalizedWhatsapp}`;
            }
            const origin = window.location.origin;
            const redirectUrl = `${origin}/${locale}/payment-success`;
            
            const hotmartParams = new URLSearchParams();
            hotmartParams.set('order_id', orderData.id);
            hotmartParams.set('email', orderData.customer_email);
            // ✅ Hotmart pode usar 'phone' ou outro campo, ajustando para compatibilidade
            hotmartParams.set('phone', normalizedWhatsapp);
            hotmartParams.set('language', locale);
            hotmartParams.set('redirect_url', redirectUrl);
            
            // ⚠️ CRÍTICO: NÃO adicionar parâmetros do checkout interno (restore, quiz_id, token)
            // A URL da Hotmart deve conter APENAS os parâmetros necessários para pagamento
            
            const hotmartUrl = `${HOTMART_PAYMENT_URL}?${hotmartParams.toString()}`;
            if (isDev) {
              console.log('✅ [CheckoutRedirectWrapper] Redirecionando IMEDIATAMENTE para Hotmart:', hotmartUrl);
              console.log('✅ [CheckoutRedirectWrapper] URL da Hotmart validada:', {
                starts_with_hotmart: hotmartUrl.startsWith('https://pay.hotmart.com'),
                contains_restore: hotmartUrl.includes('restore='),
                contains_quiz_id: hotmartUrl.includes('quiz_id='),
                contains_token: hotmartUrl.includes('token='),
              });
            }
            
            // ✅ Registrar clique no botão "Finalizar Agora" (tracking)
            supabase.functions.invoke('track-payment-click', {
              body: {
                order_id: orderData.id,
                source: 'whatsapp_redirect'
              }
            }).then(({ error: trackError }) => {
              if (trackError) {
                if (isDev) {
                  console.warn('⚠️ [CheckoutRedirectWrapper] Erro ao registrar tracking de clique (não bloqueante):', trackError);
                }
              } else if (isDev) {
                console.log('✅ [CheckoutRedirectWrapper] Tracking de clique registrado com sucesso');
              }
            }).catch((trackError) => {
              if (isDev) {
                console.warn('⚠️ [CheckoutRedirectWrapper] Erro ao chamar track-payment-click (não bloqueante):', trackError);
              }
              // Não bloquear o redirecionamento se o tracking falhar
            });
            
            // ⚠️ CRÍTICO: Usar window.location.replace para evitar que o React Router intercepte
            // Isso substitui a URL atual no histórico, impedindo que o usuário volte para o checkout interno
            window.location.replace(hotmartUrl);
          } else {
            if (isDev) {
              console.error('❌ [CheckoutRedirectWrapper] Pedido não encontrado ou inválido:', { error, orderData });
            }
          }
        })
        .catch((err) => {
          if (isDev) {
            console.error('❌ [CheckoutRedirectWrapper] Erro ao buscar pedido para redirecionamento:', err);
          }
        });
      }).catch((err) => {
        if (isDev) {
          console.error('❌ [CheckoutRedirectWrapper] Erro ao carregar Supabase:', err);
        }
      });
    }
  }, [location.pathname, location.search]);
  
  // ✅ OTIMIZAÇÃO MOBILE: Não bloquear renderização - redirecionar em background
  // O redirecionamento já está sendo feito no useEffect acima
  // Sempre renderizar children para não bloquear a página
  
  return <>{children}</>;
}
