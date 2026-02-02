/**
 * Função helper para gerar hash de letras para auditoria
 * Normaliza o formato da letra antes de gerar o hash para comparação consistente
 */

/**
 * Normaliza a letra para um formato consistente antes de gerar hash
 * @param lyrics - Letra em qualquer formato (objeto, string, etc)
 * @returns String normalizada da letra
 */
function normalizeLyrics(lyrics: any): string {
  if (!lyrics) return '';
  
  if (typeof lyrics === 'string') {
    return lyrics.trim();
  }
  
  if (typeof lyrics === 'object' && lyrics !== null) {
    // Formato objeto: { title, lyrics, verses, ... }
    let normalized = '';
    
    if (lyrics.title) {
      normalized += `TITLE:${lyrics.title}\n`;
    }
    
    if (lyrics.lyrics) {
      normalized += lyrics.lyrics.trim();
    } else if (lyrics.verses && Array.isArray(lyrics.verses)) {
      // Extrair de verses
      normalized += lyrics.verses
        .map((v: any) => v?.text || v?.lyrics || '')
        .filter(Boolean)
        .join('\n\n');
    }
    
    return normalized.trim();
  }
  
  return String(lyrics).trim();
}

/**
 * Gera hash SHA-256 da letra normalizada
 * Usa SHA-256 (disponível nativamente) em vez de MD5
 * @param lyrics - Letra em qualquer formato
 * @returns Hash hexadecimal da letra
 */
export async function generateLyricsHash(lyrics: any): Promise<string> {
  const normalized = normalizeLyrics(lyrics);
  
  if (!normalized) {
    return 'empty';
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16); // Primeiros 16 chars para logs mais limpos
}

/**
 * Extrai preview da letra para logs
 * @param lyrics - Letra em qualquer formato
 * @returns Preview da letra (primeiros 100 caracteres)
 */
export function getLyricsPreview(lyrics: any): string {
  const normalized = normalizeLyrics(lyrics);
  
  if (!normalized) {
    return '(vazia)';
  }
  
  return normalized.substring(0, 100) + (normalized.length > 100 ? '...' : '');
}

/**
 * Compara duas letras usando hash
 * @param lyrics1 - Primeira letra
 * @param lyrics2 - Segunda letra
 * @returns true se as letras são iguais (mesmo hash)
 */
export async function compareLyrics(lyrics1: any, lyrics2: any): Promise<boolean> {
  const hash1 = await generateLyricsHash(lyrics1);
  const hash2 = await generateLyricsHash(lyrics2);
  return hash1 === hash2;
}





