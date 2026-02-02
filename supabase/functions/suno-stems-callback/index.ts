import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { downloadAndValidateAudio } from "../_shared/audio-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let supabaseClient: any = null;
  let separation: any = null;

  try {
    console.log('=== Suno Stems Callback Started ===');
    
    // Extrair parâmetros da URL
    const url = new URL(req.url);
    const songIdFromUrl = url.searchParams.get('song_id');
    const separationIdFromUrl = url.searchParams.get('separation_id');
    
    const body = await req.json();
    console.log('📥 Callback recebido:', JSON.stringify(body, null, 2));
    console.log('🔍 Parâmetros da URL:', { songIdFromUrl, separationIdFromUrl });

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
    
    supabaseClient = createClient(supabaseUrl, serviceKey);

    // A estrutura do callback da Suno para separação de stems
    // Baseado na documentação: https://docs.sunoapi.org/suno-api/separate-vocals-from-music
    // Estrutura esperada:
    // {
    //   "code": 200,
    //   "msg": "vocal Removal generated successfully.",
    //   "data": {
    //     "taskId": "...",
    //     "response": {
    //       "originUrl": "...",
    //       "instrumentalUrl": "...",  // playback
    //       "vocalUrl": "..."          // voz isolada
    //     }
    //   }
    // }
    const taskId = body.taskId || body.data?.taskId;
    const status = body.status || body.data?.status;
    const code = body.code;
    const audioId = body.audioId || body.data?.audioId;

    console.log('📊 Dados do callback:', { taskId, status, code, audioId, songIdFromUrl, separationIdFromUrl });
    console.log('📊 Estrutura completa do body:', JSON.stringify(body, null, 2));

    // ✅ REGRA DE OURO #7: Buscar registro em stem_separations
    separation = null;
    
    if (separationIdFromUrl) {
      const { data: sepById } = await supabaseClient
        .from('stem_separations')
        .select('*')
        .eq('id', separationIdFromUrl)
        .single();
      
      if (sepById) {
        separation = sepById;
        console.log('✅ Separação encontrada por ID:', separation.id);
      }
    }
    
    if (!separation && taskId) {
      const { data: sepByTaskId } = await supabaseClient
        .from('stem_separations')
        .select('*')
        .eq('separation_task_id', taskId)
        .single();
      
      if (sepByTaskId) {
        separation = sepByTaskId;
        console.log('✅ Separação encontrada por separation_task_id:', taskId);
      }
    }
    
    if (!separation && audioId) {
      const { data: sepByAudioId } = await supabaseClient
        .from('stem_separations')
        .select('*')
        .eq('audio_id', audioId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (sepByAudioId) {
        separation = sepByAudioId;
        console.log('✅ Separação encontrada por audio_id:', audioId);
      }
    }
    
    if (!separation) {
      console.error('❌ Separação não encontrada em stem_separations');
      console.error('Dados disponíveis:', { separationIdFromUrl, taskId, audioId, songIdFromUrl });
      return new Response(
        JSON.stringify({ received: true, error: 'Separação não encontrada' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // ✅ REGRA DE OURO #5: Validar código de resposta
    if (code !== undefined && code !== 200) {
      const errorMsg = body.msg || body.message || 'Erro desconhecido';
      console.error('❌ Callback retornou código de erro:', code, errorMsg);
      
      // Atualizar registro em stem_separations
      await supabaseClient
        .from('stem_separations')
        .update({
          status: 'failed',
          error_message: `Suno callback error: ${code} - ${errorMsg}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', separation.id);
      
      return new Response(
        JSON.stringify({ received: true, status: 'error', error: errorMsg }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // ✅ REGRA DE OURO #5: Validar status antes de processar
    if (status && status !== 'complete' && status !== 'completed' && status !== 'success') {
      console.log('⏳ Separação ainda em processamento:', { code, status });
      
      // Atualizar status para processing
      await supabaseClient
        .from('stem_separations')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', separation.id);
      
      return new Response(
        JSON.stringify({ received: true, status: 'processing' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Extrair URLs dos stems conforme documentação oficial
    // Estrutura pode ser:
    // 1. body.data.response.* (estrutura mais comum)
    // 2. body.data.vocal_removal_info.* (estrutura alternativa mencionada na doc)
    const response = body.data?.response || body.data?.vocal_removal_info || body.response || {};
    
    // Tentar múltiplas estruturas possíveis
    const vocalsUrl = response.vocalUrl || response.vocals_url || response.vocals || 
                      body.data?.vocalUrl || body.data?.vocals_url || body.data?.vocals ||
                      body.vocalUrl || body.vocals_url || body.vocals;
    const instrumentalUrl = response.instrumentalUrl || response.instrumental_url || response.instrumental ||
                            body.data?.instrumentalUrl || body.data?.instrumental_url || body.data?.instrumental ||
                            body.instrumentalUrl || body.instrumental_url || body.instrumental;
    const originUrl = response.originUrl || response.origin_url || body.data?.originUrl || body.originUrl;

    console.log('🎵 Stems encontrados:', {
      hasVocals: !!vocalsUrl,
      hasInstrumental: !!instrumentalUrl,
      hasOrigin: !!originUrl,
      vocalsUrl: vocalsUrl?.substring(0, 100),
      instrumentalUrl: instrumentalUrl?.substring(0, 100),
      originUrl: originUrl?.substring(0, 100)
    });

    // ✅ REGRA DE OURO #5: Validar que URLs não estão vazios
    if (!vocalsUrl || !instrumentalUrl) {
      console.error('❌ Callback não contém vocalUrl ou instrumentalUrl');
      console.error('❌ Estrutura do body.data.response:', JSON.stringify(response, null, 2));
      console.error('❌ Body completo:', JSON.stringify(body, null, 2));
      
      // Atualizar registro em stem_separations com erro
      await supabaseClient
        .from('stem_separations')
        .update({
          status: 'failed',
          error_message: 'URLs de stems não encontradas no callback da Suno',
          updated_at: new Date().toISOString()
        })
        .eq('id', separation.id);
      
      return new Response(
        JSON.stringify({ received: true, error: 'URLs de stems não encontradas no callback' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
    
    // Validar que as URLs são válidas
    try {
      new URL(vocalsUrl);
      new URL(instrumentalUrl);
    } catch (urlError) {
      console.error('❌ URLs de stems inválidas:', { vocalsUrl, instrumentalUrl });
      
      // Atualizar registro com erro
      await supabaseClient
        .from('stem_separations')
        .update({
          status: 'failed',
          error_message: `URLs de stems inválidas: ${urlError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', separation.id);
      
      throw new Error(`URLs de stems inválidas: ${urlError.message}`);
    }

    // Usar song_id do registro de separação (mais confiável)
    const songId = separation.song_id || songIdFromUrl;
    
    if (!songId) {
      console.error('❌ Song ID não encontrado no registro de separação');
      await supabaseClient
        .from('stem_separations')
        .update({
          status: 'failed',
          error_message: 'Song ID não encontrado no registro de separação',
          updated_at: new Date().toISOString()
        })
        .eq('id', separation.id);
      
      return new Response(
        JSON.stringify({ received: true, error: 'Song ID não encontrado' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log('✅ Song ID identificado:', songId);

    // Baixar e validar stems usando função compartilhada
    console.log('⬇️ Baixando e validando stems...');
    
    let validatedVocals, validatedInstrumental;
    try {
      console.log(`⬇️ Baixando vocals de: ${vocalsUrl.substring(0, 100)}...`);
      validatedVocals = await downloadAndValidateAudio(vocalsUrl);
      console.log(`✅ Vocals validado: ${validatedVocals.size} bytes, ${validatedVocals.contentType}`);
    } catch (vocalsError: any) {
      console.error('❌ Erro ao baixar/validar vocals:', vocalsError);
      throw new Error(`Falha ao processar vocals: ${vocalsError.message}`);
    }
    
    try {
      console.log(`⬇️ Baixando instrumental de: ${instrumentalUrl.substring(0, 100)}...`);
      validatedInstrumental = await downloadAndValidateAudio(instrumentalUrl);
      console.log(`✅ Instrumental validado: ${validatedInstrumental.size} bytes, ${validatedInstrumental.contentType}`);
    } catch (instrumentalError: any) {
      console.error('❌ Erro ao baixar/validar instrumental:', instrumentalError);
      throw new Error(`Falha ao processar instrumental: ${instrumentalError.message}`);
    }

    console.log('✅ Stems baixados e validados:', {
      vocals_size: validatedVocals.size,
      instrumental_size: validatedInstrumental.size
    });

    // Garantir que o bucket existe
    try {
      const { data, error } = await supabaseClient.storage.createBucket('suno-tracks', { public: true });
      if (error) {
        // Erro 400 geralmente significa que o bucket já existe
        if (error.statusCode === '400' || error.message?.includes('already exists')) {
          // Bucket já existe, continuar normalmente
        } else {
          console.warn('⚠️ [CALLBACK] Erro ao criar bucket:', error.message);
        }
      }
    } catch (error: any) {
      // Ignorar erros de bucket já existente
      if (error?.statusCode === 400 || error?.message?.includes('already exists')) {
        // Bucket já existe, continuar normalmente
      } else {
        console.warn('⚠️ [CALLBACK] Erro ao verificar bucket:', error?.message || error);
      }
    }

    // Fazer upload para Storage
    const vocalsPath = `stems/${songId}/vocals.mp3`;
    const instrumentalPath = `stems/${songId}/instrumental.mp3`;

    console.log('⬆️ Fazendo upload dos stems para Storage...');
    
    // Upload com retry logic
    let vocalsUpload, instrumentalUpload;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        [vocalsUpload, instrumentalUpload] = await Promise.all([
          supabaseClient.storage
            .from('suno-tracks')
            .upload(vocalsPath, validatedVocals.blob, { 
              contentType: validatedVocals.contentType || 'audio/mpeg', 
              upsert: true 
            }),
          supabaseClient.storage
            .from('suno-tracks')
            .upload(instrumentalPath, validatedInstrumental.blob, { 
              contentType: validatedInstrumental.contentType || 'audio/mpeg', 
              upsert: true 
            })
        ]);

        if (vocalsUpload.error || instrumentalUpload.error) {
          if (attempt < maxRetries) {
            console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou, tentando novamente...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          throw new Error(`Erro ao fazer upload: ${vocalsUpload.error?.message || instrumentalUpload.error?.message}`);
        }
        break; // Sucesso
      } catch (uploadError: any) {
        if (attempt === maxRetries) {
          throw uploadError;
        }
        console.warn(`⚠️ Erro no upload (tentativa ${attempt}/${maxRetries}):`, uploadError.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    console.log('✅ Upload concluído com sucesso');

    // Gerar URLs públicas (bucket deve ser público) ou signed URLs
    // Tentar URL pública primeiro, depois signed URL
    let finalVocalsUrl: string;
    let finalInstrumentalUrl: string;
    
    try {
      const vocalsPublicUrl = supabaseClient.storage.from('suno-tracks').getPublicUrl(vocalsPath);
      const instrumentalPublicUrl = supabaseClient.storage.from('suno-tracks').getPublicUrl(instrumentalPath);
      
      // Verificar se as URLs públicas funcionam (se o bucket for público)
      finalVocalsUrl = vocalsPublicUrl.data.publicUrl;
      finalInstrumentalUrl = instrumentalPublicUrl.data.publicUrl;
      
      console.log('✅ Usando URLs públicas do Storage');
    } catch (publicUrlError) {
      // Se não funcionar, usar signed URLs (48h)
      console.log('⚠️ URLs públicas não disponíveis, gerando signed URLs...');
      const expiresIn = 60 * 60 * 48;
      const [vocalsSignedUrl, instrumentalSignedUrl] = await Promise.all([
        supabaseClient.storage.from('suno-tracks').createSignedUrl(vocalsPath, expiresIn),
        supabaseClient.storage.from('suno-tracks').createSignedUrl(instrumentalPath, expiresIn)
      ]);

      if (vocalsSignedUrl.error || !vocalsSignedUrl.data?.signedUrl || 
          instrumentalSignedUrl.error || !instrumentalSignedUrl.data?.signedUrl) {
        throw new Error(`Erro ao gerar signed URLs: ${vocalsSignedUrl.error?.message || instrumentalSignedUrl.error?.message}`);
      }
      
      finalVocalsUrl = vocalsSignedUrl.data.signedUrl;
      finalInstrumentalUrl = instrumentalSignedUrl.data.signedUrl;
      console.log('✅ Signed URLs geradas com sucesso');
    }

    // Atualizar song no banco
    const { error: updateSongError } = await supabaseClient
      .from('songs')
      .update({
        vocals_url: finalVocalsUrl,
        instrumental_url: finalInstrumentalUrl,
        stems_separated_at: new Date().toISOString(),
        status: 'ready', // Manter status 'ready' pois stems_separated não existe no enum
        updated_at: new Date().toISOString()
      })
      .eq('id', songId);

    if (updateSongError) {
      console.error('❌ Erro ao atualizar song com URLs dos stems:', updateSongError);
      // Não bloquear, apenas logar
    } else {
      console.log('✅ Song atualizada com URLs dos stems');
    }

    console.log('✅ Stems salvos com sucesso para song:', songId);
    console.log('✅ URLs finais:', {
      vocals_url: finalVocalsUrl.substring(0, 100) + '...',
      instrumental_url: finalInstrumentalUrl.substring(0, 100) + '...'
    });

    return new Response(
      JSON.stringify({ 
        received: true, 
        success: true, 
        song_id: songId,
        separation_id: separation.id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro em suno-stems-callback:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    
    // ✅ REGRA DE OURO #7: Tentar atualizar registro em stem_separations com erro
    if (separation && separation.id) {
      try {
        await supabaseClient
          .from('stem_separations')
          .update({
            status: 'failed',
            error_message: `Erro no callback: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', separation.id);
        console.log('✅ Registro atualizado em stem_separations com status de erro');
      } catch (updateError) {
        console.error('❌ Erro ao atualizar stem_separations com status de erro:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        received: true,
        error: error.message || 'Erro desconhecido',
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Retornar 200 mesmo com erro para não causar retry infinito
      }
    );
  }
});
