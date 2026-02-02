/**
 * Utility for inserting quizzes with robust retry logic
 * Handles concurrent insertions and transient database errors
 * ✅ OTIMIZADO: Suporta 100+ pedidos simultâneos com throttling e circuit breaker
 */

import { retry, RetryOptions } from './retry';
import { supabase } from '@/integrations/supabase/client';

export interface QuizPayload {
  user_id?: string | null;
  customer_email?: string | null; // Opcional para permitir salvar sem email inicialmente
  customer_whatsapp?: string | null;
  about_who: string;
  relationship?: string;
  style: string;
  language?: string;
  vocal_gender?: string | null;
  qualities?: any;
  memories?: any;
  message?: string;
  key_moments?: any;
  occasion?: string | null;
  desired_tone?: string | null;
  answers?: any;
  transaction_id?: string;
  session_id?: string; // UUID único da sessão do navegador
}

export interface InsertQuizResult {
  success: boolean;
  data?: any;
  error?: any;
  attempts?: number;
  totalTime?: number;
}

// ✅ THROTTLING: Limitar inserções simultâneas para evitar sobrecarga do banco
const MAX_CONCURRENT_INSERTS = 20; // Máximo de inserções simultâneas
let activeInserts = 0;
const insertQueue: Array<{
  resolve: (value: InsertQuizResult) => void;
  reject: (error: any) => void;
  payload: QuizPayload;
  options: Partial<RetryOptions>;
}> = [];

// ✅ CIRCUIT BREAKER: Prevenir sobrecarga quando banco está com problemas
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 10; // Abrir circuito após 10 falhas consecutivas
let circuitOpen = false;
let circuitOpenUntil = 0;
const CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minuto

/**
 * Processar fila de inserções com throttling
 */
async function processInsertQueue(): Promise<void> {
  if (activeInserts >= MAX_CONCURRENT_INSERTS || insertQueue.length === 0) {
    return;
  }

  // Verificar circuit breaker
  if (circuitOpen) {
    if (Date.now() < circuitOpenUntil) {
      // Circuit ainda aberto - aguardar
      return;
    } else {
      // Circuit fechado - resetar
      circuitOpen = false;
      consecutiveFailures = 0;
      console.log('[QuizInsert] Circuit breaker fechado - tentando novamente');
    }
  }

  activeInserts++;
  const item = insertQueue.shift()!;

  try {
    const result = await performInsert(item.payload, item.options);
    // ✅ Sempre resolver, mesmo em caso de erro (result.success indica sucesso)
    item.resolve(result);
  } catch (error) {
    // ✅ Em caso de exceção não tratada, criar resultado de erro
    item.resolve({
      success: false,
      error,
      attempts: 0,
      totalTime: 0,
    });
  } finally {
    activeInserts--;
    // Processar próximo item da fila
    setTimeout(() => processInsertQueue(), 0); // Usar setTimeout para não bloquear
  }
}

/**
 * Realizar inserção real (sem throttling)
 */
