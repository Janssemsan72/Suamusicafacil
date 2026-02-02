/**
 * Edge Function: create-checkout
 * 
 * Cria quiz + pedido juntos em uma única transação atômica
 * Garante que nunca haverá pedido sem quiz vinculado
 * 
 * Recebe:
 * - session_id: UUID único da sessão
 * - quiz: dados completos do quiz
 * - customer_email: email do cliente
 * - customer_whatsapp: WhatsApp do cliente
 * - plan: 'standard' | 'express'
 * - amount_cents: valor em centavos
 * - transaction_id: ID único da transação
 * 
 * Retorna:
 * - success: boolean
 * - quiz_id: UUID do quiz criado/atualizado
 * - order_id: UUID do pedido criado
 * - error?: string (se houver erro)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { isValidUUID } from "../_shared/error-handler.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed', method: req.method }),
      { status: 405, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Criar cliente Supabase com service role key (bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [create-checkout] Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Parse do body
    let body: any;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('❌ [create-checkout] Erro ao fazer parse do body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      session_id,
      quiz,
      customer_email,
      customer_whatsapp,
      plan,
      amount_cents,
      transaction_id
    } = body;
    
    const normalizedProvider = 'hotmart';

    // Validações
    if (!session_id || !isValidUUID(session_id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or missing session_id' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Novo padrão: 6 campos obrigatórios (about_who, relationship, occasion, style, message). vocal_gender opcional.
    const hasNewPattern = quiz?.message && typeof quiz.message === 'string' && quiz.message.trim();
    const hasLegacyPattern = (quiz?.qualities && String(quiz.qualities).trim()) ||
      (quiz?.memories && String(quiz.memories).trim()) ||
      (quiz?.key_moments && String(quiz.key_moments).trim());
    if (!quiz || !quiz.about_who || !quiz.style) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid quiz data: about_who and style are required' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!hasNewPattern && !hasLegacyPattern) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid quiz data: message (or qualities/memories/key_moments for legacy) is required' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customer_email || !customer_whatsapp) {
      return new Response(
        JSON.stringify({ success: false, error: 'customer_email and customer_whatsapp are required' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!plan || !['standard', 'express'].includes(plan)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid plan: must be standard or express' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!amount_cents || typeof amount_cents !== 'number' || amount_cents <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid amount_cents: must be a positive number' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 [create-checkout] Iniciando transação atômica:', {
      session_id,
      customer_email,
      plan,
      amount_cents,
      provider: normalizedProvider,
      transaction_id
    });

    // ✅ PROTEÇÃO: Usar função SQL transacional que garante tudo ou nada
    // A função create_order_atomic registra tudo em order_creation_logs
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const { data: result, error: rpcError } = await supabaseClient.rpc('create_order_atomic', {
      p_session_id: session_id,
      p_customer_email: customer_email,
      p_customer_whatsapp: customer_whatsapp,
      p_quiz_data: quiz,
      p_plan: plan,
      p_amount_cents: amount_cents,
      p_provider: normalizedProvider,
      p_transaction_id: transaction_id || null,
      p_source: 'edge_function',
      p_ip_address: ipAddress,
      p_user_agent: userAgent
    });

    if (rpcError || !result || !result.success) {
      // ✅ CORREÇÃO: Log detalhado do erro para diagnóstico
      console.error('❌ [create-checkout] Erro na função transacional:', {
        rpcError: rpcError ? {
          message: rpcError.message,
          code: rpcError.code,
          details: rpcError.details,
          hint: rpcError.hint
        } : null,
        result: result,
        params: {
          session_id: session_id,
          customer_email: customer_email,
          plan: plan,
          amount_cents: amount_cents,
          provider: normalizedProvider
        }
      });
      
      // A função já registrou tudo em order_creation_logs
      // Retornar erro mas com log_id para possível recuperação
      const errorMessage = rpcError?.message || result?.error || 'Unknown error';
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to create order: ${errorMessage}`,
          log_id: result?.log_id || null,
          quiz_id: result?.quiz_id || null,
          error_code: rpcError?.code || null
        }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const quizId = result.quiz_id;
    const orderId = result.order_id;
    const logId = result.log_id;

    console.log('✅ [create-checkout] Pedido criado com sucesso:', {
      quiz_id: quizId,
      order_id: orderId,
      log_id: logId
    });

    return new Response(
      JSON.stringify({
        success: true,
        quiz_id: quizId,
        order_id: orderId,
        log_id: logId // Retornar log_id para rastreamento
      }),
      { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [create-checkout] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || 'Unknown error' 
      }),
      { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
