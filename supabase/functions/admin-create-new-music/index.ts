import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    console.log('=== Admin Create New Music Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parsing do body
    let order_id: string | null = null;
    let lyrics: any = null;
    
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        order_id = (body && body.order_id) || null;
        lyrics = (body && body.lyrics) || null;
      } else {
        const raw = await req.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            order_id = parsed.order_id || null;
            lyrics = parsed.lyrics || null;
          } catch (_) {
            const url = new URL(req.url);
            order_id = url.searchParams.get('order_id');
          }
        } else {
          const url = new URL(req.url);
          order_id = url.searchParams.get('order_id');
        }
      }
    } catch (parseError) {
      console.error('❌ [AdminCreateNewMusic] Erro ao fazer parse do body:', parseError);
      try {
        const url = new URL(req.url);
        order_id = url.searchParams.get('order_id');
      } catch (_) {
        // Ignorar
      }
    }

    if (!order_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'order_id é obrigatório' 
        }),
        {
          headers: corsHeaders,
          status: 400,
        }
      );
    }

    console.log('📝 Criando nova música para order:', order_id);

    // 1. Buscar order e quiz
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, quizzes(*)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Order não encontrado: ${orderError?.message || 'Order não existe'}` 
        }),
        {
          headers: corsHeaders,
          status: 404,
        }
      );
    }

    if (!order.quizzes) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Quiz não encontrado para este order' 
        }),
        {
          headers: corsHeaders,
          status: 404,
        }
      );
    }

    // quizzes(*) retorna um array, pegar o primeiro elemento
    const quiz = Array.isArray(order.quizzes) ? order.quizzes[0] : order.quizzes;
    if (!quiz) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Quiz inválido para este order' 
        }),
        {
          headers: corsHeaders,
          status: 404,
        }
      );
    }

    // 2. Contar quantas músicas já existem para este pedido
    const { data: existingJobs, error: countError } = await supabaseClient
      .from('jobs')
      .select('id', { count: 'exact' })
      .eq('order_id', order_id);

    const musicNumber = (existingJobs?.length || 0) + 1;
    console.log(`📊 Criando música #${musicNumber} para o pedido ${order_id}`);

    // 3. Criar NOVO job (SEM deletar os antigos)
    console.log('📝 Criando novo job (sem deletar os antigos)...');
    
    const { data: newJob, error: jobError } = await supabaseClient
      .from('jobs')
      .insert({
        order_id: order_id,
        quiz_id: quiz.id,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError || !newJob) {
      console.error('❌ Erro ao criar job:', jobError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Erro ao criar job: ${jobError?.message || 'Job não foi criado'}` 
        }),
        {
          headers: corsHeaders,
          status: 500,
        }
      );
    }

    console.log('✅ Novo job criado:', newJob.id);

    // 3.5. Descontar 12 créditos Suno ao criar novo card de lyrics
    try {
      console.log('💳 [CRÉDITOS] Descontando 12 créditos para novo card de lyrics...');
      console.log('💳 [CRÉDITOS] Job ID:', newJob.id);
      console.log('💳 [CRÉDITOS] Order ID:', order_id);
      
      const { data: deductResult, error: deductError } = await supabaseClient.rpc('deduct_suno_credits', {
        credits_to_deduct: 12,
        p_job_id: newJob.id,
        p_order_id: order_id,
        p_description: `Novo card de lyrics - Job ${newJob.id} - Música #${musicNumber}`
      });

      if (deductError) {
        console.error('❌ [CRÉDITOS] Erro ao descontar créditos Suno:', deductError);
        console.error('❌ [CRÉDITOS] Detalhes do erro:', JSON.stringify(deductError, null, 2));
        console.error('❌ [CRÉDITOS] Código do erro:', deductError.code);
        console.error('❌ [CRÉDITOS] Mensagem do erro:', deductError.message);
        // Não bloquear o fluxo se o desconto falhar, mas logar o erro
      } else {
        console.log('✅ [CRÉDITOS] 12 créditos descontados com sucesso!');
        if (deductResult) {
          console.log('✅ [CRÉDITOS] Resultado:', JSON.stringify(deductResult, null, 2));
          console.log('✅ [CRÉDITOS] Créditos anteriores:', deductResult.previous_credits);
          console.log('✅ [CRÉDITOS] Créditos descontados:', deductResult.credits_deducted);
          console.log('✅ [CRÉDITOS] Créditos restantes:', deductResult.remaining_credits);
          
          if (!deductResult.success) {
            console.error('❌ [CRÉDITOS] ATENÇÃO: Função retornou success=false!', deductResult);
          }
        } else {
          console.error('❌ [CRÉDITOS] ATENÇÃO: Função não retornou resultado!');
        }
      }
    } catch (creditError) {
      console.error('❌ [CRÉDITOS] Exceção ao descontar créditos Suno:', creditError);
      console.error('❌ [CRÉDITOS] Stack trace:', creditError instanceof Error ? creditError.stack : 'N/A');
      // Não bloquear o fluxo se o desconto falhar
    }

    // 4. Se lyrics foi fornecido, criar approval com a letra
    let approval_id: string | null = null;
    
    if (lyrics) {
      console.log('📝 Criando approval com letra fornecida...');
      
      // Validar estrutura de lyrics
      let lyricsToSave: any;
      let lyricsPreview: string;

      if (typeof lyrics === 'string') {
        lyricsToSave = {
          title: `Música ${musicNumber} para ${quiz.about_who || 'Cliente'}`,
          lyrics: lyrics,
          style: quiz.style || 'pop',
          language: quiz.language || 'pt',
          tone: 'emotional' // Novo padrão: tom padrão (desired_tone removido)
        };
        const lyricsLines = lyrics
          .split('\n')
          .map(s => s.trim())
          .filter(l => l && !l.match(/^\[(Verse|Chorus|Bridge|Refrão|Verso|Ponte|Intro|Outro)\]/i));
        const previewText = lyricsLines.slice(0, 10).join('\n');
        lyricsPreview = previewText.length > 500 ? previewText.substring(0, 500) + '...' : previewText;
      } else if (typeof lyrics === 'object') {
        lyricsToSave = lyrics;
        if (lyrics.title && lyrics.lyrics) {
          const lyricsLines = lyrics.lyrics
            .split('\n')
            .map(s => s.trim())
            .filter(l => l && !l.match(/^\[(Verse|Chorus|Bridge|Refrão|Verso|Ponte|Intro|Outro)\]/i));
          const previewText = lyricsLines.slice(0, 10).join('\n');
          lyricsPreview = previewText.length > 500 ? previewText.substring(0, 500) + '...' : previewText;
        } else {
          lyricsPreview = lyrics.title || 'Nova música';
        }
      } else {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Formato de lyrics inválido' 
          }),
          {
            headers: corsHeaders,
            status: 400,
          }
        );
      }

      // Criar approval
      const { data: newApproval, error: approvalError } = await supabaseClient
        .from('lyrics_approvals')
        .insert({
          order_id: order_id,
          job_id: newJob.id,
          quiz_id: quiz.id,
          lyrics: lyricsToSave,
          lyrics_preview: lyricsPreview,
          status: 'pending',
          expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (approvalError || !newApproval) {
        console.error('❌ Erro ao criar approval:', approvalError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Erro ao criar approval: ${approvalError?.message || 'Approval não foi criada'}` 
          }),
          {
            headers: corsHeaders,
            status: 500,
          }
        );
      }

      approval_id = newApproval.id;
      console.log('✅ Approval criada:', approval_id);

      // Atualizar job com a letra também
      await supabaseClient
        .from('jobs')
        .update({
          gpt_lyrics: lyricsToSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', newJob.id);
    } else {
      // Se não tem lyrics, apenas criar job (a letra será gerada depois)
      console.log('ℹ️  Letra não fornecida. Job criado sem approval. A letra pode ser gerada depois.');
    }

    // 5. Contar quantas músicas existem agora
    const { data: allJobs, error: finalCountError } = await supabaseClient
      .from('jobs')
      .select('id, status, created_at')
      .eq('order_id', order_id)
      .order('created_at', { ascending: false });

    console.log(`✅ Total de músicas para este pedido: ${allJobs?.length || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Nova música #${musicNumber} criada com sucesso`,
        data: {
          order_id: order_id,
          job_id: newJob.id,
          approval_id: approval_id,
          music_number: musicNumber,
          total_musics: allJobs?.length || 0,
          has_lyrics: !!lyrics
        }
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error in admin-create-new-music:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro desconhecido ao criar nova música',
        details: error.details || null
      }),
      {
        headers: corsHeaders,
        status: 500,
      }
    );
  }
});





