import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { fixGeGiPronunciation } from "../_shared/fix-pronunciation.ts";

// Headers simplificados (sem rate limiting)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Mapeia o estilo exibido ao cliente para o estilo esperado pela API da Suno
 * @param clientStyle - Estilo como exibido na interface (ex: "Romântico", "Rock", "MPB", etc.)
 * @returns Estilo no formato esperado pela Suno API
 */
function mapStyleToSuno(clientStyle: string | null | undefined): string {
  if (!clientStyle) return 'pop';
  
  const normalizedStyle = clientStyle.trim();
  
  // Mapeamento completo de estilos (suporta PT, EN, ES)
  const styleMap: Record<string, string> = {
    // Romântico / Romantic / Romántico → pop
    'romântico': 'pop',
    'romantic': 'pop',
    'romántico': 'pop',
    'pop': 'pop',
    
    // Rock → rock
    'rock': 'rock',
    
    // MPB → mpb
    'mpb': 'mpb',
    
    // Sertanejo / Sertanejo Universitário → sertanejo
    'sertanejo': 'sertanejo',
    'sertanejo_uni': 'sertanejo',
    'sertanejo universitário': 'sertanejo',
    'sertanejo universitario': 'sertanejo',
    
    // Forró / Forro → forro
    'forró': 'forro',
    'forro': 'forro',
    
    // Jazz → jazz
    'jazz': 'jazz',
    
    // Gospel → gospel
    'gospel': 'gospel',
    
    // Louvor / Praise / Alabanza → gospel (estilo similar)
    'louvor': 'gospel',
    'praise': 'gospel',
    'alabanza': 'gospel',
    
    // Reggae → reggae
    'reggae': 'reggae',
    
    // Eletrônico / Electronic / Electrónico → electronic
    'eletrônico': 'electronic',
    'electronic': 'electronic',
    'electrónico': 'electronic',
    'eletronico': 'electronic',
    
    // Rap/Hip-Hop → rap
    'rap': 'rap',
    'hip-hop': 'rap',
    'hip hop': 'rap',
    'rap/hip-hop': 'rap',
  };
  
  // Buscar no mapa (case-insensitive)
  const mappedStyle = styleMap[normalizedStyle.toLowerCase()];
  if (mappedStyle) {
    return mappedStyle;
  }
  
  // Fallback: converter para lowercase (pode funcionar para alguns estilos)
  return normalizedStyle.toLowerCase();
}

/**
 * Determina o vocalGender para enviar à Suno API baseado na preferência do usuário
 * 
 * Lógica de prioridade:
 * 1. approval.voice (M/F/S) - preferência explícita do admin
 * 2. quiz.vocal_gender (m/f/'') - preferência original do quiz
 * 3. undefined - sem preferência (Suno escolhe automaticamente)
 * 
 * @param approvalVoice - Voice da approval: 'M' (Masculino), 'F' (Feminino), 'S' (Sem preferência), null ou undefined
 * @param quizVocalGender - Vocal gender do quiz: 'm', 'f', '' (vazio), null ou undefined
 * @returns 'm' (masculino), 'f' (feminino) ou undefined (sem preferência)
 * 
 * @example
 * getVocalGenderForSuno('F', 'm') // retorna 'f' (approval tem prioridade)
 * getVocalGenderForSuno(null, 'f') // retorna 'f' (usa quiz)
 * getVocalGenderForSuno('S', 'm') // retorna undefined (S = sem preferência)
 * getVocalGenderForSuno(null, '') // retorna undefined (sem preferência)
 */
