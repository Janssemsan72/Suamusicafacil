/**
 * Edge Function: send-checkout-email
 * 
 * Gera link de checkout seguro e envia via Email
 * Chamado quando pedido está pendente há mais de 7 minutos
 * 
 * Usa Resend para enviar emails com templates HTML
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { replaceVariables, logEmail } from "../_shared/email-utils.ts";
import { detectLanguageFromOrder, type SupportedLanguage } from "../_shared/language-detector.ts";

const corsHeaders = (origin: string | null) => ({
  ...getSecureHeaders(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id é obrigatório' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📧 [SendCheckoutEmail] ==========================================');
    console.log('📧 [SendCheckoutEmail] Iniciando processamento de pedido:', order_id);
    console.log('📧 [SendCheckoutEmail] Timestamp:', new Date().toISOString());
    console.log('📧 [SendCheckoutEmail] ==========================================');

    // Buscar dados do pedido
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      const errorMsg = `Pedido não encontrado: ${orderError?.message || 'N/A'}`;
      console.error('❌ [SendCheckoutEmail] Erro ao buscar pedido:', {
        order_id: order_id,
        error: orderError,
        error_message: orderError?.message,
        error_code: orderError?.code,
      });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorMsg,
          order_id: order_id,
          context: 'Pedido não encontrado no banco de dados'
        }),
        { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que pedido tem email
    if (!order.customer_email || order.customer_email.trim().length === 0) {
      const errorMsg = `Pedido não tem email associado`;
      console.error('❌ [SendCheckoutEmail] Pedido não tem email válido:', {
        order_id: order.id,
        customer_email: order.customer_email,
      });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorMsg,
          order_id: order.id,
          context: 'Pedido não tem campo customer_email preenchido'
        }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar quiz
    let quiz: any = null;
    if (order.quiz_id) {
      const { data: quizData, error: quizError } = await supabaseClient
        .from('quizzes')
        .select('*')
        .eq('id', order.quiz_id)
        .single();

      if (quizError) {
        console.warn('⚠️ [SendCheckoutEmail] Erro ao buscar quiz:', quizError);
      } else {
        quiz = quizData;
      }
    }

    if (!quiz) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Quiz não encontrado',
          order_id: order.id,
          context: 'Pedido não tem quiz_id ou quiz não existe'
        }),
        { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Criar checkout link se não existir
    let checkoutLinkId: string | null = null;
    let checkoutToken: string;
    
    const { data: existingLink } = await supabaseClient
      .from('checkout_links')
      .select('id, token, expires_at')
      .eq('order_id', order.id)
      .eq('quiz_id', order.quiz_id)
      .gt('expires_at', new Date().toISOString())
      .is('used_at', null)
      .single();

    if (existingLink) {
      checkoutLinkId = existingLink.id;
      checkoutToken = existingLink.token;
      console.log('✅ [SendCheckoutEmail] Link existente encontrado:', checkoutLinkId);
    } else {
      // Gerar token seguro
      const tokenArray = new Uint8Array(32);
      crypto.getRandomValues(tokenArray);
      checkoutToken = Array.from(tokenArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Criar checkout link (válido por 48 horas)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const { data: linkData, error: linkError } = await supabaseClient
        .from('checkout_links')
        .insert({
          order_id: order.id,
          quiz_id: order.quiz_id,
          token: checkoutToken,
          expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .single();

      if (linkError || !linkData) {
        console.error('❌ [SendCheckoutEmail] Erro ao criar checkout link:', linkError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Erro ao criar checkout link',
            order_id: order.id,
            context: 'Falha ao inserir registro na tabela checkout_links'
          }),
          { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      checkoutLinkId = linkData.id;
      console.log('✅ [SendCheckoutEmail] Link criado:', checkoutLinkId);
    }

    // Detectar locale do quiz
    const locale = quiz.language || 'pt';
    const baseUrl = Deno.env.get('SITE_URL') || 'https://suamusicafacil.com';
    const checkoutUrl = `${baseUrl}/${locale}/checkout?order_id=${order.id}&quiz_id=${order.quiz_id}&token=${checkoutToken}&restore=true`;
    
    // Gerar URL da Cakto
    // ✅ CORREÇÃO: Cakto usa 'phone' para pré-preencher o telefone (não 'whatsapp')
    // ✅ CORREÇÃO: Garantir que WhatsApp tenha prefixo 55 (código do país)
    let normalizedWhatsapp = order.customer_whatsapp?.replace(/\D/g, '') || '';
    if (normalizedWhatsapp && !normalizedWhatsapp.startsWith('55')) {
      normalizedWhatsapp = `55${normalizedWhatsapp}`;
    }
    const redirectUrl = `${baseUrl}/${locale}/payment-success`;
    
    const caktoParams = new URLSearchParams();
    caktoParams.set('order_id', order.id);
    caktoParams.set('email', order.customer_email);
    if (normalizedWhatsapp) {
      caktoParams.set('phone', normalizedWhatsapp); // ✅ CORREÇÃO: Usar 'phone' ao invés de 'whatsapp'
    }
    caktoParams.set('language', locale);
    caktoParams.set('redirect_url', redirectUrl);
    
    const caktoUrl = `https://pay.cakto.com.br/oqkhgvm_618383?${caktoParams.toString()}`;
    
    console.log('✅ [SendCheckoutEmail] URL da Cakto gerada:', {
      url: caktoUrl.substring(0, 100) + '...',
      hasOrderId: caktoUrl.includes(`order_id=${order.id}`),
      hasEmail: caktoUrl.includes(`email=`),
    });

    // Extrair primeiro nome do email
    const email = order.customer_email || '';
    const first_name = email.split('@')[0].split('.')[0].split('_')[0];
    const first_name_capitalized = first_name.charAt(0).toUpperCase() + first_name.slice(1).toLowerCase();
    const destinatario = quiz.about_who || 'alguém especial';

    // Teste A/B: 50% recebe variante A, 50% recebe variante B
    const abVariant = Math.random() < 0.5 ? 'a' : 'b';

    // Detectar idioma do pedido
    const language = await detectLanguageFromOrder(supabaseClient, order.id) || 'pt';

    // Buscar template de email
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates_i18n')
      .select('*')
      .eq('template_type', 'checkout_reminder')
      .eq('language', language)
      .single();

    // Se template não encontrado, usar fallback para português
    let finalTemplate = template;
    let finalLanguage = language;

    if (templateError || !template) {
      console.warn('⚠️ [SendCheckoutEmail] Template não encontrado para idioma', language, ', usando fallback pt');
      const { data: fallbackTemplate } = await supabaseClient
        .from('email_templates_i18n')
        .select('*')
        .eq('template_type', 'checkout_reminder')
        .eq('language', 'pt')
        .single();

      if (!fallbackTemplate) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Template de email não encontrado',
            order_id: order.id,
            context: 'Template checkout_reminder não encontrado em nenhum idioma'
          }),
          { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      finalTemplate = fallbackTemplate;
      finalLanguage = 'pt';
    }

    // Preparar variáveis e substituir no template
    const finalSubject = replaceVariables(finalTemplate.subject, {
      first_name: first_name_capitalized,
      destinatario: destinatario,
    });
    const finalHtml = replaceVariables(finalTemplate.html_content, {
      first_name: first_name_capitalized,
      destinatario: destinatario,
      checkout_url: caktoUrl,
    });

    // Enviar email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'RESEND_API_KEY não configurada',
          order_id: order.id,
        }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    let emailResult: { success: boolean; error?: string; emailId?: string } = { success: false };
    
    // Preparar promises para envio
    const promises: Promise<any>[] = [];
    
    // 1. Enviar Email via Resend (sempre)
    promises.push((async () => {
      try {
        console.log('📧 [SendCheckoutEmail] Iniciando envio de email...', {
          order_id: order.id,
          customer_email: order.customer_email,
        });

    // Importar função de headers
    const { getEmailHeaders, addHeadersToResendPayload } = await import('../_shared/email-headers.ts');
    
    // Gerar headers melhorados
    const baseUrl = Deno.env.get('SITE_URL') || 'https://suamusicafacil.com';
    const emailHeaders = getEmailHeaders(order.customer_email, undefined, baseUrl, false); // checkout_reminder é marketing
    
    // Preparar payload
    const appName = Deno.env.get('APP_NAME') || 'Sua Música Fácil';
    const envFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'contato@suamusicafacil.com';
    
    const fromName = finalTemplate.from_name || appName;
    const fromEmail = finalTemplate.from_email || envFromEmail;

    const emailPayload: any = {
      from: `${fromName} <${fromEmail}>`,
      to: [order.customer_email],
      reply_to: finalTemplate.reply_to || undefined,
      subject: finalSubject,
      html: finalHtml,
    };
    
    // Adicionar headers ao payload
    addHeadersToResendPayload(emailPayload, emailHeaders);
    
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify(emailPayload)
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
          throw new Error(`Resend API error: ${errorText}`);
    }

    const resendData = await resendResponse.json();
        console.log('✅ [SendCheckoutEmail] Email enviado com sucesso:', {
          email_id: resendData.id,
          recipient: order.customer_email,
        });

    await logEmail(supabaseClient, {
      email_type: 'checkout_reminder',
      recipient_email: order.customer_email,
      resend_email_id: resendData.id,
      order_id: order.id,
      template_used: 'checkout_reminder',
      status: 'sent',
      metadata: {
        first_name: first_name_capitalized,
        destinatario: destinatario,
        language: finalLanguage,
        ab_variant: abVariant
      }
    });

        return { type: 'email', result: { success: true, emailId: resendData.id } };
      } catch (emailErr) {
        const errorMessage = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error('❌ [SendCheckoutEmail] Erro ao enviar email:', {
          error: errorMessage,
          stack: emailErr instanceof Error ? emailErr.stack : undefined,
          customer_email: order.customer_email
        });
        
        await logEmail(supabaseClient, {
          email_type: 'checkout_reminder',
          recipient_email: order.customer_email,
          order_id: order.id,
          template_used: 'checkout_reminder',
          status: 'failed',
          metadata: { error: errorMessage }
        });
        
        return { 
          type: 'email',
          result: { 
            success: false, 
            error: errorMessage
          }
        };
      }
    })());
    
    // Executar todas as promises em paralelo
    const responses = await Promise.allSettled(promises);
    
    // Processar resultados
    for (const response of responses) {
      if (response.status === 'fulfilled') {
        const { type, result } = response.value;
        if (type === 'email') {
          emailResult = result;
        }
      } else {
        const errorMsg = response.reason instanceof Error 
          ? response.reason.message 
          : String(response.reason || 'Erro desconhecido');
        console.error('❌ [SendCheckoutEmail] Promise rejeitada:', {
          reason: response.reason,
          error: errorMsg
        });
        emailResult = { success: false, error: errorMsg };
      }
    }

    // Log resumo dos envios
    console.log('📊 [SendCheckoutEmail] Resumo dos envios:');
    console.log(`   Email: ${emailResult.success ? '✅ Enviado' : '❌ Falhou'} ${emailResult.error ? `(${emailResult.error})` : ''}`);

    // Se email falhou, retornar erro
    if (!emailResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erro ao enviar email',
          order_id: order.id,
          details: emailResult.error
        }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const resendData = { id: emailResult.emailId };

    // Criar/atualizar funil de email
    const { data: existingFunnelPending } = await supabaseClient
      .from('email_funnel_pending')
      .select('id')
      .eq('order_id', order.id)
      .single();

    let funnel: any;

    if (existingFunnelPending) {
      // Funil já existe, atualizar
      const { data: updatedFunnel } = await supabaseClient
        .from('email_funnel_pending')
        .update({
          current_step: 1,
          next_email_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 minutos
          ab_variant: abVariant,
          last_email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingFunnelPending.id)
        .select()
        .single();

      if (!updatedFunnel) {
        throw new Error('Erro ao atualizar funil existente');
      }

      funnel = updatedFunnel;
    } else {
      // Criar novo funil
      const { data: newFunnel } = await supabaseClient
        .from('email_funnel_pending')
        .insert({
          order_id: order.id,
          customer_email: order.customer_email,
          current_step: 1,
          next_email_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 minutos
          ab_variant: abVariant,
          last_email_sent_at: new Date().toISOString(),
          order_status: order.status || 'pending',
          order_amount_cents: order.amount_cents,
          order_created_at: order.created_at,
          order_plan: order.plan,
          quiz_id: order.quiz_id,
          quiz_about_who: quiz.about_who || '',
        })
        .select()
        .single();

      if (!newFunnel) {
        throw new Error('Erro ao criar funil');
      }

      funnel = newFunnel;
    }

    // Registrar mensagem no banco
    await supabaseClient
      .from('email_messages')
      .insert({
        funnel_id: funnel.id,
        message_type: 'checkout_reminder',
        subject: finalSubject,
        html_content: finalHtml,
        status: 'sent',
        resend_email_id: resendData.id,
        sent_at: new Date().toISOString(),
      });

    console.log('✅ [SendCheckoutEmail] Processamento concluído com sucesso');

    // Considerar sucesso se pelo menos email foi enviado
    const overallSuccess = emailResult.success;

    return new Response(
      JSON.stringify({
        success: overallSuccess,
        message: 'Notificações processadas',
        order_id: order.id,
        email: {
          success: emailResult.success,
          error: emailResult.error,
          email_id: emailResult.emailId,
        },
        email_sent: emailResult.success,
        resend_email_id: resendData.id,
        funnel_id: funnel.id,
        next_email_at: funnel.next_email_at,
      }),
      { status: overallSuccess ? 200 : 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [SendCheckoutEmail] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
