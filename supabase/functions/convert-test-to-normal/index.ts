import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização necessário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verificar se é admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem executar esta ação.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { orderId, newEmail, newCustomerName } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'ID do pedido é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar o pedido
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verificar se é um pedido de teste
    const isTestOrder = order.customer_email?.includes('test') || 
                       order.customer_email?.includes('@teste') ||
                       order.customer_email?.includes('@musiclovely.com') ||
                       order.customer_email?.includes('@suamusicafacil.com');

    if (!isTestOrder) {
      return new Response(
        JSON.stringify({ error: 'Este pedido não é identificado como teste' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Atualizar o pedido para venda normal
    const updateData: any = {
      is_test_order: false,
      updated_at: new Date().toISOString()
    };

    if (newEmail) {
      updateData.customer_email = newEmail;
    }

    if (newCustomerName) {
      updateData.customer_name = newCustomerName;
    }

    const { error: updateError } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      throw updateError;
    }

    // Log da ação administrativa
    await supabaseClient.from('admin_logs').insert({
      admin_user_id: user.id,
      action: 'convert_test_to_normal',
      target_table: 'orders',
      target_id: orderId,
      changes: {
        old_email: order.customer_email,
        new_email: newEmail || order.customer_email,
        new_customer_name: newCustomerName,
        is_test_order: false
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Venda teste convertida para venda normal com sucesso',
        order: {
          id: orderId,
          customer_email: newEmail || order.customer_email,
          customer_name: newCustomerName,
          is_test_order: false
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in convert-test-to-normal:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
