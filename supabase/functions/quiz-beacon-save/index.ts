/**
 * Edge Function: quiz-beacon-save
 * 
 * Recebe quiz via sendBeacon (navigator.sendBeacon) antes de fechar a página
 * Faz UPSERT por session_id para garantir que quiz não seja perdido
 * 
 * Esta função é chamada de forma assíncrona (fire-and-forget) pelo navegador
 * quando a página está sendo fechada, então deve ser rápida e não bloquear
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { isValidUUID } from "../_shared/error-handler.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  // sendBeacon sempre usa POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', method: req.method }),
      { status: 405, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Criar cliente Supabase com service role key (bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [quiz-beacon-save] Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ ok: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Parse do body (pode vir como Blob ou JSON)
    let body: any;
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await req.json();
      } else {
        // Se vier como Blob, tentar ler como texto e fazer parse
        const text = await req.text();
        body = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('❌ [quiz-beacon-save] Erro ao fazer parse do body:', parseError);
      // Retornar 200 OK mesmo com erro de parse (sendBeacon não espera resposta)
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid JSON' }),
        { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      session_id,
      answers,
      about_who,
      relationship,
      occasion,
      style,
      language,
      vocal_gender,
      message,
      customer_email,
      customer_whatsapp
    } = body;

    // Validar session_id (obrigatório)
    if (!session_id || !isValidUUID(session_id)) {
      console.warn('⚠️ [quiz-beacon-save] session_id inválido ou ausente:', session_id);
      // Retornar 200 OK mesmo com erro (sendBeacon não espera resposta)
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid session_id' }),
        { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar dados mínimos do quiz
    if (!answers && !about_who && !style) {
      console.warn('⚠️ [quiz-beacon-save] Quiz sem dados mínimos');
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing quiz data' }),
        { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar payload para UPSERT
    // Usar estrutura completa do quiz conforme tabela quizzes
    const quizPayload: any = {
      session_id,
      answers: answers || {},
      user_id: null,
      customer_email: customer_email || null,
      customer_whatsapp: customer_whatsapp || null,
    };

    // Adicionar apenas os 6 campos do novo padrão de quiz
    if (about_who) quizPayload.about_who = about_who;
    if (relationship) quizPayload.relationship = relationship;
    if (occasion) quizPayload.occasion = occasion;
    if (style) quizPayload.style = style;
    if (vocal_gender !== undefined) quizPayload.vocal_gender = vocal_gender;
    if (message) quizPayload.message = message;
    if (language) quizPayload.language = language;
    // Campos legados: sempre null no novo padrão
    quizPayload.qualities = null;
    quizPayload.memories = null;
    quizPayload.key_moments = null;
    quizPayload.desired_tone = null;

    // Garantir que answers tenha session_id
    if (!quizPayload.answers.session_id) {
      quizPayload.answers.session_id = session_id;
    }

    // Fazer UPSERT por session_id
    const { data, error } = await supabaseClient
      .from('quizzes')
      .upsert(quizPayload, {
        onConflict: 'session_id',
        ignoreDuplicates: false // Atualiza se já existe
      })
      .select('id, session_id')
      .single();

    if (error) {
      console.error('❌ [quiz-beacon-save] Erro ao fazer UPSERT:', {
        error: error.message,
        code: error.code,
        session_id
      });
      // Retornar 200 OK mesmo com erro (sendBeacon não espera resposta)
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [quiz-beacon-save] Quiz salvo via sendBeacon:', {
      quiz_id: data?.id,
      session_id: data?.session_id
    });

    // Retornar 200 OK rapidamente (sendBeacon não espera resposta, mas é bom retornar)
    return new Response(
      JSON.stringify({ ok: true, quiz_id: data?.id }),
      { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [quiz-beacon-save] Erro inesperado:', error);
    // Retornar 200 OK mesmo com erro (sendBeacon não espera resposta)
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || 'Unknown error' }),
      { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

