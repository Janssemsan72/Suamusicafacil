/**
 * Edge Function: check-pending-orders
 * 
 * Cron job executado a cada minuto
 * Verifica pedidos 'pending' com mais de 7 minutos
 * Cria checkout link e envia Email
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

    // Verificar autenticação (service role key ou cron secret)
    const authHeader = req.headers.get('authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // Se CRON_SECRET estiver configurado, validar
    if (cronSecret) {
      const providedSecret = authHeader?.replace('Bearer ', '');
      if (providedSecret !== cronSecret && providedSecret !== serviceRoleKey) {
        console.warn('⚠️ [CheckPendingOrders] Autenticação falhou - CRON_SECRET não corresponde');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Se não tiver CRON_SECRET configurado, aceitar service_role_key
    // Isso permite que os cron jobs funcionem mesmo sem CRON_SECRET
    console.log('✅ [CheckPendingOrders] Autenticação validada');

    console.log('⏰ [CheckPendingOrders] Iniciando verificação de pedidos pendentes...');
    console.log('📊 [CheckPendingOrders] Timestamp:', new Date().toISOString());

    // Buscar pedidos pending com mais de 7 minutos desde que entraram em pending
    // Usa pending_at (quando entrou em pending) ao invés de created_at
    const sevenMinutesAgo = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    
    // Primeiro, buscar todos os pedidos pendentes com Email para debug
    const { data: allPendingOrders, error: debugError } = await supabaseClient
      .from('orders')
      .select('id, customer_email, quiz_id, created_at, pending_at, status')
      .eq('status', 'pending')
      .not('customer_email', 'is', null);

    if (debugError) {
      console.error('❌ [CheckPendingOrders] Erro ao buscar todos os pedidos pendentes:', debugError);
    } else {
      console.log(`📊 [CheckPendingOrders] Total de pedidos pendentes: ${allPendingOrders?.length || 0}`);
      if (allPendingOrders && allPendingOrders.length > 0) {
        console.log('📋 [CheckPendingOrders] Pedidos encontrados:', allPendingOrders.map(o => {
          const pendingAt = o.pending_at || o.created_at;
          return {
            id: o.id.slice(0, 8),
            email: o.customer_email ? 'sim' : 'não',
            created_at: o.created_at,
            pending_at: o.pending_at,
            minutes_ago: Math.round((Date.now() - new Date(pendingAt).getTime()) / 60000)
          };
        }));
      }
    }
    
    // Buscar pedidos que estão em pending há mais de 7 minutos
    // Usa pending_at (quando entrou em pending) ao invés de created_at
    // Se pending_at não existir, usa created_at como fallback
    const { data: pendingOrders, error: ordersError } = await supabaseClient
      .from('orders')
      .select('id, customer_email, quiz_id, created_at, pending_at')
      .eq('status', 'pending')
      .not('customer_email', 'is', null);

    if (ordersError) {
      console.error('❌ [CheckPendingOrders] Erro ao buscar pedidos:', ordersError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar pedidos' }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar pedidos que estão em pending há mais de 7 minutos
    // Usa pending_at se disponível, senão usa created_at como fallback
    const ordersWithMoreThan7Minutes = (pendingOrders || []).filter(o => {
      const pendingAt = o.pending_at || o.created_at;
      return new Date(pendingAt) < new Date(sevenMinutesAgo);
    });

    if (ordersWithMoreThan7Minutes.length === 0) {
      console.log('✅ [CheckPendingOrders] Nenhum pedido pendente com mais de 7 minutos encontrado');
      console.log(`ℹ️ [CheckPendingOrders] Total de pedidos pendentes: ${allPendingOrders?.length || 0}`);
      
      // Se houver pedidos pendentes mas nenhum com mais de 7 minutos, informar
      if (allPendingOrders && allPendingOrders.length > 0) {
        const recentOrders = allPendingOrders.filter(o => {
          const pendingAt = o.pending_at || o.created_at;
          return new Date(pendingAt) >= new Date(sevenMinutesAgo);
        });
        console.log(`⏳ [CheckPendingOrders] ${recentOrders.length} pedido(s) ainda aguardando 7 minutos desde que entraram em pending`);
      }
      
      return new Response(
        JSON.stringify({ 
          processed: 0, 
          message: 'Nenhum pedido pendente com mais de 7 minutos',
          total_pending: allPendingOrders?.length || 0
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 [CheckPendingOrders] Encontrados ${ordersWithMoreThan7Minutes.length} pedidos pendentes há mais de 7 minutos`);

    // Filtrar pedidos com Email válido
    const ordersToProcess = ordersWithMoreThan7Minutes.filter(
      o => (o.customer_email && o.customer_email.trim().length > 0)
    );

    if (ordersToProcess.length === 0) {
      console.log('✅ [CheckPendingOrders] Nenhum pedido pendente com Email válido');
      return new Response(
        JSON.stringify({ processed: 0, message: 'Nenhum pedido pendente com Email' }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 [CheckPendingOrders] Encontrados ${ordersToProcess.length} pedidos pendentes com Email`);

    const orderIds = ordersToProcess.map(o => o.id);

    // Verificar quais já estão no funil Email (em qualquer uma das 3 tabelas)
    const [pendingEmailFunnels, completedEmailFunnels, exitedEmailFunnels] = await Promise.all([
      supabaseClient.from('email_funnel_pending').select('order_id').in('order_id', orderIds),
      supabaseClient.from('email_funnel_completed').select('order_id').in('order_id', orderIds),
      supabaseClient.from('email_funnel_exited').select('order_id').in('order_id', orderIds),
    ]);
    
    const existingEmailOrderIds = new Set([
      ...(pendingEmailFunnels.data?.map(f => f.order_id) || []),
      ...(completedEmailFunnels.data?.map(f => f.order_id) || []),
      ...(exitedEmailFunnels.data?.map(f => f.order_id) || []),
    ]);

    const ordersToProcessEmail = ordersToProcess.filter(o => 
      !existingEmailOrderIds.has(o.id) && 
      o.customer_email && 
      o.customer_email.trim().length > 0
    );

    console.log(`📤 [CheckPendingOrders] Processando ${ordersToProcessEmail.length} pedidos para Email`);

    const processed: string[] = [];
    const errors: Array<{ order_id: string; channel: string; error: string }> = [];

    // Processar cada pedido - Email
    for (const order of ordersToProcessEmail) {
      try {
        console.log(`📧 [CheckPendingOrders] Enviando Email para pedido ${order.id}`);
        
        // ✅ CORREÇÃO: Passar service role key explicitamente no header para autenticação
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const { data, error } = await supabaseClient.functions.invoke('send-checkout-email', {
          body: { order_id: order.id },
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        });

        if (error || !data?.success) {
          // ✅ CORREÇÃO: Logar detalhes completos do erro
          const errorDetails = {
            order_id: order.id,
            channel: 'email',
            error_object: error,
            error_message: error?.message || data?.error || 'Erro desconhecido',
            error_name: error?.name,
            error_status: error?.status,
            data_response: data,
            timestamp: new Date().toISOString(),
          };
          
          console.error(`❌ [CheckPendingOrders] ==========================================`);
          console.error(`❌ [CheckPendingOrders] Erro ao enviar Email para pedido ${order.id}`);
          console.error(`❌ [CheckPendingOrders] ==========================================`);
          console.error(`❌ [CheckPendingOrders] Detalhes completos:`, JSON.stringify(errorDetails, null, 2));
          
          errors.push({ 
            order_id: order.id, 
            channel: 'email',
            error: errorDetails.error_message
          });
        } else {
          console.log(`✅ [CheckPendingOrders] Email enviado com sucesso para pedido ${order.id}`);
          if (!processed.includes(order.id)) {
            processed.push(order.id);
          }
        }
      } catch (err) {
        // ✅ CORREÇÃO: Logar detalhes completos da exceção
        const errorDetails = {
          order_id: order.id,
          channel: 'email',
          error: err instanceof Error ? err.message : String(err),
          error_type: err instanceof Error ? err.constructor.name : typeof err,
          stack: err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString(),
        };
        
        console.error(`❌ [CheckPendingOrders] ==========================================`);
        console.error(`❌ [CheckPendingOrders] Exceção ao enviar Email para pedido ${order.id}`);
        console.error(`❌ [CheckPendingOrders] ==========================================`);
        console.error(`❌ [CheckPendingOrders] Detalhes da exceção:`, JSON.stringify(errorDetails, null, 2));
        console.error(`❌ [CheckPendingOrders] Erro completo:`, err);
        
        errors.push({
          order_id: order.id,
          channel: 'email',
          error: errorDetails.error,
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: processed.length,
        total_found: ordersWithMoreThan7Minutes.length,
        email_processed: ordersToProcessEmail.length,
        already_in_email_funnel: ordersWithMoreThan7Minutes.filter(o => existingEmailOrderIds.has(o.id)).length,
        processed_order_ids: processed,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [CheckPendingOrders] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});

