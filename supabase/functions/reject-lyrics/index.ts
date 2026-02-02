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
    console.log('=== Reject Lyrics Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { approval_token, rejection_reason } = await req.json();

    if (!approval_token) {
      throw new Error('approval_token é obrigatório');
    }

    // Buscar aprovação
    const { data: approval, error: approvalError } = await supabaseClient
      .from('lyrics_approvals')
      .select('*')
      .eq('approval_token', approval_token)
      .single();

    if (approvalError || !approval) {
      throw new Error('Token de aprovação inválido');
    }

    // Verificar expiração
    if (new Date(approval.expires_at) < new Date()) {
      throw new Error('Token expirado');
    }

    // Verificar se já foi processado
    if (approval.status !== 'pending') {
      throw new Error(`Aprovação já foi ${approval.status}`);
    }

    // Atualizar aprovação
    await supabaseClient
      .from('lyrics_approvals')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: rejection_reason || 'Cliente solicitou ajustes',
        regeneration_feedback: rejection_reason,
      })
      .eq('id', approval.id);

    console.log('🔄 Iniciando auto-regeneração de letra...');

    // Auto-regenerar letra com feedback
    const regenerationCount = (approval.regeneration_count || 0) + 1;
    
    if (regenerationCount <= 3) {
      console.log(`🔄 Tentativa ${regenerationCount}/3 de regeneração`);
      
      // Invocar geração de letra com contexto de feedback
      const { error: regenError } = await supabaseClient.functions.invoke('generate-lyrics-internal', {
        body: {
          order_id: approval.order_id,
          quiz_id: approval.quiz_id,
          regeneration: true,
          regeneration_count: regenerationCount,
          previous_feedback: rejection_reason,
        },
      });

      if (regenError) {
        console.error('❌ Erro ao regenerar letra:', regenError);
      } else {
        console.log('✅ Regeneração de letra iniciada com sucesso');
      }
    } else {
      console.log('⚠️ Limite de regenerações atingido (3). Escalar para admin manual.');
      
      // Atualizar job para status que requer atenção manual
      await supabaseClient
        .from('jobs')
        .update({
          status: 'failed',
          error: 'Limite de regenerações atingido após 3 tentativas. Requer intervenção manual.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', approval.job_id);
    }

    console.log('✅ Letra rejeitada, regeneração em andamento...');

    // Log da ação para admin
    await supabaseClient.from('admin_logs').insert({
      action: 'lyrics_rejected',
      target_table: 'lyrics_approvals',
      target_id: approval.id,
      details: {
        approval_id: approval.id,
        job_id: approval.job_id,
        order_id: approval.order_id,
        rejection_reason: rejection_reason
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Feedback enviado! Nossa equipe vai ajustar a letra.'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in reject-lyrics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