function getVocalGenderForSuno(
  approvalVoice: string | null | undefined,
  quizVocalGender: string | null | undefined
): 'm' | 'f' | undefined {
  // Prioridade 1: approval.voice (preferência explícita do admin)
  if (approvalVoice) {
    // ✅ CORREÇÃO: Converter para string e validar que não está vazio
    const voiceStr = String(approvalVoice).trim();
    if (voiceStr === '') return undefined; // String vazia = sem preferência
    
    const normalized = voiceStr.toUpperCase();
    
    if (normalized === 'M') {
      console.log('🎤 [getVocalGenderForSuno] approval.voice = M → retornando "m"');
      return 'm'; // Masculino
    }
    
    if (normalized === 'F') {
      console.log('🎤 [getVocalGenderForSuno] approval.voice = F → retornando "f"');
      return 'f'; // Feminino
    }
    
    // 'S' ou qualquer outro valor = sem preferência
    // Não retornar nada, deixar Suno escolher
    console.log('🎤 [getVocalGenderForSuno] approval.voice =', normalized, '→ retornando undefined (sem preferência)');
    return undefined;
  }
  
  // Prioridade 2: quiz.vocal_gender (preferência original do quiz)
  // ✅ CORREÇÃO: Verificar se quizVocalGender existe e não é null/undefined
  if (quizVocalGender !== null && quizVocalGender !== undefined) {
    // ✅ CORREÇÃO: Converter para string e validar que não está vazio
    const genderStr = String(quizVocalGender).trim();
    if (genderStr === '') {
      console.log('🎤 [getVocalGenderForSuno] quiz.vocal_gender = "" (vazio) → retornando undefined (sem preferência)');
      return undefined; // String vazia = sem preferência
    }
    
    const normalized = genderStr.toLowerCase();
    
    if (normalized === 'm') {
      console.log('🎤 [getVocalGenderForSuno] quiz.vocal_gender = m → retornando "m"');
      return 'm'; // Masculino
    }
    
    if (normalized === 'f') {
      console.log('🎤 [getVocalGenderForSuno] quiz.vocal_gender = f → retornando "f"');
      return 'f'; // Feminino
    }
    
    // String vazia ou qualquer outro valor = sem preferência
    console.log('🎤 [getVocalGenderForSuno] quiz.vocal_gender =', normalized, '→ retornando undefined (sem preferência)');
    return undefined;
  }
  
  // Sem preferência definida
  console.log('🎤 [getVocalGenderForSuno] Nenhuma preferência encontrada → retornando undefined');
  return undefined;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let job_id: string | undefined;
  
  try {
    console.log('=== Generate Audio Internal Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ CORREÇÃO: Parsing resiliente do body
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        job_id = (body && body.job_id) || undefined;
      } else {
        const raw = await req.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            job_id = parsed.job_id || undefined;
          } catch (_) {
            const url = new URL(req.url);
            job_id = url.searchParams.get('job_id') || undefined;
          }
        } else {
          const url = new URL(req.url);
          job_id = url.searchParams.get('job_id') || undefined;
        }
      }
    } catch (parseError) {
      console.error('❌ [GenerateAudioInternal] Erro ao fazer parse do body:', parseError);
      try {
        const url = new URL(req.url);
        job_id = url.searchParams.get('job_id') || undefined;
      } catch (_) {
        // Ignorar
      }
    }

    if (!job_id) {
      throw new Error('job_id é obrigatório');
    }

    console.log('Processing job:', job_id);

    // Buscar job com letra e quiz
    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .select('*, quizzes(*)')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job não encontrado: ${jobError?.message}`);
    }

    if (!job.gpt_lyrics) {
      throw new Error('Letra não encontrada no job');
    }

    // ✅ CORREÇÃO: Verificar se já existe uma requisição em andamento para o mesmo pedido
    // Isso previne múltiplas requisições simultâneas para a Suno do mesmo order_id
    const orderId = job.order_id;
    if (orderId) {
      const { data: existingJobs, error: checkError } = await supabaseClient
        .from('jobs')
        .select('id, status, suno_task_id')
        .eq('order_id', orderId)
        .in('status', ['audio_processing', 'generating_audio'])
        .neq('id', job_id); // Excluir o job atual da verificação
      
      if (checkError) {
        console.warn('⚠️ Erro ao verificar jobs existentes:', checkError);
      } else if (existingJobs && existingJobs.length > 0) {
        // Verificar se algum job tem suno_task_id (requisição já foi feita)
        const hasActiveRequest = existingJobs.some(j => j.suno_task_id && j.suno_task_id.trim() !== '');
        
        if (hasActiveRequest) {
          console.log('⚠️ [GenerateAudioInternal] Já existe uma requisição ativa para a Suno neste pedido:', {
            order_id: orderId,
            existing_jobs: existingJobs.map(j => ({ id: j.id, status: j.status, has_task_id: !!j.suno_task_id }))
          });
          
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Já existe uma requisição em andamento para a Suno neste pedido. Aguarde a conclusão antes de tentar novamente.',
              order_id: orderId,
              existing_job_ids: existingJobs.map(j => j.id)
            }),
            {
              headers: corsHeaders,
              status: 409 // Conflict
            }
          );
        }
      }
    }

    // ✅ CORREÇÃO: Verificar se o próprio job já tem suno_task_id (requisição já foi feita)
    if (job.suno_task_id && job.suno_task_id.trim() !== '') {
      console.log('⚠️ [GenerateAudioInternal] Este job já tem uma requisição ativa para a Suno:', {
        job_id: job_id,
        suno_task_id: job.suno_task_id,
        status: job.status
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Este job já possui uma requisição ativa para a Suno. Aguarde a conclusão antes de tentar novamente.',
          job_id: job_id,
          suno_task_id: job.suno_task_id
        }),
        {
          headers: corsHeaders,
          status: 409 // Conflict
        }
      );
    }

    const lyrics = job.gpt_lyrics;
    // quizzes(*) retorna um array, pegar o primeiro elemento
    const quiz = Array.isArray(job.quizzes) ? job.quizzes[0] : job.quizzes;
    if (!quiz) {
      throw new Error('Quiz não encontrado para este job');
    }

    // Buscar lyrics_approvals para obter o campo voice (preferência do admin)
    // ✅ CORREÇÃO CRÍTICA: Buscar a approval mais recente que tenha voice definido
    // IMPORTANTE: Buscar por job_id E order_id para garantir que pegamos a approval correta
    // orderId já foi definido acima na verificação de duplicatas
    const { data: approvals, error: approvalError } = await supabaseClient
      .from('lyrics_approvals')
      .select('id, voice, status, created_at, updated_at, job_id, order_id')
      .eq('job_id', job_id)
      .order('updated_at', { ascending: false }); // Ordenar por updated_at para pegar a mais recentemente atualizada
    
    // Se não encontrou por job_id, tentar buscar por order_id também
    let approvalsByOrder: any[] = [];
    if ((!approvals || approvals.length === 0) && orderId) {
      const { data: orderApprovals } = await supabaseClient
        .from('lyrics_approvals')
        .select('id, voice, status, created_at, updated_at, job_id, order_id')
        .eq('order_id', orderId)
        .order('updated_at', { ascending: false });
      approvalsByOrder = orderApprovals || [];
    }
    
    // Combinar resultados, priorizando approvals por job_id
    const allApprovals = [...(approvals || []), ...approvalsByOrder.filter(a => !approvals?.some(ap => ap.id === a.id))];
    
    console.log('🔍 [DEBUG] Buscando approvals para job_id:', job_id, '| order_id:', orderId);
    console.log('🔍 [DEBUG] Total de approvals encontradas (job_id):', approvals?.length || 0);
    console.log('🔍 [DEBUG] Total de approvals encontradas (order_id):', approvalsByOrder.length);
    console.log('🔍 [DEBUG] Total de approvals combinadas:', allApprovals.length);
    
    if (allApprovals.length > 0) {
      console.log('🔍 [DEBUG] Detalhes de TODAS as approvals encontradas:');
      allApprovals.forEach((a, idx) => {
        console.log(`   ${idx + 1}. ID: ${a.id?.substring(0, 8)}... | Status: ${a.status} | Voice: ${a.voice || 'NULL'} | Updated: ${a.updated_at} | Job: ${a.job_id?.substring(0, 8)}... | Order: ${a.order_id?.substring(0, 8)}...`);
      });
    }
    
    // ✅ CORREÇÃO CRÍTICA: Priorizar approval que tenha voice definido (M, F ou S)
    // IMPORTANTE: Se houver uma approval aprovada mas outra mais recente com voice atualizado, usar a mais recente
    // Prioridade: 1) approval mais recente com voice='F' ou 'M' (independente de status), 2) approved com voice, 3) pending com voice, 4) approved sem voice, 5) mais recente
    let approval = null;
    if (allApprovals.length > 0) {
      // ✅ NOVA LÓGICA MELHORADA: Primeiro, buscar a approval mais recente que tenha voice definido (F, M ou S)
      // Ordenar por updated_at DESC para pegar a mais recente primeiro
      const sortedByUpdated = [...allApprovals].sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA; // Mais recente primeiro
      });
      
      // Buscar a mais recente com voice válido (F, M ou S)
      // ✅ CORREÇÃO: Verificar se voice não é null, undefined, ou string vazia
      const mostRecentWithVoice = sortedByUpdated.find(a => {
        if (!a.voice) return false; // Se voice é null/undefined, ignorar
        const voice = String(a.voice).trim().toUpperCase();
        return voice === 'F' || voice === 'M' || voice === 'S';
      });
      
      if (mostRecentWithVoice) {
        approval = mostRecentWithVoice;
        console.log('✅✅✅ [DEBUG] Usando approval MAIS RECENTE com voice válido:', {
          id: approval.id,
          status: approval.status,
          voice: approval.voice,
          voice_raw: JSON.stringify(approval.voice),
          updated_at: approval.updated_at,
          job_id: approval.job_id?.substring(0, 8),
          order_id: approval.order_id?.substring(0, 8)
        });
      } else {
        // Fallback: buscar approved com voice válido
        const approvedWithVoice = sortedByUpdated.find(a => {
          if (a.status !== 'approved' || !a.voice) return false;
          const voice = String(a.voice).trim().toUpperCase();
          return voice === 'F' || voice === 'M' || voice === 'S';
        });
        if (approvedWithVoice) {
          approval = approvedWithVoice;
          console.log('✅ [DEBUG] Usando approval APROVADA com voice:', approvedWithVoice.id, '| Voice:', approvedWithVoice.voice, '| Voice RAW:', JSON.stringify(approvedWithVoice.voice));
        } else {
          // Fallback: buscar pending com voice válido
          const pendingWithVoice = sortedByUpdated.find(a => {
            if (a.status !== 'pending' || !a.voice) return false;
            const voice = String(a.voice).trim().toUpperCase();
            return voice === 'F' || voice === 'M' || voice === 'S';
          });
          if (pendingWithVoice) {
            approval = pendingWithVoice;
            console.log('✅ [DEBUG] Usando approval PENDENTE com voice:', pendingWithVoice.id, '| Voice:', pendingWithVoice.voice, '| Voice RAW:', JSON.stringify(pendingWithVoice.voice));
          } else {
            // Fallback: buscar approved sem voice
            const approved = sortedByUpdated.find(a => a.status === 'approved');
            if (approved) {
              approval = approved;
              console.log('⚠️  [DEBUG] Usando approval APROVADA sem voice (fallback):', approved.id);
            } else if (sortedByUpdated.length > 0) {
              // Último fallback: usar a mais recente
              approval = sortedByUpdated[0];
              console.log('⚠️  [DEBUG] Usando approval mais recente:', sortedByUpdated[0].id, '| Voice:', sortedByUpdated[0].voice || 'NULL');
            }
          }
        }
      }
    }
    
    if (approvalError) {
      console.error('❌ [DEBUG] Erro ao buscar approvals:', approvalError);
    }

    console.log('📋 Job details:', {
      job_id,
      has_lyrics: !!lyrics,
      has_quiz: !!quiz,
      music_prompt: quiz?.music_prompt?.substring(0, 100) + '...',
      approval_id: approval?.id,
      approval_voice: approval?.voice,
      approval_status: approval?.status,
      approval_updated_at: approval?.updated_at,
      quiz_vocal_gender: quiz?.vocal_gender,
      quiz_vocal_gender_type: typeof quiz?.vocal_gender,
      quiz_vocal_gender_raw: JSON.stringify(quiz?.vocal_gender)
    });
    
    // ✅ VERIFICAÇÃO CRÍTICA: Garantir que vocal_gender está sendo lido do quiz
    if (!quiz) {
      console.error('❌❌❌ ERRO CRÍTICO: Quiz não encontrado!');
    } else {
      console.log('✅ Quiz encontrado:', {
        quiz_id: quiz.id,
        about_who: quiz.about_who,
        vocal_gender: quiz.vocal_gender,
        vocal_gender_type: typeof quiz.vocal_gender,
        vocal_gender_is_null: quiz.vocal_gender === null,
        vocal_gender_is_undefined: quiz.vocal_gender === undefined,
        vocal_gender_is_empty: quiz.vocal_gender === '',
        vocal_gender_trimmed: quiz.vocal_gender ? String(quiz.vocal_gender).trim() : 'N/A'
      });
    }
    
    // 🎤 Determinar vocalGender para enviar à Suno usando função helper profissional
    // Documentação Suno: vocalGender aceita apenas 'm' ou 'f' (minúsculas) - https://docs.sunoapi.org/suno-api/generate-music
    
    // ✅ VERIFICAÇÃO ANTES DE CHAMAR A FUNÇÃO
    console.log('🎤🎤🎤 ANTES DE CHAMAR getVocalGenderForSuno 🎤🎤🎤');
    console.log('🎤 approval?.voice:', approval?.voice, '(tipo:', typeof approval?.voice, ')');
    console.log('🎤 quiz?.vocal_gender:', quiz?.vocal_gender, '(tipo:', typeof quiz?.vocal_gender, ')');
    console.log('🎤 quiz?.vocal_gender (JSON):', JSON.stringify(quiz?.vocal_gender));
    
    const vocalGenderForSuno = getVocalGenderForSuno(approval?.voice, quiz?.vocal_gender);
    
    // ✅ VERIFICAÇÃO APÓS CHAMAR A FUNÇÃO
    console.log('🎤🎤🎤 APÓS CHAMAR getVocalGenderForSuno 🎤🎤🎤');
    console.log('🎤 Resultado vocalGenderForSuno:', vocalGenderForSuno, '(tipo:', typeof vocalGenderForSuno, ')');
    
    console.log('🎤🎤🎤 [DEBUG] Processando voz para Suno 🎤🎤🎤');
    console.log('🎤 approval encontrada?', approval ? '✅ SIM' : '❌ NÃO');
    if (approval) {
      console.log('🎤 approval.id:', approval.id);
      console.log('🎤 approval.status:', approval.status);
      console.log('🎤 approval.voice (RAW):', JSON.stringify(approval.voice));
      console.log('🎤 approval.voice (tipo):', typeof approval.voice);
      console.log('🎤 approval.voice (trimmed):', approval.voice ? String(approval.voice).trim() : 'NULL');
    }
    console.log('🎤 quiz.vocal_gender (RAW):', JSON.stringify(quiz?.vocal_gender || 'não definido'));
    console.log('🎤 vocalGenderForSuno (resultado):', vocalGenderForSuno || 'undefined (sem preferência)');
    console.log('🎤 Será enviado para Suno?', vocalGenderForSuno ? `✅ SIM (${vocalGenderForSuno === 'm' ? 'Masculino' : 'Feminino'})` : '❌ NÃO (Suno escolherá automaticamente)');

    // Atualizar status para audio_processing
    await supabaseClient
      .from('jobs')
      .update({ 
        status: 'audio_processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', job_id);

    // Preparar payload para Suno
    const sunoApiKey = Deno.env.get('SUNO_API_KEY');
    if (!sunoApiKey) {
      throw new Error('SUNO_API_KEY não configurado');
    }

    // Extrair letra do job
    const lyricsText = lyrics.lyrics || job.gpt_lyrics?.lyrics || '';
    
    // ✅ Validar que a letra contém apenas os marcadores esperados
    const hasOnlyLyrics = /^\[Verse 1\][\s\S]*\[Chorus\][\s\S]*\[Verse 2\][\s\S]*\[Bridge\][\s\S]*$/.test(lyricsText);
    if (!hasOnlyLyrics) {
      console.warn('⚠️ Letra pode conter instruções técnicas misturadas');
    }

    // ✅ Remover qualquer linha que comece com instruções técnicas (ex: "BPM:", "Tom:", "Duração:")
    const cleanedLyrics = lyricsText
      .split('\n')
      .filter((line: string) => !line.match(/^(BPM|Tom|Duração|Instrumental|Vocal|Estrutura):/i))
      .join('\n');

    console.log('🧹 Letra após limpeza (200 chars):', cleanedLyrics.substring(0, 200) + '...');
    
    // ✅ Style SIMPLES: mapear estilo do cliente para formato da Suno + características emocionais básicas
    const baseStyle = mapStyleToSuno(quiz.style);
    // ✅ Style simples: apenas o estilo do quiz + características emocionais básicas
    // NÃO adicionar descrições de voz em inglês - usar apenas o campo vocalGender
    let emotionalStyle = `${baseStyle}, emotional, slow, romantic, acoustic`;
    
    // ✅ Validar tamanho do style (máximo 1000 chars para V4_5PLUS conforme documentação)
    if (emotionalStyle.length > 1000) {
      console.warn(`⚠️ Style muito longo (${emotionalStyle.length} chars). Máximo 1000 para V4_5PLUS. Truncando...`);
      emotionalStyle = emotionalStyle.substring(0, 1000);
    }
    
    // ✅ Prompt: APENAS a letra limpa, SEM descrições de voz em inglês
    // A voz é controlada exclusivamente pelo campo vocalGender no payload
    let formattedLyrics = cleanedLyrics;
    
    if (vocalGenderForSuno === 'f' || vocalGenderForSuno === 'm') {
      console.log(`🎤 Usando apenas campo vocalGender="${vocalGenderForSuno}" - sem adicionar descrições em inglês no prompt`);
    } else {
      console.log('🎤 Sem preferência de voz - usando apenas letra limpa (vocalGender não será enviado)');
    }

    // ✅ CORREÇÃO: Aplicar correção fonética para nomes Ge/Gi
    formattedLyrics = fixGeGiPronunciation(formattedLyrics);
    console.log('🔤 Correção fonética Ge/Gi aplicada');

    // ✅ Validar tamanho da letra (máximo 5000 chars para V4_5PLUS conforme documentação)
    if (formattedLyrics.length > 5000) {
      throw new Error(`Letra muito longa (${formattedLyrics.length} chars). Máximo 5000 para V4_5PLUS.`);
    }

    console.log('📝 Letra limpa (primeiros 300 chars):', formattedLyrics.substring(0, 300) + '...');
    console.log('📏 Tamanho da letra:', formattedLyrics.length, 'caracteres');
    console.log('🎨 Estilo emocional:', emotionalStyle);

    // ✅ ATUALIZAÇÃO: Preparar callBackUrl conforme nova API Suno
    // A URL deve ser acessível publicamente e responder em até 15 segundos
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL não configurado');
    }
    // ✅ CORREÇÃO: Usar formato correto da URL do Supabase Edge Functions
    // Formato: https://[project-ref].supabase.co/functions/v1/[function-name]
    const callbackUrl = `${supabaseUrl}/functions/v1/suno-callback`;

    // ✅ CONSTRUIR PAYLOAD COM vocalGender JÁ INCLUÍDO (se houver)
    // Documentação Suno: vocalGender aceita apenas "m" ou "f" (strings minúsculas)
    // IMPORTANTE: O prompt contém APENAS a letra limpa, SEM descrições de voz em inglês
    // A voz é controlada exclusivamente pelo campo vocalGender no payload
    const payload: any = {
      title: lyrics.title || job.gpt_lyrics?.title || 'Música Personalizada',
      style: emotionalStyle,  // ✅ Estilo simples e direto (sem descrições de voz em inglês)
      prompt: formattedLyrics,  // ✅ APENAS letra limpa, SEM descrições de voz em inglês
      customMode: true,  // ✅ OBRIGATÓRIO: customMode=true para respeitar melhor o vocalGender
      instrumental: false,
      model: 'V4_5PLUS', // ✅ V4_5PLUS: richer sound, new ways to create, max 8 min
      callBackUrl: callbackUrl
    };
    
    // ✅ ADICIONAR vocalGender ao payload APENAS se houver preferência válida
    // A função getVocalGenderForSuno já garante que retorna apenas 'm', 'f' ou undefined
    // Documentação: enum<string> - Available options: m, f (opcional)
    if (vocalGenderForSuno === 'm' || vocalGenderForSuno === 'f') {
      payload.vocalGender = vocalGenderForSuno; // ✅ Adicionar ao payload (já está validado e no formato correto)
      console.log('🎤✅ vocalGender ADICIONADO ao payload:', vocalGenderForSuno, `(${vocalGenderForSuno === 'm' ? 'Masculino' : 'Feminino'})`);
    } else {
      // Não adicionar o campo se não houver preferência (Suno escolherá automaticamente)
      console.log('🎤 Campo vocalGender NÃO será enviado - Suno escolherá automaticamente');
    }
    
    console.log('🔒 MODELO DEFINIDO NO PAYLOAD:', payload.model);

    // VERIFICAÇÃO FINAL: Garantir que o modelo está correto antes de enviar
    if (payload.model !== 'V4_5PLUS') {
      console.error('❌ ERRO CRÍTICO: Modelo incorreto no payload!', payload.model);
      payload.model = 'V4_5PLUS';
      console.log('✅ Modelo corrigido para V4_5PLUS');
    }
    
    // Log final do modelo antes de enviar
    console.log('🔒🔒🔒 VERIFICAÇÃO FINAL DO MODELO 🔒🔒🔒');
    console.log('🔒 Modelo no payload ANTES do envio:', JSON.stringify(payload.model));
    console.log('🔒 É V4_5PLUS?', payload.model === 'V4_5PLUS' ? '✅ SIM' : '❌ NÃO');
    
    // 🎤 VERIFICAÇÃO FINAL DA PREFERÊNCIA DE VOZ
    console.log('🎤🎤🎤 VERIFICAÇÃO FINAL DA PREFERÊNCIA DE VOZ 🎤🎤🎤');
    console.log('🎤 approval.voice:', approval?.voice || 'não definido');
    console.log('🎤 quiz.vocal_gender:', quiz?.vocal_gender || 'não definido');
    console.log('🎤 vocalGenderForSuno (determinado):', vocalGenderForSuno || 'undefined');
    console.log('🎤 vocalGender no payload:', payload.vocalGender || 'NÃO ENVIADO (Suno escolherá automaticamente)');
    console.log('🎤 Status final:', payload.vocalGender ? `✅ Preferência definida (${payload.vocalGender === 'm' ? 'Masculino' : 'Feminino'})` : '✅ Sem preferência (Suno escolherá)');
    
    console.log('🎵 Payload COMPLETO para Suno:', JSON.stringify(payload, null, 2));
    console.log('🔒 MODELO CONFIRMADO:', payload.model, '(DEVE SER V4_5PLUS)');
    console.log('📝 Preview da letra (200 chars):', formattedLyrics.substring(0, 200) + '...');
    console.log('📞 Callback URL:', callbackUrl);
    
    // ✅ VERIFICAÇÃO FINAL: Garantir consistência entre vocalGenderForSuno e payload
    // A lógica já garante que só adiciona ao payload se for válido, mas vamos verificar por segurança
    if (vocalGenderForSuno === 'm' || vocalGenderForSuno === 'f') {
      if (!payload.vocalGender || payload.vocalGender !== vocalGenderForSuno) {
        console.error('❌ INCONSISTÊNCIA DETECTADA: Corrigindo vocalGender no payload');
        payload.vocalGender = vocalGenderForSuno;
      }
      console.log('✅ vocalGender confirmado no payload:', payload.vocalGender);
    } else {
      // Garantir que o campo não está no payload se não há preferência
      if (payload.vocalGender) {
        console.warn('⚠️ Removendo vocalGender inválido do payload');
        delete payload.vocalGender;
      }
      console.log('✅ Campo vocalGender não será enviado (sem preferência)');
    }

    // ✅ LOG FINAL ANTES DO ENVIO - Verificar payload completo
    console.log('🚀🚀🚀 ENVIANDO PARA SUNO API 🚀🚀🚀');
    console.log('🌐 URL: https://api.sunoapi.org/api/v1/generate');
    console.log('📦 Payload COMPLETO (JSON):', JSON.stringify(payload, null, 2));
    console.log('🎤 vocalGender no payload:', payload.vocalGender || 'NÃO ENVIADO');
    console.log('🎤 Tipo do vocalGender:', typeof payload.vocalGender);
    console.log('🎤 Valor exato:', JSON.stringify(payload.vocalGender));
    
    // ✅ VERIFICAÇÃO FINAL CRÍTICA: Garantir que o vocalGender está correto antes de enviar
    // IMPORTANTE: Se approval.voice = 'S' (sem preferência), NÃO enviar o campo, mesmo que quiz tenha valor
    // A função getVocalGenderForSuno já prioriza approval.voice sobre quiz.vocal_gender
    // Esta verificação só serve para garantir consistência, não para sobrescrever a lógica
    if (vocalGenderForSuno === 'm' || vocalGenderForSuno === 'f') {
      // Só verificar se há preferência válida
      if (!payload.vocalGender || payload.vocalGender !== vocalGenderForSuno) {
        console.warn('⚠️⚠️⚠️ ATENÇÃO: vocalGender não está consistente no payload!');
        console.warn('⚠️ vocalGenderForSuno:', vocalGenderForSuno);
        console.warn('⚠️ payload.vocalGender:', payload.vocalGender);
        console.warn('⚠️ Corrigindo...');
        payload.vocalGender = vocalGenderForSuno;
        console.log('✅ vocalGender corrigido no payload:', payload.vocalGender);
      } else {
        console.log('✅✅✅ CONFIRMADO: vocalGender está correto no payload:', payload.vocalGender);
      }
    } else {
      // Sem preferência: garantir que o campo não está no payload
      if (payload.vocalGender) {
        console.warn('⚠️ Removendo vocalGender do payload (sem preferência)');
        delete payload.vocalGender;
      }
      console.log('✅ Campo vocalGender não será enviado (sem preferência - Suno escolherá automaticamente)');
    }
    
    const response = await fetch('https://api.sunoapi.org/api/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sunoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('📥 Suno Response Status:', response.status);
    console.log('📥 Suno Response Body:', responseText);
    
    // ✅ LOG DA RESPOSTA - Verificar se a voz foi respeitada
    try {
      const responseData = JSON.parse(responseText);
      console.log('📥 Suno Response parsed:', JSON.stringify(responseData, null, 2));
      
      // ✅ VERIFICAÇÃO CRÍTICA: Confirmar que a voz foi respeitada
      console.log('🎤🎤🎤 VERIFICAÇÃO DA RESPOSTA DA SUNO 🎤🎤🎤');
      console.log('🎤 vocalGender enviado no payload:', payload.vocalGender || 'NÃO ENVIADO');
      console.log('🎤 Modelo de voz retornado pela Suno (mv):', responseData.data?.mv || 'NÃO RETORNADO');
      
      if (responseData.data?.mv) {
        const mvModel = responseData.data.mv;
        console.log('🎤 Modelo completo retornado:', mvModel);
        
        // Verificar se o modelo corresponde à voz solicitada
        if (payload.vocalGender === 'f') {
          // Para voz feminina, verificar se o modelo contém indicadores femininos
          const isFemaleModel = mvModel.includes('female') || mvModel.includes('woman') || mvModel.includes('girl') || 
                                mvModel.includes('chirp') && (mvModel.includes('bluejay') || mvModel.includes('canary'));
          if (!isFemaleModel) {
            console.error('❌❌❌ PROBLEMA DETECTADO: Solicitado voz feminina (f) mas modelo retornado pode não ser feminino:', mvModel);
            console.error('❌ Isso pode indicar que a Suno não está respeitando o vocalGender enviado');
          } else {
            console.log('✅ Modelo retornado parece ser feminino:', mvModel);
          }
        } else if (payload.vocalGender === 'm') {
          // Para voz masculina, verificar se o modelo contém indicadores masculinos
          const isMaleModel = mvModel.includes('male') || mvModel.includes('man') || mvModel.includes('boy');
          if (!isMaleModel) {
            console.warn('⚠️⚠️⚠️ ATENÇÃO: Solicitado voz masculina (m) mas modelo retornado pode não ser masculino:', mvModel);
          } else {
            console.log('✅ Modelo retornado parece ser masculino:', mvModel);
          }
        } else {
          console.log('🎤 Nenhuma preferência de voz foi enviada - Suno escolheu automaticamente:', mvModel);
        }
      } else {
        console.warn('⚠️ Resposta da Suno não contém campo mv (modelo de voz)');
      }
    } catch (e) {
      console.error('❌ Erro ao parsear resposta da Suno para verificação de voz:', e);
    }

    if (!response.ok) {
      console.error('❌ Suno API HTTP error:', response.status, responseText);
      let errorDetail = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorDetail = errorJson.detail || errorJson.message || errorJson.msg || responseText;
      } catch (e) {
        // Manter como texto
      }
      throw new Error(`Suno API error: ${response.status} - ${errorDetail}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Erro ao parsear resposta Suno:', e);
      throw new Error(`Resposta inválida da Suno: ${responseText}`);
    }

    console.log('✅ Suno Response parsed:', JSON.stringify(data, null, 2));
    
    // 🔍 INVESTIGAÇÃO: Procurar por "chirp" ou "v3-5" na resposta
    const responseString = JSON.stringify(data);
    if (responseString.includes('chirp') || responseString.includes('v3-5') || responseString.includes('V3_5')) {
      console.error('⚠️⚠️⚠️ DETECTOU "chirp" OU "v3-5" NA RESPOSTA DA SUNO (generate-audio-internal) ⚠️⚠️⚠️');
      console.error('📋 Resposta completa:', responseString);
      console.error('🔍 Detalhes do modelo enviado:', {
        modeloEnviado: payload.model,
        modeloResposta: data.model,
        temChirp: responseString.includes('chirp'),
        temV3_5: responseString.includes('v3-5') || responseString.includes('V3_5')
      });
    }

    // Verificar se a resposta contém um código de erro (mesmo que HTTP 200)
    if (data.code !== undefined && data.code !== 200 && data.code !== 0) {
      const errorMsg = data.msg || data.message || data.detail || 'Erro desconhecido da Suno API';
      console.error('❌ Suno API retornou código de erro:', data.code, errorMsg);
      throw new Error(`Suno API error (code ${data.code}): ${errorMsg}`);
    }

    // Verificar se há status de falha
    if (data.status === 'failure' || data.status === 'error' || data.status === 'FAILURE') {
      const errorMsg = data.msg || data.message || data.detail || data.error || 'Falha na geração';
      console.error('❌ Suno API retornou status de falha:', data.status, errorMsg);
      throw new Error(`Suno API failure: ${errorMsg}`);
    }

    // Suno retorna { code: 200, data: { taskId: "xxx" } } ou { taskId: "xxx" }
    const taskId = data.data?.taskId || data.data?.jobId || data.taskId || data.task_id || data.id || data.data?.id;
    
    if (!taskId) {
      console.error('❌ Suno não retornou taskId. Resposta completa:', JSON.stringify(data, null, 2));
      
      // Verificar se há mensagem de erro na resposta
      if (data.msg || data.message || data.error) {
        throw new Error(`Suno API: ${data.msg || data.message || data.error}`);
      }
      
      throw new Error('Suno não retornou taskId válido. Resposta: ' + JSON.stringify(data));
    }

    console.log('✅ Task ID obtido:', taskId);

    // ✅ NOTA: Créditos são descontados quando o card de lyrics é criado (não aqui)
    // O desconto acontece em: admin-create-new-music e generate-lyrics-for-approval
    console.log('ℹ️ [CRÉDITOS] Créditos já foram descontados quando o card de lyrics foi criado');

    // ✅ CORREÇÃO CRÍTICA: Salvar task ID no job e verificar se foi salvo
    const { error: updateError, data: updatedJob } = await supabaseClient
      .from('jobs')
      .update({
        suno_task_id: taskId,
        status: 'audio_processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', job_id)
      .select('suno_task_id')
      .single();

    if (updateError) {
      console.error('❌ ERRO CRÍTICO: Falha ao salvar suno_task_id no banco:', updateError);
      throw new Error(`Falha ao salvar suno_task_id: ${updateError.message}`);
    }

    // Verificar se foi realmente salvo
    if (!updatedJob?.suno_task_id || updatedJob.suno_task_id !== taskId) {
      console.error('❌ ERRO CRÍTICO: suno_task_id não foi salvo corretamente!');
      console.error('   Task ID obtido:', taskId);
      console.error('   Task ID salvo:', updatedJob?.suno_task_id);
      throw new Error('Falha crítica: suno_task_id não foi salvo no banco de dados');
    }

    console.log('✅ Task ID salvo e confirmado:', taskId);

    return new Response(
      JSON.stringify({
        success: true,
        task_id: taskId,
        job_id: job_id
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error in generate-audio-internal:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Atualizar job para failed se tiver job_id
    if (job_id) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseClient
          .from('jobs')
          .update({
            status: 'failed',
            error: error.message || 'Erro ao gerar áudio',
            updated_at: new Date().toISOString()
          })
          .eq('id', job_id);
      } catch (updateError) {
        console.error('❌ Erro ao atualizar job para failed:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido ao gerar áudio',
        details: error.details || null
      }),
      {
        headers: corsHeaders,
        status: 500,
      }
    );
  }
});
