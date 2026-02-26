import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { getSecureHeaders } from "../_shared/security-headers.ts";

/**
 * Validações de áudio
 */
const MIN_AUDIO_SIZE = 10 * 1024; // 10KB - tamanho mínimo para MP3 válido
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB - limite do bucket
const VALID_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mpeg3'];
const CONTENT_LENGTH_TOLERANCE = 0.05; // 5% de tolerância
const FETCH_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 3;

/**
 * Interface para resultado do download validado
 */
interface ValidatedAudioResult {
  blob: Blob;
  contentType: string;
  size: number;
}

/**
 * Faz download de áudio com validações robustas e retry logic
 * @param audioUrl URL do áudio para download
 * @param attempt Número da tentativa atual (para retry)
 * @returns Blob validado do áudio
 * @throws Error com mensagem descritiva se validação falhar
 */
async function downloadAndValidateAudio(
  audioUrl: string,
  attempt: number = 1
): Promise<ValidatedAudioResult> {
  const logPrefix = `[DOWNLOAD-AUDIO] Tentativa ${attempt}/${MAX_RETRIES}`;
  
  console.log(`${logPrefix} Iniciando download de: ${audioUrl}`);
  
  try {
    // Criar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    
    // Fazer fetch com timeout
    const response = await fetch(audioUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Clamorenmusica/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    // Validar status HTTP
    if (!response.ok || response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Obter headers importantes
    const contentType = response.headers.get('content-type') || '';
    const contentLengthHeader = response.headers.get('content-length');
    const expectedSize = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;
    
    console.log(`${logPrefix} Headers recebidos:`, {
      contentType,
      contentLength: expectedSize,
      status: response.status
    });
    
    // Converter para blob
    const blob = await response.blob();
    const actualSize = blob.size;
    const blobType = blob.type || contentType;
    
    console.log(`${logPrefix} Blob criado:`, {
      size: actualSize,
      type: blobType,
      expectedSize
    });
    
    // Validação 1: Tamanho mínimo
    if (actualSize < MIN_AUDIO_SIZE) {
      throw new Error(
        `Arquivo muito pequeno: ${actualSize} bytes (mínimo: ${MIN_AUDIO_SIZE} bytes). ` +
        `Provavelmente arquivo corrompido ou download incompleto.`
      );
    }
    
    // Validação 2: Tamanho máximo
    if (actualSize > MAX_AUDIO_SIZE) {
      throw new Error(
        `Arquivo muito grande: ${actualSize} bytes (máximo: ${MAX_AUDIO_SIZE} bytes)`
      );
    }
    
    // Validação 3: Tipo MIME
    const isValidMimeType = VALID_AUDIO_MIME_TYPES.some(
      validType => blobType.toLowerCase().includes(validType.toLowerCase())
    );
    
    if (!isValidMimeType) {
      console.warn(`${logPrefix} ⚠️ Tipo MIME não reconhecido: ${blobType} (aceitando mesmo assim)`);
      // Não rejeitar por tipo MIME, apenas logar warning
      // Alguns servidores podem retornar tipos incorretos mas o arquivo estar OK
    }
    
    // Validação 4: Integridade (Content-Length vs blob.size)
    if (expectedSize !== null) {
      const sizeDifference = Math.abs(actualSize - expectedSize);
      const sizeDifferencePercent = (sizeDifference / expectedSize) * 100;
      
      if (sizeDifferencePercent > CONTENT_LENGTH_TOLERANCE * 100) {
        throw new Error(
          `Download incompleto: tamanho esperado ${expectedSize} bytes, ` +
          `recebido ${actualSize} bytes (diferença: ${sizeDifferencePercent.toFixed(2)}%). ` +
          `Provavelmente conexão interrompida.`
        );
      }
      
      console.log(`${logPrefix} ✅ Integridade validada: diferença de ${sizeDifferencePercent.toFixed(2)}%`);
    } else {
      console.warn(`${logPrefix} ⚠️ Content-Length não disponível, pulando validação de integridade`);
    }
    
    // Validação 5: Verificar se blob não está vazio (redundante mas importante)
    if (actualSize === 0) {
      throw new Error('Arquivo vazio recebido');
    }
    
    console.log(`${logPrefix} ✅ Todas as validações passaram! Tamanho: ${actualSize} bytes, Tipo: ${blobType}`);
    
    return {
      blob,
      contentType: blobType || 'audio/mpeg',
      size: actualSize
    };
    
  } catch (error: any) {
    // Se for timeout ou erro de rede, tentar novamente se ainda houver tentativas
    const isRetryableError = 
      error.name === 'AbortError' || // Timeout
      error.message?.includes('fetch failed') ||
      error.message?.includes('network') ||
      error.message?.includes('HTTP 5') || // Erros 5xx
      error.message?.includes('HTTP 429'); // Rate limit
    
    if (isRetryableError && attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt - 1) * 1000; // Delay exponencial: 1s, 2s, 4s
      console.warn(`${logPrefix} ⚠️ Erro recuperável: ${error.message}. Tentando novamente em ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return downloadAndValidateAudio(audioUrl, attempt + 1);
    }
    
    // Se não for recuperável ou esgotaram tentativas, lançar erro
    const errorMessage = attempt >= MAX_RETRIES
      ? `Falha após ${MAX_RETRIES} tentativas: ${error.message}`
      : error.message;
    
    console.error(`${logPrefix} ❌ Erro não recuperável: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    console.log("📥 [CALLBACK] Recebendo callback da Suno...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ✅ ATUALIZAÇÃO: Processar callback conforme nova API Suno
    // A API Suno envia POST com diferentes formatos possíveis
    const payload = await req.json();
    console.log('📥 [CALLBACK] ============ PAYLOAD COMPLETO DA SUNO ============');
    console.log(JSON.stringify(payload, null, 2));
    console.log('📥 [CALLBACK] ====================================================');
    
    // ✅ MELHORIA: Suportar múltiplos formatos de callback da Suno API
    // Formato 1: { data: { task_id, callbackType, data: [...] } }
    // Formato 2: { taskId, status, musics: [...] }
    // Formato 3: { task_id, status, data: [...] }
    // Formato 4: { id, status, clips: [...] }
    
    // Extrair task_id de múltiplas possíveis localizações
    const task_id = payload?.data?.task_id || 
                    payload?.data?.taskId || 
                    payload?.taskId || 
                    payload?.task_id || 
                    payload?.id ||
                    payload?.data?.id ||
                    "";
    
    // Extrair tipo de callback (se disponível)
    const callbackType = payload?.data?.callbackType || 
                         payload?.callbackType || 
                         payload?.status ||
                         "";
    
    // ✅ MELHORIA: Extrair lista de músicas de múltiplas estruturas possíveis
    // A nova API pode enviar em diferentes formatos:
    // - payload.data.data (array de músicas)
    // - payload.data.musics (array de músicas)
    // - payload.musics (array direto)
    // - payload.data.clips (array de clips)
    // - payload.data (objeto único)
    const rawList = payload?.data?.data || 
                    payload?.data?.musics || 
                    payload?.data?.Musics ||
                    payload?.musics ||
                    payload?.Musics ||
                    payload?.data?.clips || 
                    payload?.data?.music || 
                    payload?.data?.songs || 
                    payload?.data?.audios ||
                    (payload?.data && !payload.data.task_id && !payload.data.taskId ? [payload.data] : []) ||
                    [];
    
    const musicData = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);

    console.log("📋 [CALLBACK] Resumo normalizado:", { 
      task_id, 
      callbackType, 
      items: musicData.length,
      payloadKeys: Object.keys(payload),
      hasData: !!payload.data,
      dataKeys: payload.data ? Object.keys(payload.data) : []
    });
    
    // ✅ VALIDAÇÃO CRÍTICA: Alertar se não vierem 2 músicas
    if (musicData.length !== 2) {
      console.warn(`⚠️⚠️⚠️ [CALLBACK] ATENÇÃO: Recebidas ${musicData.length} músicas (esperado: 2)!`);
      console.warn(`📋 [CALLBACK] Payload completo:`, JSON.stringify(payload, null, 2));
      console.warn(`🎵 [CALLBACK] MusicData:`, JSON.stringify(musicData, null, 2));
    }

    if (!task_id) {
      console.error("❌ [CALLBACK] task_id ausente no payload");
      console.error("📋 Payload recebido:", JSON.stringify(payload, null, 2));
      return new Response(JSON.stringify({ error: "task_id ausente" }), { status: 400, headers: { ...secureHeaders, "Content-Type": "application/json" } });
    }

    // ✅ ATUALIZAÇÃO: Processar callbacks "complete" ou com status "complete"/"success"
    // A nova API pode enviar diferentes status: "complete", "success", "completed"
    const isComplete = callbackType === "complete" || 
                       callbackType === "success" || 
                       callbackType === "completed" ||
                       payload?.status === "complete" ||
                       payload?.status === "success" ||
                       payload?.status === "completed" ||
                       (payload?.data?.status === "complete") ||
                       (payload?.data?.status === "success") ||
                       (payload?.data?.status === "completed");
    
    // Se não está completo ou não tem dados de música, ignorar (mas retornar 200)
    if (!isComplete || musicData.length === 0) {
      console.log(`ℹ️ [CALLBACK] Ignorado (tipo=${callbackType}, status=${payload?.status}, itens=${musicData.length})`);
      // ✅ IMPORTANTE: Retornar 200 mesmo quando ignorado (API Suno espera resposta rápida)
      return new Response(JSON.stringify({ success: true, ignored: true, reason: `Status: ${callbackType || payload?.status}, Items: ${musicData.length}` }), { 
        status: 200, 
        headers: { ...secureHeaders, "Content-Type": "application/json" } 
      });
    }

      // Buscar o job pelo task_id
      const { data: jobs, error: jobError } = await supabase
        .from("jobs")
        .select("id, order_id, quiz_id, gpt_lyrics")
        .eq("suno_task_id", task_id)
        .single();

      if (jobError || !jobs) {
      console.error("❌ [CALLBACK] Job não encontrado para task_id:", task_id, jobError);
      return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: { ...secureHeaders, "Content-Type": "application/json" } });
      }

    console.log("✅ [CALLBACK] Job encontrado:", { jobId: jobs.id, orderId: jobs.order_id, taskId: task_id });

    // Garantir bucket/pasta
    try {
      const { data, error } = await supabase.storage.createBucket('suno-tracks', { public: true });
      if (error) {
        // Erro 400 geralmente significa que o bucket já existe
        if (error.statusCode === '400' || error.message?.includes('already exists')) {
          // Bucket já existe, continuar normalmente
        } else {
          console.warn('⚠️ [CALLBACK] Erro ao criar bucket:', error.message);
        }
      } else {
        console.log('🪣 [CALLBACK] Bucket suno-tracks criado');
      }
    } catch (error: any) {
      // Ignorar erros de bucket já existente
      if (error?.statusCode === 400 || error?.message?.includes('already exists')) {
        // Bucket já existe, continuar normalmente
      } else {
        console.warn('⚠️ [CALLBACK] Erro ao verificar bucket:', error?.message || error);
      }
    }

    let nextVariant = 1;
    let songsCreated = 0;

      console.log(`🔄 [CALLBACK] Iniciando loop para processar ${musicData.length} música(s)...`);
      
      for (let i = 0; i < musicData.length; i++) {
      console.log(`\n🎵 [CALLBACK] ========== Processando música ${i + 1}/${musicData.length} (Variante ${nextVariant}) ==========`);
      
      const music = musicData[i] || {};
      // Normalizar possíveis campos
      const audioSrc = music.audio_url || music.audioUrl || music.audio || music.mp3 || (music.clips?.[0]?.audio_url) || (music.clips?.[0]?.audioUrl) || "";
      const imageSrc = music.image_url || music.imageUrl || music.cover_url || music.coverUrl || (music.clips?.[0]?.image_url) || (music.clips?.[0]?.imageUrl) || "";
      const duration = music.duration || music.clip_duration || music.length || 0;
      
      // ✅ CORREÇÃO: Extrair clipId (audioId) com prioridade e validação
      // O audioId é essencial para separação de stems, então deve ser sempre salvo
      const clipId = music.id || music.musicId || music.clip_id || music.clipId || music.audioId || null;
      
      // Se não encontrou clipId, tentar gerar um baseado no task_id
      // Mas logar um aviso pois isso pode causar problemas na separação de stems
      const finalClipId = clipId || `${task_id}-${nextVariant}`;
      
      if (!clipId) {
        console.warn(`⚠️ [CALLBACK] ATENÇÃO: clipId não encontrado na música ${i + 1}, usando fallback: ${finalClipId}`);
        console.warn(`⚠️ [CALLBACK] Campos disponíveis na música:`, Object.keys(music));
        console.warn(`⚠️ [CALLBACK] Isso pode impedir a separação de stems no futuro!`);
      } else {
        console.log(`✅ [CALLBACK] clipId (audioId) encontrado: ${finalClipId}`);
      }
      
      const title = music.title || jobs.gpt_lyrics?.title || `Música ${nextVariant}`;

      console.log(`🎵 [CALLBACK] Variante ${nextVariant}:`, { hasAudio: !!audioSrc, hasImage: !!imageSrc, clipId: finalClipId, title });
      console.log(`📊 [CALLBACK] Dados raw da música:`, JSON.stringify(music, null, 2));

      // Upload áudio com validações robustas
      let audioUrl = "";
      if (audioSrc) {
        try {
          console.log(`⬇️ [CALLBACK] Baixando áudio variante ${nextVariant} de: ${audioSrc}`);
          
          // Usar função validada com retry logic
          const validatedAudio = await downloadAndValidateAudio(audioSrc);
          
          console.log(`✅ [CALLBACK] Áudio validado com sucesso:`, {
            size: validatedAudio.size,
            contentType: validatedAudio.contentType,
            variant: nextVariant
          });
          
          const audioPath = `media/${task_id}-${nextVariant}.mp3`;
          const { error } = await supabase.storage
            .from('suno-tracks')
            .upload(audioPath, validatedAudio.blob, { 
              contentType: validatedAudio.contentType || 'audio/mpeg', 
              upsert: true 
            });
          
          if (error) {
            throw new Error(`Erro ao fazer upload: ${error.message}`);
          }
          
          audioUrl = supabase.storage.from('suno-tracks').getPublicUrl(audioPath).data.publicUrl;
          console.log(`✅ [CALLBACK] Áudio salvo com sucesso: ${audioUrl} (${validatedAudio.size} bytes)`);
        } catch (e: any) {
          console.error(`❌ [CALLBACK] Falha ao processar áudio variante ${nextVariant}:`, {
            error: e.message || e,
            audioSrc,
            variant: nextVariant
          });
          // Não definir audioUrl, será tratado na validação abaixo
        }
      }

      // Upload capa
      let coverUrl = "";
      if (imageSrc) {
          try {
          const r = await fetch(imageSrc);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const blob = await r.blob();
          const imagePath = `media/${task_id}-${nextVariant}.jpeg`;
          const { error } = await supabase.storage.from('suno-tracks').upload(imagePath, blob, { contentType: 'image/jpeg', upsert: true });
          if (error) throw error;
          coverUrl = supabase.storage.from('suno-tracks').getPublicUrl(imagePath).data.publicUrl;
          console.log(`✅ [CALLBACK] Capa salva: ${coverUrl}`);
        } catch (e) {
          console.error("❌ [CALLBACK] Falha upload capa:", e);
          }
        }

        const lyrics = jobs.gpt_lyrics || {};
        
      // ✅ CORREÇÃO CRÍTICA: Garantir que audio_url seja sempre preenchido
      if (!audioUrl || audioUrl.trim() === '') {
        console.error(`❌❌❌ [CALLBACK] CRÍTICO: Áudio não disponível para variante ${nextVariant}!`);
        console.error(`❌ [CALLBACK] audioSrc original:`, audioSrc);
        console.error(`❌ [CALLBACK] Música ${i + 1}/${musicData.length} será PULADA - pedido ficará incompleto!`);
        console.error(`⚠️ [CALLBACK] Isso causará pedido com apenas 1 música em vez de 2!`);
        nextVariant++;
        continue; // Pular esta variante se não tiver áudio
      }
      
      console.log(`✅ [CALLBACK] Áudio validado OK para variante ${nextVariant}`);
        
      // ✅ REGRA DE OURO #1: Criar song e salvar dados completos
      const { data: createdSong, error: createSongError } = await supabase
        .from('songs')
        .insert({
          order_id: jobs.order_id,
          quiz_id: jobs.quiz_id,
          audio_url: audioUrl, // ✅ Sempre preenchido (não null)
          cover_url: coverUrl || null,
          duration_sec: Math.round(duration || 0),
          title: title,
          lyrics: lyrics?.lyrics || null,
          language: lyrics?.language || 'pt',
          style: lyrics?.style || 'pop',
          variant_number: nextVariant,
          suno_clip_id: finalClipId,
          suno_task_id: task_id,
          status: 'ready',
          release_at: new Date().toISOString(),
          released_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createSongError || !createdSong) {
        console.error(`❌ [CALLBACK] Erro ao criar song ${nextVariant}:`, createSongError);
      } else {
        songsCreated++;
        console.log(`✅ [CALLBACK] Song ${nextVariant} criada com sucesso! (Total criadas: ${songsCreated})`);
        
        // ✅ REGRA DE OURO #1 e #7: Criar registro em audio_generations para rastreamento completo
        const audioSrcOriginal = music.audio_url || music.audioUrl || music.audio || music.mp3 || (music.clips?.[0]?.audio_url) || (music.clips?.[0]?.audioUrl) || "";
        
        const { error: audioGenError } = await supabase
          .from('audio_generations')
          .insert({
            generation_task_id: task_id,
            audio_id: finalClipId,
            audio_url: audioSrcOriginal, // URL original da Suno (antes de salvar no nosso storage)
            song_id: createdSong.id,
            job_id: jobs.id,
            order_id: jobs.order_id,
            status: 'completed',
            completed_at: new Date().toISOString()
          });
        
        if (audioGenError) {
          console.error(`❌ [CALLBACK] Erro ao criar registro em audio_generations:`, audioGenError);
          // Não bloquear o fluxo, apenas logar o erro
        } else {
          console.log(`✅ [CALLBACK] Registro criado em audio_generations para song ${createdSong.id} (taskId: ${task_id}, audioId: ${finalClipId})`);
        }
      }

      nextVariant++;
      }
      
      // ✅ VALIDAÇÃO FINAL: Alertar se não criou 2 músicas
      console.log(`\n📊 [CALLBACK] ========== RESUMO FINAL DO PROCESSAMENTO ==========`);
      console.log(`📊 [CALLBACK] Músicas recebidas no payload: ${musicData.length}`);
      console.log(`📊 [CALLBACK] Músicas criadas no banco: ${songsCreated}`);
      console.log(`📊 [CALLBACK] Variante final: ${nextVariant - 1}`);
      
      if (songsCreated !== 2) {
        console.warn(`⚠️⚠️⚠️ [CALLBACK] ATENÇÃO CRÍTICA: Criadas ${songsCreated} músicas (esperado: 2)!`);
        console.warn(`⚠️ [CALLBACK] Este pedido ficará INCOMPLETO em /admin/releases!`);
        console.warn(`⚠️ [CALLBACK] Order ID: ${jobs.order_id}`);
      } else {
        console.log(`✅ [CALLBACK] Pedido completo com 2 variantes!`);
      }
      console.log(`📊 [CALLBACK] ================================================\n`);

    // Atualizar job para completed e salvar suno_audio_url
    // Extrair audio_url do primeiro áudio gerado
    let jobAudioUrl = null;
    if (musicData && musicData.length > 0) {
      const firstMusic = musicData[0];
      jobAudioUrl = firstMusic.audio_url || firstMusic.audioUrl || firstMusic.url;
    }
    
    const jobUpdateData: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // ✅ SEMPRE salvar suno_audio_url se disponível
    if (jobAudioUrl) {
      jobUpdateData.suno_audio_url = jobAudioUrl;
      console.log(`✅ [CALLBACK] Salvando suno_audio_url no job: ${jobAudioUrl.substring(0, 50)}...`);
    } else {
      console.warn(`⚠️ [CALLBACK] Job completado mas nenhum audio_url encontrado`);
    }
    
    const { error: updateJobError } = await supabase
      .from('jobs')
      .update(jobUpdateData)
      .eq('id', jobs.id);
      if (updateJobError) {
        console.error("❌ [CALLBACK] Erro ao atualizar job:", updateJobError);
      }

    console.log(`🎉 [CALLBACK] Processamento completo! ${musicData.length} variante(s).`);

    // ✅ ATUALIZAÇÃO: Notificar cliente quando música estiver pronta
    // Buscar primeira song criada para notificar
    const { data: createdSongs } = await supabase
      .from('songs')
      .select('id, order_id')
      .eq('order_id', jobs.order_id)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (createdSongs && createdSongs.length > 0) {
      console.log('📧 [CALLBACK] Enviando email de música pronta...');
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-music-released-email', {
          body: { 
            songId: createdSongs[0].id,
            orderId: jobs.order_id
          },
        });
        
        if (emailError) {
          console.warn('⚠️ [CALLBACK] Erro ao enviar email (não bloqueante):', emailError);
        } else {
          console.log('✅ [CALLBACK] Email enviado com sucesso:', emailData);
        }
      } catch (emailErr) {
        console.warn('⚠️ [CALLBACK] Erro ao chamar send-music-released-email (não bloqueante):', emailErr);
      }
    } else {
      console.warn('⚠️ [CALLBACK] Nenhuma song encontrada para enviar email');
    }

    // ✅ IMPORTANTE: Retornar 200 rapidamente (API Suno espera resposta em até 15 segundos)
    return new Response(JSON.stringify({ success: true, created: musicData.length }), { status: 200, headers: { ...secureHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("❌ [CALLBACK] Erro:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), { status: 500, headers: { ...secureHeaders, "Content-Type": "application/json" } });
  }
});
