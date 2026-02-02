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
    console.log('=== Admin Approve Lyrics Started ===');

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
      console.error('❌ [AdminApproveLyrics] Erro ao fazer parse do body:', parseError);
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

    console.log('📋 Aprovando letra:', approval_id);

    // 1. Buscar aprovação
    const { data: approval, error: approvalError } = await supabaseClient
      .from('lyrics_approvals')
      .select('*')
      .eq('id', approval_id)
      .single();

    if (approvalError || !approval) {
      throw new Error(`Aprovação não encontrada: ${approvalError?.message}`);
    }

    if (approval.status !== 'pending') {
      throw new Error(`Aprovação já foi ${approval.status}`);
    }

    // 2. Atualizar aprovação para approved
    const { error: updateError } = await supabaseClient
      .from('lyrics_approvals')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', approval_id);

    if (updateError) {
      throw new Error(`Erro ao aprovar: ${updateError.message}`);
    }

    // 3. Atualizar job para processing
    const { error: jobError } = await supabaseClient
      .from('jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', approval.job_id);

    if (jobError) {
      console.warn('⚠️ Erro ao atualizar job (não crítico):', jobError);
    }

    // 4. Verificar se o job já tem suno_task_id ANTES de chamar generate-audio-internal (evitar duplicação)
    // ✅ CORREÇÃO CRÍTICA: Buscar job com informações completas incluindo updated_at
    const { data: jobData, error: jobFetchError } = await supabaseClient
      .from('jobs')
      .select('id, suno_task_id, status, updated_at')
      .eq('id', approval.job_id)
      .single();

    if (jobFetchError) {
      console.warn('⚠️ Erro ao buscar job (não crítico):', jobFetchError);
    }

    // ✅ CORREÇÃO CRÍTICA: Verificar se já tem suno_task_id E se deve forçar regeneração
    // Forçar regeneração se:
    // 1. Job está em status 'pending' (foi resetado após desaprovação)
    // 2. Approval foi atualizada mais recentemente que o job (desaprovada e re-aprovada)
    const approvalUpdatedAt = new Date(approval.updated_at || approval.approved_at || new Date());
    const jobUpdatedAt = jobData?.updated_at ? new Date(jobData.updated_at) : null;
    
    // Se job está pending, significa que foi resetado após desaprovação - deve forçar nova geração
    const isJobPending = jobData?.status === 'pending';
    
    // Se a approval foi atualizada mais recentemente que o job, significa que foi desaprovada e re-aprovada
    const approvalNewerThanJob = jobUpdatedAt && approvalUpdatedAt > jobUpdatedAt;
    
    const shouldForceRegeneration = isJobPending || approvalNewerThanJob;
    
    if (jobData?.suno_task_id && jobData.suno_task_id.trim() !== '' && !shouldForceRegeneration) {
      console.log('⚠️ Job já tem suno_task_id, pulando chamada para generate-audio-internal:', jobData.suno_task_id.substring(0, 20) + '...');
      console.log('   Isso indica que a geração já foi iniciada por outra chamada (trigger ou função anterior).');
      console.log('   Evitando duplicação de requisições para o Suno.');
    } else {
      // ✅ CORREÇÃO: Se deve forçar regeneração, limpar suno_task_id primeiro
      if (shouldForceRegeneration && jobData?.suno_task_id) {
        console.log('🔄 Forçando regeneração - limpar suno_task_id antigo antes de enviar para Suno', {
          reason: isJobPending ? 'Job está em status pending (foi resetado)' : 'Approval mais recente que job',
          job_status: jobData.status,
          approval_updated_at: approvalUpdatedAt.toISOString(),
          job_updated_at: jobUpdatedAt?.toISOString()
        });
        await supabaseClient
          .from('jobs')
          .update({ 
            suno_task_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', approval.job_id);
      }
      // 5. Iniciar geração de áudio (ASSÍNCRONO - não aguardar resposta)
      console.log('🎵 Iniciando geração de áudio para job:', approval.job_id);

      // Chamar a Edge Function diretamente no domínio functions com Bearer SERVICE_ROLE
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      const functionsBase = `https://${projectRef}.functions.supabase.co`;
      const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

      if (!serviceRole) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
      }

      console.log('📡 Chamando generate-audio-internal para job_id:', approval.job_id);
      console.log('🔗 URL:', `${functionsBase}/generate-audio-internal`);

      // ✅ CORREÇÃO: Chamar de forma assíncrona (sem await) para retornar imediatamente
      // A geração de áudio continuará em background
      fetch(`${functionsBase}/generate-audio-internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRole}`,
          'apikey': serviceRole,
        },
        body: JSON.stringify({ job_id: approval.job_id }),
      }).then(async (genResp) => {
        console.log('📥 Resposta generate-audio-internal status:', genResp.status);
        
        if (!genResp.ok) {
          const errText = await genResp.text();
          console.error('❌ Erro ao iniciar geração de áudio (HTTP):', genResp.status, errText);
          // Atualizar job com erro (mas manter aprovação como approved)
          await supabaseClient.from('jobs').update({ 
            status: 'failed', 
            error: `generate-audio-internal: ${genResp.status} ${errText.substring(0, 500)}`, 
            updated_at: new Date().toISOString() 
          }).eq('id', approval.job_id);
        } else {
          try {
            const audioData = await genResp.json();
            console.log('✅ Áudio iniciado com sucesso:', audioData);
          } catch (parseError) {
            console.error('❌ Erro ao parsear resposta:', parseError);
          }
        }
      }).catch((error) => {
        console.error('❌ Erro ao chamar generate-audio-internal:', error);
        // Atualizar job com erro (mas manter aprovação como approved)
        supabaseClient.from('jobs').update({ 
          status: 'failed', 
          error: `Erro ao chamar generate-audio-internal: ${error.message}`, 
          updated_at: new Date().toISOString() 
        }).eq('id', approval.job_id).catch((updateError) => {
          console.error('❌ Erro ao atualizar job:', updateError);
        });
      });
    }

    // 6. Log da ação
    await supabaseClient.from('admin_logs').insert({
      action: 'lyrics_approved',
      target_table: 'lyrics_approvals',
      target_id: approval_id,
      details: {
        approval_id: approval_id,
        job_id: approval.job_id,
        order_id: approval.order_id
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Letra aprovada! Gerando música...',
        job_id: approval.job_id
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in admin-approve-lyrics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: corsHeaders,
        status: 500,
      }
    );
  }
});
