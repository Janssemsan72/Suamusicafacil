import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Send Music Ready Email Started ===');
    console.log('📥 [SendMusicReadyEmail] Método:', req.method);
    console.log('📥 [SendMusicReadyEmail] Headers:', Object.fromEntries(req.headers.entries()));

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('❌ [SendMusicReadyEmail] RESEND_API_KEY não configurado');
      throw new Error('RESEND_API_KEY não configurado');
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [SendMusicReadyEmail] Variáveis de ambiente do Supabase não configuradas');
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse do body com tratamento de erro
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📥 [SendMusicReadyEmail] Body recebido:', requestBody);
    } catch (parseError) {
      console.error('❌ [SendMusicReadyEmail] Erro ao fazer parse do JSON:', parseError);
      throw new Error(`Erro ao fazer parse do JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    const { order_id } = requestBody;

    if (!order_id) {
      console.error('❌ [SendMusicReadyEmail] order_id não fornecido no body:', requestBody);
      throw new Error('order_id é obrigatório');
    }

    console.log('📦 Processing order:', order_id);

    // Buscar order com quiz
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, quizzes(*)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order não encontrado: ${orderError?.message}`);
    }

    // Buscar todas as músicas do order (suporta 2+ músicas)
    const { data: songs, error: songsError } = await supabaseClient
      .from('songs')
      .select('*')
      .eq('order_id', order_id)
      .order('variant_number', { ascending: true });

    if (songsError || !songs || songs.length === 0) {
      throw new Error(`Erro ao buscar músicas: ${songsError?.message || 'Nenhuma música encontrada'}`);
    }

    // Validar que todas as músicas têm audio_url
    const songsWithoutAudio = songs.filter(s => !s.audio_url || s.audio_url.trim() === '');
    if (songsWithoutAudio.length > 0) {
      throw new Error(`${songsWithoutAudio.length} música(s) ainda não possuem URL de áudio`);
    }

    // Usar as primeiras 2 músicas para o template (compatibilidade com template existente)
    const song1 = songs[0];
    const song2 = songs[1] || songs[0]; // Se só tiver 1, usar a mesma

    // Buscar template (tabela atual usa 'content' não 'html_content')
    console.log('📧 [SendMusicReadyEmail] Buscando template de email...');
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('template_type', 'production_complete')
      .single();

    // Se não encontrar template, usar template padrão
    let emailSubject = '🎵 Sua Música Está Pronta para Download!';
    let emailContent = '';

    if (templateError || !template) {
      console.warn('⚠️ [SendMusicReadyEmail] Template não encontrado, usando template padrão:', templateError?.message);
      // Template padrão simples
      emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sua Música Está Pronta!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <h1 style="color: #9b87f5; text-align: center;">🎵 Sua Música Está Pronta!</h1>
    <p>Olá <strong>{{customer_name}}</strong>,</p>
    <p>Sua música personalizada foi criada com muito carinho para <strong>{{recipient_name}}</strong>!</p>
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">{{song_title_1}}</h3>
      <p style="margin-bottom: 0;">Estilo: {{music_style}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{download_url_1}}" style="display: inline-block; background: #9b87f5; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600;">Baixar Música</a>
    </div>
    <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">Sua Música Fácil - Música Personalizada com IA</p>
  </div>
</body>
</html>`;
    } else {
      emailSubject = template.subject || emailSubject;
      // Usar 'content' (não 'html_content') - estrutura atual da tabela
      emailContent = template.content || '';
      
      // Se o template existe mas está vazio, usar template padrão
      if (!emailContent || emailContent.trim() === '') {
        console.warn('⚠️ [SendMusicReadyEmail] Template encontrado mas content está vazio, usando template padrão');
        emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sua Música Está Pronta!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <h1 style="color: #9b87f5; text-align: center;">🎵 Sua Música Está Pronta!</h1>
    <p>Olá <strong>{{customer_name}}</strong>,</p>
    <p>Sua música personalizada foi criada com muito carinho para <strong>{{recipient_name}}</strong>!</p>
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">{{song_title_1}}</h3>
      <p style="margin-bottom: 0;">Estilo: {{music_style}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{download_url_1}}" style="display: inline-block; background: #9b87f5; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600;">Baixar Música</a>
    </div>
    <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">Sua Música Fácil - Música Personalizada com IA</p>
  </div>
</body>
</html>`;
      }
      
      console.log('✅ [SendMusicReadyEmail] Template encontrado:', {
        template_type: template.template_type,
        subject: emailSubject,
        has_content: !!emailContent,
        content_length: emailContent.length
      });
    }
    
    // Validar que emailContent não está vazio antes de continuar
    if (!emailContent || emailContent.trim() === '') {
      throw new Error('Template de email está vazio');
    }

    // ✅ CORREÇÃO: Gerar download URLs apontando para o site (suamusicafacil.com) em vez do Supabase
    const siteUrl = Deno.env.get('SITE_URL') || 'https://suamusicafacil.com';
    const download1Url = `${siteUrl}/download/${song1.id}/${order.magic_token}`;
    const download2Url = `${siteUrl}/download/${song2.id}/${order.magic_token}`;

    console.log('🔗 URLs de download geradas:', {
      download1Url,
      download2Url,
      song1Id: song1.id,
      song2Id: song2.id,
      magicToken: order.magic_token
    });

    // ✅ CORREÇÃO: Verificar se quizzes existe antes de acessar propriedades
    const quiz = Array.isArray(order.quizzes) ? order.quizzes[0] : order.quizzes;
    const aboutWho = quiz?.about_who || 'alguém especial';
    const musicStyle = quiz?.style || 'Música Personalizada';

    console.log('📝 [SendMusicReadyEmail] Dados para substituição:', {
      customer_email: order.customer_email,
      about_who: aboutWho,
      music_style: musicStyle,
      song1_title: song1.title,
      song2_title: song2.title,
      has_quiz: !!quiz
    });

    // Substituir variáveis no template
    console.log('🔄 [SendMusicReadyEmail] Substituindo variáveis no template...');
    let finalEmailContent = emailContent;
    
    try {
      finalEmailContent = finalEmailContent
      .replace(/\{\{customer_name\}\}/g, order.customer_email.split('@')[0] || 'Cliente')
        .replace(/\{\{recipient_name\}\}/g, aboutWho)
        .replace(/\{\{song_title_1\}\}/g, song1.title || 'Música 1')
        .replace(/\{\{song_title_2\}\}/g, song2.title || song1.title || 'Música 2')
        .replace(/\{\{music_style\}\}/g, musicStyle)
      .replace(/\{\{duration\}\}/g, song1.duration_sec ? `${Math.floor(song1.duration_sec / 60)}:${String(song1.duration_sec % 60).padStart(2, '0')}` : '3-4 min')
      .replace(/\{\{release_date\}\}/g, new Date().toLocaleDateString('pt-BR'))
      .replace(/\{\{cover_url\}\}/g, song1.cover_url || '')
      .replace(/\{\{download_url_1\}\}/g, download1Url)
      .replace(/\{\{download_url_2\}\}/g, download2Url);
      
      console.log('✅ [SendMusicReadyEmail] Variáveis substituídas com sucesso');
    } catch (replaceError) {
      console.error('❌ [SendMusicReadyEmail] Erro ao substituir variáveis:', replaceError);
      throw new Error(`Erro ao substituir variáveis no template: ${replaceError instanceof Error ? replaceError.message : String(replaceError)}`);
    }

    // ==========================================
    // Enviar Email
    // ==========================================
    
    let emailResult: { success: boolean; error?: string; emailId?: string } = { success: false };

    // Preparar promises para envio
    const promises: Promise<any>[] = [];
    
    // 1. Enviar Email via Resend (sempre)
    promises.push((async () => {
      try {
        console.log('📧 [SendMusicReadyEmail] Iniciando envio de email...', {
          order_id: order.id,
          customer_email: order.customer_email,
        });

    console.log('📤 [SendMusicReadyEmail] Enviando requisição para Resend API...');
    
    // Configurar remetente dinâmico via variáveis de ambiente
    const appName = Deno.env.get('APP_NAME') || 'Sua Música Fácil';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'contato@suamusicafacil.com';
    const replyTo = Deno.env.get('RESEND_REPLY_TO') || 'contato@suamusicafacil.com';
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${appName} <${fromEmail}>`,
        to: [order.customer_email],
        subject: emailSubject,
        html: finalEmailContent,
        reply_to: replyTo,
        headers: {
          'X-Entity-Ref-ID': 'noreply', // Previne avatar automático no Gmail/Outlook
        },
      })
    });

    console.log('📥 [SendMusicReadyEmail] Resposta do Resend:', {
      status: emailResponse.status,
      statusText: emailResponse.statusText,
      ok: emailResponse.ok
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('❌ [SendMusicReadyEmail] Erro na resposta do Resend:', errorText);
      throw new Error(`Resend API error (${emailResponse.status}): ${errorText}`);
    }

    const emailData = await emailResponse.json();
    console.log('✅ [SendMusicReadyEmail] Resposta JSON do Resend:', emailData);
    
    // Validar que emailData tem id
    if (!emailData || !emailData.id) {
      console.error('❌ [SendMusicReadyEmail] Resposta do Resend não contém id:', emailData);
      throw new Error('Resposta do Resend API inválida: id não encontrado');
    }
    
        console.log('✅ [SendMusicReadyEmail] Email enviado com sucesso:', {
          email_id: emailData.id,
          recipient: order.customer_email,
        });

    // Log do email (não bloquear se falhar)
    try {
      console.log('📝 [SendMusicReadyEmail] Registrando log do email...');
      const { error: logError } = await supabaseClient.from('email_logs').insert({
      email_type: 'production_complete',
      recipient_email: order.customer_email,
      order_id: order_id,
      status: 'sent',
      resend_email_id: emailData.id,
      template_used: 'production_complete',
      metadata: {
        song1_id: song1.id,
        song2_id: song2.id,
        title1: song1.title,
        title2: song2.title
      }
    });
      
      if (logError) {
        console.warn('⚠️ [SendMusicReadyEmail] Erro ao registrar log (não crítico):', logError);
      } else {
        console.log('✅ [SendMusicReadyEmail] Log registrado com sucesso');
      }
    } catch (logErr) {
      console.warn('⚠️ [SendMusicReadyEmail] Erro ao registrar log (não crítico):', logErr);
    }

        return { type: 'email', result: { success: true, emailId: emailData.id } };
      } catch (emailErr) {
        const errorMessage = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error('❌ [SendMusicReadyEmail] Erro ao enviar email:', {
          error: errorMessage,
          stack: emailErr instanceof Error ? emailErr.stack : undefined,
          customer_email: order.customer_email
        });
        return { 
          type: 'email',
          result: { 
            success: false, 
            error: errorMessage
          }
        };
      }
    })());
    
    // Executar todas as promises em paralelo
    const responses = await Promise.allSettled(promises);
    
    // Processar resultados
    for (const response of responses) {
      if (response.status === 'fulfilled') {
        const { type, result } = response.value;
        if (type === 'whatsapp') {
          void result;
        } else if (type === 'email') {
          emailResult = result;
        }
      } else {
        const errorMsg = response.reason instanceof Error 
          ? response.reason.message 
          : String(response.reason || 'Erro desconhecido');
        console.error('❌ [SendMusicReadyEmail] Promise rejeitada:', {
          reason: response.reason,
          error: errorMsg
        });
        emailResult = { success: false, error: errorMsg };
      }
    }

    // Log resumo dos envios
    console.log('📊 [SendMusicReadyEmail] Resumo dos envios:');
    console.log(`   Email: ${emailResult.success ? '✅ Enviado' : '❌ Falhou'} ${emailResult.error ? `(${emailResult.error})` : ''}`);

    if (!emailResult.success) {
      throw new Error(`Falha ao enviar email: ${emailResult.error}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email processado',
        email: {
          success: emailResult.success,
          error: emailResult.error,
          email_id: emailResult.emailId,
        },
        recipient: order.customer_email
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ [SendMusicReadyEmail] Erro capturado:', {
      message: errorMessage,
      stack: errorStack,
      error: error,
      errorType: error?.constructor?.name || typeof error,
      errorStringified: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: errorStack
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
