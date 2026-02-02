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
    console.log('=== Separate Audio Stems Started ===');

    // Variáveis de ambiente do Supabase (automaticamente injetadas)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !serviceKey) {
      console.error('❌ Variáveis do Supabase não configuradas:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey
      });
      throw new Error('Configuração do Supabase incompleta. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
    }
    
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    // Verificar autenticação admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    // Verificar se é service role key (chamada interna)
    const isServiceRole = token === serviceKey;
    
    // Se não for service role, verificar se é usuário admin
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        console.error('❌ Erro de autenticação:', authError);
        throw new Error('Token inválido ou expirado');
      }
      
      console.log('✅ Usuário autenticado:', user.id);
      
      // Verificar se usuário é admin usando função has_role
      const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      
      console.log('🔍 Verificação de role:', { isAdmin, roleError, user_id: user.id });
      
      if (roleError) {
        console.error('❌ Erro ao verificar role:', roleError);
        throw new Error(`Erro ao verificar permissões: ${roleError.message}`);
      }
      
      if (!isAdmin) {
        console.error('❌ Usuário não é admin:', user.id);
        throw new Error('Sem permissão de admin');
      }
      
      console.log('✅ Usuário é admin, acesso permitido');
    } else {
      console.log('✅ Service role key detectada, acesso permitido');
    }

    // Parse do body com tratamento de erro
    let song_id: string | undefined;
    try {
      const body = await req.json();
      console.log('📥 Body recebido:', JSON.stringify(body));
      song_id = body.song_id;
      console.log('🎵 song_id extraído:', song_id);
    } catch (parseError: any) {
      console.error('❌ Erro ao fazer parse do body:', parseError);
      console.error('❌ Stack trace do parse:', parseError?.stack);
      throw new Error(`Erro ao processar requisição: body inválido - ${parseError?.message || 'Erro desconhecido'}`);
    }

    if (!song_id) {
      console.error('❌ song_id não fornecido no body');
      throw new Error('song_id é obrigatório');
    }

    console.log('🎵 Processando separação de stems para song:', song_id);

    // 1. Buscar song no banco (incluindo job_id se disponível)
    const { data: song, error: songError } = await supabaseClient
      .from('songs')
      .select('id, order_id, job_id, suno_clip_id, suno_task_id, title, variant_number, vocals_url, instrumental_url, stems_separated_at')
      .eq('id', song_id)
      .single();

    if (songError || !song) {
      console.error('❌ Erro ao buscar song:', songError);
      console.error('❌ Song encontrado:', !!song);
      throw new Error(`Song não encontrado: ${songError?.message || 'Song não existe no banco de dados'}`);
    }
    
    console.log('✅ Song encontrado:', {
      id: song.id,
      title: song.title,
      has_suno_clip_id: !!song.suno_clip_id,
      has_suno_task_id: !!song.suno_task_id,
      has_job_id: !!song.job_id,
      has_order_id: !!song.order_id,
      has_vocals_url: !!song.vocals_url,
      has_instrumental_url: !!song.instrumental_url
    });

    // ✅ REGRA DE OURO #3: Verificar se já existe separação completa
    const { data: existingSeparation } = await supabaseClient
      .from('stem_separations')
      .select('id, status, instrumental_url, vocal_url')
      .eq('song_id', song_id)
      .eq('status', 'completed')
      .single();
    
    if (existingSeparation && existingSeparation.instrumental_url && existingSeparation.vocal_url) {
      console.log('✅ Separação já existe e está completa');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Stems já foram separados anteriormente',
          vocals_url: existingSeparation.vocal_url,
          instrumental_url: existingSeparation.instrumental_url,
          separation_id: existingSeparation.id
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    // Verificar se há separação em processamento
    const { data: processingSeparation } = await supabaseClient
      .from('stem_separations')
      .select('id, status, separation_task_id')
      .eq('song_id', song_id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (processingSeparation) {
      console.log('⏳ Separação já está em processamento:', processingSeparation.separation_task_id);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Separação já está em processamento',
          separation_id: processingSeparation.id,
          separation_task_id: processingSeparation.separation_task_id,
          status: processingSeparation.status
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // ✅ REGRA DE OURO #1: Buscar dados de audio_generations (prioridade) ou songs
    let generation_task_id: string | null = null;
    let audio_id: string | null = null;
    
    // Prioridade 1: Buscar em audio_generations
    const { data: audioGen } = await supabaseClient
      .from('audio_generations')
      .select('generation_task_id, audio_id, audio_url')
      .eq('song_id', song_id)
      .single();
    
    if (audioGen) {
      generation_task_id = audioGen.generation_task_id;
      audio_id = audioGen.audio_id;
      console.log('✅ Dados encontrados em audio_generations:', { generation_task_id, audio_id });
    } else {
      // Fallback: usar dados da song
      generation_task_id = song.suno_task_id;
      audio_id = song.suno_clip_id;
      console.log('⚠️ Dados não encontrados em audio_generations, usando fallback da song:', { generation_task_id, audio_id });
    }
    
    // Se ainda não tem, buscar por job_id ou order_id
    if (!generation_task_id && song.job_id) {
      const { data: job } = await supabaseClient
        .from('jobs')
        .select('suno_task_id')
        .eq('id', song.job_id)
        .single();
      
      if (job?.suno_task_id) {
        generation_task_id = job.suno_task_id;
        console.log('✅ Task ID encontrado via job_id:', generation_task_id);
      }
    }
    
    if (!generation_task_id && song.order_id) {
      const { data: jobs } = await supabaseClient
        .from('jobs')
        .select('suno_task_id')
        .eq('order_id', song.order_id)
        .not('suno_task_id', 'is', null)
        .limit(1);
      
      if (jobs && jobs.length > 0 && jobs[0].suno_task_id) {
        generation_task_id = jobs[0].suno_task_id;
        console.log('✅ Task ID encontrado via order_id:', generation_task_id);
      }
    }

    if (!generation_task_id || generation_task_id.trim() === '') {
      throw new Error(`Não foi possível encontrar generation_task_id válido para a song ${song_id}`);
    }

    if (!audio_id || audio_id.trim() === '') {
      throw new Error(`Não foi possível encontrar audio_id válido para a song ${song_id}. É necessário para usar a API de separação de stems.`);
    }

    console.log('📋 Dados encontrados para separação:', { 
      generation_task_id: generation_task_id,
      audio_id: audio_id,
      song_id: song.id,
      song_title: song.title,
      variant_number: song.variant_number
    });
    
    // ✅ REGRA DE OURO #3 e #7: Criar registro em stem_separations ANTES de chamar API
    const { data: newSeparation, error: separationInsertError } = await supabaseClient
      .from('stem_separations')
      .insert({
        generation_task_id: generation_task_id,
        audio_id: audio_id,
        song_id: song.id,
        type: 'separate_vocal', // ✅ REGRA DE OURO #2: Sempre usar separate_vocal
        status: 'pending'
      })
      .select('id')
      .single();
    
    if (separationInsertError || !newSeparation) {
      console.error('❌ Erro ao criar registro em stem_separations:', separationInsertError);
      throw new Error(`Falha ao criar registro de separação: ${separationInsertError?.message || 'Erro desconhecido'}`);
    }
    
    console.log('✅ Registro criado em stem_separations:', newSeparation.id);

    // 4. Chamar endpoint /v1/vocal-removal/generate da Suno (nova API)
    // Mesma variável usada em generate-audio-internal
    const sunoApiKey = Deno.env.get('SUNO_API_KEY');
    if (!sunoApiKey) {
      console.error('❌ SUNO_API_KEY não configurada');
      throw new Error('SUNO_API_KEY não configurado');
    }
    
    console.log('✅ SUNO_API_KEY encontrada (primeiros 10 chars):', sunoApiKey.substring(0, 10) + '...');

    // Construir callback URL com song_id e separation_id como parâmetros
    const callbackUrl = `${supabaseUrl}/functions/v1/suno-stems-callback?song_id=${song.id}&separation_id=${newSeparation.id}`;

    console.log('🎤 Chamando endpoint /v1/vocal-removal/generate da Suno...');
    console.log('📋 Parâmetros:', {
      taskId: generation_task_id,
      audioId: audio_id,
      type: 'separate_vocal',
      callbackUrl: callbackUrl,
      separation_id: newSeparation.id
    });

    // ✅ REGRA DE OURO #2: Preparar payload sempre com type: "separate_vocal"
    // Documentação: https://docs.sunoapi.org/suno-api/separate-vocals-from-music
    const payload = {
      taskId: generation_task_id,
      audioId: audio_id,
      callBackUrl: callbackUrl,
      type: 'separate_vocal' // ✅ REGRA DE OURO #2: Sempre separate_vocal para voz + playback
    };
    
    console.log('🎤 Chamando endpoint /v1/vocal-removal/generate da Suno...');
    console.log('📋 Payload completo:', JSON.stringify(payload, null, 2));
    console.log('🔗 URL do callback:', callbackUrl);

    // ✅ CORREÇÃO: Usar endpoint correto conforme documentação
    // Documentação indica: /api/v1/vocal-removal/generate (não /vone/)
    const separateResponse = await fetch('https://api.sunoapi.org/api/v1/vocal-removal/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sunoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('📥 Status da resposta:', separateResponse.status);
    console.log('📥 Headers da resposta:', Object.fromEntries(separateResponse.headers.entries()));

    if (!separateResponse.ok) {
      const errorText = await separateResponse.text();
      console.error('❌ Erro HTTP ao chamar /v1/vocal-removal/generate:', separateResponse.status);
      console.error('❌ Corpo da resposta de erro:', errorText);
      
      // Tentar parsear como JSON para mensagem mais clara
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.msg || errorJson.message || errorJson.detail || errorText;
      } catch (e) {
        // Manter como texto
      }
      
      throw new Error(`Suno API error (${separateResponse.status}): ${errorMessage}`);
    }

    const responseText = await separateResponse.text();
    console.log('📥 Resposta completa (texto):', responseText);
    
    let separateData;
    try {
      separateData = JSON.parse(responseText);
      console.log('✅ Resposta parseada:', JSON.stringify(separateData, null, 2));
    } catch (parseError) {
      console.error('❌ Erro ao parsear resposta JSON:', parseError);
      throw new Error(`Resposta inválida da Suno API: ${responseText.substring(0, 200)}`);
    }

    // Validar estrutura da resposta conforme documentação
    if (separateData.code !== undefined && separateData.code !== 200) {
      const errorMsg = separateData.msg || separateData.message || 'Erro desconhecido';
      console.error('❌ Suno API retornou código de erro:', separateData.code, errorMsg);
      throw new Error(`Suno API retornou código ${separateData.code}: ${errorMsg}`);
    }

    // Extrair taskId da separação
    const separationTaskId = separateData.data?.taskId || separateData.taskId || separateData.data?.id;
    
    if (!separationTaskId) {
      console.error('❌ Resposta da Suno não contém taskId da separação');
      console.error('❌ Estrutura da resposta:', JSON.stringify(separateData, null, 2));
      
      // ✅ REGRA DE OURO #7: Atualizar registro com erro
      await supabaseClient
        .from('stem_separations')
        .update({
          status: 'failed',
          error_message: 'Suno API não retornou taskId para a separação',
          updated_at: new Date().toISOString()
        })
        .eq('id', newSeparation.id);
      
      throw new Error('Suno API não retornou taskId para a separação. Resposta: ' + JSON.stringify(separateData));
    }
    
    console.log('✅ Separação iniciada com sucesso!');
    console.log('✅ Task ID da separação:', separationTaskId);

    // ✅ REGRA DE OURO #3 e #7: Atualizar registro em stem_separations com separation_task_id e status
    const { error: updateSeparationError } = await supabaseClient
      .from('stem_separations')
      .update({
        separation_task_id: separationTaskId,
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', newSeparation.id);
    
    if (updateSeparationError) {
      console.error('❌ Erro ao atualizar stem_separations:', updateSeparationError);
      // Não bloquear, apenas logar
    } else {
      console.log('✅ Registro atualizado em stem_separations com separation_task_id:', separationTaskId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Separação de stems iniciada com sucesso. Os resultados serão processados via callback.',
        separation_task_id: separationTaskId,
        separation_id: newSeparation.id,
        song_id: song_id,
        generation_task_id: generation_task_id,
        audio_id: audio_id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro em separate-audio-stems:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    
    // Retornar mensagem de erro mais detalhada
    const errorMessage = error.message || 'Erro desconhecido';
    const errorDetails = {
      message: errorMessage,
      name: error.name,
      stack: error.stack,
      // Incluir informações adicionais se disponíveis
      ...(error.cause && { cause: error.cause }),
    };
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
