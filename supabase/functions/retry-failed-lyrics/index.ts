import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Retry Failed Lyrics Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar aprovações de letra onde a música não foi gerada ainda
    console.log('🔍 Buscando aprovações para reprocessar...');
    
    const { data: approvals, error: approvalsError } = await supabaseClient
      .from('lyrics_approvals')
      .select(`
        *,
        jobs!inner(id, status, suno_task_id, order_id),
        orders!inner(id, status, customer_email)
      `)
      .eq('status', 'approved')
      .eq('orders.status', 'paid')
      .is('jobs.suno_task_id', null)
      .order('approved_at', { ascending: true })
      .limit(10);

    if (approvalsError) {
      console.error('❌ Erro ao buscar aprovações:', approvalsError);
      throw approvalsError;
    }

    console.log(`📦 Encontradas ${approvals?.length || 0} aprovações para reprocessar`);

    const results = [];

    for (const approval of approvals || []) {
      const job = approval.jobs;
      console.log(`🔄 Reprocessando approval ${approval.id}, job: ${job.id}, order: ${job.order_id}`);
      
      try {
        // Resetar job para 'pending' antes de reprocessar
        await supabaseClient
          .from('jobs')
          .update({ 
            status: 'pending',
            error: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        console.log(`📝 Re-gerando letras para order ${job.order_id}`);
        
        const { data, error } = await supabaseClient.functions.invoke(
          'generate-lyrics-for-approval',
          { body: { order_id: job.order_id } }
        );

        if (error) {
          console.error(`❌ Erro ao re-gerar letras para order ${job.order_id}:`, error);
          results.push({
            approval_id: approval.id,
            job_id: job.id,
            order_id: job.order_id,
            success: false,
            error: error.message
          });
        } else {
          console.log(`✅ Letras re-geradas para order ${job.order_id}`);
          results.push({
            approval_id: approval.id,
            job_id: job.id,
            order_id: job.order_id,
            success: true,
            data
          });
        }
      } catch (e: any) {
        console.error(`❌ Exceção ao processar approval ${approval.id}:`, e);
        results.push({
          approval_id: approval.id,
          job_id: job.id,
          order_id: job.order_id,
          success: false,
          error: e.message
        });
      }

      // Delay de 3s entre chamadas para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`\n=== Retry Concluído ===`);
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Falhas: ${failedCount}`);
    console.log(`📊 Total: ${results.length}`);

    return new Response(
      JSON.stringify({ 
        message: 'Retry concluído',
        processed: results.length,
        success: successCount,
        failed: failedCount,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error in retry-failed-lyrics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
