import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Headers simplificados
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Admin Unapprove Lyrics Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ CORREÇÃO: Parsing resiliente do body
    let approval_id: string | null = null;
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        approval_id = (body && body.approval_id) || null;
      } else {
        const raw = await req.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            approval_id = parsed.approval_id || null;
          } catch (_) {
            const url = new URL(req.url);
            approval_id = url.searchParams.get('approval_id');
          }
        } else {
          const url = new URL(req.url);
          approval_id = url.searchParams.get('approval_id');
        }
      }
    } catch (parseError) {
      console.error('❌ [AdminUnapproveLyrics] Erro ao fazer parse do body:', parseError);
      try {
        const url = new URL(req.url);
        approval_id = url.searchParams.get('approval_id');
      } catch (_) {
        // Ignorar
      }
    }

    if (!approval_id) {
      throw new Error('approval_id é obrigatório');
    }

    console.log('📋 Desaprovando letra:', approval_id);

    // 1. Buscar aprovação
    const { data: approval, error: approvalError } = await supabaseClient
      .from('lyrics_approvals')
      .select('*')
      .eq('id', approval_id)
      .single();

    if (approvalError || !approval) {
      throw new Error(`Aprovação não encontrada: ${approvalError?.message}`);
    }

    if (approval.status !== 'approved') {
      throw new Error(`Aprovação não está aprovada (status atual: ${approval.status})`);
    }

    // 2. Atualizar aprovação para pending
    // Renovar expires_at para garantir que apareça na lista de pendentes
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 72); // 72 horas a partir de agora
    
    const { error: updateError } = await supabaseClient
      .from('lyrics_approvals')
      .update({
        status: 'pending',
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
        // Não limpamos approved_at para manter histórico
      })
      .eq('id', approval_id);

    if (updateError) {
      throw new Error(`Erro ao desaprovar: ${updateError.message}`);
    }

    // 3. Atualizar job para pending e limpar dados de música antiga
    // Só atualizar se o job existir e não causar erro
    if (approval.job_id) {
      console.log('📋 Resetando job e limpando música antiga...', {
        job_id: approval.job_id,
        order_id: approval.order_id
      });

      // ✅ CORREÇÃO: Limpar campos de áudio para forçar nova geração
      const { error: jobError } = await supabaseClient
        .from('jobs')
        .update({
          status: 'pending',
          // Limpar dados de música antiga
          suno_task_id: null,
          suno_audio_url: null,
          suno_video_url: null,
          suno_cover_url: null,
          error: null,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', approval.job_id);

      if (jobError) {
        console.warn('⚠️ Erro ao resetar job (não crítico):', jobError.message);
      } else {
        console.log('✅ Job resetado com sucesso - música antiga removida');
      }

      // ✅ NOVO: Remover songs antigas relacionadas ao job/order
      // Como songs não tem job_id direto, vamos remover por order_id
      // mas apenas as que foram criadas antes da desaprovação
      const { error: songsDeleteError } = await supabaseClient
        .from('songs')
        .delete()
        .eq('order_id', approval.order_id)
        .eq('status', 'ready')
        .is('released_at', null);

      if (songsDeleteError) {
        console.warn('⚠️ Erro ao remover songs antigas (não crítico):', songsDeleteError.message);
      } else {
        console.log('✅ Songs antigas removidas com sucesso');
      }

      // ✅ NOVO: Cancelar releases programadas
      const { error: releasesError } = await supabaseClient
        .from('scheduled_releases')
        .delete()
        .eq('order_id', approval.order_id);

      if (releasesError) {
        console.warn('⚠️ Erro ao cancelar releases (não crítico):', releasesError.message);
      } else {
        console.log('✅ Releases canceladas com sucesso');
      }
    }

    // 4. Log da ação (opcional - não falhar se a tabela não existir)
    try {
      await supabaseClient.from('admin_logs').insert({
        action: 'lyrics_unapproved',
        target_table: 'lyrics_approvals',
        target_id: approval_id,
        details: {
          approval_id: approval_id,
          job_id: approval.job_id,
          order_id: approval.order_id,
          previous_status: 'approved',
          new_status: 'pending'
        }
      });
    } catch (logError) {
      console.warn('⚠️ Erro ao registrar log (não crítico):', logError);
      // Não falhar se o log não puder ser registrado
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Letra desaprovada e movida para pendentes'
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error in admin-unapprove-lyrics:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Retornar mensagem de erro mais detalhada
    const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error?.details || null,
        code: error?.code || 'UNKNOWN_ERROR'
      }),
      {
        headers: corsHeaders,
        status: 500,
      }
    );
  }
});
