import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Limpa pedidos pending antigos marcando-os como 'failed'
 * 
 * PROTEÇÕES IMPLEMENTADAS:
 * - NÃO marca pedidos manuais como 'failed' (provider = 'manual')
 * - Prazo aumentado para 30 dias (em vez de 24 horas)
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Starting cleanup of old pending orders...');

    // Aumentar prazo de 24 horas para 30 dias e proteger pedidos manuais
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log('Cleaning orders older than:', thirtyDaysAgo.toISOString());

    // Buscar pedidos pending antigos
    // Depois filtrar manualmente para garantir proteção de Cakto/manuais
    const { data: allOldOrders, error: selectError } = await supabaseClient
      .from('orders')
      .select('id, provider, payment_provider, created_at, customer_email')
      .eq('status', 'pending')
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (selectError) {
      throw new Error(`Error selecting old orders: ${selectError.message}`);
    }

    if (!allOldOrders || allOldOrders.length === 0) {
      console.log('No old pending orders found');
      return new Response(
        JSON.stringify({ 
          message: 'No orders to cleanup',
          cleaned: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Filtrar manualmente: proteger pedidos manuais
    const oldOrders = allOldOrders.filter((order: any) => {
      const provider = order.provider || order.payment_provider;
      return provider !== 'manual';
    });

    if (oldOrders.length === 0) {
      console.log('No orders to cleanup (all are protected manual orders)');
      return new Response(
        JSON.stringify({ 
          message: 'No orders to cleanup (all are protected)',
          cleaned: 0,
          protected: allOldOrders.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${oldOrders.length} old pending orders to mark as failed (${allOldOrders.length - oldOrders.length} manual orders protected)`);

    // Marcar pedidos antigos como failed
    const orderIds = oldOrders.map((o: any) => o.id);
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({ status: 'failed' })
      .in('id', orderIds);

    if (updateError) {
      throw new Error(`Error updating orders: ${updateError.message}`);
    }

    console.log(`Successfully marked ${oldOrders.length} orders as failed (${allOldOrders.length - oldOrders.length} manual orders protected)`);

    // Log detalhado dos orders limpos
    oldOrders.forEach((order: any) => {
      console.log(`Expired order: ${order.id} (created at: ${order.created_at}, email: ${order.customer_email || 'N/A'})`);
    });

    return new Response(
      JSON.stringify({ 
        message: 'Cleanup completed successfully',
        cleaned: oldOrders.length,
        protected: allOldOrders.length - oldOrders.length,
        orders: oldOrders.map((o: any) => ({ id: o.id, created_at: o.created_at })),
        protected_orders: (allOldOrders.length - oldOrders.length)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in cleanup-old-orders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});






