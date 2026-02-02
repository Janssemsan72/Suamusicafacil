/**
 * Utilitários para download e validação de arquivos de áudio
 */

const MAX_RETRIES = 3;
const FETCH_TIMEOUT = 30000; // 30 segundos
const MIN_AUDIO_SIZE = 1000; // 1KB mínimo
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB máximo
const VALID_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3', 'audio/wav', 'audio/webm', 'audio/ogg'];
const CONTENT_LENGTH_TOLERANCE = 0.05; // 5% de tolerância

export interface ValidatedAudioResult {
  blob: Blob;
  contentType: string;
  size: number;
}

/**
 * Baixa e valida um arquivo de áudio com retry logic e validações robustas
 * @param audioUrl URL do arquivo de áudio
 * @param attempt Número da tentativa atual (usado internamente para retry)
 * @returns Objeto com blob, contentType e size do áudio validado
 */
export async function downloadAndValidateAudio(
  audioUrl: string,
  attempt: number = 1
): Promise<ValidatedAudioResult> {
  const logPrefix = `[DOWNLOAD-AUDIO] Tentativa ${attempt}/${MAX_RETRIES}`;
  
  console.log(`${logPrefix} Iniciando download de: ${audioUrl}`);
  
  try {
    // Criar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    
    // Fazer fetch com timeout
    const response = await fetch(audioUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MusicLovely/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    // Validar status HTTP
    if (!response.ok || response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Obter headers importantes
    const contentType = response.headers.get('content-type') || '';
    const contentLengthHeader = response.headers.get('content-length');
    const expectedSize = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;
    
    console.log(`${logPrefix} Headers recebidos:`, {
      contentType,
      contentLength: expectedSize,
      status: response.status
    });
    
    // Converter para blob
    const blob = await response.blob();
    const actualSize = blob.size;
    const blobType = blob.type || contentType;
    
    console.log(`${logPrefix} Blob criado:`, {
      size: actualSize,
      type: blobType,
      expectedSize
    });
    
    // Validação 1: Tamanho mínimo
    if (actualSize < MIN_AUDIO_SIZE) {
      throw new Error(
        `Arquivo muito pequeno: ${actualSize} bytes (mínimo: ${MIN_AUDIO_SIZE} bytes). ` +
        `Provavelmente arquivo corrompido ou download incompleto.`
      );
    }
    
    // Validação 2: Tamanho máximo
    if (actualSize > MAX_AUDIO_SIZE) {
      throw new Error(
        `Arquivo muito grande: ${actualSize} bytes (máximo: ${MAX_AUDIO_SIZE} bytes)`
      );
    }
    
    // Validação 3: Tipo MIME
    const isValidMimeType = VALID_AUDIO_MIME_TYPES.some(
      validType => blobType.toLowerCase().includes(validType.toLowerCase())
    );
    
    if (!isValidMimeType) {
      console.warn(`${logPrefix} ⚠️ Tipo MIME não reconhecido: ${blobType} (aceitando mesmo assim)`);
      // Não rejeitar por tipo MIME, apenas logar warning
      // Alguns servidores podem retornar tipos incorretos mas o arquivo estar OK
    }
    
    // Validação 4: Integridade (Content-Length vs blob.size)
    if (expectedSize !== null) {
      const sizeDifference = Math.abs(actualSize - expectedSize);
      const sizeDifferencePercent = (sizeDifference / expectedSize) * 100;
      
      if (sizeDifferencePercent > CONTENT_LENGTH_TOLERANCE * 100) {
        throw new Error(
          `Download incompleto: tamanho esperado ${expectedSize} bytes, ` +
          `recebido ${actualSize} bytes (diferença: ${sizeDifferencePercent.toFixed(2)}%). ` +
          `Provavelmente conexão interrompida.`
        );
      }
      
      console.log(`${logPrefix} ✅ Integridade validada: diferença de ${sizeDifferencePercent.toFixed(2)}%`);
    } else {
      console.warn(`${logPrefix} ⚠️ Content-Length não disponível, pulando validação de integridade`);
    }
    
    // Validação 5: Verificar se blob não está vazio (redundante mas importante)
    if (actualSize === 0) {
      throw new Error('Arquivo vazio recebido');
    }
    
    console.log(`${logPrefix} ✅ Todas as validações passaram! Tamanho: ${actualSize} bytes, Tipo: ${blobType}`);
    
    return {
      blob,
      contentType: blobType || 'audio/mpeg',
      size: actualSize
    };
    
  } catch (error: any) {
    // Se for timeout ou erro de rede, tentar novamente se ainda houver tentativas
    const isRetryableError = 
      error.name === 'AbortError' || // Timeout
      error.message?.includes('fetch failed') ||
      error.message?.includes('network') ||
      error.message?.includes('HTTP 5') || // Erros 5xx
      error.message?.includes('HTTP 429'); // Rate limit
    
    if (isRetryableError && attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt - 1) * 1000; // Delay exponencial: 1s, 2s, 4s
      console.warn(`${logPrefix} ⚠️ Erro recuperável: ${error.message}. Tentando novamente em ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return downloadAndValidateAudio(audioUrl, attempt + 1);
    }
    
    // Se não for recuperável ou esgotaram tentativas, lançar erro
    const errorMessage = attempt >= MAX_RETRIES
      ? `Falha após ${MAX_RETRIES} tentativas: ${error.message}`
      : error.message;
    
    console.error(`${logPrefix} ❌ Erro não recuperável: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

