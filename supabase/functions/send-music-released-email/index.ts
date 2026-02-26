// @ts-ignore - Deno imports
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore - Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { detectLanguageFromOrder, logLanguageDetection } from "../_shared/language-detector.ts";

// Headers simplificados (sem rate limiting)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

// ✅ CORREÇÃO: Função helper para cliente Supabase com SERVICE_ROLE
function getSupabaseAdmin() {
  // @ts-ignore - Deno global
  const url = Deno.env.get("SUPABASE_URL")!;
  // @ts-ignore - Deno global
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // <- SERVICE_ROLE ignora RLS
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const errorId = crypto.randomUUID(); // Para correlacionar logs
  console.log(`=== SEND MUSIC RELEASED EMAIL [${errorId}] ===`);

  try {
    // @ts-ignore - Deno global
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error(`[${errorId}] RESEND_API_KEY not configured`);
      return new Response(
        JSON.stringify({ error: "Resend API key not configured", errorId }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { songId, orderId, force = false } = await req.json();

    if (!songId) {
      return new Response(
        JSON.stringify({ error: "songId é obrigatório", errorId }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[${errorId}] 🎵 Processing song: ${songId}`);

    // ✅ CORREÇÃO: Usar SERVICE_ROLE para buscar dados
    const supabase = getSupabaseAdmin();

    // Buscar música
    const { data: song, error: songError } = await supabase
      .from("songs")
      .select("*")
      .eq("id", songId)
      .single();

    if (songError || !song) {
      console.error(`[${errorId}] Song not found:`, songError);
      return new Response(
        JSON.stringify({ error: "Música não encontrada", errorId }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Buscar order separadamente
    let orderData: any = null;
    if (song.order_id) {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_email, customer_name, user_id, quiz_id, magic_token")
        .eq("id", song.order_id)
        .single();
      orderData = data;
    }
    song.orders = orderData;

    // Buscar quiz separadamente
    let quizData: any = null;
    if (song.quiz_id) {
      const { data } = await supabase
        .from("quizzes")
        .select("about_who, style")
        .eq("id", song.quiz_id)
        .single();
      quizData = data;
    }
    song.quizzes = quizData;

    console.log(`[${errorId}] ✅ Song loaded: ${song.title}`);

    // Buscar todas as músicas do pedido
    const { data: allSongs, error: songsError } = await supabase
      .from("songs")
      .select("*")
      .eq("order_id", song.order_id)
      .order("variant_number", { ascending: true });

    if (songsError || !allSongs || allSongs.length === 0) {
      console.error(`[${errorId}] Songs not found:`, songsError);
      return new Response(
        JSON.stringify({ error: "Músicas do pedido não encontradas", errorId }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`[${errorId}] ✅ Found ${allSongs.length} songs for order`);

    // ✅ OTIMIZAÇÃO: Paralelizar todas as queries independentes
    // 1. Detectar idioma primeiro (necessário para buscar template correto)
    const language = await detectLanguageFromOrder(supabase, song.order_id);
    logLanguageDetection(song.order_id, language, 'music_released_email', song.orders.customer_email);
    console.log(`[${errorId}] 🌍 Idioma detectado: ${language}`);

    // 2. Buscar template e profile em paralelo (independentes entre si)
    const [templateResults, profileResult] = await Promise.all([
      // Buscar templates em paralelo (pt e idioma detectado)
      Promise.all([
        supabase
          .from('email_templates_i18n')
          .select('*')
          .eq('template_type', 'music_released')
          .eq('language', 'pt')
          .single(),
        supabase
          .from('email_templates_i18n')
          .select('*')
          .eq('template_type', 'music_released')
          .eq('language', language)
          .single()
      ]),
      // Buscar profile apenas se user_id existir
      song.orders?.user_id 
        ? supabase
            .from("profiles")
            .select("display_name")
            .eq("id", song.orders.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    // Extrair template (priorizar idioma detectado, fallback para pt)
    const [tplPtResult, tplLangResult] = templateResults;
    const template = tplLangResult.data || tplPtResult.data;

    const fallbackTemplate = {
      template_type: 'music_released',
      subject: '🎵 Sua música "{{song_title_1}}" está pronta!',
      html_content: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
          <div style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);padding:32px 24px;text-align:center">
            <h1 style="color:#ffffff;margin:0;font-size:24px">🎶 Sua música está pronta!</h1>
          </div>
          <div style="padding:32px 24px">
            <p style="font-size:16px;color:#333">Olá <strong>{{customer_name}}</strong>,</p>
            <p style="font-size:16px;color:#555">Sua música personalizada para <strong>{{recipient_name}}</strong> ficou incrível! Preparamos duas versões para você escolher a favorita.</p>
            
            <div style="background:#f8f5ff;border-radius:8px;padding:20px;margin:24px 0">
              <h2 style="color:#7c3aed;margin:0 0 8px;font-size:20px">{{song_title_1}}</h2>
              <p style="color:#666;margin:0;font-size:14px">Estilo: {{music_style}} | Duração: {{duration}}</p>
            </div>
            
            <div style="text-align:center;margin:32px 0">
              <a href="{{download_url_1}}" style="background:#7c3aed;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;display:inline-block;font-size:16px;font-weight:600">⬇️ Baixar Versão 1</a>
            </div>
            <div style="text-align:center;margin:16px 0 32px">
              <a href="{{download_url_2}}" style="background:#9333ea;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;display:inline-block;font-size:16px;font-weight:600">⬇️ Baixar Versão 2</a>
            </div>
            
            <p style="color:#666;font-size:14px;text-align:center">Esperamos que você e {{recipient_name}} amem essa música! 💜</p>
          </div>
          <div style="background:#f4f0ff;padding:16px 24px;text-align:center">
            <p style="color:#999;font-size:12px;margin:0">Sua Música Fácil - {{release_date}}</p>
            <p style="color:#bbb;font-size:11px;margin:4px 0 0">suamusicafacil.com.br</p>
          </div>
        </div>`,
      from_email: 'suport@suamusicafacil.com.br',
      from_name: 'Sua Música Fácil',
    };

    if (!template) {
      console.warn(`[${errorId}] Template não encontrado no banco, usando fallback embutido`);
    }
    const finalTemplate = template || fallbackTemplate;

    logLanguageDetection(song.order_id, language, 'music_released_email', song.orders?.customer_email);
    console.log(`[${errorId}] 🌍 Idioma detectado: ${language}`);
    console.log(`[${errorId}] ✅ Template: ${finalTemplate.template_type}`);

    const fromEmailEnv = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM');
    const appName = Deno.env.get('APP_NAME') || 'Sua Música Fácil';
    const templateEmail = finalTemplate.from_email || 'suport@suamusicafacil.com.br';
    const templateName = finalTemplate.from_name || appName;

    // RESEND_FROM_EMAIL/EMAIL_FROM tem prioridade, senão usa template
    let fromAddress: string;
    if (fromEmailEnv && fromEmailEnv.includes('@')) {
      fromAddress = `${appName} <${fromEmailEnv.trim()}>`;
      console.log(`[${errorId}] 📧 Usando RESEND_FROM_EMAIL/EMAIL_FROM do ambiente: ${fromAddress}`);
    } else {
      fromAddress = `${templateName} <${templateEmail}>`;
      console.log(`[${errorId}] 📧 Usando email do template (domínio verificado): ${fromAddress}`);
    }

    // Nome do cliente: prioridade customer_name da order, depois profile, depois email
    let customerName = song.orders?.customer_name
      || profileResult.data?.display_name
      || song.orders?.customer_email?.split("@")[0]
      || 'Cliente';

    // Data de lançamento
    const releaseDate = new Date();
    const releaseDateFormatted = releaseDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Links diretos para os arquivos no Supabase Storage
    const download1 = allSongs[0]?.audio_url || '';
    const download2 = allSongs.length > 1 
      ? (allSongs[1]?.audio_url || download1)
      : download1;

    const variables = {
      customer_name: customerName,
      recipient_name: song.quizzes?.about_who || 'pessoa especial',
      song_title_1: allSongs[0]?.title || '',
      song_title_2: allSongs.length > 1 ? (allSongs[1]?.title || '') : (allSongs[0]?.title || ''),
      music_style: song.quizzes?.style || allSongs[0]?.style || 'Pop',
      duration: allSongs[0]?.duration_sec ? `${Math.floor(allSongs[0].duration_sec / 60)}:${String(allSongs[0].duration_sec % 60).padStart(2, '0')}` : '3:45',
      release_date: releaseDateFormatted,
      download_url_1: download1,
      download_url_2: download2,
      cover_url: allSongs[0]?.cover_url || '',
    };

    console.log(`[${errorId}] 📝 Variables:`, variables);

    // Substituir variáveis
    const replaceVars = (text: string) => 
      text.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? '');

    const subject = replaceVars(finalTemplate.subject);
    const html = replaceVars(finalTemplate.html_content);

    console.log(`[${errorId}] 📧 Enviando email via Resend...`);

    // Enviar via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [song.orders?.customer_email || 'test@example.com'],
        subject,
        html,
        reply_to: finalTemplate.reply_to || fromEmailEnv || templateEmail,
        headers: {
          'X-Entity-Ref-ID': 'noreply', // Previne avatar automático no Gmail/Outlook
        },
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`[${errorId}] RESEND_ERROR:`, errorText);
      return new Response(
        JSON.stringify({ error: 'Falha ao enviar email', details: errorText, errorId }),
        { status: 502, headers: corsHeaders }
      );
    }

    const emailData = await emailResponse.json();
    console.log(`[${errorId}] ✅ Email enviado! Resend ID: ${emailData.id}`);

    try {
      await supabase.from('email_logs').insert({
        email_type: 'music_released',
        recipient_email: song.orders?.customer_email || 'test@example.com',
        resend_email_id: emailData.id,
        song_id: songId,
        order_id: song.order_id,
        template_used: `music_released_${language}`,
        status: "sent",
        metadata: { 
          customer_name: customerName,
          song_title_1: allSongs[0]?.title,
          song_title_2: allSongs.length > 1 ? allSongs[1]?.title : "",
          variant_count: allSongs.length,
          release_date: releaseDateFormatted,
          language: language,
          error_id: errorId 
        },
      });
      console.log(`[${errorId}] ✅ Log de email registrado`);
    } catch (logErr) {
      console.warn(`[${errorId}] ⚠️ Erro ao registrar log (não bloqueante):`, logErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailData.id,
        recipient: song.orders?.customer_email || 'test@example.com',
        subject,
        errorId 
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error(`[${errorId}] UNHANDLED_ERROR:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno',
        details: error.message,
        errorId 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
