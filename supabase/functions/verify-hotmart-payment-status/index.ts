/**
 * Edge Function: verify-hotmart-payment-status
 * 
 * Verifica e atualiza o status de pagamento de um pedido Hotmart
 * Útil quando o webhook não foi processado ou houve falha na comunicação
 * 
 * Recebe: { order_id: string } ou { transaction_id: string }
 * Retorna: { success: boolean, order_status: string, updated: boolean }
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
    // ✅ CORREÇÃO: Parsing resiliente do body
    let order_id: string | null = null;
    let transaction_id: string | null = null;

    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        order_id = (body && body.order_id) || null;
        transaction_id = (body && body.transaction_id) || null;
      } else {
        const raw = await req.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            order_id = parsed.order_id || null;
            transaction_id = parsed.transaction_id || null;
          } catch (_) {
            // tentar querystring como fallback
            const url = new URL(req.url);
            order_id = url.searchParams.get('order_id');
            transaction_id = url.searchParams.get('transaction_id');
          }
        } else {
          const url = new URL(req.url);
          order_id = url.searchParams.get('order_id');
          transaction_id = url.searchParams.get('transaction_id');
        }
      }
    } catch (parseError) {
      console.error('❌ [VerifyHotmartPayment] Erro ao fazer parse do body:', parseError);
      // Tentar querystring como fallback
      try {
        const url = new URL(req.url);
        order_id = url.searchParams.get('order_id');
        transaction_id = url.searchParams.get('transaction_id');
      } catch (_) {
        // Ignorar
      }
    }

    if (!order_id && !transaction_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'order_id ou transaction_id é obrigatório' 
        }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 [VerifyHotmartPayment] Verificando status do pagamento:', { order_id, transaction_id });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceKey) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado');
    }

    const supabaseClient = createClient(supabaseUrl, serviceKey);

    // Buscar pedido
    let query = supabaseClient
      .from('orders')
      .select('id, status, customer_email, provider, payment_provider, hotmart_transaction_id, hotmart_payment_status, paid_at, created_at'); // Mantendo nomes das colunas por enquanto
      
    if (order_id) {
      query = query.eq('id', order_id);
    } else if (transaction_id) {
      // Tenta buscar pelo ID da transação (usando coluna antiga hotmart_transaction_id por enquanto)
      query = query.eq('hotmart_transaction_id', transaction_id);
    }

    const { data: order, error: orderError } = await query.single();

    if (orderError || !order) {
      console.error('❌ [VerifyHotmartPayment] Pedido não encontrado:', orderError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Pedido não encontrado',
          order_id,
          transaction_id
        }),
        { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 [VerifyHotmartPayment] Status atual do pedido:', {
      order_id: order.id,
      status: order.status,
      provider: order.provider,
      payment_provider: order.payment_provider,
      transaction_id: order.cakto_transaction_id,
      payment_status: order.cakto_payment_status,
      paid_at: order.paid_at
    });

    // Se já está pago, retornar sucesso
    if (order.status === 'paid') {
      console.log('✅ [VerifyHotmartPayment] Pedido já está marcado como pago');
      return new Response(
        JSON.stringify({ 
          success: true,
          order_status: 'paid',
          updated: false,
          message: 'Pedido já está pago'
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se há evidência de pagamento aprovado na Hotmart (mapeado nas colunas antigas)
    const isHotmartApproved = order.cakto_payment_status === 'approved' || 
                            order.cakto_payment_status === 'aprovada' ||
                            order.cakto_payment_status === 'paid' ||
                            order.cakto_payment_status === 'pago' ||
                            order.cakto_payment_status === 'completed';

    // ✅ VERIFICAÇÃO DE INCONSISTÊNCIAS
    if (isHotmartApproved && order.status !== 'paid') {
      console.log('🔄 [VerifyHotmartPayment] Inconsistência detectada: Pagamento aprovado na Hotmart mas pedido não está marcado como pago. Atualizando...');
      
      const paymentTimestamp = order.paid_at || order.created_at || new Date().toISOString();
      console.log('📅 [VerifyHotmartPayment] Usando created_at como paid_at:', paymentTimestamp);
      
      // Atualizar pedido para pago
      const { data: updatedOrder, error: updateError } = await supabaseClient
        .from('orders')
        .update({
          status: 'paid',
          paid_at: paymentTimestamp,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select('id, status, paid_at')
        .single();

      if (updateError) {
        console.error('❌ [VerifyHotmartPayment] Erro ao atualizar pedido:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Erro ao atualizar pedido',
            update_error: updateError.message
          }),
          { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      // Marcar funil como pago se existir
      try {
        const { data: funnelId, error: markPaidError } = await supabaseClient.rpc('mark_funnel_and_order_as_paid', {
          p_order_id: order.id
        });
        
        if (markPaidError) {
          console.warn('⚠️ [VerifyHotmartPayment] Erro ao marcar funil como pago:', markPaidError);
        }
      } catch (funnelError) {
        console.warn('⚠️ [VerifyHotmartPayment] Erro ao processar funil (non-blocking):', funnelError);
      }

      // Enviar notificações
      try {
        const { error: notifyError } = await supabaseClient.functions.invoke('notify-payment-webhook', {
          body: { order_id: order.id }
        });
        
        if (notifyError) {
          console.warn('⚠️ [VerifyHotmartPayment] Erro ao enviar notificações (non-blocking):', notifyError);
        }
      } catch (notifyErr) {
        console.warn('⚠️ [VerifyHotmartPayment] Erro ao enviar notificações (non-blocking):', notifyErr);
      }

      // Iniciar geração de letra
      try {
        const { data: lyricsData, error: lyricsError } = await supabaseClient.functions.invoke('generate-lyrics-for-approval', {
          body: { order_id: order.id }
        });
        
        if (lyricsError) {
          console.error('❌ [VerifyHotmartPayment] Erro ao chamar generate-lyrics-for-approval:', lyricsError);
        } else {
          console.log('✅ [VerifyHotmartPayment] Geração de letra iniciada com sucesso');
        }
      } catch (lyricsErr: any) {
        console.error('❌ [VerifyHotmartPayment] Exceção ao iniciar geração de letra:', lyricsErr);
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          order_status: 'paid',
          updated: true,
          message: 'Pedido atualizado para pago e fluxo pós-pagamento executado'
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Se não há evidência de pagamento, retornar status atual
    console.log('ℹ️ [VerifyHotmartPayment] Nenhuma evidência de pagamento aprovado encontrada');
    return new Response(
      JSON.stringify({ 
        success: true,
        order_status: order.status,
        updated: false,
        message: 'Nenhuma evidência de pagamento aprovado encontrada',
        payment_status: order.hotmart_payment_status
      }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [VerifyHotmartPayment] Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro ao verificar status do pagamento'
      }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});