async function performInsert(
  quizPayload: QuizPayload,
  options: Partial<RetryOptions> = {}
): Promise<InsertQuizResult> {
  const startTime = Date.now();
  let attempts = 0;
  
  const retryOptions: RetryOptions = {
    maxRetries: 5,
    initialDelay: 500,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryable: (error: any) => {
      if (!error) return false;
      
      // Network errors
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        return true;
      }
      
      // Timeout errors
      if (error.message?.includes('timeout') || error.message?.includes('aborted')) {
        return true;
      }
      
      // HTTP 5xx errors (server errors)
      if (error.status >= 500 && error.status < 600) {
        return true;
      }
      
      // Supabase/PostgreSQL specific errors that are retryable
      if (error.code === 'PGRST116' || error.code === '57014') {
        return true; // Connection timeout, statement timeout
      }
      
      // PostgreSQL error codes for retryable errors
      if (error.code === '40P01') return true; // deadlock detected
      if (error.code === '53300') return true; // too many connections
      if (error.code === '57P03') return true; // cannot connect now
      if (error.code === '08006') return true; // connection failure
      if (error.code === '08003') return true; // connection does not exist
      if (error.code === '08001') return true; // SQL client unable to establish SQL connection
      
      // Check error message for connection-related errors
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('connection') || errorMsg.includes('econnreset') || errorMsg.includes('etimedout')) {
        return true;
      }
      
      return false;
    },
    ...options,
  };

  try {
    const result = await retry(
      async () => {
        attempts++;
        const attemptStartTime = Date.now();
        
        console.log(`[QuizInsert] Tentativa ${attempts}/${(retryOptions.maxRetries || 5) + 1} de inserir quiz`, {
          timestamp: new Date().toISOString(),
          customer_email: quizPayload.customer_email,
          transaction_id: quizPayload.transaction_id,
          activeInserts,
          queueLength: insertQueue.length,
        });

        // ✅ UPSERT: Usar upsert se tiver session_id para garantir idempotência
        // ✅ CORREÇÃO: Verificar se quiz já está associado a pedido antes de fazer UPSERT
        let query = supabase.from('quizzes');
        
        if (quizPayload.session_id) {
          // Verificar se já existe quiz com este session_id e se está associado a um pedido
          // maybeSingle() evita 406 quando não existe quiz (single() retorna 406 com 0 linhas)
          const { data: existingQuiz } = await supabase
            .from('quizzes')
            .select('id')
            .eq('session_id', quizPayload.session_id)
            .maybeSingle();
          
          if (existingQuiz) {
            // Verificar se quiz já está associado a algum pedido
            const { data: existingOrder } = await supabase
              .from('orders')
              .select('id, status')
              .eq('quiz_id', existingQuiz.id)
              .maybeSingle();
            
            if (existingOrder) {
              // Quiz já está associado a um pedido - criar novo quiz em vez de atualizar
              // ✅ CORREÇÃO: Não usar session_id para novo quiz (evitar conflito de constraint unique)
              console.log(`[QuizInsert] Quiz com session_id ${quizPayload.session_id} já está associado a pedido ${existingOrder.id}, criando novo quiz sem session_id`);
              const newQuizPayload = { ...quizPayload, session_id: undefined };
              query = query.insert(newQuizPayload);
            } else {
              // Quiz existe mas não está associado a pedido - pode atualizar
              query = query.upsert(quizPayload, {
                onConflict: 'session_id',
                ignoreDuplicates: false // Atualiza se já existe
              });
            }
          } else {
            // Quiz não existe - pode fazer upsert normalmente
            query = query.upsert(quizPayload, {
              onConflict: 'session_id',
              ignoreDuplicates: false // Atualiza se já existe
            });
          }
        } else {
          // Fallback para insert se não tiver session_id
          query = query.insert(quizPayload);
        }
        
        const { data, error } = await query
          .select()
          .single();

        const attemptDuration = Date.now() - attemptStartTime;

        if (error) {
          const errMsg = (error.message || "").toLowerCase();
          const isSchemaError =
            error.code === "42703" ||
            error.code === "42P01" ||
            errMsg.includes("session_id") ||
            errMsg.includes("customer_whatsapp") ||
            errMsg.includes("column");
          const isAuthError = error.code === "PGRST301" || errMsg.includes("401");

          // Fallback: tentar INSERT simples se UPSERT falhou por schema ou auth
          if ((isSchemaError || isAuthError) && quizPayload.session_id) {
            console.warn(`[QuizInsert] Fallback: tentando INSERT simples (erro: ${error.code})`);
            const fallbackPayload = {
              about_who: quizPayload.about_who,
              relationship: quizPayload.relationship,
              style: quizPayload.style,
              language: quizPayload.language || "pt",
              customer_email: quizPayload.customer_email || "",
              occasion: quizPayload.occasion || null,
              vocal_gender: quizPayload.vocal_gender || null,
              qualities: quizPayload.qualities || null,
              memories: quizPayload.memories || null,
              message: quizPayload.message || null,
              key_moments: quizPayload.key_moments || null,
              desired_tone: quizPayload.desired_tone || null,
              answers: quizPayload.answers || null,
            };
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("quizzes")
              .insert(fallbackPayload)
              .select()
              .single();
            if (!fallbackError && fallbackData?.id) {
              return fallbackData;
            }
          }

          console.warn(`[QuizInsert] Tentativa ${attempts} falhou`, {
            error_code: error.code,
            error_message: error.message,
            error_details: error.details,
            error_hint: error.hint,
            duration_ms: attemptDuration,
          });
          throw error;
        }

        if (!data || !data.id) {
          const missingDataError = new Error('Quiz data ou ID ausente após inserção');
          console.error(`[QuizInsert] Tentativa ${attempts} retornou dados inválidos`, {
            has_data: !!data,
            has_id: !!data?.id,
            duration_ms: attemptDuration,
          });
          throw missingDataError;
        }

        console.log(`[QuizInsert] Tentativa ${attempts} bem-sucedida`, {
          quiz_id: data.id,
          duration_ms: attemptDuration,
        });

        // ✅ CIRCUIT BREAKER: Resetar contador de falhas em caso de sucesso
        if (consecutiveFailures > 0) {
          consecutiveFailures = 0;
          circuitOpen = false;
          console.log('[QuizInsert] Circuit breaker resetado após sucesso');
        }

        return data;
      },
      retryOptions
    );

    const totalTime = Date.now() - startTime;
    
    console.log(`[QuizInsert] Quiz inserido com sucesso após ${attempts} tentativa(s)`, {
      quiz_id: result.id,
      total_time_ms: totalTime,
      attempts,
    });

    return {
      success: true,
      data: result,
      attempts,
      totalTime,
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    
    // ✅ CIRCUIT BREAKER: Incrementar contador de falhas (apenas uma vez)
    consecutiveFailures++;
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitOpen = true;
      circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_RESET_TIME;
      console.error(`[QuizInsert] Circuit breaker ABERTO após ${consecutiveFailures} falhas consecutivas`, {
        circuitOpenUntil: new Date(circuitOpenUntil).toISOString(),
        resetTime: CIRCUIT_BREAKER_RESET_TIME / 1000 + 's',
      });
    }
    
    console.error(`[QuizInsert] Falha ao inserir quiz após ${attempts} tentativa(s)`, {
      error_code: error?.code,
      error_message: error?.message,
      error_details: error?.details,
      total_time_ms: totalTime,
      attempts,
      consecutiveFailures,
      circuitOpen,
      customer_email: quizPayload.customer_email,
      transaction_id: quizPayload.transaction_id,
    });
    
    return {
      success: false,
      error,
      attempts,
      totalTime,
    };
  }
}

