/**
 * Edge Function para receber emails via Resend Inbound
 * Recebe webhooks do Resend quando emails são enviados para contato@musiclovely.com
 * 
 * Webhook URL: https://[project].supabase.co/functions/v1/resend-inbound-webhook
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Resend Inbound Webhook Received ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('Inbound webhook payload:', JSON.stringify(body, null, 2));

    // Resend Inbound envia os dados do email recebido
    // Formato esperado do Resend Inbound:
    // {
    //   "type": "email.received",
    //   "data": {
    //     "id": "email-id",
    //     "from": { "email": "...", "name": "..." },
    //     "to": [{ "email": "...", "name": "..." }],
    //     "subject": "...",
    //     "html": "...",
    //     "text": "...",
    //     "headers": {...},
    //     "attachments": [...],
    //     "in_reply_to": "...",
    //     "thread_id": "..."
    //   }
    // }

    const { type, data } = body;

    // Verificar se é um evento de email recebido
    if (type !== 'email.received' && type !== 'email.inbound') {
      console.log('Evento não é de email recebido, ignorando:', type);
      return new Response(
        JSON.stringify({ received: true, message: 'Evento ignorado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Extrair informações do email
    const emailId = data.id || data.email_id;
    const fromEmail = data.from?.email || data.from_email || '';
    const fromName = data.from?.name || data.from_name || null;
    const toEmail = data.to?.[0]?.email || data.to_email || data.to || '';
    const subject = data.subject || '(Sem assunto)';
    const htmlContent = data.html || data.html_content || '';
    const textContent = data.text || data.text_content || '';
    const headers = data.headers || {};
    const attachments = data.attachments || [];
    const inReplyTo = data.in_reply_to || data.headers?.['in-reply-to'] || headers['In-Reply-To'] || null;
    
    // Gerar thread_id: se for resposta, buscar thread_id do email original
    let threadId = data.thread_id || null;
    
    if (!threadId && inReplyTo) {
      // Se é uma resposta, buscar o thread_id do email original
      try {
        const { data: originalEmail, error: originalError } = await supabaseClient
          .from('received_emails')
          .select('thread_id, resend_email_id')
          .or(`resend_email_id.eq.${inReplyTo},in_reply_to.eq.${inReplyTo}`)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (!originalError && originalEmail) {
          if (originalEmail.thread_id) {
            // Usar o thread_id do email original
            threadId = originalEmail.thread_id;
          } else if (originalEmail.resend_email_id) {
            // Se não tem thread_id mas tem resend_email_id, usar como thread_id
            threadId = originalEmail.resend_email_id;
          } else {
            // Criar novo thread baseado no in_reply_to
            threadId = inReplyTo;
          }
        } else {
          // Email original não encontrado, criar novo thread baseado no in_reply_to
          threadId = inReplyTo;
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar email original para thread:', error);
        // Em caso de erro, usar in_reply_to como thread_id
        threadId = inReplyTo;
      }
    } else if (!threadId) {
      // Para emails novos (não resposta), usar Message-ID ou criar novo thread
      const messageId = headers['message-id'] || headers['Message-ID'] || emailId;
      threadId = messageId;
    }

    console.log('📧 Email recebido:', {
      id: emailId,
      from: fromEmail,
      to: toEmail,
      subject: subject
    });

    // Verificar se já existe (evitar duplicatas)
    if (emailId) {
      const { data: existing } = await supabaseClient
        .from('received_emails')
        .select('id')
        .eq('resend_email_id', emailId)
        .single();

      if (existing) {
        console.log('⚠️ Email já existe no banco, ignorando duplicata');
        return new Response(
          JSON.stringify({ received: true, message: 'Email já processado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // Salvar email recebido
    const { data: savedEmail, error: insertError } = await supabaseClient
      .from('received_emails')
      .insert({
        resend_email_id: emailId,
        from_email: fromEmail,
        from_name: fromName,
        to_email: toEmail,
        subject: subject,
        html_content: htmlContent,
        text_content: textContent,
        headers: headers,
        attachments: attachments,
        thread_id: threadId,
        in_reply_to: inReplyTo,
        is_read: false,
        is_archived: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao salvar email recebido:', insertError);
      throw insertError;
    }

    console.log('✅ Email recebido salvo com sucesso:', savedEmail.id);

    return new Response(
      JSON.stringify({ 
        received: true, 
        email_id: savedEmail.id,
        resend_email_id: emailId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro no resend-inbound-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

