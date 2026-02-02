import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = { ...getSecureHeaders(origin), 'Content-Type': 'application/json' };
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    const formData = await req.formData();
    const videoFile = formData.get('video') as File;
    const magicToken = formData.get('magic_token') as string;
    const orderId = formData.get('order_id') as string;
    const songId = formData.get('song_id') as string | null;
    const uploaderEmail = formData.get('uploader_email') as string;
    const uploaderName = formData.get('uploader_name') as string | null;
    const videoTitle = formData.get('video_title') as string | null;
    const description = formData.get('description') as string | null;

    // Validações
    if (!videoFile) {
      return new Response(
        JSON.stringify({ error: 'Arquivo de vídeo é obrigatório' }),
        { status: 400, headers: secureHeaders }
      );
    }

    if (!magicToken || !orderId || !uploaderEmail) {
      return new Response(
        JSON.stringify({ error: 'magic_token, order_id e uploader_email são obrigatórios' }),
        { status: 400, headers: secureHeaders }
      );
    }

    // Validar formato do vídeo
    const allowedTypes = ['video/mp4', 'video/mov', 'video/quicktime', 'video/avi'];
    if (!allowedTypes.includes(videoFile.type)) {
      return new Response(
        JSON.stringify({ error: 'Formato de vídeo não suportado. Use MP4, MOV ou AVI' }),
        { status: 400, headers: secureHeaders }
      );
    }

    // Validar tamanho (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB em bytes
    if (videoFile.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'Vídeo muito grande. Tamanho máximo: 500MB' }),
        { status: 400, headers: secureHeaders }
      );
    }

    const supabase = getAdminClient();

    // Validar magic_token e order_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, magic_token')
      .eq('id', orderId)
      .eq('magic_token', magicToken)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou pedido não encontrado' }),
        { status: 403, headers: secureHeaders }
      );
    }

    // Gerar nome único para o arquivo
    const fileExt = videoFile.name.split('.').pop() || 'mp4';
    const fileName = `${orderId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `reaction-videos/${fileName}`;

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reaction-videos')
      .upload(filePath, videoFile, {
        contentType: videoFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao fazer upload do vídeo', details: uploadError.message }),
        { status: 500, headers: secureHeaders }
      );
    }

    // Obter URL pública do vídeo
    const { data: { publicUrl } } = supabase.storage
      .from('reaction-videos')
      .getPublicUrl(filePath);

    const sanitize = (s: string | null, maxLen: number) =>
      (s || '')
        .replace(/[<>]/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, maxLen);
    const sanitizedName = sanitize(uploaderName, 100);
    const sanitizedTitle = sanitize(videoTitle, 200);
    const sanitizedDesc = sanitize(description, 1000);

    // Criar registro na tabela reaction_videos
    const { data: videoRecord, error: insertError } = await supabase
      .from('reaction_videos')
      .insert({
        order_id: orderId,
        song_id: songId || null,
        video_url: publicUrl,
        uploader_email: uploaderEmail,
        uploader_name: sanitizedName || null,
        video_title: sanitizedTitle || null,
        description: sanitizedDesc || null,
        file_size_bytes: videoFile.size,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar registro:', insertError);
      // Tentar deletar o arquivo do storage se o insert falhar
      await supabase.storage.from('reaction-videos').remove([filePath]);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar registro do vídeo', details: insertError.message }),
        { status: 500, headers: secureHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        video: {
          id: videoRecord.id,
          video_url: publicUrl,
          status: videoRecord.status,
        },
        message: 'Vídeo enviado com sucesso! Aguarde a moderação.',
      }),
      { status: 200, headers: secureHeaders }
    );
  } catch (error) {
    console.error('Erro na função upload-reaction-video:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: secureHeaders }
    );
  }
});

