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

  let supabaseClient: any = null;
  let order_id: string | null = null;

  try {
    console.log('=== Generate Lyrics for Admin Approval Started ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    supabaseClient = createClient(supabaseUrl, serviceKey);

    // Parsing resiliente do body (pode vir vazio ou sem header JSON)
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        order_id = (body && body.order_id) || null;
      } else {
        const raw = await req.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            order_id = parsed.order_id || null;
          } catch (_) {
            // tentar querystring como fallback
            const url = new URL(req.url);
            order_id = url.searchParams.get('order_id');
          }
        } else {
          const url = new URL(req.url);
          order_id = url.searchParams.get('order_id');
        }
      }
    } catch (_) {
      const url = new URL(req.url);
      order_id = url.searchParams.get('order_id');
    }

    if (!order_id) {
      console.error('❌ [GenerateLyricsForApproval] order_id não fornecido');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'order_id é obrigatório' 
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    console.log('📦 [GenerateLyricsForApproval] Processando pedido:', {
      order_id: order_id,
      timestamp: new Date().toISOString()
    });

    // 1. Buscar order e quiz (desambiguando relação)
    // ✅ CORREÇÃO: Adicionar retry com delay para garantir que o status foi commitado
    let order: any = null;
    let orderError: any = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Aguardar um pouco antes de verificar (especialmente na primeira tentativa)
      if (attempt > 1) {
        const delay = attempt * 500; // 1s, 1.5s, 2s
        console.log(`⏳ [GenerateLyricsForApproval] Tentativa ${attempt}/${maxRetries} - Aguardando ${delay}ms para garantir commit...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const { data: orderData, error: orderErr } = await supabaseClient
      .from('orders')
      .select('id, quiz_id, customer_email, status, paid_at, quizzes:quiz_id(*)')
      .eq('id', order_id)
      .single();

      order = orderData;
      orderError = orderErr;
      
    if (orderError || !order) {
        console.error(`❌ [GenerateLyricsForApproval] Erro ao buscar pedido (tentativa ${attempt}/${maxRetries}):`, {
        order_id: order_id,
        error: orderError,
        message: orderError?.message
      });
        if (attempt < maxRetries) continue;
        
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Order não encontrado: ${orderError?.message || 'Pedido não existe'}` 
        }),
        { headers: corsHeaders, status: 404 }
      );
    }

      // ✅ CORREÇÃO: Verificar status com retry - pode haver delay no commit
    if (order.status !== 'paid') {
        console.warn(`⚠️ [GenerateLyricsForApproval] Pedido não está marcado como pago ainda (tentativa ${attempt}/${maxRetries}):`, {
          order_id: order_id,
          current_status: order.status,
          customer_email: order.customer_email,
          paid_at: order.paid_at
        });
        
        // Se não for a última tentativa, tentar novamente
        if (attempt < maxRetries) {
          continue;
        }
        
        // Na última tentativa, retornar erro
        console.error('❌ [GenerateLyricsForApproval] Pedido não está marcado como pago após todas as tentativas:', {
        order_id: order_id,
        current_status: order.status,
        customer_email: order.customer_email
      });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Pedido não está marcado como pago. Status atual: ${order.status}. A letra só pode ser gerada quando o pedido estiver com status 'paid'.` 
        }),
        { headers: corsHeaders, status: 400 }
        );
      }
      
      // Se chegou aqui, o pedido está pago
      break;
    }
    
    if (!order) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erro ao buscar pedido após todas as tentativas' 
        }),
        { headers: corsHeaders, status: 500 }
      );
    }

    if (!order.quizzes) {
      console.error('❌ [GenerateLyricsForApproval] Quiz não encontrado:', {
        order_id: order_id,
        quiz_id: order.quiz_id
      });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Quiz não encontrado para este order' 
        }),
        { headers: corsHeaders, status: 404 }
      );
    }

    // quizzes:quiz_id(*) retorna um array, pegar o primeiro elemento
    const quiz = Array.isArray(order.quizzes) ? order.quizzes[0] : order.quizzes;
    if (!quiz) {
      console.error('❌ [GenerateLyricsForApproval] Quiz inválido:', {
        order_id: order_id,
        quizzes: order.quizzes
      });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Quiz inválido para este order' 
        }),
        { headers: corsHeaders, status: 404 }
      );
    }

    // ✅ CORREÇÃO: Verificar se existe job pendente que pode ser reutilizado
    // Se existe um job pending/processing sem letras, usar ele em vez de criar novo
    // Mas sempre permitir criar novo job se o usuário solicitar (mesmo que já exista letra)
    const { data: existingJobs } = await supabaseClient
      .from('jobs')
      .select('id, status, gpt_lyrics')
      .eq('order_id', order_id)
      .neq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const hasPendingJob = existingJobs && existingJobs.length > 0 && 
                          (!existingJobs[0].gpt_lyrics || Object.keys(existingJobs[0].gpt_lyrics).length === 0) &&
                          (existingJobs[0].status === 'pending' || existingJobs[0].status === 'processing');
    
    let job: any = null;
    
    if (hasPendingJob) {
      // Reutilizar job existente pendente (sem letras ainda)
      job = existingJobs[0];
      console.log('ℹ️ [GenerateLyricsForApproval] Reutilizando job existente pendente:', {
        job_id: job.id,
        order_id: order_id,
        status: job.status
      });
      
      // Atualizar status para processing se estiver pending
      if (job.status === 'pending') {
        const { error: updateError } = await supabaseClient
          .from('jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id);
        
        if (updateError) {
          console.warn('⚠️ [GenerateLyricsForApproval] Erro ao atualizar status do job:', updateError);
        }
      }
    } else {
      // Criar novo job (mesmo que já exista letra - permite regeneração)
      console.log('📝 [GenerateLyricsForApproval] Criando novo job para geração de letra...');
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
      console.error('❌ [GenerateLyricsForApproval] Erro ao criar job:', {
        order_id: order_id,
        quiz_id: quiz.id,
        error: jobError,
        message: jobError?.message
      });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Erro ao criar job: ${jobError?.message || 'Falha ao criar job'}` 
        }),
        { headers: corsHeaders, status: 500 }
      );
    }

      job = newJob;
    console.log('✅ [GenerateLyricsForApproval] Job criado:', {
      job_id: job.id,
      order_id: order_id,
      quiz_id: quiz.id
    });
    
    // Descontar 12 créditos Suno ao criar novo card de lyrics
    try {
      console.log('💳 [CRÉDITOS] Descontando 12 créditos para novo card de lyrics...');
      console.log('💳 [CRÉDITOS] Job ID:', job.id);
      console.log('💳 [CRÉDITOS] Order ID:', order_id);
      
      const { data: deductResult, error: deductError } = await supabaseClient.rpc('deduct_suno_credits', {
        credits_to_deduct: 12,
        p_job_id: job.id,
        p_order_id: order_id,
        p_description: `Novo card de lyrics - Job ${job.id} - Geração automática`
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
    }
    
    // Verificar se job foi definido
    if (!job) {
      console.error('❌ [GenerateLyricsForApproval] Job não foi criado ou encontrado');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Falha ao criar ou encontrar job' 
        }),
        { headers: corsHeaders, status: 500 }
      );
    }

    // 3. Gerar letra com ChatGPT de forma SÍNCRONA
    // ✅ CORREÇÃO CRÍTICA: Fazer a chamada de forma síncrona para garantir que a letra seja gerada
    console.log('🤖 Gerando letra com ChatGPT (síncrono)...');
    console.log('📡 Chamando generate-lyrics-internal:', {
      job_id: job.id,
      order_id: order_id
    });
    
    let generatedLyrics: any = null;
    let generationError: string | null = null;
    let approvedLyrics: string | null = null;
    let approvedLyricsTitle: string | null = null;

    try {
      const answers = typeof quiz.answers === 'string' ? JSON.parse(quiz.answers) : quiz.answers;
      approvedLyrics = typeof answers?.approved_lyrics === 'string' ? answers.approved_lyrics.trim() : null;
      approvedLyricsTitle = typeof answers?.approved_lyrics_title === 'string' ? answers.approved_lyrics_title.trim() : null;
    } catch (parseError) {
      console.warn('⚠️ [GenerateLyricsForApproval] Erro ao parsear answers do quiz:', parseError);
    }

    if (approvedLyrics) {
      console.log('✅ Letra aprovada detectada, usando versão aprovada pelo cliente');
      generatedLyrics = {
        title: approvedLyricsTitle || 'Música Personalizada',
        lyrics: approvedLyrics,
        style: quiz.style || 'Personalizado',
        language: quiz.language || 'pt'
      };

      try {
        await supabaseClient
          .from('jobs')
          .update({
            gpt_lyrics: generatedLyrics,
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      } catch (updateErr) {
        console.error('❌ Erro ao salvar letra aprovada no job:', updateErr);
      }
    } else {
    try {
      console.log('📞 Chamando generate-lyrics-internal para job:', job.id);
      
      // ✅ CORREÇÃO: Chamada HTTP direta com autenticação correta
      // generate-lyrics-internal está configurada com verify_jwt: false, então aceita service key
      const functionUrl = `${supabaseUrl}/functions/v1/generate-lyrics-internal`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey
        },
        body: JSON.stringify({ job_id: job.id })
      });
      
      let data: any = null;
      let error: any = null;
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorJson: any = null;
        try {
          errorJson = JSON.parse(errorText);
        } catch (_) {
          // Se não for JSON, usar o texto como mensagem
        }
        
        error = {
          name: 'FunctionsHttpError',
          message: errorJson?.error || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          context: response
        };
        
        console.error('❌ Erro HTTP ao chamar generate-lyrics-internal:', {
          status: response.status,
          statusText: response.statusText,
          error: errorJson || errorText
        });
      } else {
        const responseText = await response.text();
        try {
          data = JSON.parse(responseText);
        } catch (parseErr) {
          console.error('❌ Erro ao fazer parse da resposta:', parseErr);
          error = {
            name: 'ParseError',
            message: 'Resposta inválida da função',
            status: response.status
          };
        }
      }
      
      console.log('📥 Resposta de generate-lyrics-internal:', {
        has_data: !!data,
        has_error: !!error,
        data_success: data?.success,
        data_error: data?.error
      });
      
      if (error) {
        console.error('❌ Erro ao chamar generate-lyrics-internal:', {
          name: error.name,
          message: error.message,
          status: (error as any).status,
          context: (error as any).context
        });
        generationError = error.message || 'Erro desconhecido ao gerar letra';
        
        // Atualizar job com erro
        try {
          await supabaseClient
            .from('jobs')
            .update({ 
              status: 'failed', 
              error: `Falha ao gerar letra: ${generationError}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
        } catch (updateErr) {
          console.error('❌ Erro ao atualizar job com erro:', updateErr);
        }
      } else if (data?.success === false) {
        console.error('❌ generate-lyrics-internal retornou success=false:', {
          error: data?.error,
          details: data?.details
        });
        generationError = data?.error || 'Erro desconhecido';
        
        // Atualizar job com erro
        try {
          await supabaseClient
            .from('jobs')
            .update({ 
              status: 'failed', 
              error: `Falha ao gerar letra: ${generationError}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
        } catch (updateErr) {
          console.error('❌ Erro ao atualizar job com erro:', updateErr);
        }
      } else if (data?.success === true) {
        console.log('✅ generate-lyrics-internal retornou success=true');
        
        // ✅ CORREÇÃO: Aguardar um pouco e buscar a letra do job (pode haver delay no commit)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Buscar a letra gerada do job (com retry)
        let retries = 3;
        let updatedJob: any = null;
        
        while (retries > 0 && !updatedJob?.gpt_lyrics) {
          const { data: jobData, error: jobFetchError } = await supabaseClient
            .from('jobs')
            .select('gpt_lyrics, status, error')
            .eq('id', job.id)
            .single();
          
          if (jobFetchError) {
            console.warn(`⚠️ Erro ao buscar job (tentativa ${4 - retries}/3):`, jobFetchError);
          } else if (jobData?.gpt_lyrics) {
            updatedJob = jobData;
            console.log('✅ Letra encontrada no job:', {
              title: jobData.gpt_lyrics?.title,
              has_lyrics: !!jobData.gpt_lyrics?.lyrics
            });
            break;
          } else {
            console.log(`⏳ Letra ainda não está no job (tentativa ${4 - retries}/3), aguardando...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          retries--;
        }
        
        if (updatedJob?.gpt_lyrics) {
          generatedLyrics = updatedJob.gpt_lyrics;
          console.log('✅ Letra obtida do job:', generatedLyrics?.title);
        } else {
          console.warn('⚠️ Letra não foi encontrada no job após tentativas');
          // Tentar usar a letra da resposta se disponível
          if (data?.lyrics) {
            generatedLyrics = data.lyrics;
            console.log('✅ Usando letra da resposta direta:', generatedLyrics?.title);
          }
        }
      } else {
        console.warn('⚠️ Resposta inesperada de generate-lyrics-internal:', data);
      }
    } catch (err: any) {
      console.error('❌ Exceção ao chamar generate-lyrics-internal:', {
        message: err?.message,
        stack: err?.stack,
        name: err?.name
      });
      generationError = err?.message || 'Exceção ao gerar letra';
      
      // Atualizar job com erro em caso de exceção
      try {
        await supabaseClient
          .from('jobs')
          .update({ 
            status: 'failed', 
            error: `Exceção ao gerar letra: ${generationError}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      } catch (updateErr) {
        console.error('❌ Erro ao atualizar job após falha:', updateErr);
      }
    }
    }
    
    // ✅ CORREÇÃO: Usar letra gerada ou placeholder em caso de erro
    // SEMPRE criar aprovação, mesmo se a geração falhar
    const finalLyrics = generatedLyrics || {
      title: generationError ? 'Erro ao gerar letra' : 'Gerando letra...',
      lyrics: generationError || 'A letra está sendo gerada. Aguarde alguns instantes e atualize a página.',
      style: quiz.style || 'Personalizado',
      language: quiz.language || 'pt',
      error: generationError
    };
    
    console.log('📝 Letra final para aprovação:', {
      has_lyrics: !!generatedLyrics,
      title: finalLyrics?.title,
      has_error: !!generationError
    });

    // 4. Criar ou atualizar registro de aprovação
    // ✅ FLUXO AUTOMÁTICO: Quando cliente aprovou letra na página (approved_lyrics), criar com status 'approved'
    // e chamar generate-audio-internal imediatamente. Caso contrário, criar 'pending' e aguardar aprovação manual.
    const usedApprovedLyricsFromQuiz = !!approvedLyrics;
    const approvalStatus = usedApprovedLyricsFromQuiz ? 'approved' : 'pending';

    // ✅ Preencher voice baseado no vocal_gender do quiz (M/F/S)
    let voice = 'S'; // Sem preferência (padrão)
    if (quiz.vocal_gender === 'm' || quiz.vocal_gender === 'M') {
      voice = 'M'; // Masculino
    } else if (quiz.vocal_gender === 'f' || quiz.vocal_gender === 'F') {
      voice = 'F'; // Feminino
    }
    
    // ✅ CORREÇÃO CRÍTICA: Verificar se aprovação PENDENTE já existe por order_id
    // Priorizar verificação por order_id para evitar duplicações quando trigger + admin-order-actions são chamados simultaneamente
    // Se já existe uma aprovação pendente, atualizar ela em vez de criar nova
    const { data: existingApproval } = await supabaseClient
      .from('lyrics_approvals')
      .select('id, job_id, order_id, status')
      .eq('order_id', order_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Se não encontrou pendente, verificar se existe qualquer aprovação para este pedido
    let existingApprovalAny: any = null;
    if (!existingApproval) {
      const { data: anyApproval } = await supabaseClient
        .from('lyrics_approvals')
        .select('id, job_id, order_id, status')
        .eq('order_id', order_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      existingApprovalAny = anyApproval;
    }
    
    // ✅ CORREÇÃO: Definir expires_at explicitamente (72 horas a partir de agora)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);
    
    // ✅ CORREÇÃO: Criar preview melhorado
    const lyricsPreview = generatedLyrics 
      ? `${(finalLyrics?.title || 'Nova música')} - ${(finalLyrics?.style || 'Personalizado')}`
      : (generationError 
        ? 'Erro na geração — use o botão Regenerar' 
        : 'Gerando letra...');
    
    let approval: any;
    
    // ✅ CORREÇÃO: Usar aprovação pendente se existir, senão usar qualquer aprovação existente
    const approvalToUpdate = existingApproval || existingApprovalAny;
    
    if (approvalToUpdate) {
      // Aprovação já existe, atualizar
      console.log('ℹ️ Aprovação já existe, atualizando...', {
        approval_id: approvalToUpdate.id,
        job_id: approvalToUpdate.job_id,
        order_id: approvalToUpdate.order_id,
        current_status: approvalToUpdate.status,
        is_pending: approvalToUpdate.status === 'pending'
      });
      
      const updateData: Record<string, unknown> = {
        lyrics: finalLyrics,
        status: approvalStatus,
        voice: voice,
        lyrics_preview: lyricsPreview,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
        job_id: job.id
      };
      if (approvalStatus === 'approved') {
        updateData.approved_at = new Date().toISOString();
      }
      const { data: updatedApproval, error: updateError } = await supabaseClient
        .from('lyrics_approvals')
        .update(updateData)
        .eq('id', approvalToUpdate.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Erro ao atualizar aprovação:', updateError);
        // ✅ CORREÇÃO: Não lançar erro, tentar criar nova aprovação
        console.log('⚠️ Tentando criar nova aprovação após erro no update...');
        approval = null; // Forçar criação de nova
      } else {
        approval = updatedApproval;
        console.log('✅ Aprovação atualizada:', approval.id);
      }
    }
    
    // Se não existe ou falhou ao atualizar, criar nova
    if (!approval) {
      console.log('📝 Criando nova aprovação...');
      
      const insertData: Record<string, unknown> = {
        order_id: order_id,
        job_id: job.id,
        quiz_id: quiz.id,
        lyrics: finalLyrics,
        status: approvalStatus,
        voice: voice,
        lyrics_preview: lyricsPreview,
        expires_at: expiresAt.toISOString()
      };
      if (approvalStatus === 'approved') {
        insertData.approved_at = new Date().toISOString();
      }
      const { data: newApproval, error: approvalError } = await supabaseClient
        .from('lyrics_approvals')
        .insert(insertData)
        .select()
        .single();

      if (approvalError) {
        console.error('❌ Erro ao criar aprovação:', approvalError);
        // ✅ CORREÇÃO CRÍTICA: Se houver erro de constraint (duplicata), buscar aprovação existente
        if (approvalError.code === '23505' || approvalError.message?.includes('duplicate') || approvalError.message?.includes('unique')) {
          console.log('⚠️ Aprovação duplicada detectada (constraint violation), buscando existente...');
          
          // Buscar aprovação pendente mais recente para este pedido
          const { data: duplicateApproval } = await supabaseClient
            .from('lyrics_approvals')
            .select('*')
            .eq('order_id', order_id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (duplicateApproval) {
            approval = duplicateApproval;
            console.log('✅ Usando aprovação pendente existente:', approval.id);
            
            // Atualizar a aprovação existente com os novos dados
            const duplicateUpdateData: Record<string, unknown> = {
              lyrics: finalLyrics,
              job_id: job.id,
              voice: voice,
              lyrics_preview: lyricsPreview,
              expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString(),
              status: approvalStatus
            };
            if (approvalStatus === 'approved') {
              duplicateUpdateData.approved_at = new Date().toISOString();
            }
            const { data: updatedDuplicate } = await supabaseClient
              .from('lyrics_approvals')
              .update(duplicateUpdateData)
              .eq('id', duplicateApproval.id)
              .select()
              .single();
            
            if (updatedDuplicate) {
              approval = updatedDuplicate;
              console.log('✅ Aprovação duplicada atualizada com sucesso');
            }
          } else {
            // Se não encontrou pendente, buscar qualquer aprovação
            const { data: anyDuplicateApproval } = await supabaseClient
              .from('lyrics_approvals')
              .select('*')
              .eq('order_id', order_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (anyDuplicateApproval) {
              approval = anyDuplicateApproval;
              console.log('✅ Usando aprovação existente (não pendente):', approval.id);
            } else {
              throw approvalError;
            }
          }
        } else {
          throw approvalError;
        }
      } else {
        approval = newApproval;
        console.log('✅ Aprovação criada:', approval.id);
      }
    }
    
    // ✅ VALIDAÇÃO FINAL: Garantir que approval foi criada
    if (!approval) {
      console.error('❌ CRÍTICO: Aprovação não foi criada nem atualizada!');
      throw new Error('Falha crítica: não foi possível criar ou atualizar aprovação de letras');
    }

    console.log('✅ Job criado e geração iniciada em background:', {
      job_id: job.id,
      approval_id: approval.id,
      used_approved_lyrics_from_quiz: usedApprovedLyricsFromQuiz
    });

    // ✅ FLUXO AUTOMÁTICO: Quando cliente aprovou letra na página, chamar generate-audio-internal imediatamente
    // Chamada assíncrona (fire-and-forget) para não bloquear resposta e evitar timeout
    if (usedApprovedLyricsFromQuiz) {
      console.log('🎵 [Fluxo Automático] Cliente aprovou letra na página - iniciando geração de áudio na Suno...');
      const audioFunctionUrl = `${supabaseUrl}/functions/v1/generate-audio-internal`;
      fetch(audioFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ job_id: job.id }),
      }).then(async (resp) => {
        console.log('📥 [Fluxo Automático] Resposta generate-audio-internal status:', resp.status);
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('❌ [Fluxo Automático] Erro ao iniciar geração de áudio:', resp.status, errText);
        } else {
          console.log('✅ [Fluxo Automático] Geração de áudio iniciada com sucesso para job:', job.id);
        }
      }).catch((err) => {
        console.error('❌ [Fluxo Automático] Erro ao chamar generate-audio-internal:', err);
      });
    }

    // 5. Notificação via UI (Realtime/Polling) – nenhuma Edge extra necessária
    console.log(usedApprovedLyricsFromQuiz
      ? '🔔 Letra aprovada na página - geração de áudio iniciada automaticamente'
      : '🔔 Nova letra pendente registrada – UI será atualizada via Realtime/Polling');

    // 6. Log da ação
    await supabaseClient.from('admin_logs').insert({
      action: 'generate_lyrics_for_approval',
      target_table: 'orders',
      target_id: order_id,
      changes: {
        job_id: job.id,
        approval_id: approval.id,
        used_approved_lyrics_from_quiz: usedApprovedLyricsFromQuiz,
        message: usedApprovedLyricsFromQuiz
          ? 'Letra aprovada na página - geração de áudio iniciada automaticamente'
          : 'Geração de letra iniciada em background'
      }
    });

    // ✅ CORREÇÃO: Retornar imediatamente para evitar timeout
    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        approval_id: approval.id,
        used_approved_lyrics_from_quiz: usedApprovedLyricsFromQuiz,
        message: usedApprovedLyricsFromQuiz
          ? 'Letra aprovada na página. Geração de áudio iniciada automaticamente na Suno.'
          : 'Geração de letra iniciada em background. A letra será atualizada automaticamente quando pronta.'
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );

  } catch (error: any) {
    // ✅ CORREÇÃO: Log detalhado de erros
    console.error('❌ [GenerateLyricsForApproval] Erro crítico:', {
      error: error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      order_id: order_id,
      timestamp: new Date().toISOString()
    });
    
    // ✅ CORREÇÃO: Tentar criar fallback mesmo em caso de erro crítico
    if (supabaseClient && order_id) try {
      // Buscar order e quiz para criar fallback
      const { data: orderData } = await supabaseClient
        .from('orders')
        .select('id, quiz_id, quizzes:quiz_id(*)')
        .eq('id', order_id)
        .single();
      
      if (orderData && orderData.quizzes) {
        const quiz = Array.isArray(orderData.quizzes) ? orderData.quizzes[0] : orderData.quizzes;
        
        // Criar job se não existir
        let jobId = null;
        const { data: existingJob } = await supabaseClient
          .from('jobs')
          .select('id')
          .eq('order_id', order_id)
          .limit(1)
          .maybeSingle();
        
        if (existingJob) {
          jobId = existingJob.id;
        } else {
          const { data: newJob } = await supabaseClient
            .from('jobs')
            .insert({
              order_id: order_id,
              quiz_id: quiz.id,
              status: 'failed',
              error: `Erro crítico: ${error?.message || 'Erro desconhecido'}`
            })
            .select('id')
            .single();
          
          if (newJob) {
            jobId = newJob.id;
          }
        }
        
        // Criar approval fallback
        if (jobId) {
          const placeholderLyrics = {
            title: 'Erro ao gerar letra',
            lyrics: 'Não foi possível gerar a letra automaticamente devido a um erro. Clique em "Regenerar" no painel do admin para tentar novamente.'
          };
          
          // ✅ CORREÇÃO: Definir expires_at explicitamente
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 72);
          
          const { data: fallbackApproval } = await supabaseClient
            .from('lyrics_approvals')
            .insert({
              order_id: order_id,
              job_id: jobId,
              quiz_id: quiz.id,
              lyrics: placeholderLyrics,
              status: 'pending',
              lyrics_preview: 'Erro na geração — use o botão Regenerar',
              expires_at: expiresAt.toISOString() // ✅ CORREÇÃO
            })
            .select('id')
            .single();
          
          if (fallbackApproval) {
            console.log('✅ [GenerateLyricsForApproval] Fallback criado após erro crítico:', fallbackApproval.id);
            return new Response(
              JSON.stringify({
                success: false,
                fallback_created: true,
                job_id: jobId,
                approval_id: fallbackApproval.id,
                error: error?.message || 'Erro desconhecido',
                message: 'Erro ao gerar letra, mas fallback foi criado para permitir regeneração manual'
              }),
              {
                headers: corsHeaders,
                status: 200, // Retornar 200 para não bloquear o fluxo
              }
            );
          }
        }
      }
    } catch (fallbackError) {
      console.error('❌ [GenerateLyricsForApproval] Erro ao criar fallback:', fallbackError);
    }
    
    // Retornar erro detalhado
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro desconhecido',
        details: {
          name: error?.name,
          code: error?.code,
          stack: error?.stack
        }
      }),
      {
        headers: corsHeaders,
        status: 500,
      }
    );
  }
});
