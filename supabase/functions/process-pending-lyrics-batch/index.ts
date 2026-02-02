// @ts-ignore - Deno imports
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore - Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function getSupabaseAdmin() {
  // @ts-ignore
  const url = Deno.env.get("SUPABASE_URL")!;
  // @ts-ignore
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = crypto.randomUUID().substring(0, 8);
  console.log(`=== PROCESS PENDING LYRICS BATCH [${executionId}] ===`);

  try {
    const supabase = getSupabaseAdmin();
    const { batchSize = 50 } = await req.json().catch(() => ({}));

    // Buscar jobs pending que precisam de letra
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('jobs')
      .select('id, quiz_id, order_id')
      .eq('status', 'pending')
      .is('gpt_lyrics', null)
      .order('created_at', { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      console.error(`[${executionId}] Erro ao buscar jobs:`, fetchError);
      throw fetchError;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log(`[${executionId}] Nenhum job pending encontrado`);
      return new Response(
        JSON.stringify({ message: 'Nenhum job pending', processed: 0 }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`[${executionId}] Processando ${pendingJobs.length} jobs...`);

    // Processar em paralelo (max 10 por vez para não sobrecarregar)
    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < pendingJobs.length; i += chunkSize) {
      chunks.push(pendingJobs.slice(i, i + chunkSize));
    }

    let successful = 0;
    let failed = 0;

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (job) => {
          try {
            console.log(`[${executionId}] Processando job ${job.id.substring(0, 8)}...`);
            
            const { data, error } = await supabase.functions.invoke('generate-lyrics-internal', {
              body: { job_id: job.id }
            });

            if (error) {
              throw new Error(error.message);
            }

            console.log(`[${executionId}] ✅ Job ${job.id.substring(0, 8)} processado`);
            return { id: job.id, status: 'success' };

          } catch (error: any) {
            console.error(`[${executionId}] ❌ Job ${job.id.substring(0, 8)} falhou:`, error.message);
            return { id: job.id, status: 'failed', error: error.message };
          }
        })
      );

      // Contar sucessos e falhas
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.status === 'success') {
          successful++;
        } else {
          failed++;
        }
      });

      // Aguardar 2 segundos entre chunks para não sobrecarregar
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`[${executionId}] Resultado: ${successful} sucesso, ${failed} falhas`);

    return new Response(
      JSON.stringify({
        executionId,
        processed: pendingJobs.length,
        successful,
        failed
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error(`[${executionId}] ❌ ERRO GERAL:`, error);
    return new Response(
      JSON.stringify({
        error: 'Erro ao processar lote',
        details: error.message,
        executionId
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});










