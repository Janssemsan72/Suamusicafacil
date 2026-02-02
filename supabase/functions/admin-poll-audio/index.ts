import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
      _role: 'admin'
    });

    if (!isAdmin) {
      throw new Error('Sem permissão de admin');
    }

    const { task_id } = await req.json();
    console.log('📋 [POLL] Task ID recebido:', task_id);

    const sunoApiKey = Deno.env.get('SUNO_API_KEY');
    if (!sunoApiKey) {
      console.error('❌ [POLL] SUNO_API_KEY não configurada');
      throw new Error('SUNO_API_KEY não configurada');
    }
    
    console.log('✅ [POLL] SUNO_API_KEY configurada');

    console.log('🔍 [SUNO] Consultando status do task_id:', task_id);

    // Tentar endpoint de status detalhado primeiro
    const endpoints = [
      `https://api.sunoapi.org/api/v1/generate/record-info?id=${task_id}`,
      `https://api.sunoapi.org/api/v1/query?id=${task_id}`,
      `https://api.sunoapi.org/api/v1/query?jobId=${task_id}`,
      `https://api.sunoapi.org/api/v1/feed?id=${task_id}`
    ];

    let response: Response | null = null;
    let lastError: any = null;
    
    const MAX_RETRIES = 3;
    let retryCount = 0;

    const fetchWithRetry = async (url: string): Promise<Response> => {
      try {
        const resp = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${sunoApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!resp.ok && retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`⚠️ Tentativa ${retryCount}/${MAX_RETRIES} falhou (${resp.status}), tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchWithRetry(url);
        }

        return resp;
      } catch (error) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`⚠️ Erro na tentativa ${retryCount}, tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchWithRetry(url);
        }
        throw error;
      }
    };

    // Testar cada endpoint até encontrar um que funcione
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Tentando endpoint: ${endpoint}`);
        response = await fetchWithRetry(endpoint);
        
        if (response.ok) {
          console.log(`✅ Endpoint funcionou: ${endpoint}`);
          break;
        } else {
          console.log(`⚠️ Endpoint retornou ${response.status}: ${endpoint}`);
          lastError = new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.log(`⚠️ Erro ao tentar endpoint ${endpoint}:`, error);
        lastError = error;
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error('Nenhum endpoint funcionou');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro Suno poll:', errorText);
      
      if (response.status === 404) {
        throw new Error('Task não encontrado. Verifique se a SUNO_API_KEY está correta.');
      } else if (response.status === 401) {
        throw new Error('Não autorizado. Verifique a SUNO_API_KEY.');
      }
      
      throw new Error(`Erro ao consultar Suno: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('📥 [SUNO] Resposta do polling:', {
      code: result.code,
      status: result.status,
      hasData: !!result.data,
      timestamp: new Date().toISOString()
    });

    // Validar formato da resposta
    if (result.code !== 200 && result.status !== 'SUCCESS') {
      const errorMsg = result.msg || result.message || 'Erro ao consultar status do job';
      console.error('❌ Job query falhou:', {
        code: result.code,
        status: result.status,
        error: errorMsg
      });
      
      return new Response(JSON.stringify({ 
        status: 'error',
        error: errorMsg
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extrair status e progresso
    const status = result.data?.status; // PENDING, TEXT_SUCCESS, FIRST_SUCCESS, SUCCESS, FAILED
    const progress = result.data?.progress || 0;
    const jobData = result.data || result;
    const progressString = jobData?.progress || jobData?.Progress || '0%';
    const progressNumber = typeof progress === 'number' ? progress : parseInt(progressString.replace('%', '')) || 0;
    const musics = jobData?.musics || jobData?.Musics || jobData?.data?.musics || [];
    
    // Mapear status para porcentagem
    let calculatedProgress = progressNumber;
    if (status === 'PENDING') calculatedProgress = 10;
    else if (status === 'TEXT_SUCCESS') calculatedProgress = 30;
    else if (status === 'FIRST_SUCCESS') calculatedProgress = 60;
    else if (status === 'SUCCESS' || status === 'complete') calculatedProgress = 100;
    else if (status === 'FAILED' || status === 'failed') calculatedProgress = 0;

    console.log('📊 Status extraído:', {
      status,
      progress: progressNumber,
      calculatedProgress,
      musicsCount: musics.length
    });

    // Se ainda está processando
    if (status !== 'SUCCESS' && status !== 'complete' && calculatedProgress < 100) {
      return new Response(JSON.stringify({
        status: 'processing',
        progress: calculatedProgress,
        message: `Processando... (${calculatedProgress}%)`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se falhou
    if (status === 'FAILED' || status === 'failed') {
      const errorMsg = result.data?.error || result.msg || 'Falha ao gerar áudio';
      return new Response(JSON.stringify({
        status: 'error',
        error: errorMsg
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se completou, extrair dados da primeira música
    if (musics && musics.length > 0) {
      const firstMusic = musics[0];
      
      // ✅ REGRA DE OURO #1: Extrair audio_id (clipId) para playback
      const audioId = firstMusic.id || firstMusic.clipId || firstMusic.musicId || firstMusic.audioId || null;
      const audioUrl = firstMusic.audio_url || firstMusic.audioUrl || firstMusic.AudioUrl || firstMusic.url;
      const videoUrl = firstMusic.video_url || firstMusic.videoUrl || firstMusic.VideoUrl;
      const imageUrl = firstMusic.image_url || firstMusic.imageUrl || firstMusic.ImageUrl || firstMusic.cover_url || firstMusic.coverUrl;
      const duration = firstMusic.duration || firstMusic.Duration || 180;

      console.log('✅ [POLL] Áudio completo!', {
        audio_id: audioId,
        has_audio_url: !!audioUrl,
        has_image_url: !!imageUrl,
        duration
      });

      // ✅ REGRA DE OURO #1: Retornar audio_id na resposta para que o frontend possa passá-lo para admin-finalize-generation
      return new Response(JSON.stringify({
        status: 'complete',
        progress: 100,
        audio_url: audioUrl,
        video_url: videoUrl,
        image_url: imageUrl,
        duration: duration,
        task_id: task_id,
        audio_id: audioId, // ✅ REGRA DE OURO #1: Incluir audio_id para playback
        clip_id: audioId, // Alias para compatibilidade
        message: 'Áudio gerado com sucesso!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se não tem músicas mas status é success, pode estar ainda processando
    return new Response(JSON.stringify({
      status: 'processing',
      progress: calculatedProgress,
      message: 'Aguardando músicas...'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Erro em admin-poll-audio:', error);
    return new Response(JSON.stringify({ 
      status: 'error',
      error: error.message || 'Erro desconhecido'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
