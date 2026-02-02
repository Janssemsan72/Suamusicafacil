import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { validateQuizData } from "../_shared/validation.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validar payload
    const body = await req.json();
    const { order_id } = body;
    
    if (!order_id || typeof order_id !== 'string') {
      throw new Error('order_id inválido ou ausente');
    }
    
    // Validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(order_id)) {
      throw new Error('order_id deve ser um UUID válido');
    }

    console.log('Processing order:', order_id);

    // Buscar order com quiz
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, quizzes(*)')
      .eq('id', order_id)
      .single();

    if (orderError) {
      console.error('Database error fetching order:', orderError);
      throw new Error(`Erro ao buscar pedido: ${orderError.message}`);
    }
    
    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    // Validar status do pedido
    if (order.status !== 'paid') {
      console.warn(`Order ${order_id} status is ${order.status}, not paid`);
      throw new Error(`Pedido com status inválido: ${order.status}. Esperado: paid`);
    }

    // quizzes(*) retorna um array, pegar o primeiro elemento
    const quiz = Array.isArray(order.quizzes) ? order.quizzes[0] : order.quizzes;
    if (!quiz) {
      console.error('Quiz not found for order:', order_id);
      throw new Error('Questionário não encontrado para este pedido');
    }
    
    // ✅ VALIDAÇÃO COMPLETA: Usando função compartilhada
    const validationErrors = validateQuizData(quiz);
    
    if (validationErrors.length > 0) {
      console.error('Quiz validation failed:', validationErrors, quiz);
      throw new Error(`Dados do questionário inválidos: ${validationErrors.join(', ')}`);
    }
    
    // ✅ VALIDAÇÃO DE INTEGRIDADE: Verificar se quiz tem dados mínimos para processamento
    if (!quiz.customer_email) {
      console.warn('Quiz sem email do cliente, mas continuando processamento');
    }

    // Calcular data de release baseado no plano
    // Standard: 7 days (168 hours) | Express: 24 hours
    const hoursToRelease = order.plan === 'express' ? 24 : 168;
    const releaseAt = new Date();
    releaseAt.setHours(releaseAt.getHours() + hoursToRelease);
    
    console.log('Order details:', {
      order_id: order.id,
      plan: order.plan,
      hours_to_release: hoursToRelease,
      release_at: releaseAt.toISOString()
    });

    // Verificar se já existe job para este pedido
    const { data: existingJobs } = await supabaseClient
      .from('jobs')
      .select('id, status')
      .eq('order_id', order.id)
      .limit(1);
    
    if (existingJobs && existingJobs.length > 0) {
      const existingJob = existingJobs[0];
      console.log('Job already exists for order:', existingJob);
      
      // Se job existente não está failed, retornar ele
      if (existingJob.status !== 'failed') {
        return new Response(
          JSON.stringify({ 
            success: true,
            job_id: existingJob.id,
            message: 'Job já existe para este pedido',
            existing: true
          }),
          {
            headers: { ...secureHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }
    }

    // Criar job de geração
    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .insert({
        order_id: order.id,
        quiz_id: quiz.id,
        status: 'pending',
        transaction_id: order.transaction_id
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      throw new Error(`Erro ao criar job: ${jobError.message}`);
    }
    
    if (!job || !job.id) {
      throw new Error('Job criado mas ID não retornado');
    }

    console.log('Job created:', job.id);

    // Descontar 12 créditos Suno ao criar novo card de lyrics
    try {
      console.log('💳 [CRÉDITOS] Descontando 12 créditos para novo card de lyrics...');
      const { data: deductResult, error: deductError } = await supabaseClient.rpc('deduct_suno_credits', {
        credits_to_deduct: 12,
        p_job_id: job.id,
        p_order_id: order.id,
        p_description: `Novo card de lyrics - Job ${job.id} - Processamento de pedido`
      });

      if (deductError) {
        console.error('❌ [CRÉDITOS] Erro ao descontar créditos Suno:', deductError);
      } else {
        console.log('✅ [CRÉDITOS] 12 créditos descontados com sucesso!');
      }
    } catch (creditError) {
      console.error('❌ [CRÉDITOS] Exceção ao descontar créditos Suno:', creditError);
    }

    // Verificar se já existe música para este pedido
    const { data: existingSongs } = await supabaseClient
      .from('songs')
      .select('id')
      .eq('order_id', order.id)
      .limit(1);
    
    let song;
    if (existingSongs && existingSongs.length > 0) {
      song = existingSongs[0];
      console.log('Song already exists for order:', song.id);
    } else {
      // Criar registro de música
      const { data: newSong, error: songError } = await supabaseClient
        .from('songs')
        .insert({
          user_id: order.user_id,
          order_id: order.id,
          quiz_id: quiz.id,
          title: `Música para ${quiz.about_who}`,
          language: quiz.language,
          style: quiz.style,
          emotion: null, // Novo padrão: tom derivado do message na geração
          status: 'pending',
          release_at: releaseAt.toISOString(),
          transaction_id: order.transaction_id
        })
        .select()
        .single();

      if (songError) {
        console.error('Error creating song:', songError);
        throw new Error(`Erro ao criar música: ${songError.message}`);
      }
      
      song = newSong;
      console.log('Song created:', song.id);
    }

    // Invocar função de geração de letra (não-bloqueante)
    try {
      const { error: lyricsError } = await supabaseClient.functions.invoke(
        'generate-lyrics-internal',
        {
          body: { job_id: job.id }
        }
      );

      if (lyricsError) {
        console.error('Error invoking generate-lyrics-internal:', lyricsError);
      } else {
        console.log('generate-lyrics-internal invoked successfully');
      }
    } catch (invokeError) {
      console.error('Failed to invoke generate-lyrics-internal:', invokeError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: job.id,
        song_id: song?.id,
        release_at: releaseAt.toISOString()
      }),
      {
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('Error in process-order:', error);
    
    let status = 500;
    let errorMessage = error.message || 'Erro desconhecido ao processar pedido';
    
    if (errorMessage.includes('não encontrado') || errorMessage.includes('not found')) {
      status = 404;
    } else if (errorMessage.includes('inválido') || errorMessage.includes('invalid') || errorMessage.includes('UUID')) {
      status = 400;
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: Deno.env.get('ENVIRONMENT') === 'development' ? error.stack : undefined
      }),
      {
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
        status
      }
    );
  }
});
