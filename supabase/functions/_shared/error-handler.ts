/**
 * Helper centralizado para tratamento de erros
 * Padroniza respostas de erro e logging
 */

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

/**
 * Cria resposta de erro padronizada
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string = 'Erro interno do servidor',
  statusCode: number = 500,
  code?: string
): { response: Response; logMessage: string } {
  const timestamp = new Date().toISOString();
  
  let errorMessage = defaultMessage;
  let errorDetails: any = undefined;
  
  if (error instanceof Error) {
    errorMessage = error.message || defaultMessage;
    errorDetails = {
      name: error.name,
      stack: error.stack,
    };
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    errorMessage = (error as any).message || defaultMessage;
    errorDetails = error;
  }

  const errorResponse: ErrorResponse = {
    error: errorMessage,
    code: code || `ERR_${statusCode}`,
    timestamp,
    ...(errorDetails && { details: errorDetails }),
  };

  const logMessage = `❌ [ErrorHandler] ${errorMessage}${code ? ` (${code})` : ''}`;

  return {
    response: new Response(
      JSON.stringify(errorResponse),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    ),
    logMessage,
  };
}

/**
 * Wrapper para funções async com tratamento de erro automático
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string = 'Function',
  defaultError: string = 'Erro ao processar requisição'
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`❌ [${context}] Erro capturado:`, error);
    const { response } = createErrorResponse(error, defaultError);
    throw response;
  }
}

/**
 * Valida se um valor é um UUID válido
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Normaliza domínios de email comuns que podem ter erros de digitação
 * 
 * @param email - Email a ser normalizado
 * @returns Email com domínio corrigido
 */
export function normalizeEmailDomain(email: string): string {
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
 * Normaliza um email: remove espaços, converte para lowercase e corrige domínios comuns
 * 
 * @param email - Email a ser normalizado
 * @returns Email normalizado
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  // Remover caracteres perigosos, trim e lowercase
  let normalized = email
    .replace(/[<>'"&]/g, '') // Remove caracteres perigosos
    .trim()
    .toLowerCase();
  
  // Normalizar domínios comuns com erros de digitação
  normalized = normalizeEmailDomain(normalized);
  
  return normalized;
}

/**
 * Valida se um email é válido
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida se um número de telefone está em formato E.164
 */
export function isValidE164(phone: string): boolean {
  const e164Regex = /^\+?[1-9]\d{1,14}$/;
  return e164Regex.test(phone.replace(/\D/g, ''));
}