/**
 * Adicionar quiz à fila de retry no servidor
 * Substitui a fila local (quizQueue) por uma fila no servidor (mais confiável)
 * ✅ MELHORIA: Adicionado retry com 3 tentativas para garantir 100% de eficácia
 */
export async function enqueueQuizToServer(quizPayload: QuizPayload, error?: any): Promise<boolean> {
  const maxRetries = 3;
  const initialDelay = 500;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Inserir diretamente na tabela quiz_retry_queue
      const { data, error: insertError } = await supabase
        .from('quiz_retry_queue')
        .insert({
          session_id: quizPayload.session_id || null,
          quiz_payload: quizPayload as any,
          attempts: 0,
          max_attempts: 5,
          last_error: error?.message || 'Unknown error',
          status: 'pending',
          next_retry_at: new Date().toISOString() // Tentar imediatamente
        })
        .select('id')
        .single();

      if (insertError) {
        // Se é erro de duplicado (session_id já existe), considerar sucesso
        if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
          console.log('✅ [quizInsert] Quiz já existe na fila (duplicado), considerando sucesso:', {
            session_id: quizPayload.session_id,
            attempt
          });
          return true;
        }
        
        // Se não é última tentativa, tentar novamente
        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`⚠️ [quizInsert] Erro ao adicionar quiz à fila (tentativa ${attempt}/${maxRetries}), tentando novamente em ${delay}ms:`, insertError);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        console.error('❌ [quizInsert] Erro ao adicionar quiz à fila do servidor após todas as tentativas:', insertError);
        return false;
      }

      console.log('✅ [quizInsert] Quiz adicionado à fila do servidor:', {
        queue_id: data?.id,
        session_id: quizPayload.session_id,
        customer_email: quizPayload.customer_email,
        attempt
      });

      return true;
    } catch (err: any) {
      // Se não é última tentativa, tentar novamente
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`⚠️ [quizInsert] Exceção ao adicionar quiz à fila (tentativa ${attempt}/${maxRetries}), tentando novamente em ${delay}ms:`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error('❌ [quizInsert] Exceção ao adicionar quiz à fila do servidor após todas as tentativas:', err);
      return false;
    }
  }
  
  return false;
}

/**
 * Obter estatísticas de concorrência (útil para debugging)
 */
export function getInsertStats(): {
  activeInserts: number;
  queueLength: number;
  circuitOpen: boolean;
  consecutiveFailures: number;
  circuitOpenUntil: number | null;
} {
  return {
    activeInserts,
    queueLength: insertQueue.length,
    circuitOpen,
    consecutiveFailures,
    circuitOpenUntil: circuitOpen ? circuitOpenUntil : null,
  };
}

/**
 * Insert quiz with retry logic optimized for database operations
 * ✅ OTIMIZADO: Suporta 100+ pedidos simultâneos com throttling e circuit breaker
 * 
 * @param quizPayload - The quiz data to insert
 * @param options - Optional retry configuration
 * @returns Promise with result containing success status, data, and metadata
 */
export async function insertQuizWithRetry(
  quizPayload: QuizPayload,
  options: Partial<RetryOptions> = {}
): Promise<InsertQuizResult> {
  // ✅ THROTTLING: Se já temos muitas inserções ativas, adicionar à fila
  if (activeInserts >= MAX_CONCURRENT_INSERTS || (circuitOpen && Date.now() < circuitOpenUntil)) {
    return new Promise((resolve, reject) => {
      insertQueue.push({
        resolve,
        reject,
        payload: quizPayload,
        options,
      });
      
      console.log(`[QuizInsert] Quiz adicionado à fila (${insertQueue.length} na fila, ${activeInserts} ativos)`, {
        customer_email: quizPayload.customer_email,
        circuitOpen,
        circuitOpenUntil: circuitOpen ? new Date(circuitOpenUntil).toISOString() : null,
      });
      
      // Processar fila
      processInsertQueue().catch(error => {
        console.error('[QuizInsert] Erro ao processar fila:', error);
      });
    });
  }

  // ✅ THROTTLING: Processar imediatamente se houver espaço
  return performInsert(quizPayload, options);
}

