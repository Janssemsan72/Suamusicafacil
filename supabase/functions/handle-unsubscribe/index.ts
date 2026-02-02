/**
 * Edge Function: handle-unsubscribe
 * 
 * Endpoint para processar unsubscribe de emails
 * Suporta unsubscribe via link (GET) e via webhook (POST)
 * 
 * URLs:
 * - GET /api/unsubscribe?token=XXX&email=XXX
 * - POST /api/unsubscribe (com body JSON)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: { ...secureHeaders, ...corsHeaders } 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let email: string | null = null;
    let token: string | null = null;
    let reason: string | null = null;

    // Processar request baseado no método
    if (req.method === 'GET') {
      // Unsubscribe via link (GET)
      const url = new URL(req.url);
      email = url.searchParams.get('email');
      token = url.searchParams.get('token');
      reason = url.searchParams.get('reason') || null;
    } else if (req.method === 'POST') {
      // Unsubscribe via webhook ou API (POST)
      const body = await req.json();
      email = body.email || null;
      token = body.token || null;
      reason = body.reason || null;
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validar parâmetros obrigatórios
    if (!email || !token) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters',
          message: 'Email and token are required'
        }),
        { 
          status: 400, 
          headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('📧 [Unsubscribe] Processando unsubscribe:', { email, token, reason });

    // Adicionar à lista de unsubscribes
    const { data, error } = await supabase.rpc('add_email_unsubscribe', {
      p_email: email.toLowerCase().trim(),
      p_token: token,
      p_reason: reason,
      p_source: req.method === 'GET' ? 'link' : 'api',
      p_metadata: {
        user_agent: req.headers.get('user-agent') || null,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        timestamp: new Date().toISOString(),
      }
    });

    if (error) {
      console.error('❌ [Unsubscribe] Erro ao processar unsubscribe:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to process unsubscribe',
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ [Unsubscribe] Email adicionado à lista de unsubscribes:', email);

    // Se for GET, retornar página HTML de confirmação
    if (req.method === 'GET') {
      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe Confirmado - Music Lovely</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #F5F0EB;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      box-shadow: 0 2px 14px rgba(0,0,0,0.08);
      text-align: center;
    }
    h1 {
      color: #362E26;
      margin-bottom: 20px;
      font-size: 24px;
    }
    p {
      color: #6B6157;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .success-icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    .email {
      font-weight: 600;
      color: #C18B67;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>
    <h1>Unsubscribe Confirmado</h1>
    <p>Você foi removido da nossa lista de emails com sucesso.</p>
    <p>O email <span class="email">${email}</span> não receberá mais emails da Music Lovely.</p>
    <p style="font-size: 14px; color: #999;">Se você mudou de ideia, entre em contato conosco para reativar o recebimento de emails.</p>
  </div>
</body>
</html>
      `;

      return new Response(html, {
        status: 200,
        headers: { 
          ...secureHeaders, 
          ...corsHeaders, 
          'Content-Type': 'text/html; charset=utf-8' 
        }
      });
    }

    // Se for POST, retornar JSON
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Email successfully unsubscribed',
        email: email
      }),
      { 
        status: 200, 
        headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [Unsubscribe] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

