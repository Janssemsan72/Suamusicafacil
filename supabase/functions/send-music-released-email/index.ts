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

    // Buscar música com relationships desambiguadas (orders e quizzes)
    const { data: song, error: songError } = await supabase
      .from("songs")
      .select(`
        *,
        orders:order_id (
          id,
          customer_email,
          user_id,
          quiz_id,
          magic_token
        ),
        quizzes:quiz_id (
          about_who,
          style
        )
      `)
      .eq("id", songId)
      .single();

    if (songError || !song) {
      console.error(`[${errorId}] Song not found:`, songError);
      return new Response(
        JSON.stringify({ error: "Música não encontrada", errorId }),
        { status: 404, headers: corsHeaders }
      );
    }

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

    if (!template) {
      console.error(`[${errorId}] Template music_released não encontrado em email_templates_i18n (lang=${language})`);
      return new Response(
        JSON.stringify({ error: `Template não encontrado em email_templates_i18n`, errorId }),
        { status: 404, headers: corsHeaders }
      );
    }

    logLanguageDetection(song.order_id, language, 'music_released_email', song.orders.customer_email);
    console.log(`[${errorId}] 🌍 Idioma detectado: ${language}`);
    console.log(`[${errorId}] ✅ Template encontrado: ${template.template_type}`);

    // Priorizar RESEND_FROM_EMAIL/EMAIL_FROM, senão usar template (domínio suamusicafacil.com está verificado)
    const fromEmailEnv = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM');
    const appName = Deno.env.get('APP_NAME') || 'Sua Música Fácil';
    const templateEmail = template.from_email || 'contato@suamusicafacil.com';
    const templateName = template.from_name || appName;

    // RESEND_FROM_EMAIL/EMAIL_FROM tem prioridade, senão usa template
    let fromAddress: string;
    if (fromEmailEnv && fromEmailEnv.includes('@')) {
      fromAddress = `${appName} <${fromEmailEnv.trim()}>`;
      console.log(`[${errorId}] 📧 Usando RESEND_FROM_EMAIL/EMAIL_FROM do ambiente: ${fromAddress}`);
    } else {
      fromAddress = `${templateName} <${templateEmail}>`;
      console.log(`[${errorId}] 📧 Usando email do template (domínio verificado): ${fromAddress}`);
    }

    // Nome do cliente (já buscado em paralelo)
    let customerName = song.orders?.customer_email?.split("@")[0] || 'Cliente';
    if (profileResult.data?.display_name) {
      customerName = profileResult.data.display_name;
    }

    // Data de lançamento
    const releaseDate = new Date();
    const releaseDateFormatted = releaseDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // ✅ CORREÇÃO: Construir links apontando para o site (suamusicafacil.com) em vez do Supabase
    const siteUrl = Deno.env.get('SITE_URL') || 'https://suamusicafacil.com';
    const download1 = `${siteUrl}/download/${allSongs[0].id}/${song.orders.magic_token}`;
    const download2 = allSongs.length > 1 
      ? `${siteUrl}/download/${allSongs[1].id}/${song.orders.magic_token}`
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

    const subject = replaceVars(template.subject);
    const html = replaceVars(template.html_content);

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
        reply_to: template.reply_to,
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

    const logPromise = supabase.from('email_logs').insert({
      email_type: 'music_released',
      recipient_email: song.orders?.customer_email || 'test@example.com',
      resend_email_id: emailData.id,
      song_id: songId,
      order_id: song.order_id,
      template_used: `music_released_${language}`,
      status: "sent",
      metadata: { 
        customer_name: customerName,
        song_title_1: allSongs[0].title,
        song_title_2: allSongs.length > 1 ? allSongs[1].title : "",
        variant_count: allSongs.length,
        release_date: releaseDateFormatted,
        language: language,
        error_id: errorId 
      },
    }).catch((error) => {
      console.warn(`[${errorId}] ⚠️ Erro ao registrar log (não bloqueante):`, error);
    });

    logPromise.then(() => {
      console.log(`[${errorId}] ✅ Log processado`);
    });

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
