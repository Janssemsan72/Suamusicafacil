import { supabase } from "@/integrations/supabase/client";

/**
 * Gera URL da Hotmart para pagamento
 * @param orderId ID do pedido
 * @param email Email do cliente
 * @param whatsapp WhatsApp do cliente (normalizado)
 * @param language Idioma (pt, en, es)
 * @param utms Parâmetros UTM opcionais
 * @returns URL completa da Hotmart
 */
export function generateHotmartUrl(
  orderId: string,
  email: string,
  whatsapp: string,
  language: string = 'pt',
  utms?: Record<string, string>
): string {
  const HOTMART_PAYMENT_URL = 'https://pay.hotmart.com.br/d877u4t_665160';
  
  // Normalizar WhatsApp (apenas números)
  let normalizedWhatsapp = whatsapp.replace(/\D/g, '');
  
  // ✅ CORREÇÃO: Garantir que WhatsApp tenha prefixo 55 (código do país)
  if (!normalizedWhatsapp.startsWith('55')) {
    // Se já começa com 55, não duplicar
    normalizedWhatsapp = `55${normalizedWhatsapp}`;
  }
  
  // Logs detalhados para auditoria
  console.log('🔍 [generateHotmartUrl] Gerando URL da Hotmart:', {
    orderId,
    email,
    whatsapp_original: whatsapp,
    whatsapp_normalized: normalizedWhatsapp,
    language,
    hasUtms: !!utms,
  });
  
  // URL de redirecionamento após pagamento
  const redirectUrl = `${window.location.origin}/${language}/payment-success`;
  
  const hotmartParams = new URLSearchParams();
  hotmartParams.set('order_id', orderId);
  hotmartParams.set('email', email);
  // ✅ Hotmart usa 'phone' para pré-preencher o telefone (não 'whatsapp')
  // Formato: código do país + DDD + número (ex: 5511999999999)
  // ✅ CORREÇÃO: Só adicionar phone se WhatsApp for válido
  if (normalizedWhatsapp && normalizedWhatsapp.trim() !== '') {
    hotmartParams.set('phone', normalizedWhatsapp);
  } else {
    console.warn('⚠️ [generateHotmartUrl] WhatsApp inválido ou vazio, URL será gerada sem phone', {
      orderId,
      email,
      whatsapp
    });
  }
  hotmartParams.set('language', language);
  hotmartParams.set('redirect_url', redirectUrl);
  
  // Adicionar parâmetros UTM se fornecidos
  if (utms) {
    Object.entries(utms).forEach(([key, value]) => {
      if (value) {
        hotmartParams.set(key, value);
      }
    });
  }
  
  const finalUrl = `${HOTMART_PAYMENT_URL}?${hotmartParams.toString()}`;
  
  // Validação e log da URL final
  if (!finalUrl.startsWith('https://pay.hotmart.com.br')) {
    console.error('❌ [generateHotmartUrl] URL gerada não começa com https://pay.hotmart.com.br:', finalUrl);
  } else {
    console.log('✅ [generateHotmartUrl] URL da Hotmart gerada com sucesso:', {
      url: finalUrl,
      urlLength: finalUrl.length,
      hasOrderId: finalUrl.includes(`order_id=${orderId}`),
      hasEmail: finalUrl.includes(`email=`),
      hasPhone: finalUrl.includes(`phone=${normalizedWhatsapp}`),
    });
  }
  
  return finalUrl;
}

/**
 * Gera URL de checkout interno (com token)
 * @param orderId ID do pedido
 * @param quizId ID do quiz
 * @param token Token de segurança
 * @param language Idioma
 * @returns URL completa de checkout interno
 */
export function generateCheckoutUrl(
  orderId: string,
  quizId: string,
  token: string,
  language: string = 'pt'
): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/${language}/checkout?order_id=${orderId}&quiz_id=${quizId}&token=${token}&restore=true`;
}

/**
 * Gera URL de edição do quiz
 * @param orderId ID do pedido
 * @param quizId ID do quiz
 * @param token Token de segurança
 * @param language Idioma
 * @returns URL completa de edição do quiz
 */
export function generateEditQuizUrl(
  orderId: string,
  quizId: string,
  token: string,
  language: string = 'pt'
): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/${language}/quiz?order_id=${orderId}&quiz_id=${quizId}&token=${token}&edit=true`;
}

/**
 * Garante que um pedido tenha checkout links criados
 * Cria tanto o link interno (checkout_links) quanto salva a URL da Hotmart
 * @param orderId ID do pedido
 * @returns Objeto com os links criados ou existentes
 */
