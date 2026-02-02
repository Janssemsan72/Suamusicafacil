/**
 * Função auxiliar para enviar links de download via email
 * Usa a Edge Function send-download-links para gerar Signed URLs
 */

interface DownloadTrack {
  path: string;     // Caminho do arquivo no bucket (ex: "orders/123/song-1.mp3")
  title?: string;   // Título da música (ex: "Homenagem — Versão 1")
}

interface SendDownloadLinksResponse {
  success: boolean;
  message: string;
  email_id: string;
  tracks_count: number;
  signed_urls_count: number;
  expires_in_hours: number;
  recipient: string;
}

/**
 * Envia links de download por email usando Signed URLs
 * @param email Email do destinatário
 * @param tracks Array de tracks com path e título
 * @returns Promise com resposta da Edge Function
 */
export async function sendDownloadLinks(
  email: string, 
  tracks: DownloadTrack[]
): Promise<SendDownloadLinksResponse> {
  try {
    console.log(`📧 Enviando links de download para: ${email}`);
    console.log(`🎵 ${tracks.length} músicas para processar`);

    const response = await fetch('/api/send-download-links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        tracks
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro ao enviar links: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Links de download enviados com sucesso:', data);
    
    return data;
  } catch (error) {
    console.error('❌ Erro ao enviar links de download:', error);
    throw error;
  }
}

/**
 * Exemplo de uso:
 * 
 * await sendDownloadLinks('cliente@exemplo.com', [
 *   { path: 'orders/123/song-1.mp3', title: 'Homenagem — Versão 1' },
 *   { path: 'orders/123/song-2.mp3', title: 'Homenagem — Versão 2' }
 * ]);
 */
