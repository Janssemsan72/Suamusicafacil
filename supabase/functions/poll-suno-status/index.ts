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

    // ✅ CORREÇÃO: Buscar também jobs 'completed' sem suno_audio_url (para recuperar áudio perdido)
    // Buscar jobs com status 'audio_processing' ou 'processing' que têm suno_task_id
    const { data: jobsProcessing, error: fetchErrorProcessing } = await supabase
      .from('jobs')
      .select('*')
      .in('status', ['audio_processing', 'processing'])
      .not('suno_task_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(50);
    
    // Buscar jobs 'completed' sem suno_audio_url mas com suno_task_id (para recuperar)
    const { data: jobsCompletedWithoutAudio, error: fetchErrorCompleted } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'completed')
      .not('suno_task_id', 'is', null)
      .or('suno_audio_url.is.null,suno_audio_url.eq.')
      .order('created_at', { ascending: true })
      .limit(20);
    
    if (fetchErrorProcessing) {
      console.error('❌ Error fetching processing jobs:', fetchErrorProcessing);
    }
    if (fetchErrorCompleted) {
      console.error('❌ Error fetching completed jobs without audio:', fetchErrorCompleted);
    }
    
    // Combinar ambos os arrays
    const jobs = [
      ...(jobsProcessing || []),
      ...(jobsCompletedWithoutAudio || [])
    ];

    if (fetchErrorProcessing || fetchErrorCompleted) {
      console.error('❌ Error fetching jobs:', { fetchErrorProcessing, fetchErrorCompleted });
      // Não bloquear se houver erro em uma das queries, continuar com as que funcionaram
    }

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
        console.log(`🔍 Checking job ${job.id} with task ${job.suno_task_id}`);

        const endpoint = `https://api.sunoapi.org/api/v1/query?id=${job.suno_task_id}`;
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

        // Suno retorna { code: 200, data: { progress: "100%", status: "complete", musics: [...] } }
        const taskData = result.data || result;
        
        if (!taskData) {
          console.warn(`⚠️ Empty taskData for job ${job.id}`);
          stillProcessing++;
          continue;
        }

        const status = taskData.status || '';
        const progress = taskData.progress || '0%';
        
        console.log(`📊 Task status: ${status}, progress: ${progress}`);

        // ✅ CORREÇÃO: Se job já está completed mas sem suno_audio_url, processar mesmo assim
        const isJobCompletedWithoutAudio = job.status === 'completed' && (!job.suno_audio_url || job.suno_audio_url.trim() === '');
        
        // Se ainda está processando (e não é um job completed sem áudio), continue
        if (!isJobCompletedWithoutAudio && (status === 'processing' || status === 'queued' || status === 'pending' || progress !== '100%')) {
          console.log(`⏳ Task ${job.suno_task_id} still processing (${progress})`);
          stillProcessing++;
          continue;
        }

        // Se completou (status === 'complete' OU progress === '100%' OU job completed sem áudio), extrair as músicas
        if (status === 'complete' || progress === '100%' || isJobCompletedWithoutAudio) {
          // Suno retorna { musics: [...] } ou { Musics: [...] }
          const musics = taskData.musics || taskData.Musics || [];
          
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
          const scheduledTime = new Date();
          scheduledTime.setHours(scheduledTime.getHours() + 22); // 22 horas depois

          // Processar TODAS as músicas retornadas (não limitar a 2)
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
              title: jobData.gpt_lyrics?.title || `Música Personalizada ${variantNumber}`,
              lyrics: JSON.stringify(jobData.gpt_lyrics),
              audio_url: audioUrl,
              cover_url: coverUrl,
              suno_clip_id: finalClipId, // ✅ Sempre salvar clipId (audioId) para permitir separação de stems
              language: quizData?.about_who ? 'pt' : 'en',
              style: quizData?.style || 'pop',
              status: 'ready', // ✅ CORREÇÃO: Status deve ser 'ready' quando áudio está pronto
              scheduled_release_at: scheduledTime.toISOString(),
              release_at: scheduledTime.toISOString(),
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

          // ✅ CORREÇÃO CRÍTICA: Garantir que suno_audio_url seja sempre salvo
          // Extrair audio_url do primeiro clip válido
          let jobAudioUrl = null;
          for (const clip of clips) {
            const clipAudioUrl = clip.audio_url || clip.audioUrl || clip.AudioUrl || clip.url;
            if (clipAudioUrl && clipAudioUrl.trim() !== '') {
              jobAudioUrl = clipAudioUrl;
              break; // Usar o primeiro clip válido
            }
          }
          
          // Atualizar job como completo
          const jobUpdateData: any = {
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          // ✅ SEMPRE salvar suno_audio_url se disponível
          if (jobAudioUrl) {
            jobUpdateData.suno_audio_url = jobAudioUrl;
            console.log(`✅ Salvando suno_audio_url no job ${job.id}: ${jobAudioUrl.substring(0, 50)}...`);
          } else {
            console.warn(`⚠️ Job ${job.id} completado mas nenhum audio_url encontrado nos clips`);
          }
          
          const { error: jobUpdateError } = await supabase
            .from('jobs')
            .update(jobUpdateData)
            .eq('id', job.id);
          
          if (jobUpdateError) {
            console.error(`❌ Erro ao atualizar job ${job.id}:`, jobUpdateError);
          } else {
            console.log(`✅ Job ${job.id} marcado como completed`);
          }
          
          // ✅ VERIFICAÇÃO ADICIONAL: Garantir que todas as songs do pedido tenham audio_url
          // Se alguma song foi criada/atualizada mas não tem audio_url, usar o do job
          if (jobAudioUrl) {
            const { data: songsWithoutAudio } = await supabase
              .from('songs')
              .select('id, audio_url')
              .eq('order_id', jobData.order_id)
              .or('audio_url.is.null,audio_url.eq.');
            
            if (songsWithoutAudio && songsWithoutAudio.length > 0) {
              console.log(`🔧 Corrigindo ${songsWithoutAudio.length} song(s) sem audio_url...`);
              for (const song of songsWithoutAudio) {
                const { error: fixError } = await supabase
                  .from('songs')
                  .update({
                    audio_url: jobAudioUrl,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', song.id);
                
                if (fixError) {
                  console.error(`❌ Erro ao corrigir song ${song.id}:`, fixError);
                } else {
                  console.log(`✅ Song ${song.id} corrigida com audio_url do job`);
                }
              }
            }
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

    const summary = {
      total: jobs.length,
      completed,
      failed,
      stillProcessing,
      timestamp: new Date().toISOString(),
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
