import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { sendEmail, htmlToText, replaceVariables } from "../_shared/email-utils.ts";

interface EmailRequest {
  template_type: 'order_paid' | 'music_released';
  order_id?: string;
  song_id?: string;
  language?: string;
  to_email?: string;
}

interface EmailVariables {
  customer_name: string;
  about_who?: string;
  recipient_name?: string;
  order_id?: string;
  style?: string;
  plan?: string;
  release_date?: string;
  song_title_1?: string;
  song_title_2?: string;
  music_style?: string;
  duration?: string;
  download_url_1?: string;
  download_url_2?: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: secureHeaders });
  }

  console.log('=== SEND EMAIL WITH VARIABLES RECEIVED ===');
  console.log('📥 [send-email-with-variables] Método:', req.method);
  console.log('📥 [send-email-with-variables] URL:', req.url);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!supabaseUrl || !serviceKey) {
      console.error('❌ [send-email-with-variables] Variáveis de ambiente não configuradas');
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const bodyText = await req.text();
    console.log('📦 [send-email-with-variables] Body recebido (raw):', bodyText.substring(0, 500));
    
    let body: any;
    try {
      body = JSON.parse(bodyText);
      console.log('📦 [send-email-with-variables] Body parseado:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('❌ [send-email-with-variables] Erro ao fazer parse do body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { template_type, order_id, song_id, language = 'pt', to_email }: EmailRequest = body;

    if (!template_type) {
      return new Response(
        JSON.stringify({ success: false, error: "template_type is required" }),
        { status: 200, headers: { ...secureHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailData: any;
    let variables: EmailVariables;

    // Obter dados do email baseado no tipo de template
    if (template_type === 'order_paid') {
      if (!order_id) {
        return new Response(
          JSON.stringify({ success: false, error: "order_id is required for order_paid template" }),
          { status: 200, headers: { ...secureHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase.rpc('send_order_paid_email', {
        p_order_id: order_id,
        p_language: language
      });

      if (error || !data?.success) {
        console.error('Error getting order_paid email data (using generic fallback):', error || data);
        // Fallback genérico para garantir envio e facilitar debug
        emailData = {
          success: true,
          subject: '[DEBUG] Pedido Confirmado - Music Lovely',
          html_content: `<h1>Pedido Confirmado</h1><p>Seu pedido {{order_id}} foi confirmado.</p>`,
          to_email: undefined,
          from_name: 'Music Lovely',
          from_email: 'onboarding@resend.dev'
        };
        variables = {
          customer_name: 'Cliente',
          order_id: order_id || 'N/A'
        } as any;
      } else {
        emailData = data;
        variables = data.variables;
      }
    } else if (template_type === 'music_released') {
      if (!song_id) {
        return new Response(
          JSON.stringify({ success: false, error: "song_id is required for music_released template" }),
          { status: 200, headers: { ...secureHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase.rpc('send_music_released_email', {
        p_song_id: song_id,
        p_language: language
      });

      if (error || !data?.success) {
        console.error('Error getting music_released email data (using generic fallback):', error || data);
        emailData = {
          success: true,
          subject: '[DEBUG] Sua música está pronta - Sua Música Fácil',
          html_content: `<h1>Música pronta</h1><p>Sua música está pronta para download.</p>`,
          to_email: undefined,
          from_name: 'Sua Música Fácil',
          from_email: 'contato@suamusicafacil.com'
        };
        variables = {
          customer_name: 'Cliente'
        } as any;
      } else {
        emailData = data;
        variables = data.variables;
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid template_type. Must be 'order_paid' or 'music_released'" }),
        { 
          status: 400, 
          headers: { ...secureHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (!emailData.success) {
      return new Response(
        JSON.stringify({ error: emailData.error }),
        { 
          status: 400, 
          headers: { ...secureHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Substituir variáveis no HTML
    let htmlContent = emailData.html_content || '';
    let subject = emailData.subject || '[Sem assunto]';

    // Suporte a condicionais simples: {{#if var}} ... {{/if}}
    const processConditionals = (input: string, vars: Record<string, any>) => {
      return input.replace(/\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, varName: string, block: string) => {
        const value = (vars as any)[varName];
        return value ? block : '';
      });
    };

    htmlContent = processConditionals(htmlContent, variables as any);
    subject = processConditionals(subject, variables as any);

    // Substituir todas as variáveis usando função centralizada
    htmlContent = replaceVariables(htmlContent, variables as unknown as Record<string, string | number>);
    subject = replaceVariables(subject, variables as unknown as Record<string, string | number>);

    // Remover placeholders e blocos não resolvidos remanescentes
    htmlContent = htmlContent
      // remover blocos condicionais não resolvidos por segurança
      .replace(/\{\{#if[\s\S]*?\{\{\/if\}\}/g, '')
      .replace(/\{\{[^}]+\}\}/g, '');
    subject = subject
      .replace(/\{\{#if[\s\S]*?\{\{\/if\}\}/g, '')
      .replace(/\{\{[^}]+\}\}/g, '');

    // Determinar email de destino com múltiplos fallbacks corretos
    let candidateEmails = [
      to_email,
      (emailData && (emailData.to_email || emailData.customer_email)),
      (variables as any).customer_email,
      (variables as any).recipient_email,
    ].filter(Boolean) as string[];

    let finalToEmail = candidateEmails[0];

    // Se ainda não há destinatário, buscar do pedido/quiz no banco
    if (!finalToEmail && order_id) {
      try {
        const { data: ord } = await supabase
          .from('orders')
          .select('customer_email, quiz_id')
          .eq('id', order_id)
          .maybeSingle();

        if (ord?.customer_email) {
          finalToEmail = ord.customer_email as string;
        } else if (ord?.quiz_id) {
          const { data: q } = await supabase
            .from('quizzes')
            .select('customer_email')
            .eq('id', ord.quiz_id)
            .maybeSingle();
          if (q?.customer_email) finalToEmail = q.customer_email as string;
        } else {
          // Fallback adicional: alguns fluxos relacionam quizzes -> order via order_id
          const { data: qByOrder } = await supabase
            .from('quizzes')
            .select('customer_email')
            .eq('order_id', order_id)
            .maybeSingle();
          if (qByOrder?.customer_email) finalToEmail = qByOrder.customer_email as string;
        }
      } catch (_) {
        // ignore – será validado abaixo
      }
    }

    if (!finalToEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalToEmail)) {
      console.warn('⚠️ [Email] Destinatário inválido/ausente após todas as tentativas', {
        to_email,
        emailData_to: emailData?.to_email,
        emailData_customer: emailData?.customer_email,
        var_customer: (variables as any)?.customer_email,
        var_recipient: (variables as any)?.recipient_email,
        order_id
      });
      return new Response(
        JSON.stringify({ success: false, error: "No valid recipient email found" }),
        { status: 200, headers: { ...secureHeaders, "Content-Type": "application/json" } }
      );
    }

    // Usar função centralizada de envio (fallbacks: APP_NAME e RESEND_FROM_EMAIL)
    const fromName = emailData?.from_name || Deno.env.get('APP_NAME') || 'Sua Música Fácil';
    const fromEmail = emailData?.from_email || Deno.env.get('RESEND_FROM_EMAIL') || 'contato@suamusicafacil.com';
    const fromHeader = `${fromName} <${fromEmail}>`;

    // Gerar versão texto do HTML
    const textContent = htmlToText(htmlContent);

    // Enviar email usando função centralizada
    // ✅ CORREÇÃO: Para emails transacionais críticos (order_paid, music_released),
    // pular validações restritivas que podem bloquear envios legítimos
    // Esses emails são críticos e devem ser enviados sempre que possível
    const isTransactionalCritical = template_type === 'order_paid' || template_type === 'music_released';
    
    const sendResult = await sendEmail(supabase, {
      to: finalToEmail,
      subject: subject,
      html: htmlContent,
      text: textContent,
      from: fromHeader,
      replyTo: emailData?.reply_to,
      tags: [
        { name: 'template_type', value: template_type },
        { name: 'language', value: language }
      ],
      orderId: order_id,
      songId: song_id,
      templateType: template_type,
      language: language,
      variables: variables,
      // ✅ Pular validações restritivas para emails transacionais críticos
      // Isso garante que emails importantes não sejam bloqueados por:
      // - Unsubscribes (cliente pode ter se descadastrado de marketing, mas precisa receber confirmação de pedido)
      // - Bounces antigos (pode ter sido resolvido)
      // - Rate limits muito restritivos
      skipValidation: isTransactionalCritical,
      skipRateLimit: false // Manter rate limit, mas com configuração mais permissiva (já implementado)
    });

    const emailSent = sendResult.success;
    const resendData = sendResult.emailId ? { id: sendResult.emailId } : null;

    // Log do payload para debug
    const emailPayload = {
      to: finalToEmail,
      subject: subject,
      template_type: template_type,
      variables: variables,
      language: language,
      email_sent: emailSent,
      resend_id: resendData?.id || null
    };

    return new Response(JSON.stringify({
      success: emailSent,
      message: emailSent ? "Email sent successfully" : "Email prepared but not sent (no API key)",
      email_payload: emailPayload,
      email_sent: emailSent,
      resend_id: resendData?.id || null,
      debug: {
        template_type,
        language,
        variables_count: Object.keys(variables).length,
        html_length: htmlContent.length,
        subject_length: subject.length
      }
    }), { status: 200, headers: { ...secureHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error('Error in send-email-with-variables:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal error in send-email-with-variables',
      details: (error as any)?.message || String(error)
    }), { status: 200, headers: { ...secureHeaders, "Content-Type": "application/json" } });
  }
});
