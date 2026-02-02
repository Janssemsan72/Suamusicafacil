// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Headers simplificados (sem rate limiting)
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
    console.log('=== Auto Generate Workflow Started ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    // Parsing robusto
    let order_id: string | null = null;
    try {
      const body = await req.json();
      order_id = body?.order_id || null;
    } catch (_) {
      // ignorar
    }
    if (!order_id) {
      const url = new URL(req.url);
      order_id = url.searchParams.get('order_id');
    }

    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id é obrigatório' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log('Processing order:', order_id);

    // Buscar order (sem embed ambíguo)
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, customer_email, quiz_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Pedido não encontrado: ${orderError?.message || 'not found'}`);
    }

    // Buscar quiz explicitamente
    const { data: quiz, error: quizError } = await supabaseClient
      .from('quizzes')
      .select('*')
      .eq('id', order.quiz_id)
      .single();

    if (quizError || !quiz) {
      throw new Error('Quiz não encontrado para este pedido');
    }

    // Buscar job mais recente por order_id
    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .select('id, status')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (jobError || !job) {
      throw new Error('Job não encontrado para este pedido');
    }

    console.log('Order found:', { order_id, job_id: job.id, status: job.status });

    // ETAPA 1: Gerar Letra com IA
    console.log('📝 Generating lyrics...');
    
    try {
      const { data: lyricsData, error: lyricsError } = await supabaseClient.functions.invoke(
        'generate-lyrics-internal',
        { body: { job_id: job.id } }
      );

      if (lyricsError) {
        throw new Error(`Erro ao gerar letra: ${lyricsError.message}`);
      }

      console.log('✅ Lyrics generated successfully');

      // Aguardar atualização no banco
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Buscar job atualizado
      const { data: updatedJob } = await supabaseClient
        .from('jobs')
        .select('gpt_lyrics')
        .eq('id', job.id)
        .single();

      if (!updatedJob?.gpt_lyrics) {
        throw new Error('Letra não foi salva no job');
      }

      const lyrics = updatedJob.gpt_lyrics;

      // ETAPA 2: Criar aprovação de letra
      console.log('📝 Creating lyrics approval...');

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72); // 72 horas

      // ✅ Preencher voice baseado no vocal_gender do quiz (M/F/S)
      let voice = 'S'; // Sem preferência (padrão)
      if (quiz?.vocal_gender === 'm' || quiz?.vocal_gender === 'M') {
        voice = 'M'; // Masculino
      } else if (quiz?.vocal_gender === 'f' || quiz?.vocal_gender === 'F') {
        voice = 'F'; // Feminino
      }

      const { data: approval, error: approvalError } = await supabaseClient
        .from('lyrics_approvals')
        .insert({
          job_id: job.id,
          order_id: order.id,
          quiz_id: quiz?.id, // ✅ Adicionar quiz_id se disponível
          customer_email: order.customer_email,
          lyrics: lyrics,
          voice: voice, // ✅ Preencher voice baseado no quiz
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (approvalError || !approval) {
        throw new Error(`Erro ao criar aprovação: ${approvalError?.message}`);
      }

      console.log('✅ Approval created:', approval.id);

      // ETAPA 3: Notificação via UI (Realtime/Polling) – sem e-mail
      console.log('🔔 Approval criada – UI (Realtime/Polling) será atualizada automaticamente');

      // Log da ação
      await supabaseClient.from('admin_logs').insert({
        action: 'lyrics_approval_created',
        details: {
          order_id,
          job_id: job.id,
          approval_id: approval.id,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          job_id: job.id,
          approval_id: approval.id,
          message: 'Letra gerada e enviada para aprovação do cliente',
        }),
        {
          headers: corsHeaders,
          status: 200,
        }
      );

    } catch (lyricsError: any) {
      console.error('❌ Error generating lyrics:', lyricsError);
      
      // Marcar job como failed
      await supabaseClient
        .from('jobs')
        .update({ status: 'failed', error_message: lyricsError.message })
        .eq('id', job.id);

      throw lyricsError;
    }

  } catch (error: any) {
    console.error('Error in auto-generate-workflow:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: corsHeaders,
        status: 500,
      }
    );
  }
});
