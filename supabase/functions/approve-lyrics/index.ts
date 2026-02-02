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
    console.log('=== Approve Lyrics Started ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    const { approval_token } = await req.json();

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
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', approval.id);

    // Atualizar job - letra aprovada, pronto para geração de áudio
    await supabaseClient
      .from('jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', approval.job_id);

    console.log('✅ Letra aprovada, iniciando geração de áudio...');

    // ✅ CORREÇÃO: Iniciar geração de áudio com tratamento de erro
    console.log('🎵 Iniciando geração de áudio para job:', approval.job_id);

    const { data: audioData, error: audioError } = await supabaseClient.functions.invoke(
      'generate-audio-internal',
      { body: { job_id: approval.job_id } }
    );

    if (audioError) {
      console.error('❌ Erro ao iniciar geração de áudio:', audioError);
      
      // Reverter job para failed
      await supabaseClient
        .from('jobs')
        .update({
          status: 'failed',
          error: `Erro ao gerar áudio: ${audioError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', approval.job_id);
        
      throw new Error(`Erro ao gerar áudio: ${audioError.message}`);
    }

    console.log('✅ Áudio iniciado com sucesso:', audioData);

    // ✅ CORREÇÃO CRÍTICA: Verificar se suno_task_id foi criado
    // Aguardar um pouco para garantir que o update foi processado
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: jobAfterAudio, error: jobCheckError } = await supabaseClient
      .from('jobs')
      .select('suno_task_id, status')
      .eq('id', approval.job_id)
      .single();

    if (jobCheckError) {
      console.warn('⚠️ Erro ao verificar job após geração de áudio (não crítico):', jobCheckError);
    } else if (!jobAfterAudio?.suno_task_id || jobAfterAudio.suno_task_id.trim() === '') {
      console.error('❌ CRÍTICO: generate-audio-internal retornou sucesso mas não criou suno_task_id!');
      console.error('   Job ID:', approval.job_id);
      console.error('   Resposta da função:', audioData);
      
      // Tentar novamente uma vez
      console.log('🔄 Tentando gerar áudio novamente...');
      const { data: retryData, error: retryError } = await supabaseClient.functions.invoke(
        'generate-audio-internal',
        { body: { job_id: approval.job_id } }
      );

      if (retryError || !retryData?.task_id) {
        console.error('❌ Retry também falhou. Marcando job como failed.');
        await supabaseClient
          .from('jobs')
          .update({
            status: 'failed',
            error: 'Erro crítico: generate-audio-internal não criou suno_task_id após 2 tentativas',
            updated_at: new Date().toISOString()
          })
          .eq('id', approval.job_id);
        
        throw new Error('Erro crítico: suno_task_id não foi criado após geração de áudio');
      } else {
        console.log('✅ Retry bem-sucedido! Task ID criado.');
      }
    } else {
      console.log('✅ Confirmação: suno_task_id criado com sucesso:', jobAfterAudio.suno_task_id.substring(0, 20) + '...');
    }

    // Log da ação
    await supabaseClient.from('admin_logs').insert({
      action: 'lyrics_approved',
      target_table: 'lyrics_approvals',
      target_id: approval.id,
      details: {
        approval_id: approval.id,
        job_id: approval.job_id,
        order_id: approval.order_id
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Letra aprovada! Gerando música...'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in approve-lyrics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
