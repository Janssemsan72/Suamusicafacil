import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { approval_token } = await req.json();

    if (!approval_token) {
      throw new Error('approval_token é obrigatório');
    }

    const { data: approval, error } = await supabaseClient
      .from('lyrics_approvals')
      .select('*')
      .eq('approval_token', approval_token)
      .single();

    if (error) {
      console.error('Error fetching approval:', error);
      return new Response(
        JSON.stringify({ error: error.message || 'Aprovação não encontrada' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    if (!approval) {
      return new Response(
        JSON.stringify({ error: 'Aprovação não encontrada' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Verificar expiração
    if (new Date(approval.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Este link expirou. Entre em contato conosco.' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 410,
        }
      );
    }

    // ✅ CORREÇÃO: Permitir visualizar letras aprovadas também (não apenas pending)
    // O cliente pode querer ver a letra mesmo depois de aprovada
    // if (approval.status !== 'pending') {
    //   return new Response(
    //     JSON.stringify({ 
    //       error: `Esta letra já foi ${approval.status === 'approved' ? 'aprovada' : 'rejeitada'}` 
    //     }),
    //     {
    //       headers: { ...corsHeaders, "Content-Type": "application/json" },
    //       status: 409,
    //     }
    //   );
    // }

    // ✅ CORREÇÃO: Garantir que lyrics está no formato correto
    let lyricsData = approval.lyrics;
    
    // Se lyrics for string, tentar fazer parse
    if (typeof lyricsData === 'string') {
      try {
        lyricsData = JSON.parse(lyricsData);
      } catch {
        // Se não for JSON válido, manter como string e criar estrutura
        lyricsData = {
          title: approval.lyrics_preview?.split(' - ')[0] || 'Música Personalizada',
          lyrics: lyricsData
        };
      }
    }

    // Se lyrics for null ou undefined, usar preview como fallback
    if (!lyricsData || (typeof lyricsData === 'object' && Object.keys(lyricsData).length === 0)) {
      lyricsData = {
        title: approval.lyrics_preview?.split(' - ')[0] || 'Música Personalizada',
        lyrics: approval.lyrics_preview || 'Letra não disponível'
      };
    }

    // Garantir que tem pelo menos title e lyrics
    if (typeof lyricsData === 'object' && !lyricsData.title) {
      lyricsData.title = approval.lyrics_preview?.split(' - ')[0] || 'Música Personalizada';
    }
    if (typeof lyricsData === 'object' && !lyricsData.lyrics) {
      lyricsData.lyrics = approval.lyrics_preview || 'Letra não disponível';
    }

    return new Response(
      JSON.stringify({
        success: true,
        approval: {
          ...approval,
          lyrics: lyricsData
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in get-lyrics-approval:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
