// @ts-ignore - Deno imports
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore - Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

function getSupabaseAdmin() {
  // @ts-ignore - Deno global
  const url = Deno.env.get("SUPABASE_URL")!;
  // @ts-ignore - Deno global
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
  console.log(`=== PROCESS EMAIL QUEUE [${executionId}] ===`);

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Buscar até 20 emails pendentes para processar
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', now)
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error(`[${executionId}] Erro ao buscar emails pendentes:`, fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log(`[${executionId}] Nenhum email pendente na fila`);
      return new Response(
        JSON.stringify({ message: 'Nenhum email pendente', processed: 0 }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`[${executionId}] 📬 Processando ${pendingEmails.length} emails...`);

    // Processar todos os emails em paralelo
    const results = await Promise.allSettled(
      pendingEmails.map(async (email) => {
        const emailId = email.id.substring(0, 8);
        
        try {
          // Marcar como processing
          await supabase
            .from('email_queue')
            .update({ status: 'processing', updated_at: now })
            .eq('id', email.id);

          console.log(`[${executionId}:${emailId}] Enviando email para ${email.recipient_email}...`);

          // Chamar função de envio de email
          const { data: emailResult, error: emailError } = await supabase.functions.invoke(
            'send-music-released-email',
            {
              body: {
                songId: email.song_id,
                orderId: email.order_id,
                force: true
              }
            }
          );

          if (emailError) {
            throw new Error(`Erro no envio: ${emailError.message}`);
          }

          console.log(`[${executionId}:${emailId}] ✅ Email enviado com sucesso`);

          // Remover da fila (ou marcar como sent)
          await supabase
            .from('email_queue')
            .delete()
            .eq('id', email.id);

          return { id: email.id, status: 'sent', email: email.recipient_email };

        } catch (error: any) {
          console.error(`[${executionId}:${emailId}] ❌ Erro ao enviar:`, error.message);

          const newRetryCount = email.retry_count + 1;
          
          if (newRetryCount >= email.max_retries) {
            // Max retries atingido, marcar como failed
            console.error(`[${executionId}:${emailId}] Max retries (${email.max_retries}) atingido`);
            
            await supabase
              .from('email_queue')
              .update({
                status: 'failed',
                retry_count: newRetryCount,
                last_error: error.message,
                updated_at: now
              })
              .eq('id', email.id);

            return { id: email.id, status: 'failed', email: email.recipient_email, error: error.message };
          } else {
            // Calcular próxima tentativa com backoff exponencial
            // 5min * 2^retry_count (5min, 10min, 20min, 40min, 80min...)
            const backoffMinutes = 5 * Math.pow(2, newRetryCount);
            const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

            console.log(`[${executionId}:${emailId}] Agendando retry ${newRetryCount}/${email.max_retries} para ${backoffMinutes}min`);

            await supabase
              .from('email_queue')
              .update({
                status: 'pending',
                retry_count: newRetryCount,
                next_retry_at: nextRetry,
                last_error: error.message,
                updated_at: now
              })
              .eq('id', email.id);

            return { id: email.id, status: 'retry', email: email.recipient_email, retry: newRetryCount };
          }
        }
      })
    );

    // Contar resultados
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'sent').length;
    const retrying = results.filter(r => r.status === 'fulfilled' && r.value.status === 'retry').length;
    const failed = results.filter(r => r.status === 'fulfilled' && r.value.status === 'failed').length;
    const rejected = results.filter(r => r.status === 'rejected').length;

    console.log(`[${executionId}] 📊 Resultados: ${successful} enviados, ${retrying} retry, ${failed} falharam, ${rejected} exceções`);

    return new Response(
      JSON.stringify({
        executionId,
        processed: pendingEmails.length,
        successful,
        retrying,
        failed,
        rejected,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'rejected', reason: r.reason?.message })
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error(`[${executionId}] ❌ ERRO GERAL:`, error);
    return new Response(
      JSON.stringify({
        error: 'Erro ao processar fila de emails',
        details: error.message,
        executionId
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