export async function ensureCheckoutLinks(orderId: string): Promise<{
  checkoutLink: { id: string; token: string } | null;
  hotmartUrl: string | null;
  checkoutUrl: string | null;
  editQuizUrl: string | null;
}> {
  try {
    // Buscar dados do pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_email, customer_whatsapp, quiz_id, hotmart_payment_url')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }
    
    if (!order.quiz_id) {
      throw new Error(`Pedido ${orderId} não tem quiz_id`);
    }
    
    // Verificar se já existe checkout_link
    const { data: existingLink } = await supabase
      .from('checkout_links')
      .select('id, token, expires_at')
      .eq('order_id', orderId)
      .eq('quiz_id', order.quiz_id)
      .gt('expires_at', new Date().toISOString())
      .is('used_at', null)
      .single();
    
    let checkoutLink = existingLink;
    let checkoutToken: string;
    
    // Se não existe ou expirou, criar novo
    if (!checkoutLink) {
      // Gerar token seguro
      const tokenArray = new Uint8Array(32);
      crypto.getRandomValues(tokenArray);
      checkoutToken = Array.from(tokenArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Criar checkout link (válido por 48 horas)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);
      
      const { data: newLink, error: linkError } = await supabase
        .from('checkout_links')
        .insert({
          order_id: orderId,
          quiz_id: order.quiz_id,
          token: checkoutToken,
          expires_at: expiresAt.toISOString(),
        })
        .select('id, token')
        .single();
      
      if (linkError || !newLink) {
        console.error('Erro ao criar checkout link:', linkError);
        throw new Error(`Erro ao criar checkout link: ${linkError?.message}`);
      }
      
      checkoutLink = newLink;
      checkoutToken = newLink.token;
    } else {
      checkoutToken = checkoutLink.token;
    }
    
    // Buscar idioma do quiz
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('language')
      .eq('id', order.quiz_id)
      .single();
    
    const language = quiz?.language || 'pt';
    
    // Gerar URLs
    const checkoutUrl = generateCheckoutUrl(orderId, order.quiz_id, checkoutToken, language);
    const editQuizUrl = generateEditQuizUrl(orderId, order.quiz_id, checkoutToken, language);
    
    // Gerar ou usar URL da Hotmart existente
    let hotmartUrl = order.hotmart_payment_url;
    
    if (!hotmartUrl && order.customer_email && order.customer_whatsapp) {
      // ✅ CORREÇÃO: generateHotmartUrl já normaliza o WhatsApp (adiciona prefixo 55)
      // Passar WhatsApp original, a função vai normalizar
      hotmartUrl = generateHotmartUrl(
        orderId,
        order.customer_email,
        order.customer_whatsapp,
        language
      );
      
      // Salvar URL da Hotmart no pedido
      const { error: updateError } = await supabase
        .from('orders')
        .update({ hotmart_payment_url: hotmartUrl })
        .eq('id', orderId);
      
      if (updateError) {
        console.warn('Erro ao salvar hotmart_payment_url:', updateError);
        // Continuar mesmo assim, a URL foi gerada
      }
    }
    
    return {
      checkoutLink: checkoutLink ? { id: checkoutLink.id, token: checkoutLink.token } : null,
      hotmartUrl,
      checkoutUrl,
      editQuizUrl,
    };
  } catch (error) {
    console.error('Erro ao garantir checkout links:', error);
    throw error;
  }
}

/**
 * Busca checkout links existentes de um pedido
 * @param orderId ID do pedido
 * @returns Objeto com os links ou null se não existir
 */
export async function getCheckoutLinks(orderId: string): Promise<{
  checkoutLink: { id: string; token: string } | null;
  hotmartUrl: string | null;
  checkoutUrl: string | null;
  editQuizUrl: string | null;
} | null> {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('id, customer_email, customer_whatsapp, quiz_id, hotmart_payment_url')
      .eq('id', orderId)
      .single();
    
    if (!order || !order.quiz_id) {
      return null;
    }
    
    const { data: checkoutLink } = await supabase
      .from('checkout_links')
      .select('id, token')
      .eq('order_id', orderId)
      .eq('quiz_id', order.quiz_id)
      .gt('expires_at', new Date().toISOString())
      .is('used_at', null)
      .single();
    
    if (!checkoutLink) {
      return null;
    }
    
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('language')
      .eq('id', order.quiz_id)
      .single();
    
    const language = quiz?.language || 'pt';
    
    const checkoutUrl = generateCheckoutUrl(orderId, order.quiz_id, checkoutLink.token, language);
    const editQuizUrl = generateEditQuizUrl(orderId, order.quiz_id, checkoutLink.token, language);
    
    return {
      checkoutLink: { id: checkoutLink.id, token: checkoutLink.token },
      hotmartUrl: order.hotmart_payment_url || null,
      checkoutUrl,
      editQuizUrl,
    };
  } catch (error) {
    console.error('Erro ao buscar checkout links:', error);
    return null;
  }
}


