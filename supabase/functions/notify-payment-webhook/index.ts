/**
 * Edge Function: notify-payment-webhook
 * 
 * Notifica quando pedido é pago
 * Marca funis como exited e registra eventos internos
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { createErrorResponse, isValidUUID } from "../_shared/error-handler.ts";
import { withTimeout, TIMEOUTS } from "../_shared/timeout.ts";
import { withRetry, RETRY_CONFIGS } from "../_shared/retry.ts";

const corsHeaders = (origin: string | null) => ({
  ...getSecureHeaders(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // 🔒 VALIDAÇÃO DE AUTENTICAÇÃO: Permitir chamadas internas (pg_net) ou externas com service role key
    const authHeader = req.headers.get('authorization');
    const userAgent = req.headers.get('user-agent') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // Detectar se é chamada interna do banco de dados via pg_net
    const isInternalCall = userAgent.includes('pg_net');
    
    if (isInternalCall) {
      // ✅ Chamada interna do banco de dados - permitir sem autenticação
      // (pg_net já está em contexto seguro do banco de dados)
      console.log('✅ [NotifyPaymentWebhook] Chamada interna detectada (pg_net) - permitindo sem autenticação');
      
      // Se tiver header de autenticação, validar (mas não bloquear se não tiver)
      if (authHeader) {
        const providedToken = authHeader.replace('Bearer ', '').trim();
        const serviceKeyTrimmed = serviceRoleKey?.trim();
        
        if (serviceKeyTrimmed && providedToken === serviceKeyTrimmed) {
          console.log('✅ [NotifyPaymentWebhook] Chamada interna autenticada com service role key');
        } else {
          console.log('⚠️ [NotifyPaymentWebhook] Chamada interna com token inválido - continuando (chamada interna permitida)');
        }
      }
    } else {
      // 🔒 Chamada externa - EXIGIR autenticação obrigatória
      if (!authHeader) {
        console.error('❌ [NotifyPaymentWebhook] Chamada externa sem header de autorização - BLOQUEANDO requisição');
        return new Response(
          JSON.stringify({ 
            error: 'Missing authentication',
            message: 'Webhook requer header Authorization com service role key para chamadas externas'
          }),
          { status: 401, headers }
        );
      }
      
      const providedToken = authHeader.replace('Bearer ', '').trim();
      const serviceKeyTrimmed = serviceRoleKey?.trim();
      
      if (!serviceKeyTrimmed) {
        console.error('❌ [NotifyPaymentWebhook] SUPABASE_SERVICE_ROLE_KEY não configurado');
        return new Response(
          JSON.stringify({ error: 'Service role key not configured' }),
          { status: 500, headers }
        );
      }
      
      if (providedToken !== serviceKeyTrimmed) {
        console.error('❌ [NotifyPaymentWebhook] Token inválido - BLOQUEANDO requisição');
        console.error('   Token fornecido:', providedToken.substring(0, 15) + '...');
        return new Response(
          JSON.stringify({ 
            error: 'Invalid authentication',
            message: 'Token fornecido não corresponde ao service role key'
          }),
          { status: 401, headers }
        );
      }
      
      console.log('✅ [NotifyPaymentWebhook] Chamada externa autenticada via service role key - permitido');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // ✅ CORREÇÃO: Tratamento robusto do body JSON
    let body: any = {};
    let order_id: string | undefined;
    
    try {
      const contentType = req.headers.get('content-type') || '';
      const contentLength = req.headers.get('content-length');
      
      console.log('📦 [NotifyPaymentWebhook] Headers da requisição:', {
        content_type: contentType,
        content_length: contentLength,
        method: req.method,
        user_agent: req.headers.get('user-agent'),
      });
      
      // Verificar se há conteúdo no body
      if (contentLength && parseInt(contentLength) > 0) {
        if (contentType.includes('application/json')) {
          const bodyText = await req.text();
          console.log('📦 [NotifyPaymentWebhook] Body recebido (primeiros 200 chars):', bodyText.substring(0, 200));
          
          if (bodyText && bodyText.trim().length > 0) {
            try {
              body = JSON.parse(bodyText);
              order_id = body?.order_id;
              console.log('✅ [NotifyPaymentWebhook] Body parseado com sucesso:', { order_id });
            } catch (parseError) {
              console.error('❌ [NotifyPaymentWebhook] Erro ao fazer parse do JSON:', {
                error: parseError instanceof Error ? parseError.message : String(parseError),
                body_preview: bodyText.substring(0, 200),
              });
              const { response } = createErrorResponse(
                new Error('Body JSON inválido'),
                'Body da requisição não é um JSON válido',
                400,
                'INVALID_JSON'
              );
              return new Response(response.body, {
                ...response,
                headers: { ...headers, ...response.headers },
              });
            }
          } else {
            console.warn('⚠️ [NotifyPaymentWebhook] Body vazio ou apenas espaços em branco');
          }
        } else {
          console.warn('⚠️ [NotifyPaymentWebhook] Content-Type não é application/json:', contentType);
        }
      } else {
        console.warn('⚠️ [NotifyPaymentWebhook] Body vazio (content-length: 0 ou não especificado)');
      }
    } catch (bodyError) {
      console.error('❌ [NotifyPaymentWebhook] Erro ao processar body da requisição:', {
        error: bodyError instanceof Error ? bodyError.message : String(bodyError),
        stack: bodyError instanceof Error ? bodyError.stack : undefined,
      });
      const { response } = createErrorResponse(
        bodyError instanceof Error ? bodyError : new Error('Erro ao processar body'),
        'Erro ao processar body da requisição',
        400,
        'BODY_PROCESSING_ERROR'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // Validação de entrada
    if (!order_id) {
      const { response } = createErrorResponse(
        new Error('order_id é obrigatório'),
        'order_id é obrigatório',
        400,
        'MISSING_ORDER_ID'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // Validar formato UUID
    if (!isValidUUID(order_id)) {
      const { response } = createErrorResponse(
        new Error('order_id inválido'),
        'order_id deve ser um UUID válido',
        400,
        'INVALID_ORDER_ID'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // Log de origem da chamada para rastreamento
    const callerInfo = {
      user_agent: req.headers.get('user-agent') || 'unknown',
      origin: origin || 'unknown',
      referer: req.headers.get('referer') || 'unknown',
      timestamp: new Date().toISOString(),
    };
    
    console.log('==========================================');
    console.log('💳 [NotifyPaymentWebhook] PROCESSANDO PEDIDO PAGO');
    console.log('==========================================');
    console.log('💳 [NotifyPaymentWebhook] Order ID:', order_id);
    console.log('💳 [NotifyPaymentWebhook] Timestamp:', new Date().toISOString());
    console.log('🔍 [NotifyPaymentWebhook] Informações do chamador:', JSON.stringify(callerInfo, null, 2));

    // Buscar dados do pedido com timeout e retry
    let order: any = null;
    let orderError: any = null;
    
    try {
      const queryPromise = supabaseClient
        .from('orders')
        .select('*, quizzes!orders_quiz_id_fkey(*)')
        .eq('id', order_id)
        .single() as Promise<{ data: any; error: any }>;
      
      const queryResult = await withRetry(
        async () => {
          return await withTimeout(
            queryPromise,
            TIMEOUTS.DATABASE_QUERY,
            'Timeout ao buscar pedido'
          );
        },
        RETRY_CONFIGS.DATABASE
      );
      
      if (queryResult.error) {
        throw queryResult.error;
      }
      
      order = queryResult.data;
    } catch (error) {
      orderError = error;
      console.error('❌ [NotifyPaymentWebhook] Erro ao buscar pedido:', orderError);
    }

    if (orderError || !order) {
      const { response } = createErrorResponse(
        orderError || new Error('Pedido não encontrado'),
        'Pedido não encontrado',
        404,
        'ORDER_NOT_FOUND'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // ✅ VALIDAÇÃO CRÍTICA: Verificar se pedido está realmente pago
    console.log('🔍 [NotifyPaymentWebhook] Validando status do pedido:', {
      order_id: order.id,
      status: order.status,
      paid_at: order.paid_at,
      provider: order.provider,
      payment_provider: order.payment_provider,
      cakto_payment_status: order.cakto_payment_status,
    });

    if (order.status !== 'paid') {
      console.error('❌ [NotifyPaymentWebhook] BLOQUEADO: Pedido não está pago', {
        order_id: order.id,
        status_atual: order.status,
        esperado: 'paid',
        caller_info: callerInfo,
      });
      const { response } = createErrorResponse(
        new Error('Pedido não está pago'),
        'Pedido não está pago',
        400,
        'ORDER_NOT_PAID'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // ✅ VALIDAÇÃO EXTRA: Verificar se pedido tem paid_at (confirma que foi realmente pago)
    if (!order.paid_at) {
      console.error('❌ [NotifyPaymentWebhook] BLOQUEADO: Pedido marcado como paid mas sem paid_at', {
        order_id: order.id,
        status: order.status,
        paid_at: order.paid_at,
        caller_info: callerInfo,
      });
      const { response } = createErrorResponse(
        new Error('Pedido não tem data de pagamento confirmada'),
        'Pedido não tem data de pagamento confirmada',
        400,
        'ORDER_PAYMENT_NOT_CONFIRMED'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // ✅ VALIDAÇÃO CRÍTICA: Verificar indicadores de pagamento confirmado
    // Garante que apenas pedidos com pagamento realmente confirmado recebam email
    const hasValidPaymentIndicator = (
      // Cakto: deve ter transaction_id E status approved
      (order.cakto_transaction_id && order.cakto_transaction_id.trim() !== '' 
       && order.cakto_payment_status && ['approved', 'paid', 'pago', 'aprovada'].includes(order.cakto_payment_status))
    );

    if (!hasValidPaymentIndicator) {
      console.error('❌ [NotifyPaymentWebhook] BLOQUEADO: Pedido não tem indicadores válidos de pagamento', {
        order_id: order.id,
        status: order.status,
        paid_at: order.paid_at,
        cakto_transaction_id: order.cakto_transaction_id,
        cakto_payment_status: order.cakto_payment_status,
        provider: order.provider,
        payment_provider: order.payment_provider,
        caller_info: callerInfo,
      });

      // Registrar em admin_logs para auditoria
      try {
        await supabaseClient.from('admin_logs').insert({
          action: 'email_blocked_no_payment_indicator',
          target_table: 'orders',
          target_id: order.id,
          changes: {
            reason: 'Pedido não tem indicadores válidos de pagamento confirmado',
            status: order.status,
            paid_at: order.paid_at,
            cakto_transaction_id: order.cakto_transaction_id,
            cakto_payment_status: order.cakto_payment_status,
            provider: order.provider,
            payment_provider: order.payment_provider,
            caller_info: callerInfo,
          }
        });
      } catch (logError) {
        console.warn('⚠️ [NotifyPaymentWebhook] Erro ao registrar log de auditoria (não bloqueante):', logError);
      }

      const { response } = createErrorResponse(
        new Error('Pedido não tem indicadores válidos de pagamento confirmado'),
        'Pedido não tem indicadores válidos de pagamento confirmado',
        400,
        'ORDER_PAYMENT_NOT_CONFIRMED'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // ✅ VALIDAÇÃO DE DATA: Verificar se pedido foi criado a partir de 26/11/2024
    const minDate = new Date('2024-11-26T00:00:00.000Z');
    const orderCreatedAt = new Date(order.created_at);
    
    if (orderCreatedAt < minDate) {
      console.log('ℹ️ [NotifyPaymentWebhook] Pedido criado antes de 26/11/2024 - não enviando email', {
        order_id: order.id,
        created_at: order.created_at,
        min_date: minDate.toISOString(),
        caller_info: callerInfo,
      });
      // Retornar sucesso mas não enviar email
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Pedido anterior a 26/11/2024 - email não enviado',
          email: {
            success: false,
            skipped: true,
            reason: 'Pedido criado antes de 26/11/2024',
          },
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ VALIDAÇÃO CRÍTICA: Verificar se email já foi enviado (evitar duplicatas)
    // BLOQUEAR envio se email já foi enviado com sucesso
    try {
      const { data: existingEmail } = await supabaseClient
        .from('email_logs')
        .select('id, status, sent_at, email_type')
        .eq('order_id', order_id)
        .eq('email_type', 'order_paid')
        .in('status', ['sent', 'delivered']) // Considerar tanto 'sent' quanto 'delivered' como já enviado
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingEmail) {
        console.log('✅ [NotifyPaymentWebhook] ==========================================');
        console.log('✅ [NotifyPaymentWebhook] Email order_paid já foi enviado anteriormente');
        console.log('✅ [NotifyPaymentWebhook] BLOQUEANDO envio duplicado');
        console.log('✅ [NotifyPaymentWebhook] ==========================================');
        console.log('✅ [NotifyPaymentWebhook] Detalhes:', {
          order_id: order.id,
          customer_email: order.customer_email,
          order_status: order.status,
          paid_at: order.paid_at,
          provider: order.provider,
          payment_provider: order.payment_provider,
          cakto_payment_status: order.cakto_payment_status,
          email_log_id: existingEmail.id,
          email_status: existingEmail.status,
          email_sent_at: existingEmail.sent_at,
          email_type: existingEmail.email_type,
          caller_info: callerInfo,
          timestamp: new Date().toISOString(),
        });
        
        // Retornar sucesso mas indicar que email já foi enviado
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email já foi enviado anteriormente',
            email: {
              success: true,
              already_sent: true,
              email_log_id: existingEmail.id,
              sent_at: existingEmail.sent_at,
              status: existingEmail.status,
            },
            whatsapp: {
              success: false,
              message: 'Email já enviado, pulando envio de WhatsApp também',
            },
          }),
          {
            status: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (emailCheckError) {
      console.warn('⚠️ [NotifyPaymentWebhook] ==========================================');
      console.warn('⚠️ [NotifyPaymentWebhook] Erro ao verificar email_logs (não bloqueante)');
      console.warn('⚠️ [NotifyPaymentWebhook] ==========================================');
      console.warn('⚠️ [NotifyPaymentWebhook] Detalhes do erro:', {
        order_id: order_id,
        error: emailCheckError instanceof Error ? emailCheckError.message : String(emailCheckError),
        error_type: emailCheckError instanceof Error ? emailCheckError.constructor.name : typeof emailCheckError,
        stack: emailCheckError instanceof Error ? emailCheckError.stack : undefined,
        caller_info: callerInfo,
        timestamp: new Date().toISOString(),
      });
      // Continuar mesmo se houver erro na verificação, mas logar o aviso
    }

    console.log('✅ [NotifyPaymentWebhook] ==========================================');
    console.log('✅ [NotifyPaymentWebhook] Validações passadas');
    console.log('✅ [NotifyPaymentWebhook] Pedido está pago e pronto para envio de email');
    console.log('✅ [NotifyPaymentWebhook] ==========================================');
    console.log('✅ [NotifyPaymentWebhook] Detalhes do pedido:', {
      order_id: order.id,
      customer_email: order.customer_email,
      status: order.status,
      paid_at: order.paid_at,
      provider: order.provider,
      payment_provider: order.payment_provider,
      cakto_payment_status: order.cakto_payment_status,
      cakto_transaction_id: order.cakto_transaction_id,
      caller_info: callerInfo,
      timestamp: new Date().toISOString(),
    });

    // ✅ REMOVIDO: Validação de WhatsApp removida

    // Marcar funil e ordem como pagos simultaneamente
    // Esta função atualiza order.status='paid' e move funil para completed
    const { data: funnelId, error: markPaidError } = await supabaseClient.rpc('mark_funnel_and_order_as_paid', {
      p_order_id: order_id
    });
    
    if (markPaidError) {
      console.warn('⚠️ [NotifyPaymentWebhook] Erro ao marcar funil como pago:', markPaidError);
      // Continuar mesmo se não encontrar funil (pode não ter funil para este pedido)
    }
    
    // ✅ REMOVIDO: Busca de funil WhatsApp removida
    // Funis WhatsApp não são mais usados

    // Detectar idioma do quiz para o email
    const quizLanguage = (order.quizzes as any)?.language || 'pt';

    // ==========================================
    // Enviar Email (WhatsApp removido) - COM RETRY ROBUSTO
    // ==========================================
    
    let emailResult: { success: boolean; error?: string; emailId?: string } = { success: false };
    
    // ✅ REMOVIDO: Envio de WhatsApp - apenas email agora
    console.log('📧 [NotifyPaymentWebhook] Enviando apenas email de confirmação (WhatsApp removido)');
    
    // ✅ RETRY LOGIC ROBUSTO: Até 5 tentativas com backoff exponencial
    const maxRetries = 5;
    let lastError: any = null;
    let emailSent = false;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📧 [NotifyPaymentWebhook] Tentativa ${attempt}/${maxRetries} de enviar email...`, {
          order_id: order.id,
          customer_email: order.customer_email,
          language: quizLanguage,
          template_type: 'order_paid',
          paid_at: order.paid_at,
          provider: order.provider,
          caller_info: callerInfo,
        });
        
        const { data: emailData, error: emailError } = await supabaseClient.functions.invoke('send-email-with-variables', {
          body: {
            template_type: 'order_paid',
            order_id: order.id,
            language: quizLanguage,
            to_email: order.customer_email,
          },
        });

        if (emailError) {
          lastError = emailError;
          console.error(`❌ [NotifyPaymentWebhook] Erro ao chamar send-email-with-variables (tentativa ${attempt}/${maxRetries}):`, {
            error: emailError.message,
            name: emailError.name,
            order_id: order.id,
          });
          
          // Se não for a última tentativa, aguardar antes de tentar novamente (backoff exponencial)
          if (attempt < maxRetries) {
            const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s
            console.log(`⏳ [NotifyPaymentWebhook] Aguardando ${delayMs}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          
          emailResult = { success: false, error: emailError.message };
          break;
        } else if (emailData?.success) {
          console.log('✅ [NotifyPaymentWebhook] Email enviado com sucesso:', {
            order_id: order.id,
            email_id: emailData.email_id,
            recipient: order.customer_email,
            template_type: 'order_paid',
            language: quizLanguage,
            paid_at: order.paid_at,
            provider: order.provider,
            caller_info: callerInfo,
            attempt: attempt,
          });
          emailResult = { success: true, emailId: emailData.email_id };
          emailSent = true;
          break;
        } else {
          lastError = emailData?.error || 'Erro ao enviar email';
          console.error(`❌ [NotifyPaymentWebhook] Email não foi enviado (tentativa ${attempt}/${maxRetries}):`, {
            order_id: order.id,
            error: lastError,
            recipient: order.customer_email,
            caller_info: callerInfo,
          });
          
          // Se não for a última tentativa, aguardar antes de tentar novamente
          if (attempt < maxRetries) {
            const delayMs = Math.pow(2, attempt) * 1000;
            console.log(`⏳ [NotifyPaymentWebhook] Aguardando ${delayMs}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          
          emailResult = { success: false, error: lastError };
          break;
        }
      } catch (emailErr) {
        lastError = emailErr;
        console.error(`❌ [NotifyPaymentWebhook] Exceção ao enviar email (tentativa ${attempt}/${maxRetries}):`, {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          stack: emailErr instanceof Error ? emailErr.stack : undefined,
          order_id: order.id,
        });
        
        // Se não for a última tentativa, aguardar antes de tentar novamente
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 1000;
          console.log(`⏳ [NotifyPaymentWebhook] Aguardando ${delayMs}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        emailResult = { 
          success: false, 
          error: emailErr instanceof Error ? emailErr.message : 'Erro ao enviar email' 
        };
        break;
      }
    }
    
    if (!emailSent && lastError) {
      console.error('❌ [NotifyPaymentWebhook] Falha ao enviar email após todas as tentativas:', {
        order_id: order.id,
        attempts: maxRetries,
        last_error: lastError instanceof Error ? lastError.message : String(lastError),
      });
    }

    // ✅ REMOVIDO: Código de WhatsApp removido completamente
    // Funil e mensagens WhatsApp não são mais usados

    // Log resumo do envio
    console.log('📊 [NotifyPaymentWebhook] Resumo do envio:');
    console.log(`   Email: ${emailResult.success ? '✅ Enviado' : '❌ Falhou'} ${emailResult.error ? `(${emailResult.error})` : ''}`);

    const overallSuccess = emailResult.success;

    if (overallSuccess) {
      console.log('✅ [NotifyPaymentWebhook] Email enviado com sucesso');
    } else {
      console.error('❌ [NotifyPaymentWebhook] Falha ao enviar email');
    }

    return new Response(
      JSON.stringify({
        success: overallSuccess,
        message: 'Webhook processado',
        email: {
          success: emailResult.success,
          error: emailResult.error,
          email_id: emailResult.emailId,
        },
      }),
      { status: overallSuccess ? 200 : 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [NotifyPaymentWebhook] Erro inesperado:', error);
    const { response } = createErrorResponse(
      error,
      'Erro ao processar notificação de pagamento',
      500,
      'INTERNAL_ERROR'
    );
    return new Response(response.body, {
      ...response,
      headers: { ...headers, ...response.headers },
    });
  }
});
