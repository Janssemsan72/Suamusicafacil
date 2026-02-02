/**
 * Edge Function para enviar emails personalizados
 * Permite que admins enviem emails customizados para clientes
 * 
 * Uso:
 * POST /functions/v1/admin-send-custom-email
 * Headers: Authorization: Bearer <token>
 * Body: {
 *   "to_email": "cliente@example.com",
 *   "subject": "Assunto do email",
 *   "html_content": "<p>Conteúdo HTML...</p>"
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
    console.log('=== Admin Send Custom Email Started ===');

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
    const { to_email, subject, html_content } = await req.json();

    if (!to_email || !subject || !html_content) {
      throw new Error('to_email, subject e html_content são obrigatórios');
    }

    console.log('📧 Enviando email personalizado:', {
      to: to_email,
      subject: subject
    });

    // Verificar Resend API Key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
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
        headers: {
          'X-Entity-Ref-ID': 'noreply', // Previne avatar automático no Gmail/Outlook
        },
        tags: [
          { name: 'email_type', value: 'custom' },
          { name: 'admin_custom', value: 'true' }
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

    // Registrar em email_logs
    await logEmail(
      supabase,
      {
        email_type: 'custom',
        recipient_email: to_email,
        resend_email_id: resendData.id,
        template_used: 'admin_custom',
        status: 'sent',
        metadata: {
          admin_user_id: user.id,
          custom_email: true,
          subject,
          html_content
        }
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        resend_id: resendData.id,
        message: 'Email personalizado enviado com sucesso'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro no admin-send-custom-email:', error);
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
