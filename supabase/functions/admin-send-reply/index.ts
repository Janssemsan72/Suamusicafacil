/**
 * Edge Function para enviar resposta a emails recebidos
 * Permite que admins respondam emails de clientes enviados para contato@suamusicafacil.com
 * 
 * Uso:
 * POST /functions/v1/admin-send-reply
 * Headers: Authorization: Bearer <token>
 * Body: {
 *   "to_email": "cliente@example.com",
 *   "subject": "Re: Assunto original",
 *   "html_content": "<p>Resposta...</p>",
 *   "in_reply_to": "email-id-original" (opcional),
 *   "thread_id": "thread-id" (opcional),
 *   "received_email_id": "uuid-do-email-recebido" (opcional)
 * }
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logEmail } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Admin Send Reply Started ===');

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Token de autenticação não fornecido");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Não autenticado');
    }

    // Verificar se é admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      throw new Error('Sem permissão de admin');
    }

    // Obter dados do request
    const { to_email, subject, html_content, in_reply_to, thread_id, received_email_id } = await req.json();

    if (!to_email || !subject || !html_content) {
      throw new Error('to_email, subject e html_content são obrigatórios');
    }

    // Se recebeu received_email_id, buscar thread_id do email original
    let finalThreadId = thread_id;
    if (received_email_id && !finalThreadId) {
      const { data: originalEmail } = await supabase
        .from('received_emails')
        .select('thread_id, resend_email_id')
        .eq('id', received_email_id)
        .single();
      
      if (originalEmail?.thread_id) {
        finalThreadId = originalEmail.thread_id;
      } else if (originalEmail?.resend_email_id) {
        finalThreadId = originalEmail.resend_email_id;
      }
    }

    console.log('📧 Enviando resposta:', {
      to: to_email,
      subject: subject,
      has_html: !!html_content
    });

    // Verificar Resend API Key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    // Preparar headers para reply
    const replyHeaders: Record<string, string> = {
      'X-Entity-Ref-ID': 'noreply', // Previne avatar automático no Gmail/Outlook
    };
    if (in_reply_to) {
      replyHeaders['In-Reply-To'] = in_reply_to;
      replyHeaders['References'] = in_reply_to;
    }

    // Enviar email via Resend (usa APP_NAME e RESEND_FROM_EMAIL do ambiente)
    const appName = Deno.env.get('APP_NAME') || 'Sua Música Fácil';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'contato@suamusicafacil.com';
    const replyTo = Deno.env.get('RESEND_REPLY_TO') || fromEmail;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${appName} <${fromEmail}>`,
        to: [to_email],
        subject: subject,
        html: html_content,
        reply_to: replyTo,
        headers: replyHeaders,
        tags: [
          { name: 'email_type', value: 'reply' },
          { name: 'admin_reply', value: 'true' }
        ]
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('❌ Erro na API Resend:', errorData);
      throw new Error(`Erro ao enviar email: ${errorData.message || 'Erro desconhecido'}`);
    }

    const resendData = await resendResponse.json();
    console.log('✅ Email enviado via Resend:', resendData.id);

    // Atualizar email recebido se foi fornecido received_email_id
    if (received_email_id) {
      const { error: updateError } = await supabase
        .from('received_emails')
        .update({
          replied_at: new Date().toISOString(),
          replied_by: user.id
        })
        .eq('id', received_email_id);

      if (updateError) {
        console.warn('⚠️ Erro ao atualizar email recebido:', updateError);
      } else {
        console.log('✅ Email recebido marcado como respondido');
      }
    }

    // Registrar em email_logs
    await logEmail(
      supabase,
      {
        email_type: 'reply',
        recipient_email: to_email,
        resend_email_id: resendData.id,
        template_used: 'admin_reply',
        status: 'sent',
        metadata: {
          admin_user_id: user.id,
          in_reply_to: in_reply_to,
          thread_id: thread_id,
          received_email_id: received_email_id,
          subject,
          html_content
        }
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        resend_id: resendData.id,
        message: 'Resposta enviada com sucesso'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro no admin-send-reply:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
