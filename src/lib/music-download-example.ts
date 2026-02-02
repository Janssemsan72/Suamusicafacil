/**
 * Exemplo de como usar o sistema de Signed URLs no MusicLovely
 * Este arquivo demonstra como integrar o envio de links de download
 */

import { sendDownloadLinks } from './send-download-links';

/**
 * Exemplo 1: Enviar links após liberação de música
 * Use este exemplo quando uma música for liberada (status = 'released')
 */
export async function sendMusicDownloadLinks(
  orderId: string,
  customerEmail: string,
  songs: Array<{
    id: string;
    title: string;
    audio_url: string;
  }>
) {
  try {
    console.log(`🎵 Enviando links de download para pedido ${orderId}`);
    
    // Converter dados das músicas para o formato esperado
    const tracks = songs.map((song, index) => ({
      path: extractAudioPath(song.audio_url, song.id),
      title: `${song.title} — Versão ${index + 1}`
    }));

    // Enviar links via email
    const result = await sendDownloadLinks(customerEmail, tracks);
    
    console.log('✅ Links enviados com sucesso:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro ao enviar links de download:', error);
    throw error;
  }
}

/**
 * Exemplo 2: Enviar links para múltiplas músicas de um pedido
 * Use este exemplo quando todas as músicas de um pedido estiverem prontas
 */
export async function sendOrderDownloadLinks(
  orderId: string,
  customerEmail: string,
  songs: Array<{
    id: string;
    title: string;
    audio_url: string;
    variant_number?: number;
  }>
) {
  try {
    console.log(`📦 Enviando links de download para pedido ${orderId}`);
    
    // Ordenar por variant_number se disponível
    const sortedSongs = songs.sort((a, b) => 
      (a.variant_number || 0) - (b.variant_number || 0)
    );

    // Converter para tracks
    const tracks = sortedSongs.map((song, index) => ({
      path: extractAudioPath(song.audio_url, song.id),
      title: song.variant_number 
        ? `${song.title} — Versão ${song.variant_number}`
        : `${song.title} — Versão ${index + 1}`
    }));

    // Enviar links
    const result = await sendDownloadLinks(customerEmail, tracks);
    
    console.log('✅ Links de pedido enviados com sucesso:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro ao enviar links do pedido:', error);
    throw error;
  }
}

/**
 * Exemplo 3: Reenviar links de download
 * Use este exemplo quando o cliente solicitar reenvio dos links
 */
export async function resendDownloadLinks(
  orderId: string,
  customerEmail: string,
  songs: Array<{
    id: string;
    title: string;
    audio_url: string;
  }>
) {
  try {
    console.log(`🔄 Reenviando links de download para pedido ${orderId}`);
    
    const tracks = songs.map((song, index) => ({
      path: extractAudioPath(song.audio_url, song.id),
      title: `${song.title} — Versão ${index + 1} (Reenvio)`
    }));

    const result = await sendDownloadLinks(customerEmail, tracks);
    
    console.log('✅ Links reenviados com sucesso:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro ao reenviar links:', error);
    throw error;
  }
}

/**
 * Função auxiliar para extrair o caminho do arquivo de áudio
 * Converte URLs completas do Supabase Storage para paths relativos
 */
function extractAudioPath(audioUrl: string, songId: string): string {
  if (!audioUrl) {
    return `songs/${songId}.mp3`;
  }

  // Se é uma URL completa do Supabase Storage
  if (audioUrl.includes('/storage/v1/object/')) {
    const urlParts = audioUrl.split('/storage/v1/object/');
    if (urlParts.length > 1) {
      return urlParts[1];
    }
  }

  // Se já é um path relativo
  if (audioUrl.startsWith('songs/') || audioUrl.startsWith('orders/')) {
    return audioUrl;
  }

  // Fallback para path padrão
  return `songs/${songId}.mp3`;
}

/**
 * Exemplo de uso em uma Edge Function ou API route:
 * 
 * // Em uma Edge Function
 * export async function handleMusicReleased(songId: string) {
 *   const songs = await getSongsByOrder(orderId);
 *   await sendMusicDownloadLinks(orderId, customerEmail, songs);
 * }
 * 
 * // Em uma API route
 * export async function POST(req: Request) {
 *   const { orderId, customerEmail } = await req.json();
 *   const songs = await getSongsByOrder(orderId);
 *   return await sendOrderDownloadLinks(orderId, customerEmail, songs);
 * }
 */
