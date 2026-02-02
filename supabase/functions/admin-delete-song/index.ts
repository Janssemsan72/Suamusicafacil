/**
 * Edge Function para deletar uma música específica
 * Remove arquivos de áudio e capas do storage e o registro da tabela songs
 * Mantém as letras em lyrics_approvals
 * 
 * Uso: 
 * POST /functions/v1/admin-delete-song
 * Body: { "song_id": "uuid-da-musica" }
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Admin Delete Song Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { song_id } = await req.json();

    if (!song_id) {
      throw new Error('song_id é obrigatório');
    }

    console.log(`🔍 Deletando música: ${song_id}`);
    console.log('📝 IMPORTANTE:');
    console.log('   ✅ Arquivos de áudio e capas serão removidos do storage');
    console.log('   ✅ Registro de song será deletado');
    console.log('   ✅ Letras em lyrics_approvals serão preservadas\n');

    // 1. Buscar a música
    const { data: song, error: songError } = await supabaseClient
      .from('songs')
      .select('id, audio_url, cover_url, title, order_id')
      .eq('id', song_id)
      .single();

    if (songError || !song) {
      throw new Error(`Música não encontrada: ${songError?.message || 'Não encontrada'}`);
    }

    console.log(`📊 Música encontrada: ${song.title || 'Sem título'}`);

    const deletedFiles = [];
    const errors = [];

    // 2. Extrair e deletar arquivos do storage
    const audioFiles = song.audio_url && song.audio_url.includes('/storage/v1/object/public/')
      ? (() => {
          const match = song.audio_url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/);
          return match ? { bucket: match[1], path: match[2], type: 'audio' } : null;
        })()
      : null;

    const coverFiles = song.cover_url && song.cover_url.includes('/storage/v1/object/public/')
      ? (() => {
          const match = song.cover_url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/);
          return match ? { bucket: match[1], path: match[2], type: 'cover' } : null;
        })()
      : null;

    // Agrupar por bucket
    const filesByBucket: Record<string, Array<{ path: string; type: string }>> = {};
    
    if (audioFiles) {
      if (!filesByBucket[audioFiles.bucket]) filesByBucket[audioFiles.bucket] = [];
      filesByBucket[audioFiles.bucket].push({ path: audioFiles.path, type: audioFiles.type });
    }

    if (coverFiles) {
      if (!filesByBucket[coverFiles.bucket]) filesByBucket[coverFiles.bucket] = [];
      filesByBucket[coverFiles.bucket].push({ path: coverFiles.path, type: coverFiles.type });
    }

    // Deletar arquivos do storage
    if (Object.keys(filesByBucket).length > 0) {
      console.log('\n🗑️  Deletando arquivos do storage...');
      
      for (const [bucket, files] of Object.entries(filesByBucket)) {
        const paths = files.map(f => f.path);
        console.log(`📦 Bucket: "${bucket}" - ${paths.length} arquivo(s)`);

        const { data: deleted, error: deleteError } = await supabaseClient.storage
          .from(bucket)
          .remove(paths);

        if (deleteError) {
          console.error(`❌ Erro ao deletar arquivos do bucket ${bucket}:`, deleteError.message);
          errors.push({ bucket, error: deleteError.message });
        } else {
          console.log(`✅ ${paths.length} arquivo(s) deletado(s) do bucket "${bucket}"`);
          deletedFiles.push(...files.map(f => ({ bucket, path: f.path, type: f.type })));
        }
      }
    } else {
      console.log('⚠️  Nenhum arquivo encontrado no storage para deletar');
    }

    // 3. Deletar logs relacionados
    console.log('\n🗑️  Deletando logs relacionados...');
    
    // Deletar download_logs
    const { error: downloadLogsError } = await supabaseClient
      .from('download_logs')
      .delete()
      .eq('song_id', song_id);
    
    if (downloadLogsError) {
      console.warn('⚠️  Erro ao deletar download_logs:', downloadLogsError.message);
    } else {
      console.log('✅ Download logs deletados');
    }

    // Deletar admin_logs relacionados
    const { error: adminLogsError } = await supabaseClient
      .from('admin_logs')
      .delete()
      .eq('target_table', 'songs')
      .eq('target_id', song_id);
    
    if (adminLogsError) {
      console.warn('⚠️  Erro ao deletar admin_logs:', adminLogsError.message);
    } else {
      console.log('✅ Admin logs deletados');
    }

    // Deletar email_logs relacionados
    const { error: emailLogsError } = await supabaseClient
      .from('email_logs')
      .delete()
      .eq('song_id', song_id);
    
    if (emailLogsError) {
      console.warn('⚠️  Erro ao deletar email_logs:', emailLogsError.message);
    } else {
      console.log('✅ Email logs deletados');
    }

    // 4. Deletar registro da tabela songs
    console.log('\n🗑️  Deletando registro de song...');
    const { error: songsDeleteError } = await supabaseClient
      .from('songs')
      .delete()
      .eq('id', song_id);
    
    if (songsDeleteError) {
      throw new Error(`Erro ao deletar song: ${songsDeleteError.message}`);
    }
    
    console.log(`✅ Registro de song deletado`);

    // 5. Verificar que as letras foram preservadas
    const { data: lyrics, error: lyricsError } = await supabaseClient
      .from('lyrics_approvals')
      .select('id, status, lyrics_preview')
      .eq('order_id', song.order_id);

    const preservedLyrics = lyrics || [];

    console.log(`\n✅ ✅ ✅ DELETADO COM SUCESSO ✅ ✅ ✅\n`);
    console.log(`📝 Letras preservadas: ${preservedLyrics.length} letra(s) encontrada(s) para o pedido`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Música deletada com sucesso. Letras preservadas.',
        song_id: song_id,
        song_title: song.title,
        stats: {
          audio_files_deleted: audioFiles ? 1 : 0,
          cover_files_deleted: coverFiles ? 1 : 0,
          total_files_deleted: deletedFiles.length,
          lyrics_preserved: preservedLyrics.length
        },
        deleted_files: deletedFiles,
        preserved_lyrics_count: preservedLyrics.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: corsHeaders, status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Error in admin-delete-song:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || error?.toString() || 'Erro desconhecido',
        details: error?.details || null
      }),
      { headers: corsHeaders, status: 500 }
    );
  }
});


