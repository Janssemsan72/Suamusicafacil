/**
 * Edge Function: track-payment-click
 * 
 * Registra quando o botão "Finalizar Agora" é clicado
 * Usado para tracking e analytics de conversão
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";

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

    const body = await req.json();
    const { order_id, source } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id é obrigatório' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🖱️ [TrackPaymentClick] Registrando clique no botão Finalizar Agora:', {
      order_id,
      source: source || 'unknown',
      timestamp: new Date().toISOString()
    });

    // Verificar se o pedido existe
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, status, customer_email')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.warn('⚠️ [TrackPaymentClick] Pedido não encontrado:', order_id);
      // Não retornar erro para não bloquear o redirecionamento
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Tracking registrado (pedido não encontrado)',
          order_id 
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar o clique (apenas log por enquanto, pode ser expandido para salvar em tabela)
    console.log('✅ [TrackPaymentClick] Clique registrado com sucesso:', {
      order_id: order.id,
      order_status: order.status,
      customer_email: order.customer_email,
      source: source || 'checkout',
      clicked_at: new Date().toISOString()
    });

    // Opcional: Salvar em uma tabela de eventos se necessário no futuro
    // Por enquanto, apenas logar para não adicionar complexidade desnecessária

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Tracking registrado com sucesso',
        order_id: order.id,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [TrackPaymentClick] Erro ao registrar tracking:', error);
    
    // Não retornar erro para não bloquear o redirecionamento
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Tracking não registrado (erro não bloqueante)',
        error: error.message
      }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});




