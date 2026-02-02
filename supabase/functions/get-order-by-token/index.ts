import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = { ...getSecureHeaders(origin), 'Content-Type': 'application/json' };
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    const { magic_token } = await req.json();

    if (!magic_token) {
      return new Response(
        JSON.stringify({ error: 'magic_token é obrigatório' }),
        { status: 400, headers: secureHeaders }
      );
    }

    const supabase = getAdminClient();

    // Buscar pedido pelo magic_token
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        customer_email,
        plan,
        status,
        created_at,
        paid_at,
        magic_token
      `)
      .eq('magic_token', magic_token)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado ou token inválido' }),
        { status: 404, headers: secureHeaders }
      );
    }

    // Buscar músicas do pedido (apenas as 2 primeiras, status ready ou released)
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select(`
        id,
        order_id,
        quiz_id,
        title,
        variant_number,
        status,
        audio_url,
        cover_url,
        lyrics,
        release_at,
        released_at,
        created_at
      `)
      .eq('order_id', order.id)
      .in('status', ['ready', 'released'])
      .order('variant_number', { ascending: true })
      .limit(2);

    if (songsError) {
      console.error('Erro ao buscar músicas:', songsError);
      // Continuar mesmo se houver erro, retornando array vazio
    }

    // Retornar dados públicos (sem informações sensíveis)
    return new Response(
      JSON.stringify({
        order: {
          id: order.id,
          customer_email: order.customer_email,
          plan: order.plan,
          status: order.status,
          created_at: order.created_at,
          paid_at: order.paid_at,
        },
        songs: songs || [],
      }),
      { status: 200, headers: secureHeaders }
    );
  } catch (error) {
    console.error('Erro na função get-order-by-token:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: secureHeaders }
    );
  }
});

