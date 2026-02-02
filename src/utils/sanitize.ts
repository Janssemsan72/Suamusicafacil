/**
 * Funções de sanitização para prevenir XSS e injeção de dados maliciosos
 * 
 * @module utils/sanitize
 */

/**
 * Sanitiza uma string removendo caracteres perigosos
 * 
 * @param input - String a ser sanitizada
 * @returns String sanitizada
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }
  
  // Remover tags HTML
  return input
    .replace(/<[^>]*>/g, '') // Remove tags HTML
    .replace(/[<>]/g, '') // Remove caracteres < e >
    .trim();
}

/**
 * Normaliza domínios de email comuns que podem ter erros de digitação
 * 
 * @param email - Email a ser normalizado
 * @returns Email com domínio corrigido
 */
function normalizeEmailDomain(email: string): string {
  // Mapeamento de domínios incorretos para corretos
  const domainCorrections: Record<string, string> = {
    'incloud.com': 'icloud.com',
    'gmial.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmaiil.com': 'hotmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
  };

  const parts = email.split('@');
  if (parts.length !== 2) {
    return email; // Email inválido, retornar como está
  }

  const [localPart, domain] = parts;
  const normalizedDomain = domainCorrections[domain.toLowerCase()] || domain;

  return `${localPart}@${normalizedDomain}`;
}

/**
 * Sanitiza um email removendo caracteres perigosos mas mantendo formato válido
 * Também normaliza domínios comuns que podem ter erros de digitação
 * 
 * @param email - Email a ser sanitizado
 * @returns Email sanitizado e normalizado
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }
  
  // Remover caracteres perigosos mas manter formato de email
  let sanitized = email
    .replace(/[<>'"&]/g, '') // Remove caracteres perigosos
    .trim()
    .toLowerCase();
  
  // Normalizar domínios comuns com erros de digitação
  sanitized = normalizeEmailDomain(sanitized);
  
  return sanitized;
}

/**
 * Sanitiza um número de telefone/WhatsApp removendo caracteres não numéricos
 * 
 * @param phone - Número de telefone a ser sanitizado
 * @returns Número sanitizado (apenas dígitos)
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') {
    return '';
  }
  
  // Manter apenas dígitos e caracteres permitidos (+ para código internacional)
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Sanitiza um objeto removendo propriedades perigosas e sanitizando valores
 * 
 * @param obj - Objeto a ser sanitizado
 * @returns Objeto sanitizado
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const value = sanitized[key];
      
      if (typeof value === 'string') {
        // Sanitizar strings baseado no tipo de campo
        if (key.includes('email')) {
          sanitized[key] = sanitizeEmail(value) as T[Extract<keyof T, string>];
        } else if (key.includes('phone') || key.includes('whatsapp')) {
          sanitized[key] = sanitizePhone(value) as T[Extract<keyof T, string>];
        } else {
          sanitized[key] = sanitizeString(value) as T[Extract<keyof T, string>];
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursivamente sanitizar objetos aninhados
        sanitized[key] = sanitizeObject(value as Record<string, unknown>) as T[Extract<keyof T, string>];
      } else if (Array.isArray(value)) {
        // Sanitizar arrays
        sanitized[key] = value.map((item) => {
          if (typeof item === 'string') {
            return sanitizeString(item);
          } else if (typeof item === 'object' && item !== null) {
            return sanitizeObject(item as Record<string, unknown>);
          }
          return item;
        }) as T[Extract<keyof T, string>];
      }
    }
  }
  
  return sanitized;
}

/**
 * Sanitiza dados antes de salvar no localStorage
 * 
 * @param data - Dados a serem sanitizados
 * @returns Dados sanitizados prontos para localStorage
 */
export function sanitizeForStorage<T>(data: T): T {
  if (typeof data === 'string') {
    return sanitizeString(data) as T;
  } else if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map((item) => sanitizeForStorage(item)) as T;
    } else {
      return sanitizeObject(data as Record<string, unknown>) as T;
    }
  }
  
  return data;
}

/**
 * Escapa HTML para prevenir XSS ao exibir dados do usuário
 * 
 * @param text - Texto a ser escapado
 * @returns Texto escapado
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Sanitiza sequências de escape Unicode inválidas que podem causar erros
 * ao fazer JSON.parse() ou JSON.stringify()
 * 
 * Corrige sequências como \u seguido de caracteres não-hexadecimais
 * ou sequências incompletas
 * 
 * @param text - Texto a ser sanitizado
 * @returns Texto com sequências de escape Unicode corrigidas
 */
export function sanitizeUnicodeEscapes(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }
  
  // Corrigir sequências \u inválidas ou incompletas
  // Padrão: \u seguido de exatamente 4 dígitos hexadecimais
  // Se não for válido, remover o \u ou completar com zeros
  
  return text
    // Corrigir \u seguido de menos de 4 caracteres hexadecimais
    .replace(/\\u([0-9a-fA-F]{0,3})(?![0-9a-fA-F])/g, (match, hex) => {
      // Se tiver menos de 4 dígitos, completar com zeros à direita
      if (hex.length < 4) {
        const padded = hex.padEnd(4, '0');
        return `\\u${padded}`;
      }
      return match;
    })
    // Corrigir \u seguido de caracteres não-hexadecimais (remover o \u)
    .replace(/\\u([^0-9a-fA-F])/g, '$1')
    // Corrigir \u no final da string (remover)
    .replace(/\\u$/g, '')
    // Corrigir \u seguido de espaço ou quebra de linha (remover o \u)
    .replace(/\\u(\s)/g, '$1')
    // Garantir que \u válidos sejam mantidos (4 dígitos hexadecimais)
    .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
      // Validar que é um código Unicode válido
      const code = parseInt(hex, 16);
      if (code >= 0 && code <= 0x10FFFF) {
        return match; // Manter sequência válida
      }
      // Se inválido, remover
      return '';
    });
}

/**
 * Sanitiza texto de letras removendo sequências de escape Unicode inválidas
 * e garantindo que seja seguro para serialização JSON
 * 
 * @param lyrics - Texto da letra a ser sanitizado
 * @returns Texto sanitizado e seguro para JSON
 */
export function sanitizeLyricsText(lyrics: string): string {
  if (typeof lyrics !== 'string') {
    return String(lyrics);
  }
  
  // Aplicar sanitização de Unicode
  let sanitized = sanitizeUnicodeEscapes(lyrics);
  
  // Remover caracteres de controle (exceto \n, \r, \t)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalizar quebras de linha
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  return sanitized;
}

