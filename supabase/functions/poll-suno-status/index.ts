import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { getSecureHeaders } from "../_shared/security-headers.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    console.log('🔄 Starting Suno polling cycle...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sunoApiKey = Deno.env.get('SUNO_API_KEY');

    if (!sunoApiKey) {
      throw new Error('SUNO_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar jobs que precisam de polling: audio_processing, processing, ou completed com suno_task_id
    const { data: jobsWithTask, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .not('suno_task_id', 'is', null)
      .in('status', ['audio_processing', 'processing', 'completed'])
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (fetchError) {
      console.error('❌ Error fetching jobs:', fetchError);
    }
    
    // Filtrar: manter jobs que não têm songs criadas (verificar no loop abaixo)
    const jobs = jobsWithTask || [];

    if (!jobs || jobs.length === 0) {
      console.log('✅ No jobs to poll');
      return new Response(
        JSON.stringify({ message: 'No jobs to poll', processed: 0 }),
        { headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${jobs.length} jobs to check`);

    let completed = 0;
    let failed = 0;
    let stillProcessing = 0;

    // Processar cada job
    for (const job of jobs) {
      try {
        // Pular jobs que já têm songs criadas
        const { data: existingSongs } = await supabase
          .from('songs')
          .select('id')
          .eq('order_id', job.order_id)
          .limit(1);
        
        if (existingSongs && existingSongs.length > 0) {
          console.log(`⏭️ Job ${job.id} já tem songs, pulando`);
          completed++;
          continue;
        }

        console.log(`🔍 Checking job ${job.id} with task ${job.suno_task_id}`);

        const endpoint = `https://api.sunoapi.org/api/v1/generate/record-info?taskId=${job.suno_task_id}`;
        console.log(`📡 Calling Suno query: ${endpoint}`);

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sunoApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        const responseText = await response.text();
        console.log(`📥 Suno Response Status: ${response.status}`);
        console.log(`📥 Suno Response Body:`, responseText.substring(0, 500));

        if (!response.ok) {
          console.error(`❌ Suno API error for job ${job.id}:`, response.status, responseText);
          stillProcessing++;
          continue;
        }

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          console.error(`❌ Erro ao parsear resposta Suno:`, e);
          stillProcessing++;
          continue;
        }

        console.log(`✅ Suno Response parsed:`, JSON.stringify(result, null, 2));

        // record-info retorna: { data: { status: "SUCCESS"|"PENDING"|..., response: { sunoData: [...] } } }
        // Formato alternativo: { code: 200, data: { progress, status, musics } }
        const taskData = result.data || result;
        
        if (!taskData) {
          console.warn(`⚠️ Empty taskData for job ${job.id}`);
          stillProcessing++;
          continue;
        }

        const status = (taskData.status || '').toUpperCase();
        const progress = taskData.progress || '0%';
        
        console.log(`📊 Task status: ${status}, progress: ${progress}`);

        const isJobNeedingRecovery = job.status === 'completed' || job.status === 'processing';

        const isStillProcessing = ['PENDING', 'TEXT_SUCCESS', 'PROCESSING', 'QUEUED'].includes(status);
        if (!isJobNeedingRecovery && isStillProcessing) {
          console.log(`⏳ Task ${job.suno_task_id} still processing (status=${status})`);
          stillProcessing++;
          continue;
        }

        const isSuccess = ['SUCCESS', 'FIRST_SUCCESS', 'COMPLETE', 'COMPLETED'].includes(status) || progress === '100%' || isJobNeedingRecovery;
        if (isSuccess) {
          // Extrair músicas: sunoData (novo formato) ou musics/Musics (formato antigo)
          const sunoData = taskData.response?.sunoData || [];
          const musics = sunoData.length > 0 ? sunoData : (taskData.musics || taskData.Musics || []);
          
          if (!Array.isArray(musics) || musics.length === 0) {
            console.error(`❌ No musics found for job ${job.id}. Full taskData:`, JSON.stringify(taskData, null, 2));
            stillProcessing++;
            continue;
          }
          
          console.log(`✅ Job ${job.id} completed with ${musics.length} music(s)`);
          
          // Usar 'musics' ao invés de 'clips' para compatibilidade
          const clips = musics;

          // Buscar dados do job com quiz
          const { data: jobData, error: jobFetchError } = await supabase
            .from('jobs')
            .select('order_id, quiz_id, gpt_lyrics')
            .eq('id', job.id)
            .single();
          
          const { data: quizData } = await supabase
            .from('quizzes')
            .select('about_who, style')
            .eq('id', job.quiz_id)
            .single();

          if (jobFetchError || !jobData) {
            console.error(`❌ Erro ao buscar dados do job ${job.id}:`, jobFetchError);
            failed++;
            continue;
          }

          // Criar/atualizar todas as variantes em songs (suporta 2+ músicas)
          // Processar TODAS as músicas retornadas
          for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const variantNumber = i + 1;
            
            // Case-insensitive extraction
            const audioUrl = clip.audio_url || clip.audioUrl || clip.AudioUrl || clip.url;
            const videoUrl = clip.video_url || clip.videoUrl || clip.VideoUrl;
            const coverUrl = clip.image_url || clip.imageUrl || clip.ImageUrl || clip.cover_url || clip.coverUrl;
            
            // ✅ CORREÇÃO: Extrair clipId (audioId) com prioridade e validação
            // O audioId é essencial para separação de stems, então deve ser sempre salvo
            const clipId = clip.id || clip.clipId || clip.musicId || clip.audioId || null;
            
            // Se não encontrou clipId, tentar gerar um baseado no task_id
            // Mas logar um aviso pois isso pode causar problemas na separação de stems
            const finalClipId = clipId || `${job.suno_task_id}-${variantNumber}`;
            
            if (!clipId) {
              console.warn(`⚠️ [POLL] ATENÇÃO: clipId não encontrado na música ${i + 1} do job ${job.id}, usando fallback: ${finalClipId}`);
              console.warn(`⚠️ [POLL] Campos disponíveis no clip:`, Object.keys(clip));
              console.warn(`⚠️ [POLL] Isso pode impedir a separação de stems no futuro!`);
            } else {
              console.log(`✅ [POLL] clipId (audioId) encontrado: ${finalClipId}`);
            }

            console.log(`🎵 Music ${i + 1}:`, { audioUrl, videoUrl, coverUrl, clipId: finalClipId });

            if (!audioUrl) {
              console.warn(`⚠️ Music ${i + 1} do job ${job.id} não tem audio_url. Full clip:`, clip);
              continue;
            }

            // Download audio e upload para Supabase Storage
            let storageAudioUrl = audioUrl;
            try {
              console.log(`⬇️ [POLL] Baixando áudio variante ${variantNumber}...`);
              const audioResp = await fetch(audioUrl);
              if (audioResp.ok) {
                const audioBlob = await audioResp.blob();
                const storagePath = `media/${job.suno_task_id}-${variantNumber}.mp3`;
                
                // Garantir bucket existe
                try { await supabase.storage.createBucket('suno-tracks', { public: true }); } catch (_) {}
                
                const { error: uploadErr } = await supabase.storage
                  .from('suno-tracks')
                  .upload(storagePath, audioBlob, { contentType: 'audio/mpeg', upsert: true });
                
                if (!uploadErr) {
                  const { data: publicUrl } = supabase.storage.from('suno-tracks').getPublicUrl(storagePath);
                  storageAudioUrl = publicUrl.publicUrl;
                  console.log(`✅ [POLL] Áudio salvo no storage: ${storageAudioUrl}`);
                } else {
                  console.warn(`⚠️ [POLL] Upload falhou, usando URL externa:`, uploadErr.message);
                }
              }
            } catch (dlErr) {
              console.warn(`⚠️ [POLL] Download falhou, usando URL externa:`, dlErr);
            }

            // Upload cover se disponível
            let storageCoverUrl = coverUrl;
            if (coverUrl) {
              try {
                const coverResp = await fetch(coverUrl);
                if (coverResp.ok) {
                  const coverBlob = await coverResp.blob();
                  const coverPath = `media/${job.suno_task_id}-${variantNumber}-cover.jpg`;
                  const { error: coverUpErr } = await supabase.storage
                    .from('suno-tracks')
                    .upload(coverPath, coverBlob, { contentType: 'image/jpeg', upsert: true });
                  if (!coverUpErr) {
                    const { data: coverPubUrl } = supabase.storage.from('suno-tracks').getPublicUrl(coverPath);
                    storageCoverUrl = coverPubUrl.publicUrl;
                  }
                }
              } catch (_) {}
            }

            // Verificar se já existe song para este order + variant
            const { data: existingSong } = await supabase
              .from('songs')
              .select('id')
              .eq('order_id', jobData.order_id)
              .eq('variant_number', variantNumber)
              .single();

            const songData = {
              order_id: jobData.order_id,
              quiz_id: job.quiz_id,
              variant_number: variantNumber,
              title: clip.title || jobData.gpt_lyrics?.title || `Música Personalizada ${variantNumber}`,
              lyrics: JSON.stringify(jobData.gpt_lyrics),
              audio_url: storageAudioUrl,
              cover_url: storageCoverUrl,
              suno_clip_id: finalClipId,
              status: 'ready',
              release_at: new Date().toISOString(),
              released_at: new Date().toISOString(),
              duration_sec: clip.duration ? Math.round(clip.duration) : null,
              updated_at: new Date().toISOString()
            };

            let songId: string | null = null;
            
            if (existingSong) {
              // Atualizar song existente
              const { data: updatedSong, error: songUpdateError } = await supabase
                .from('songs')
                .update({
                  ...songData,
                  suno_task_id: job.suno_task_id, // ✅ Salvar taskId também na song
                })
                .eq('id', existingSong.id)
                .select('id, audio_url')
                .single();

              if (songUpdateError) {
                console.error(`❌ Erro ao atualizar song variante ${variantNumber}:`, songUpdateError);
              } else {
                songId = updatedSong?.id || existingSong.id;
                console.log(`✅ Song variante ${variantNumber} atualizada para order ${jobData.order_id}`);
                // ✅ VERIFICAÇÃO: Confirmar que audio_url foi realmente atualizado
                if (!updatedSong?.audio_url || updatedSong.audio_url.trim() === '') {
                  console.error(`⚠️ ATENÇÃO: Song ${existingSong.id} atualizada mas audio_url ainda está vazio! Tentando corrigir...`);
                  // Tentar atualizar novamente com o audioUrl direto
                  await supabase
                    .from('songs')
                    .update({ audio_url: audioUrl, updated_at: new Date().toISOString() })
                    .eq('id', existingSong.id);
                }
              }
            } else {
              // Criar nova song
              const { data: newSong, error: songInsertError } = await supabase
                .from('songs')
                .insert({
                  ...songData,
                  suno_task_id: job.suno_task_id, // ✅ Salvar taskId também na song
                })
                .select('id, audio_url')
                .single();

              if (songInsertError) {
                console.error(`❌ Erro ao criar song variante ${variantNumber}:`, songInsertError);
              } else {
                songId = newSong?.id || null;
                console.log(`✅ Song variante ${variantNumber} criada para order ${jobData.order_id}`);
                // ✅ VERIFICAÇÃO: Confirmar que audio_url foi realmente criado
                if (!newSong?.audio_url || newSong.audio_url.trim() === '') {
                  console.error(`⚠️ ATENÇÃO: Song ${newSong.id} criada mas audio_url está vazio! Tentando corrigir...`);
                  // Tentar atualizar com o audioUrl direto
                  await supabase
                    .from('songs')
                    .update({ audio_url: audioUrl, updated_at: new Date().toISOString() })
                    .eq('id', newSong.id);
                }
              }
            }
            
            // ✅ REGRA DE OURO #1 e #7: Criar/atualizar registro em audio_generations
            if (songId && job.suno_task_id && finalClipId) {
              // Verificar se já existe registro
              const { data: existingGen } = await supabase
                .from('audio_generations')
                .select('id')
                .eq('generation_task_id', job.suno_task_id)
                .eq('audio_id', finalClipId)
                .single();
              
              if (existingGen) {
                // Atualizar registro existente
                const { error: updateGenError } = await supabase
                  .from('audio_generations')
                  .update({
                    audio_url: audioUrl, // URL original da Suno
                    song_id: songId,
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingGen.id);
                
                if (updateGenError) {
                  console.error(`❌ [POLL] Erro ao atualizar audio_generations:`, updateGenError);
                } else {
                  console.log(`✅ [POLL] Registro atualizado em audio_generations para song ${songId}`);
                }
              } else {
                // Criar novo registro
                const { error: insertGenError } = await supabase
                  .from('audio_generations')
                  .insert({
                    generation_task_id: job.suno_task_id,
                    audio_id: finalClipId,
                    audio_url: audioUrl, // URL original da Suno
                    song_id: songId,
                    job_id: job.id,
                    order_id: jobData.order_id,
                    status: 'completed',
                    completed_at: new Date().toISOString()
                  });
                
                if (insertGenError) {
                  console.error(`❌ [POLL] Erro ao criar registro em audio_generations:`, insertGenError);
                } else {
                  console.log(`✅ [POLL] Registro criado em audio_generations para song ${songId} (taskId: ${job.suno_task_id}, audioId: ${finalClipId})`);
                }
              }
            } else {
              console.warn(`⚠️ [POLL] Não foi possível criar registro em audio_generations:`, {
                hasSongId: !!songId,
                hasTaskId: !!job.suno_task_id,
                hasClipId: !!finalClipId
              });
            }
          }

          const { error: jobUpdateError } = await supabase
            .from('jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          
          if (jobUpdateError) {
            console.error(`❌ Erro ao atualizar job ${job.id}:`, jobUpdateError);
          } else {
            console.log(`✅ Job ${job.id} marcado como completed`);
          }

          // Notificar cliente que a música está pronta
          try {
            const { data: readySongs } = await supabase
              .from('songs')
              .select('id')
              .eq('order_id', jobData.order_id)
              .eq('status', 'ready')
              .limit(1);
            
            if (readySongs && readySongs.length > 0) {
              console.log('📧 [POLL] Notificando cliente...');
              await supabase.functions.invoke('send-music-released-email', {
                body: { songId: readySongs[0].id, orderId: jobData.order_id }
              });
              console.log('✅ [POLL] Email de notificação enviado');
            }
          } catch (notifyErr) {
            console.warn('⚠️ [POLL] Erro ao enviar notificação (não bloqueante):', notifyErr);
          }

          completed++;
          continue;
        }

        // Se falhou, marcar job como failed
        if (status === 'failed' || status === 'error') {
          // Falha na geração - implementar retry inteligente
          const errorMsg = taskData.error || taskData.message || 'Suno generation failed';
          const metadata = typeof job.metadata === 'object' ? job.metadata : {};
          const retryCount = metadata?.retry_count || 0;
          
          console.log(`❌ Job ${job.id} failed: ${errorMsg} (tentativa ${retryCount + 1}/3)`);
          
          if (retryCount < 2) {
            // Tentar novamente
            console.log(`🔄 Retrying job ${job.id}...`);
            
            const newMetadata = { ...metadata, retry_count: retryCount + 1 };
            
            await supabase
              .from('jobs')
              .update({
                status: 'retry_pending',
                error: `${errorMsg} (tentando novamente ${retryCount + 1}/3)`,
                metadata: newMetadata,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);

            // Reinvocar geração de áudio
            const { error: retryError } = await supabase.functions.invoke('generate-audio-internal', {
              body: {
                job_id: job.id,
                order_id: job.order_id,
                lyrics: job.gpt_lyrics,
                retry: true,
              },
            });

            if (retryError) {
              console.error(`❌ Erro ao retentar job ${job.id}:`, retryError);
            }
          } else {
            // Limite de retries atingido
            console.log(`⛔ Job ${job.id} atingiu limite de retries (3)`);
            
            await supabase
              .from('jobs')
              .update({
                status: 'failed',
                error: `${errorMsg} - Falha após 3 tentativas`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);

            failed++;
          }
          continue;
        }

        // Status desconhecido
        console.log(`⚠️ Job ${job.id} unknown status: ${status}`);
        stillProcessing++;

      } catch (error) {
        console.error(`❌ Error processing job ${job.id}:`, error);
        stillProcessing++;
      }
    }

    const debugInfo: any[] = [];
    for (const job of jobs) {
      if (!job.suno_task_id) continue;
      try {
        const dbg = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${job.suno_task_id}`, {
          headers: { 'Authorization': `Bearer ${sunoApiKey}`, 'Content-Type': 'application/json' },
        });
        const txt = await dbg.text();
        try {
          const parsed = JSON.parse(txt);
          const d = parsed.data || {};
          debugInfo.push({
            job_id: job.id,
            task_id: job.suno_task_id,
            http: dbg.status,
            suno_status: d.status,
            has_response: !!d.response,
            sunoData_count: d.response?.sunoData?.length || 0,
            musics_count: (d.musics || d.Musics || []).length
          });
        } catch (_) {
          debugInfo.push({ job_id: job.id, task_id: job.suno_task_id, http: dbg.status, resp: txt.substring(0, 500) });
        }
      } catch (_) {}
    }

    const summary = {
      total: jobs.length,
      completed,
      failed,
      stillProcessing,
      timestamp: new Date().toISOString(),
      debug: debugInfo,
    };

    console.log('📊 Polling summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Poll error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
