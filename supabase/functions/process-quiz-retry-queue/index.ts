/**
 * Edge Function: process-quiz-retry-queue
 * 
 * Processa fila de retry de quizzes no servidor
 * Busca itens com status='pending' e next_retry_at <= NOW()
 * Tenta salvar quiz usando quiz_payload
 * 
 * Esta função deve ser executada periodicamente via cron job
 * (configurar no Supabase Dashboard ou via pg_cron)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { withRetry, RETRY_CONFIGS } from "../_shared/retry.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  // Permitir apenas POST (pode ser chamado manualmente ou via cron)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', method: req.method }),
      { status: 405, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Criar cliente Supabase com service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [process-quiz-retry-queue] Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    console.log('🔄 [process-quiz-retry-queue] Iniciando processamento da fila...');

    // Buscar itens pendentes com next_retry_at <= NOW()
    const { data: queueItems, error: fetchError } = await supabaseClient
      .from('quiz_retry_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50); // Processar até 50 itens por vez

    if (fetchError) {
      console.error('❌ [process-quiz-retry-queue] Erro ao buscar itens da fila:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('✅ [process-quiz-retry-queue] Nenhum item pendente na fila');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No items to process' }),
        { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [process-quiz-retry-queue] Processando ${queueItems.length} item(ns) da fila`);

    let processed = 0;
    let completed = 0;
    let failed = 0;
    let stillPending = 0;

    for (const item of queueItems) {
      try {
        // Marcar como processing
        await supabaseClient
          .from('quiz_retry_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', item.id);

        // Tentar salvar quiz usando quiz_payload
        const quizPayload = item.quiz_payload;

        // ✅ VALIDAÇÃO: Verificar se quiz_payload é válido antes de processar
        if (!quizPayload || typeof quizPayload !== 'object') {
          console.warn(`⚠️ [process-quiz-retry-queue] Item ${item.id} tem quiz_payload inválido`);
          await supabaseClient
            .from('quiz_retry_queue')
            .update({
              status: 'failed',
              last_error: 'Invalid quiz_payload format',
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          failed++;
          continue;
        }

        // Validar campos obrigatórios (novo padrão: about_who, style, message ou legado)
        const hasNewPattern = quizPayload.message && typeof quizPayload.message === 'string' && String(quizPayload.message).trim();
        const hasLegacyPattern = (quizPayload.qualities && String(quizPayload.qualities).trim()) ||
          (quizPayload.memories && String(quizPayload.memories).trim()) ||
          (quizPayload.key_moments && String(quizPayload.key_moments).trim());
        if (!quizPayload.about_who || !quizPayload.style) {
          console.warn(`⚠️ [process-quiz-retry-queue] Item ${item.id} está incompleto (faltam campos obrigatórios)`);
          await supabaseClient
            .from('quiz_retry_queue')
            .update({
              status: 'failed',
              last_error: 'Missing required fields (about_who or style)',
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          failed++;
          continue;
        }
        if (!hasNewPattern && !hasLegacyPattern) {
          console.warn(`⚠️ [process-quiz-retry-queue] Item ${item.id} sem contexto (message ou qualities/memories/key_moments)`);
          await supabaseClient
            .from('quiz_retry_queue')
            .update({
              status: 'failed',
              last_error: 'Missing context (message or legacy fields)',
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          failed++;
          continue;
        }

        // Novo padrão: quando message preenchido e legado vazio, garantir campos legados null
        if (hasNewPattern && !hasLegacyPattern) {
          quizPayload.qualities = null;
          quizPayload.memories = null;
          quizPayload.key_moments = null;
          quizPayload.desired_tone = null;
        }

        // Usar retry logic para tentar salvar
        let saveSuccess = false;
        let lastError: any = null;

        try {
          await withRetry(
            async () => {
              let query = supabaseClient.from('quizzes');
              
              if (quizPayload.session_id) {
                // Usar upsert por session_id
                query = query.upsert(quizPayload, {
                  onConflict: 'session_id',
                  ignoreDuplicates: false
                });
              } else {
                // Usar insert se não tiver session_id
                query = query.insert(quizPayload);
              }

              const { data, error } = await query.select('id').single();

              if (error) {
                throw error;
              }

              if (!data || !data.id) {
                throw new Error('Quiz data ou ID ausente após inserção');
              }

              return data;
            },
            {
              ...RETRY_CONFIGS.DATABASE,
              maxAttempts: 3 // Menos tentativas na fila
            }
          );

          saveSuccess = true;
        } catch (error: any) {
          lastError = error;
          console.warn(`⚠️ [process-quiz-retry-queue] Erro ao salvar quiz (item ${item.id}):`, error);
        }

        if (saveSuccess) {
          // Sucesso! Marcar como completed e remover da fila
          await supabaseClient
            .from('quiz_retry_queue')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);

          completed++;
          console.log(`✅ [process-quiz-retry-queue] Item ${item.id} processado com sucesso`);
        } else {
          // Falha - incrementar attempts e atualizar next_retry_at (exponential backoff)
          const newAttempts = (item.attempts || 0) + 1;
          const maxAttempts = item.max_attempts || 5;

          if (newAttempts >= maxAttempts) {
            // Excedeu max_attempts - marcar como failed
            await supabaseClient
              .from('quiz_retry_queue')
              .update({
                status: 'failed',
                attempts: newAttempts,
                last_error: lastError?.message || 'Unknown error',
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id);

            failed++;
            console.warn(`❌ [process-quiz-retry-queue] Item ${item.id} marcado como failed após ${newAttempts} tentativas`);
          } else {
            // Ainda há tentativas - calcular próximo retry (exponential backoff)
            const backoffMs = Math.min(1000 * Math.pow(2, newAttempts - 1), 300000); // Max 5 minutos
            const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

            await supabaseClient
              .from('quiz_retry_queue')
              .update({
                status: 'pending',
                attempts: newAttempts,
                last_error: lastError?.message || 'Unknown error',
                next_retry_at: nextRetryAt,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id);

            stillPending++;
            console.log(`⏳ [process-quiz-retry-queue] Item ${item.id} agendado para retry em ${backoffMs}ms (tentativa ${newAttempts}/${maxAttempts})`);
          }
        }

        processed++;

        // Pequeno delay entre itens para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (itemError: any) {
        console.error(`❌ [process-quiz-retry-queue] Erro ao processar item ${item.id}:`, itemError);
        
        // Marcar como pending novamente para tentar depois
        await supabaseClient
          .from('quiz_retry_queue')
          .update({
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        stillPending++;
      }
    }

    console.log(`✅ [process-quiz-retry-queue] Processamento concluído:`, {
      processed,
      completed,
      failed,
      stillPending
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        completed,
        failed,
        stillPending
      }),
      { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [process-quiz-retry-queue] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || 'Unknown error' 
      }),
      { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

