import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se é admin
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

    const { 
      lyrics, 
      title, 
      style, 
      custom_prompt,
      negativeTags,
      vocalGender,
      styleWeight,
      weirdnessConstraint,
      audioWeight,
      model: receivedModel
    } = await req.json();

    // USAR V4_5PLUS - richer sound, new ways to create, max 8 min (segundo docs.sunoapi.org)
    const model = 'V4_5PLUS';
    
    if (receivedModel && receivedModel !== 'V4_5PLUS') {
      console.warn(`⚠️ Modelo recebido (${receivedModel}) ignorado. Usando V4_5PLUS.`);
    }

    console.log('🎵 Gerando áudio usando Suno API...');
    console.log('📊 Dados recebidos:', {
      has_lyrics: !!lyrics,
      title: title,
      style: style,
      model: model, // Sempre V4_5PLUS
      model_received: receivedModel,
      has_negative_tags: !!negativeTags,
      vocal_gender: vocalGender,
      style_weight: styleWeight,
      weirdness_constraint: weirdnessConstraint,
      audio_weight: audioWeight
    });

    const sunoApiKey = Deno.env.get('SUNO_API_KEY');
    if (!sunoApiKey) {
      console.error('❌ SUNO_API_KEY não configurada');
      throw new Error('SUNO_API_KEY não configurada. Configure em Settings > Functions no Supabase.');
    }

    console.log('🔑 SUNO_API_KEY configurada:', sunoApiKey.substring(0, 8) + '...' + sunoApiKey.slice(-4));

    // Formatar letra para Suno com tags estruturais
    let formattedLyrics = '';
    console.log('📝 Formatando letra para Suno...');
    
    if (Array.isArray(lyrics)) {
      console.log('📋 Processando array de verses:', lyrics.length);
      formattedLyrics = lyrics.map((verse: any, index: number) => {
        console.log(`📄 Verso ${index}:`, { type: verse.type, text_length: verse.text?.length || 0 });
        
        if (verse.type === 'chorus') {
          return `[Chorus]\n${verse.text}`;
        } else if (verse.type === 'verse') {
          return `[Verse]\n${verse.text}`;
        } else if (verse.type === 'bridge') {
          return `[Bridge]\n${verse.text}`;
        }
        return verse.text;
      }).join('\n\n');
    } else if (typeof lyrics === 'string') {
      console.log('📄 Processando letra como string');
      formattedLyrics = lyrics;
    } else {
      console.error('❌ Formato de letra inválido:', typeof lyrics);
      throw new Error('Formato de letra inválido. Deve ser array ou string.');
    }

    console.log('📊 Letra formatada:', {
      length: formattedLyrics.length,
      lines: formattedLyrics.split('\n').length,
      has_chorus: formattedLyrics.includes('[Chorus]'),
      has_verse: formattedLyrics.includes('[Verse]')
    });

    // Validar que a letra não está vazia
    if (!formattedLyrics || formattedLyrics.trim().length === 0) {
      console.error('❌ Letra vazia após formatação');
      throw new Error('Letra vazia após formatação');
    }

    // Validar tamanho mínimo
    if (formattedLyrics.trim().length < 50) {
      console.warn('⚠️ Letra muito curta:', formattedLyrics.trim().length);
    }

    // Criar prompt final - IMPORTANTE: NÃO incluir [${style}] no prompt
    // O estilo vai APENAS no campo "tags"
    let finalPrompt = '';
    if (custom_prompt && custom_prompt.trim().length > 0) {
      finalPrompt = custom_prompt;
    } else {
      finalPrompt = formattedLyrics; // Apenas a letra, sem estilo
    }

    // ✅ CORREÇÃO: Aplicar correção fonética para nomes Ge/Gi
    finalPrompt = fixGeGiPronunciation(finalPrompt);
    console.log('🔤 Correção fonética Ge/Gi aplicada');

    console.log('📊 Stats da letra:', {
      caracteres: finalPrompt.length,
      linhas: finalPrompt.split('\n').length,
      temChorus: finalPrompt.includes('[Chorus]'),
      temVerse: finalPrompt.includes('[Verse]')
    });

    // Payload com campos obrigatórios e opcionais
    // USAR V4_5PLUS - richer sound, new ways to create, max 8 min (segundo docs.sunoapi.org)
    let sunoStyle = mapStyleToSuno(style);
    
    // ✅ NÃO adicionar instruções em inglês - usar apenas o campo vocalGender para controlar a voz
    // A correção fonética Ge/Gi já é aplicada no finalPrompt via fixGeGiPronunciation
    
    const payload: any = {
      prompt: finalPrompt,  // ✅ APENAS letra limpa, SEM descrições de voz em inglês
      style: sunoStyle,  // ✅ Estilo sem descrições de voz em inglês
      title: title,
      customMode: true,
      instrumental: false,
      model: 'V4_5PLUS' // V4_5PLUS: richer sound, new ways to create, max 8 min
    };
    
    console.log('🔒 Modelo fixo para V4_5PLUS (modelo recebido foi ignorado)');

    // Adicionar campos opcionais
    if (negativeTags) {
      payload.negativeTags = negativeTags;
    }
    // Adicionar vocalGender apenas se houver preferência (m ou f)
    // Documentação Suno: vocalGender aceita apenas 'm' ou 'f' (minúsculas) - https://docs.sunoapi.org/suno-api/generate-music
    // Se não houver preferência (vazio ou null), não enviar o campo (a Suno escolhe automaticamente)
    let vocalGenderForSuno: string | undefined;
    if (vocalGender) {
      const normalized = vocalGender.trim().toLowerCase();
      if (normalized === 'm' || normalized === 'f') {
        vocalGenderForSuno = normalized; // ✅ Garantir minúscula conforme documentação Suno
      }
    }
    
    if (vocalGenderForSuno) {
      payload.vocalGender = vocalGenderForSuno;
      console.log('🎤 Preferência de voz enviada para Suno:', vocalGenderForSuno);
    } else {
      console.log('🎤 Sem preferência de voz - campo não será enviado (Suno escolherá automaticamente)');
    }
    if (styleWeight !== undefined) {
      payload.styleWeight = styleWeight;
    }
    if (weirdnessConstraint !== undefined) {
      payload.weirdnessConstraint = weirdnessConstraint;
    }
    if (audioWeight !== undefined) {
      payload.audioWeight = audioWeight;
    }

    // Callback URL - OBRIGATÓRIO pela API Suno
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL não configurada - callback URL obrigatório');
    }
    payload.callBackUrl = `${supabaseUrl}/functions/v1/suno-callback`;

    console.log('🎯 [SUNO] Iniciando geração de áudio', {
      timestamp: new Date().toISOString(),
      title: title,
      style: style,
      promptLength: finalPrompt.length,
      model: payload.model,
      customMode: payload.customMode,
      instrumental: payload.instrumental
    });

    console.log('📦 [GENERATE-AUDIO] Payload completo:', {
      title: payload.title,
      style: payload.style,
      model: payload.model,
      promptLength: payload.prompt.length,
      customMode: payload.customMode,
      instrumental: payload.instrumental,
      hasCallback: !!payload.callBackUrl,
      optionalFields: {
        negativeTags: !!payload.negativeTags,
        vocalGender: payload.vocalGender,
        styleWeight: payload.styleWeight,
        weirdnessConstraint: payload.weirdnessConstraint,
        audioWeight: payload.audioWeight
      }
    });

    // VERIFICAÇÃO FINAL: Garantir que o modelo está correto antes de enviar
    if (payload.model !== 'V4_5PLUS') {
      console.error('❌ ERRO CRÍTICO: Modelo incorreto no payload!', payload.model);
      payload.model = 'V4_5PLUS';
      console.log('✅ Modelo corrigido para V4_5PLUS');
    }
    
    // 🎤 VERIFICAÇÃO FINAL DA PREFERÊNCIA DE VOZ
    console.log('🎤🎤🎤 VERIFICAÇÃO FINAL DA PREFERÊNCIA DE VOZ 🎤🎤🎤');
    console.log('🎤 vocalGender recebido:', vocalGender);
    console.log('🎤 vocalGender no payload:', payload.vocalGender);
    console.log('🎤 Preferência de voz será enviada?', payload.vocalGender ? `✅ SIM (${payload.vocalGender})` : '❌ NÃO (Suno escolherá automaticamente)');
    
    console.log('📋 Payload Suno:', JSON.stringify(payload, null, 2));
    console.log('🔒 MODELO CONFIRMADO:', payload.model, '(DEVE SER V4_5PLUS)');
    console.log('🌐 URL:', 'https://api.sunoapi.org/api/v1/generate');

    // DEBUG MODE: Log detalhado da requisição
    console.log('🐛 DEBUG - Request Details:', {
      url: 'https://api.sunoapi.org/api/v1/generate',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + sunoApiKey.substring(0, 8) + '...' + sunoApiKey.slice(-4),
        'Content-Type': 'application/json'
      },
      payloadSize: JSON.stringify(payload).length,
      payloadKeys: Object.keys(payload),
      model: payload.model, // DEVE SER V4_5PLUS
      model_confirmed: payload.model === 'V4_5PLUS' ? '✅ CORRETO' : '❌ ERRADO',
      timestamp: new Date().toISOString()
    });

    const response = await fetch('https://api.sunoapi.org/api/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sunoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('📥 Resposta Suno recebida:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentLength: response.headers.get('content-length')
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // DEBUG MODE: Log detalhado da resposta de erro
      console.error('🐛 DEBUG - Error Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': response.headers.get('content-type'),
          'x-request-id': response.headers.get('x-request-id'),
          'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining')
        },
        bodyPreview: errorText.substring(0, 500),
        timestamp: new Date().toISOString()
      });
      
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
        console.error('📋 Erro JSON parseado:', errorJson);
      } catch (e) {
        console.error('📋 Erro como texto:', errorText);
        errorJson = { detail: errorText };
      }
      
      console.error('❌ Erro Suno detalhado:', {
        status: response.status,
        statusText: response.statusText,
        error: errorJson,
        timestamp: new Date().toISOString()
      });
      
      // Mensagens específicas por tipo de erro
      if (response.status === 401) {
        throw new Error('Token de autenticação inválido. Verifique se a SUNO_API_KEY está correta no Supabase.');
      } else if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const message = retryAfter ? 
          `Limite de requisições excedido. Tente novamente em ${retryAfter} segundos.` :
          'Limite de requisições excedido. Tente novamente em alguns minutos.';
        throw new Error(message);
      } else if (response.status === 402) {
        throw new Error('Créditos insuficientes na conta Suno. Adicione créditos em sunoapi.org/billing.');
      } else if (response.status === 400) {
        const detail = errorJson.detail || errorJson.message || errorText;
        throw new Error(`Requisição inválida: ${detail}`);
      } else if (response.status === 500) {
        throw new Error('Erro interno do servidor Suno. Tente novamente em alguns minutos.');
      } else if (response.status === 503) {
        throw new Error('Serviço temporariamente indisponível. Tente novamente em alguns minutos.');
      }
      
      const detail = errorJson.detail || errorJson.message || errorText;
      throw new Error(`Erro Suno (${response.status}): ${detail}`);
    }

    const result = await response.json();
    
    // 🔍 INVESTIGAÇÃO: Procurar por "chirp" ou "v3-5" na resposta
    const responseString = JSON.stringify(result);
    if (responseString.includes('chirp') || responseString.includes('v3-5') || responseString.includes('V3_5')) {
      console.error('⚠️⚠️⚠️ DETECTOU "chirp" OU "v3-5" NA RESPOSTA DA SUNO (admin-generate-audio) ⚠️⚠️⚠️');
      console.error('📋 Resposta completa:', responseString);
      console.error('🔍 Detalhes do modelo:', {
        modeloEnviado: payload.model,
        modeloResposta: result.model,
        temChirp: responseString.includes('chirp'),
        temV3_5: responseString.includes('v3-5') || responseString.includes('V3_5'),
        temDataModel: !!result.data?.model,
        temMv: !!result.mv
      });
    }
    
    // FASE 5: Validar estrutura da resposta - suportar taskId e jobId
    const taskId = result.data?.taskId || result.data?.jobId;
    
    console.log('📥 [SUNO] Resposta recebida', {
      status: response.status,
      code: result.code,
      responseStatus: result.status,
      hasTaskId: !!result.data?.taskId,
      hasJobId: !!result.data?.jobId,
      taskId: taskId
    });

    // FASE 2: Validar estrutura da resposta - suportar ambos os formatos
    if ((result.code === 200 || result.status === 'SUCCESS') && taskId) {
      console.log('✅ Áudio iniciado, taskId:', taskId);
      
      // ✅ NOTA: Créditos são descontados quando o card de lyrics é criado (não aqui)
      // O desconto acontece em: admin-create-new-music e generate-lyrics-for-approval
      console.log('ℹ️ [CRÉDITOS] Créditos já foram descontados quando o card de lyrics foi criado');
    } else {
      // Tratar erros com formato "code"
      if (result.code && result.code !== 200) {
        const errorMsg = result.msg || result.message || 'Erro desconhecido';
        console.error(`❌ API Error (code ${result.code}):`, errorMsg);
        throw new Error(`API Error (${result.code}): ${errorMsg}`);
      }
      
      console.error('❌ Suno retornou erro:', result);
      throw new Error(result.msg || result.message || 'Erro ao gerar música');
    }

    // Log da geração
    await supabase.from('admin_logs').insert({
      admin_user_id: user.id,
      action: 'generate_audio',
      target_table: 'admin_generation',
      changes: { title, style, task_id: taskId }
    });

    return new Response(JSON.stringify({ 
      task_id: taskId,
      message: 'Áudio em processamento'
    }), {
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error('❌ Erro em admin-generate-audio:', error);
    // Sempre retornar 200 com objeto de erro
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 200,
      headers: corsHeaders,
    });
  }
});
