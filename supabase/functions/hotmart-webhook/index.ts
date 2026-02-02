/**
 * 🔒 WEBHOOK HOTMART
 * 
 * Processa notificações de pagamento da Hotmart.
 * 
 * ESTRUTURA DO WEBHOOK HOTMART (Exemplo simplificado):
 * {
 *   "hottok": "TOKEN_CONFIGURADO",
 *   "prod": "ID_PRODUTO",
 *   "off": "ID_OFERTA",
 *   "price": 97.00,
 *   "email": "cliente@email.com",
 *   "name": "Nome Cliente",
 *   "transaction": "HP1234567890",
 *   "status": "approved", // approved, completed, refunded, chargeback, canceled, expired, billet_printed
 *   "payment_type": "credit_card",
 *   "phone_number": "5511999999999",
 *   "metadata": { "order_id": "..." } // Se passarmos metadata no checkout
 * }
 * 
 * LÓGICA (ORDEM DE PRIORIDADE):
 * 1. order_id (metadata) -> 100% confiável
 * 2. transaction (transaction_id) -> 100% confiável (se já salvo)
 * 3. email + status pendente -> Fallback seguro
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

  // Webhooks geralmente são POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();

  try {
    console.log('==========================================');
    console.log('🔔 [Hotmart Webhook] WEBHOOK RECEBIDO');
    console.log('==========================================');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    
    // 🔒 VALIDAÇÃO: Token da Hotmart (hottok)
    // O Hotmart envia um token único configurado na plataforma
    const hotmartToken = Deno.env.get('HOTMART_WEBHOOK_SECRET') || Deno.env.get('HOTMART_TOKEN');
    
    // Parse do body
    let body: any;
    try {
      const bodyText = await req.text();
      if (!bodyText) throw new Error('Body vazio');
      
      // Hotmart pode enviar JSON ou Form URL Encoded
      // Tentar JSON primeiro
      try {
        body = JSON.parse(bodyText);
      } catch (e) {
        // Se falhar, tentar parse de querystring (form-urlencoded)
        const params = new URLSearchParams(bodyText);
        body = Object.fromEntries(params.entries());
      }
    } catch (error) {
      console.error('❌ [Hotmart Webhook] Erro ao ler body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid body' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é chamada interna (para testes)
    const authHeader = req.headers.get('authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const isInternalCall = authHeader && authHeader.replace('Bearer ', '').trim() === serviceRoleKey;

    if (!isInternalCall) {
      if (!hotmartToken) {
        console.error('❌ [Hotmart Webhook] HOTMART_WEBHOOK_SECRET não configurado');
        // Não retornar erro 500 para não expor falha de config, mas logar erro
      } else {
        // Hotmart envia o token no campo 'hottok' do body
        const receivedToken = body.hottok;
        
        if (receivedToken !== hotmartToken) {
          console.error('❌ [Hotmart Webhook] Token inválido:', {
            recebido: receivedToken ? receivedToken.substring(0, 5) + '...' : 'NÃO ENVIADO',
            esperado: hotmartToken.substring(0, 5) + '...'
          });
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('✅ [Hotmart Webhook] Token válido');
      }
    }

    console.log('📦 [Hotmart Webhook] Payload (resumo):', {
      transaction: body.transaction,
      status: body.status,
      email: body.email,
      prod: body.prod,
      payment_type: body.payment_type
    });

    // Extração de dados
    const transaction_id = body.transaction;
    const status_hotmart = body.status;
    const customer_email = body.email ? String(body.email).toLowerCase().trim() : null;
    const customer_phone = body.phone_number || body.phone_local_code + body.phone_number; // Hotmart pode mandar separado
    
    // Order ID pode vir no metadata (custom fields) ou passthrough
    // A Hotmart costuma enviar metadata em `cms_marketplace` ou campos customizados, 
    // ou se passamos `sck` (src) ou `xcod` (external code) na url de checkout.
    // Vamos verificar campos comuns de passthrough
    const order_id_from_webhook = body.xcod || 
                                 body.sck || 
                                 body.metadata?.order_id || 
                                 body.custom_data?.order_id;

    // Normalização de Status
    let statusNormalized = 'pending';
    const statusLower = String(status_hotmart).toLowerCase();
    
    if (['approved', 'completed'].includes(statusLower)) {
      statusNormalized = 'approved';
    } else if (['refunded'].includes(statusLower)) {
      statusNormalized = 'refunded';
    } else if (['canceled', 'expired', 'chargeback'].includes(statusLower)) {
      statusNormalized = 'cancelled'; // ou refused
    } else if (['billet_printed', 'waiting_payment'].includes(statusLower)) {
      statusNormalized = 'pending';
    }

    console.log('📊 [Hotmart Webhook] Status:', { original: status_hotmart, normalizado: statusNormalized });

    // Se não for aprovado/pago, logar e retornar (a menos que queiramos tratar cancelamentos)
    // Por enquanto, foco em aprovação
    if (statusNormalized !== 'approved') {
      console.log('ℹ️ [Hotmart Webhook] Status não é aprovação. Apenas registrando log.');
      // Opcional: Atualizar status para cancelado/reembolsado no banco
      return new Response(JSON.stringify({ message: 'Ignored status' }), { status: 200, headers: secureHeaders });
    }

    // Busca do Pedido
    let order: any = null;
    let strategyUsed = 'none';

    // 1. Por Order ID (External Reference)
    if (order_id_from_webhook && isValidUUID(order_id_from_webhook)) {
      console.log('🔍 [Hotmart Webhook] Buscando por order_id:', order_id_from_webhook);
      const { data } = await supabaseClient.from('orders').select('*').eq('id', order_id_from_webhook).single();
      if (data) {
        order = data;
        strategyUsed = 'order_id';
      }
    }

    // 2. Por Transaction ID (Se já foi salvo anteriormente ou se usarmos o campo transaction_id para guardar o ID da hotmart)
    // Nota: Estamos usando hotmart_transaction_id como campo genérico de transação por enquanto
    if (!order && transaction_id) {
      console.log('🔍 [Hotmart Webhook] Buscando por transaction_id:', transaction_id);
      const { data } = await supabaseClient.from('orders').select('*').eq('hotmart_transaction_id', transaction_id).single();
      if (data) {
        order = data;
        strategyUsed = 'transaction_id';
      }
    }

    // 3. Por Email (Fallback seguro para pendentes)
    if (!order && customer_email) {
      console.log('🔍 [Hotmart Webhook] Buscando por email:', customer_email);
      // Pega o pedido pendente mais recente deste email
      const { data } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('customer_email', customer_email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        order = data;
        strategyUsed = 'email_fallback';
      }
    }

    if (!order) {
      console.error('❌ [Hotmart Webhook] Pedido não encontrado.');
      await supabaseClient.from('hotmart_webhook_logs').insert({ // Usando tabela de logs existente
        webhook_body: body,
        transaction_id,
        status_received: status_hotmart,
        customer_email,
        order_found: false,
        error_message: 'Pedido não encontrado'
      });
      
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: secureHeaders });
    }

    // Idempotência
    if (order.status === 'paid') {
      console.log('✅ [Hotmart Webhook] Pedido já pago.');
      return new Response(JSON.stringify({ message: 'Already paid' }), { status: 200, headers: secureHeaders });
    }

    // Atualizar Pedido
    console.log('💰 [Hotmart Webhook] Atualizando pedido para PAGO:', order.id);
    
    const { error: updateError, data: updatedOrder } = await supabaseClient
      .from('orders')
      .update({
        status: 'paid',
        hotmart_payment_status: 'approved', // Mapeando para coluna existente
        hotmart_transaction_id: transaction_id, // Mapeando para coluna existente
        payment_provider: 'hotmart', // Atualizando provider explicitamente
        provider: 'hotmart', // Atualizando provider explicitamente
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [Hotmart Webhook] Erro ao atualizar:', updateError);
      throw updateError;
    }

    // Ações Pós-Pagamento (Funnel, Email, Letra)
    // 1. Funnel
    try {
      await supabaseClient.rpc('mark_funnel_and_order_as_paid', { p_order_id: order.id });
    } catch (e) { console.warn('⚠️ [Hotmart Webhook] Erro funnel:', e); }

    // 2. Email
    try {
      await supabaseClient.functions.invoke('notify-payment-webhook', { body: { order_id: order.id } });
    } catch (e) { console.warn('⚠️ [Hotmart Webhook] Erro email:', e); }

    // 3. Gerar Letra
    try {
      await supabaseClient.functions.invoke('generate-lyrics-for-approval', { body: { order_id: order.id } });
    } catch (e) { console.warn('⚠️ [Hotmart Webhook] Erro letra:', e); }

    // Log Sucesso
    await supabaseClient.from('hotmart_webhook_logs').insert({
      webhook_body: body,
      transaction_id,
      order_id: order.id,
      status_received: status_hotmart,
      customer_email,
      order_found: true,
      processing_success: true,
      strategy_used: strategyUsed
    });

    return new Response(
      JSON.stringify({ success: true, order_id: order.id }),
      { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [Hotmart Webhook] Erro Fatal:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Error', details: error.message }),
      { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }
});