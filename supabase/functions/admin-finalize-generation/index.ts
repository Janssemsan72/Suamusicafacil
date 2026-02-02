import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { withRetry, RETRY_CONFIGS } from "../_shared/retry.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Não autenticado');
    }

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin' // Função aceita text, não precisa de cast
    });

    if (!isAdmin) {
      throw new Error('Sem permissão de admin');
    }

    const { customer_email, quiz_data, lyrics, audio_data, send_email } = await req.json();

    console.log('🎵 Finalizando geração manual...');
    console.log('📊 Dados recebidos:', {
      customer_email,
      has_lyrics: !!lyrics,
      has_audio_data: !!audio_data,
      send_email,
      quiz_data_keys: Object.keys(quiz_data)
    });

    // Validar dados obrigatórios
    if (!customer_email || !quiz_data.about_who || !lyrics || !audio_data) {
      throw new Error('Dados obrigatórios ausentes: customer_email, quiz_data.about_who, lyrics, audio_data');
    }

    // 1. Criar quiz com retry logic para garantir salvamento mesmo com muitas inserções simultâneas
    console.log('📝 Criando quiz com retry logic...');
    
    let quiz;
    let attemptCount = 0;
    const maxAttempts = 5;
    
    try {
      quiz = await withRetry(
        async () => {
          attemptCount++;
          console.log(`📝 [QuizInsert] Tentativa ${attemptCount}/${maxAttempts} de inserir quiz`, {
            timestamp: new Date().toISOString(),
            customer_email,
          });

          const { data, error } = await supabase
            .from('quizzes')
            .insert({
              customer_email,
              about_who: quiz_data.about_who,
              relationship: quiz_data.relationship,
              style: quiz_data.style,
              vocal_gender: quiz_data.vocal_gender || null,
              message: quiz_data.message,
              language: quiz_data.language || 'pt',
              occasion: quiz_data.occasion || null,
              desired_tone: null,
              memories: null,
              qualities: null,
              key_moments: null,
            })
            .select()
            .single();

          if (error) {
            console.warn(`⚠️ [QuizInsert] Tentativa ${attemptCount} falhou`, {
              error_code: error.code,
              error_message: error.message,
              error_details: error.details,
              error_hint: error.hint,
            });
            throw error;
          }

          if (!data || !data.id) {
            const missingDataError = new Error('Quiz data ou ID ausente após inserção');
            console.error(`❌ [QuizInsert] Tentativa ${attemptCount} retornou dados inválidos`, {
              has_data: !!data,
              has_id: !!data?.id,
            });
            throw missingDataError;
          }

          console.log(`✅ [QuizInsert] Tentativa ${attemptCount} bem-sucedida`, {
            quiz_id: data.id,
          });

          return data;
        },
        {
          ...RETRY_CONFIGS.DATABASE,
          maxAttempts: maxAttempts,
          retryableErrors: [
            'timeout',
            'ECONNRESET',
            'ETIMEDOUT',
            '40P01', // deadlock detected
            '53300', // too many connections
            '57P03', // cannot connect now
            '08006', // connection failure
            'PGRST116', // connection timeout
            '57014', // statement timeout
          ],
        }
      );

      console.log(`✅ Quiz criado após ${attemptCount} tentativa(s):`, quiz.id);
    } catch (error: any) {
      console.error(`❌ Erro ao criar quiz após ${attemptCount} tentativa(s):`, {
        error_code: error?.code,
        error_message: error?.message,
        error_details: error?.details,
        attempts: attemptCount,
        customer_email,
      });
      throw new Error(`Falha ao criar quiz após ${attemptCount} tentativa(s): ${error?.message || 'Erro desconhecido'}`);
    }

    // 2. Criar order (pago, grátis)
    console.log('📦 Criando order...');
    // ✅ CORREÇÃO: Criar ordem e usar created_at como paid_at
    // Como a ordem está sendo criada agora, created_at e paid_at serão iguais (ambos agora)
    const now = new Date().toISOString();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        quiz_id: quiz.id,
        plan: 'express',
        amount_cents: 0,
        status: 'paid',
        provider: 'manual',
        customer_email,
        paid_at: now, // Será igual a created_at (ambos são "agora")
      })
      .select()
      .single();

    if (orderError) {
      console.error('❌ Erro ao criar order:', orderError);
      throw orderError;
    }
    console.log('✅ Order criado:', order.id);

    // 3. Criar job (completo)
    console.log('🔧 Criando job...');
    const lyricsFormatted = Array.isArray(lyrics.verses) 
      ? lyrics.verses.map((v: any) => v.text).join('\n\n')
      : lyrics;

    console.log('📝 Lyrics formatadas:', {
      length: lyricsFormatted.length,
      verses_count: Array.isArray(lyrics.verses) ? lyrics.verses.length : 'N/A'
    });

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        quiz_id: quiz.id,
        order_id: order.id,
        status: 'completed',
        gpt_lyrics: lyrics,
        suno_audio_url: audio_data.audio_url,
        suno_task_id: audio_data.task_id,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ Erro ao criar job:', jobError);
      throw jobError;
    }
    console.log('✅ Job criado:', job.id);

    // 4. Criar song
    const releaseAt = new Date();
    releaseAt.setHours(releaseAt.getHours() + 1);

    // FASE 3: Salvar áudio no Supabase Storage
    let finalAudioUrl = audio_data.audio_url;
    let finalCoverUrl = audio_data.image_url;
    
    try {
      console.log('📥 Baixando áudio de:', audio_data.audio_url);
      
      // Download do áudio
      const audioResponse = await fetch(audio_data.audio_url);
      if (audioResponse.ok) {
        const audioBlob = await audioResponse.arrayBuffer();
        const audioFileName = `${order.id}/${Date.now()}_audio.mp3`;
        
        const { error: audioUploadError } = await supabase.storage
          .from('suno-tracks')
          .upload(audioFileName, audioBlob, {
            contentType: 'audio/mpeg',
            upsert: true
          });

        if (!audioUploadError) {
          const { data: audioUrlData } = supabase.storage
            .from('suno-tracks')
            .getPublicUrl(audioFileName);
          
          finalAudioUrl = audioUrlData.publicUrl;
          console.log('✅ Áudio salvo no Storage:', finalAudioUrl);
        } else {
          console.warn('⚠️ Erro ao fazer upload do áudio, usando URL da Suno:', audioUploadError);
        }
      }

      // Download da capa se disponível
      if (audio_data.image_url) {
        const coverResponse = await fetch(audio_data.image_url);
        if (coverResponse.ok) {
          const coverBlob = await coverResponse.arrayBuffer();
          const coverFileName = `${order.id}/${Date.now()}_cover.jpg`;
          
          const { error: coverUploadError } = await supabase.storage
            .from('suno-tracks')
            .upload(coverFileName, coverBlob, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (!coverUploadError) {
            const { data: coverUrlData } = supabase.storage
              .from('suno-tracks')
              .getPublicUrl(coverFileName);
            
            finalCoverUrl = coverUrlData.publicUrl;
            console.log('✅ Capa salva no Storage:', finalCoverUrl);
          }
        }
      }
    } catch (storageError) {
      console.error('⚠️ Erro ao salvar no Storage, usando URLs da Suno:', storageError);
    }

    console.log('🎵 Criando song...');
    
    // ✅ REGRA DE OURO #1: Extrair audioId (clipId) dos dados do áudio
    // O audioId pode vir em diferentes campos dependendo da estrutura retornada pela Suno
    const audioId = audio_data.audio_id || audio_data.clip_id || audio_data.id || audio_data.clipId || null;
    const taskId = audio_data.task_id || job.suno_task_id;
    
    console.log('📋 Dados para playback:', {
      task_id: taskId,
      audio_id: audioId,
      has_audio_url: !!finalAudioUrl
    });
    
    const { data: song, error: songError } = await supabase
      .from('songs')
      .insert({
        quiz_id: quiz.id,
        order_id: order.id,
        job_id: job.id,
        title: lyrics.title || 'Música Personalizada',
        lyrics: lyricsFormatted,
        style: quiz_data.style,
        language: quiz_data.language,
        audio_url: finalAudioUrl,
        cover_url: finalCoverUrl,
        duration_sec: audio_data.duration || 180,
        status: 'released',
        release_at: releaseAt.toISOString(),
        released_at: new Date().toISOString(),
        suno_task_id: taskId, // ✅ REGRA DE OURO #1: Salvar taskId
        suno_clip_id: audioId, // ✅ REGRA DE OURO #1: Salvar audioId (clipId)
      })
      .select()
      .single();

    if (songError) {
      console.error('❌ Erro ao criar song:', songError);
      throw songError;
    }
    console.log('✅ Song criado:', song.id);
    
    // ✅ REGRA DE OURO #1 e #7: Criar registro em audio_generations para rastreamento completo
    if (taskId && audioId) {
      const { error: audioGenError } = await supabase
        .from('audio_generations')
        .insert({
          generation_task_id: taskId,
          audio_id: audioId,
          audio_url: audio_data.audio_url, // URL original da Suno (antes de salvar no nosso storage)
          song_id: song.id,
          job_id: job.id,
          order_id: order.id,
          status: 'completed',
          completed_at: new Date().toISOString()
        });
      
      if (audioGenError) {
        console.error('❌ Erro ao criar registro em audio_generations:', audioGenError);
        // Não bloquear o fluxo, apenas logar o erro
      } else {
        console.log('✅ Registro criado em audio_generations para song:', song.id);
      }
    } else {
      console.warn('⚠️ Não foi possível criar registro em audio_generations:', {
        has_task_id: !!taskId,
        has_audio_id: !!audioId
      });
    }

    // 5. Enviar email se solicitado
    if (send_email) {
      console.log('📧 Enviando email...');
      const { error: emailError } = await supabase.functions.invoke('send-music-released-email', {
        body: { songId: song.id }
      });

      if (emailError) {
        console.error('Erro ao enviar email:', emailError);
      } else {
        console.log('✅ Email enviado');
      }
    }

    // 6. Log admin
    await supabase.from('admin_logs').insert({
      admin_user_id: user.id,
      action: 'finalize_manual_generation',
      target_table: 'songs',
      target_id: song.id,
      changes: { 
        customer_email, 
        quiz_id: quiz.id, 
        order_id: order.id, 
        song_id: song.id,
        email_sent: send_email 
      }
    });

    console.log('✅ Geração manual finalizada com sucesso!');

    return new Response(JSON.stringify({ 
      success: true,
      song_id: song.id,
      order_id: order.id,
      quiz_id: quiz.id
    }), {
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('❌ Erro em admin-finalize-generation:', error);
    // FASE 4: Sempre retornar 200 com objeto de erro
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 200,
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
    });
  }
});
