import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Headers simplificados (sem rate limiting)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Extrai o path do storage a partir de uma URL do Supabase Storage
 * Suporta URLs completas, signed URLs e paths relativos
 */
function extractStoragePath(audioUrl: string): string {
  if (!audioUrl || audioUrl.trim() === '') {
    throw new Error('audioUrl está vazio');
  }

  // Se já for um path relativo (sem http e sem /storage/v1/object/), retornar diretamente
  if (!audioUrl.includes('http') && !audioUrl.includes('/storage/v1/object/')) {
    // Se não começar com 'suno-tracks/', adicionar
    if (!audioUrl.startsWith('suno-tracks/')) {
      // Se começar com 'media/' ou 'songs/', adicionar o bucket
      if (audioUrl.startsWith('media/') || audioUrl.startsWith('songs/')) {
        return `suno-tracks/${audioUrl}`;
      }
      // Se não, assumir que está no bucket suno-tracks
      return `suno-tracks/${audioUrl}`;
    }
    return audioUrl;
  }

  // Se for uma URL completa do Supabase Storage, extrair o path
  if (audioUrl.includes('/storage/v1/object/')) {
    const urlParts = audioUrl.split('/storage/v1/object/');
    if (urlParts.length > 1) {
      // Remover query params se houver
      const pathWithBucket = urlParts[1].split('?')[0];
      // O formato pode ser:
      // - 'public/suno-tracks/media/file.mp3' -> extrair 'media/file.mp3'
      // - 'sign/suno-tracks/media/file.mp3' -> extrair 'media/file.mp3'
      // - 'suno-tracks/media/file.mp3' -> extrair 'media/file.mp3'
      const pathParts = pathWithBucket.split('/');
      
      // Procurar pelo índice do bucket 'suno-tracks'
      const bucketIndex = pathParts.findIndex(part => part === 'suno-tracks');
      
      if (bucketIndex >= 0 && pathParts.length > bucketIndex + 1) {
        // Retornar path após o bucket
        const extractedPath = pathParts.slice(bucketIndex + 1).join('/');
        return extractedPath;
      }
      
      // Se não encontrou o bucket, tentar remover os primeiros 2 elementos (public/sign + bucket)
      if (pathParts.length > 2) {
        const extractedPath = pathParts.slice(2).join('/');
        return extractedPath;
      }
      
      // Fallback: retornar o path completo
      return pathWithBucket;
    }
  }

  // Se for uma URL de signed URL (contém '?token='), extrair apenas o path antes do '?'
  if (audioUrl.includes('?token=') || audioUrl.includes('?t=')) {
    const pathOnly = audioUrl.split('?')[0];
    // Tentar extrair o path novamente
    return extractStoragePath(pathOnly);
  }

  // Se for uma URL externa (ex: Suno), retornar a URL completa
  // Isso será tratado no código que chama esta função
  return audioUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const errorId = crypto.randomUUID();
  console.log(`[download-song] start ${errorId} method=${req.method}`);
  try {
    let songId: string | null = null;
    let token: string | null = null;
    let email: string | null = null;

    // Suportar tanto GET (query params) quanto POST (body JSON)
    if (req.method === "GET") {
      const url = new URL(req.url);
      songId = url.searchParams.get("songId");
      token = url.searchParams.get("token");
    } else if (req.method === "POST") {
      const body = await req.json();
      songId = body.song_id || body.songId;
      token = body.magic_token || body.token;
      email = body.email;
    }

    if (!songId) {
      return new Response(JSON.stringify({ error: "songId é obrigatório", errorId }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = getAdminClient();

    // Buscar música + pedido (com magic_token) de forma desambígua
    const { data: song, error: songError } = await supabase
      .from("songs")
      .select(`
        *,
        orders:order_id(id, customer_email, magic_token)
      `)
      .eq("id", songId)
      .single();

    if (songError || !song) {
      console.error(`[${errorId}] Song not found`, songError);
      return new Response(JSON.stringify({ error: "Música não encontrada", errorId }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Normalizar emails para comparação (case-insensitive, trim)
    const normalizeEmailForComparison = (email: string | null | undefined): string | null => {
      if (!email) return null;
      return email.trim().toLowerCase();
    };
    
    const normalizedRequestEmail = normalizeEmailForComparison(email);
    const normalizedOrderEmail = normalizeEmailForComparison(song.orders?.customer_email);
    
    // Validar acesso: token OU email correspondente
    const hasValidToken = token && song.orders?.magic_token && song.orders.magic_token.trim() === token.trim();
    const hasValidEmail = normalizedRequestEmail && normalizedOrderEmail && normalizedRequestEmail === normalizedOrderEmail;
    
    // Log detalhado para debug
    console.log(`[${errorId}] Validação de acesso:`, {
      hasToken: !!token,
      hasOrderToken: !!song.orders?.magic_token,
      tokenMatch: hasValidToken,
      hasRequestEmail: !!email,
      hasOrderEmail: !!song.orders?.customer_email,
      emailMatch: hasValidEmail,
      requestEmail: email,
      orderEmail: song.orders?.customer_email,
      normalizedRequestEmail,
      normalizedOrderEmail,
      tokenFromRequest: token?.substring(0, 10) + '...',
      tokenFromOrder: song.orders?.magic_token?.substring(0, 10) + '...',
    });
    
    if (!hasValidToken && !hasValidEmail) {
      console.error(`[${errorId}] Unauthorized access attempt`, { 
        token: token?.substring(0, 10) + '...', 
        orderToken: song.orders?.magic_token?.substring(0, 10) + '...',
        email, 
        orderEmail: song.orders?.customer_email,
        songId,
        orderId: song.order_id
      });
      return new Response(JSON.stringify({ error: "Token ou email inválido", errorId }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Obter URL pública do áudio
    let audioUrl = song.audio_url as string | undefined;
    
    // ✅ CORREÇÃO: Se não tiver audio_url na song, verificar jobs.suno_audio_url como fallback
    if (!audioUrl || audioUrl.trim() === '') {
      console.log(`[${errorId}] Song sem audio_url, verificando jobs.suno_audio_url...`);
      
      // Buscar jobs do pedido com suno_audio_url
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, suno_audio_url, status')
        .eq('order_id', song.order_id)
        .not('suno_audio_url', 'is', null)
        .neq('suno_audio_url', '')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!jobsError && jobs && jobs.length > 0) {
        const job = jobs[0];
        const jobAudioUrl = job.suno_audio_url;
        
        if (jobAudioUrl && jobAudioUrl.trim() !== '') {
          console.log(`[${errorId}] Encontrado suno_audio_url no job ${job.id}, usando como fallback`);
          audioUrl = jobAudioUrl;
          
          // ✅ BONUS: Atualizar song.audio_url para futuras requisições
          try {
            await supabase
              .from('songs')
              .update({
                audio_url: jobAudioUrl,
                updated_at: new Date().toISOString()
              })
              .eq('id', songId);
            console.log(`[${errorId}] Song.audio_url atualizado com sucesso`);
          } catch (updateError) {
            console.warn(`[${errorId}] Falha ao atualizar song.audio_url (não crítico):`, updateError);
          }
        }
      }
    }
    
    if (!audioUrl || audioUrl.trim() === '') {
      console.error(`[${errorId}] Áudio indisponível - song sem audio_url e sem job com suno_audio_url`, {
        songId,
        orderId: song.order_id,
        hasSongAudioUrl: !!song.audio_url,
        songAudioUrl: song.audio_url
      });
      return new Response(JSON.stringify({ error: "Áudio indisponível", errorId }), {
        status: 409,
        headers: corsHeaders,
      });
    }

    // Se for POST (chamado do frontend via invoke), retornar blob diretamente
    if (req.method === "POST") {
      // Log do download
      try {
        await supabase.from('download_logs').insert({
          song_id: songId,
          order_id: song.order_id,
          customer_email: email || song.orders?.customer_email,
          downloaded_at: new Date().toISOString()
        });
      } catch (logError) {
        console.warn(`[${errorId}] Falha ao registrar log (não crítico):`, logError);
      }

      // ✅ CORREÇÃO: Retornar blob diretamente em vez de URL JSON
      // Verificar se é URL do Supabase Storage ou URL externa (ex: Suno)
      let audioBlob: Blob;
      let contentType = "audio/mpeg";

      try {
        if (audioUrl.includes('/storage/v1/object/') || audioUrl.includes('.supabase.co')) {
          // É URL do Supabase Storage - fazer download via storage API
          try {
            const storagePath = extractStoragePath(audioUrl);
            console.log(`[${errorId}] Fazendo download do storage: ${storagePath}`);
            
            const { data: blobData, error: downloadError } = await supabase.storage
              .from('suno-tracks')
              .download(storagePath);

            if (downloadError || !blobData) {
              console.error(`[${errorId}] Erro ao fazer download do storage:`, downloadError);
              // Fallback: tentar fetch direto da URL
              const upstream = await fetch(audioUrl);
              if (!upstream.ok) {
                throw new Error(`Falha ao buscar áudio: ${upstream.statusText}`);
              }
              audioBlob = await upstream.blob();
              contentType = upstream.headers.get("Content-Type") || "audio/mpeg";
            } else {
              audioBlob = blobData;
            }
          } catch (storageError) {
            console.warn(`[${errorId}] Erro no download do storage, tentando fetch direto:`, storageError);
            // Fallback: tentar fetch direto da URL
            const upstream = await fetch(audioUrl);
            if (!upstream.ok) {
              throw new Error(`Falha ao buscar áudio: ${upstream.statusText}`);
            }
            audioBlob = await upstream.blob();
            contentType = upstream.headers.get("Content-Type") || "audio/mpeg";
          }
        } else {
          // É URL externa (ex: Suno) - fazer fetch direto
          console.log(`[${errorId}] Fazendo fetch de URL externa: ${audioUrl.substring(0, 50)}...`);
          const upstream = await fetch(audioUrl);
          if (!upstream.ok || !upstream.body) {
            const text = await upstream.text();
            console.error(`[${errorId}] Falha ao buscar áudio externo`, text);
            throw new Error(`Falha ao buscar áudio: ${upstream.statusText}`);
          }
          audioBlob = await upstream.blob();
          contentType = upstream.headers.get("Content-Type") || "audio/mpeg";
        }
      } catch (blobError: any) {
        console.error(`[${errorId}] Erro ao obter blob do áudio:`, blobError);
        return new Response(JSON.stringify({ 
          error: "Erro ao obter arquivo de áudio", 
          details: blobError?.message || "Erro desconhecido",
          errorId 
        }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // Criar filename seguro
      const filenameSafeTitle = (song.title || "musica").replace(/[^a-zA-Z0-9-_\. ]/g, "_");
      const filename = `${filenameSafeTitle}-v${song.variant_number || 1}.mp3`;

      // Retornar blob com headers apropriados
      const headers = new Headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': audioBlob.size.toString(),
      });

      return new Response(audioBlob, { status: 200, headers });
    }

    // Se for GET (link direto), fazer proxy com Content-Disposition para forçar download
    const upstream = await fetch(audioUrl);
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      console.error(`[${errorId}] Falha ao buscar áudio do storage`, text);
      return new Response(JSON.stringify({ error: "Falha ao buscar áudio", details: text, errorId }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    // Log do download
    try {
      await supabase.from('download_logs').insert({
        song_id: songId,
        order_id: song.order_id,
        customer_email: song.orders?.customer_email,
        downloaded_at: new Date().toISOString()
      });
    } catch (logError) {
      console.warn(`[${errorId}] Falha ao registrar log (não crítico):`, logError);
    }

    const filenameSafeTitle = (song.title || "musica").replace(/[^a-zA-Z0-9-_\. ]/g, "_");
    const filename = `${filenameSafeTitle}-v${song.variant_number || 1}.mp3`;

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "audio/mpeg");
    headers.set("Content-Length", upstream.headers.get("Content-Length") || "");
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    return new Response(upstream.body, { status: 200, headers });
  } catch (err: any) {
    console.error("[download-song] Unhandled error", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: err?.message }), {
        status: 500,
      headers: corsHeaders,
    });
  }
});
