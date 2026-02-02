/**
 * Edge Function: notify-music-ready-webhook
 * 
 * Notifica quando música está pronta
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { createErrorResponse, isValidUUID } from "../_shared/error-handler.ts";
import { withTimeout, TIMEOUTS } from "../_shared/timeout.ts";
import { withRetry, RETRY_CONFIGS } from "../_shared/retry.ts";

const corsHeaders = (origin: string | null) => ({
  ...getSecureHeaders(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // 🔒 Segurança: esta função é interna. Como `verify_jwt=false`, exigimos um segredo via header.
    const internalSecret = Deno.env.get('INTERNAL_EDGE_FUNCTION_SECRET') ?? '';
    const providedSecret = req.headers.get('x-internal-secret') ?? '';
    if (!internalSecret || providedSecret !== internalSecret) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // ✅ CORREÇÃO: Parsing resiliente do body
    let order_id: string | null = null;
    let song_id: string | null = null;
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        order_id = (body && body.order_id) || null;
        song_id = (body && body.song_id) || null;
      } else {
        const raw = await req.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            order_id = parsed.order_id || null;
            song_id = parsed.song_id || null;
          } catch (_) {
            const url = new URL(req.url);
            order_id = url.searchParams.get('order_id');
            song_id = url.searchParams.get('song_id');
          }
        } else {
          const url = new URL(req.url);
          order_id = url.searchParams.get('order_id');
          song_id = url.searchParams.get('song_id');
        }
      }
    } catch (parseError) {
      console.error('❌ [NotifyMusicReadyWebhook] Erro ao fazer parse do body:', parseError);
      try {
        const url = new URL(req.url);
        order_id = url.searchParams.get('order_id');
        song_id = url.searchParams.get('song_id');
      } catch (_) {
        // Ignorar
      }
    }

    // Validação de entrada
    if (!order_id) {
      const { response } = createErrorResponse(
        new Error('order_id é obrigatório'),
        'order_id é obrigatório',
        400,
        'MISSING_ORDER_ID'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // Validar formato UUID
    if (!isValidUUID(order_id)) {
      const { response } = createErrorResponse(
        new Error('order_id inválido'),
        'order_id deve ser um UUID válido',
        400,
        'INVALID_ORDER_ID'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    console.log('🎵 [NotifyMusicReadyWebhook] Processando música pronta:', { order_id, song_id });

    // Buscar dados do pedido com timeout e retry
    let order: any = null;
    let orderError: any = null;
    
    try {
      const queryPromise = supabaseClient
        .from('orders')
        .select('*, quizzes!orders_quiz_id_fkey(*)')
        .eq('id', order_id)
        .single() as Promise<{ data: any; error: any }>;
      
      const queryResult = await withRetry(
        async () => {
          return await withTimeout(
            queryPromise,
            TIMEOUTS.DATABASE_QUERY,
            'Timeout ao buscar pedido'
          );
        },
        RETRY_CONFIGS.DATABASE
      );
      
      if (queryResult.error) {
        throw queryResult.error;
      }
      
      order = queryResult.data;
    } catch (error) {
      orderError = error;
      console.error('❌ [NotifyMusicReadyWebhook] Erro ao buscar pedido:', orderError);
    }

    if (orderError || !order) {
      const { response } = createErrorResponse(
        orderError || new Error('Pedido não encontrado'),
        'Pedido não encontrado',
        404,
        'ORDER_NOT_FOUND'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // ✅ ETAPA 1: Buscar todas as músicas do pedido (suporta 2+ músicas)
    let songs: any[] = [];
    let songsError: any = null;
    
    try {
      // Buscar todas as músicas do pedido (sem filtro de status inicialmente)
      const songsPromise = supabaseClient
        .from('songs')
        .select('*')
        .eq('order_id', order_id)
        .order('variant_number', { ascending: true }) as Promise<{ data: any; error: any }>;
      
      const songsResult = await withRetry(
        async () => {
          return await withTimeout(
            songsPromise,
            TIMEOUTS.DATABASE_QUERY,
            'Timeout ao buscar músicas'
          );
        },
        RETRY_CONFIGS.DATABASE
      );
      
      if (songsResult.error) {
        throw songsResult.error;
      }
      
      songs = songsResult.data || [];
    } catch (error) {
      songsError = error;
      console.error('❌ [NotifyMusicReadyWebhook] Erro ao buscar músicas:', songsError);
    }

    // ✅ ETAPA 1: Validar que há pelo menos 1 música
    if (songsError || !songs || songs.length === 0) {
      const { response } = createErrorResponse(
        songsError || new Error('Nenhuma música encontrada'),
        songsError ? 'Erro ao buscar músicas' : 'Nenhuma música encontrada',
        404,
        'SONGS_NOT_FOUND'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // Usar as primeiras 2 músicas para compatibilidade (mas suporta mais)
    const song1 = songs[0];
    const song2 = songs[1] || songs[0]; // Se só tiver 1, usar a mesma

    // ✅ ETAPA 1: Validar que todas as músicas têm audio_url
    const songsWithoutAudio = songs.filter(s => !s.audio_url || s.audio_url.trim() === '');
    if (songsWithoutAudio.length > 0) {
      const { response } = createErrorResponse(
        new Error(`${songsWithoutAudio.length} música(s) ainda não possuem URL de áudio`),
        `${songsWithoutAudio.length} música(s) ainda não possuem URL de áudio`,
        400,
        'SONGS_MISSING_AUDIO_URL'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    console.log(`✅ [NotifyMusicReadyWebhook] Encontradas ${songs.length} música(s) com audio_url`);

    // ✅ REMOVIDO: Validação de WhatsApp removida

    // Validar que pedido tem magic_token
    if (!order.magic_token) {
      console.error('❌ [NotifyMusicReadyWebhook] Pedido sem magic_token');
      const { response } = createErrorResponse(
        new Error('Pedido sem magic_token'),
        'Pedido sem magic_token necessário para gerar links de download',
        500,
        'MISSING_MAGIC_TOKEN'
      );
      return new Response(response.body, {
        ...response,
        headers: { ...headers, ...response.headers },
      });
    }

    // ✅ REMOVIDO: Todo código de preparação de templates WhatsApp removido
    // Apenas envio de email agora

    // ==========================================
    // ✅ REMOVIDO: Envio de WhatsApp - apenas Email agora
    // ==========================================
    
    // ✅ REMOVIDO: Todo código de WhatsApp foi removido
    console.log('📧 [NotifyMusicReadyWebhook] Enviando apenas email (WhatsApp removido)');
    
    let emailResult: { success: boolean; error?: string; emailId?: string } = { success: false };
    
    // Enviar Email via send-email-with-variables (sempre)
    try {
      // Detectar idioma do quiz
      const quizLanguage = (order.quizzes as any)?.language || 'pt';
      
      console.log('📧 [NotifyMusicReadyWebhook] Enviando email de música pronta...');
      const { data: emailData, error: emailError } = await supabaseClient.functions.invoke('send-email-with-variables', {
        body: {
          template_type: 'music_released',
          order_id: order.id,
          song_id: song_id || songs[0]?.id,
          language: quizLanguage,
          to_email: order.customer_email,
        },
      });

      if (emailError) {
        console.error('❌ [NotifyMusicReadyWebhook] Erro ao chamar send-email-with-variables:', emailError);
        emailResult = { success: false, error: emailError.message };
      } else if (emailData?.success) {
        console.log('✅ [NotifyMusicReadyWebhook] Email enviado:', emailData);
        emailResult = { success: true, emailId: emailData.email_id };
      } else {
        console.error('❌ [NotifyMusicReadyWebhook] Email não foi enviado:', emailData?.error);
        emailResult = { success: false, error: emailData?.error || 'Erro ao enviar email' };
      }
    } catch (emailErr) {
      console.error('❌ [NotifyMusicReadyWebhook] Erro ao enviar email:', emailErr);
      emailResult = { 
        success: false, 
        error: emailErr instanceof Error ? emailErr.message : 'Erro ao enviar email' 
      };
    }

    // ✅ REMOVIDO: Código de WhatsApp removido completamente
    // Funil e mensagens WhatsApp não são mais usados

    // Log resumo do envio
    console.log('📊 [NotifyMusicReadyWebhook] Resumo do envio:');
    console.log(`   Email: ${emailResult.success ? '✅ Enviado' : '❌ Falhou'} ${emailResult.error ? `(${emailResult.error})` : ''}`);

    const overallSuccess = emailResult.success;

    if (overallSuccess) {
      console.log('✅ [NotifyMusicReadyWebhook] Email enviado com sucesso');
    } else {
      console.error('❌ [NotifyMusicReadyWebhook] Falha ao enviar email');
    }

    return new Response(
      JSON.stringify({
        success: overallSuccess,
        message: 'Webhook processado',
        songs_count: songs.length,
        email: {
          success: emailResult.success,
          error: emailResult.error,
          email_id: emailResult.emailId,
        },
      }),
      { status: overallSuccess ? 200 : 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [NotifyMusicReadyWebhook] Erro inesperado:', error);
    const { response } = createErrorResponse(
      error,
      'Erro ao processar notificação de música pronta',
      500,
      'INTERNAL_ERROR'
    );
    return new Response(response.body, {
      ...response,
      headers: { ...headers, ...response.headers },
    });
  }
});
