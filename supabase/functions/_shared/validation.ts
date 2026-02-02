// ✅ VALIDAÇÃO: Sistema de validação robusto para edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface ValidationResult {
  data: any;
  error: string | null;
}

export interface ValidationOptions {
  requiredFields?: string[];
  allowedMethods?: string[];
  maxBodySize?: number;
  validateAuth?: boolean;
}

/**
 * Valida request HTTP com opções configuráveis
 */
export async function validateRequest(
  req: Request, 
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const {
    requiredFields = [],
    allowedMethods = ['POST', 'GET', 'OPTIONS'],
    maxBodySize = 1024 * 1024, // 1MB
    validateAuth = false
  } = options;

  try {
    // 1. Validar método HTTP
    if (!allowedMethods.includes(req.method)) {
      return {
        data: null,
        error: `Método ${req.method} não permitido. Métodos aceitos: ${allowedMethods.join(', ')}`
      };
    }

    // 2. Validar Content-Type para métodos que esperam body
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return {
          data: null,
          error: 'Content-Type deve ser application/json'
        };
      }
    }

    // 3. Validar tamanho do body
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxBodySize) {
      return {
        data: null,
        error: `Body muito grande. Máximo permitido: ${maxBodySize} bytes`
      };
    }

    // 4. Validar autenticação se necessário
    if (validateAuth) {
      const authError = await validateAuthentication(req);
      if (authError) {
        return { data: null, error: authError };
      }
    }

    // 5. Parse do JSON se necessário
    let data: Record<string, unknown> = {};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        data = (await req.json()) as Record<string, unknown>;
      } catch (error) {
        return {
          data: null,
          error: 'JSON inválido no body da requisição'
        };
      }
    }

    // 6. Validar campos obrigatórios
    if (requiredFields.length > 0) {
      const missingFields = requiredFields.filter(field => 
        !data || data[field] === undefined || data[field] === null || data[field] === ''
      );
      
      if (missingFields.length > 0) {
        return {
          data: null,
          error: `Campos obrigatórios faltando: ${missingFields.join(', ')}`
        };
      }
    }

    return { data, error: null };

  } catch (error: any) {
    return {
      data: null,
      error: `Erro na validação: ${error.message}`
    };
  }
}

/**
 * Valida autenticação via Supabase
 */
async function validateAuthentication(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    return 'Header Authorization é obrigatório';
  }

  if (!authHeader.startsWith('Bearer ')) {
    return 'Formato de Authorization inválido. Use: Bearer <token>';
  }

  const token = authHeader.substring(7);
  
  if (!token || token.length < 10) {
    return 'Token de autenticação inválido';
  }

  // Validar token com Supabase
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return 'Configuração do Supabase não encontrada';
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return 'Token de autenticação inválido ou expirado';
    }

    return null; // Autenticação válida
  } catch (error) {
    return 'Erro ao validar autenticação';
  }
}

/**
 * Valida dados específicos de pedidos
 */
export function validateOrderData(data: any): string | null {
  if (!data) return 'Dados do pedido são obrigatórios';

  // Validar email
  if (data.customer_email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.customer_email)) {
      return 'Email inválido';
    }
  }

  // Validar plano
  if (data.plan) {
    const validPlans = ['standard', 'express', 'pt_express', 'en_standard', 'en_express', 'es_standard', 'es_express'];
    if (!validPlans.includes(data.plan)) {
      return `Plano inválido. Planos aceitos: ${validPlans.join(', ')}`;
    }
  }

  // Validar idioma
  if (data.language) {
    const validLanguages = ['pt', 'en', 'es'];
    if (!validLanguages.includes(data.language)) {
      return `Idioma inválido. Idiomas aceitos: ${validLanguages.join(', ')}`;
    }
  }

  return null;
}

/**
 * Valida dados do quiz
 */
export function validateQuizData(quiz: any): string[] {
  const errors: string[] = [];

  if (!quiz) {
    return ['Dados do questionário não encontrados'];
  }

  // Validar about_who (obrigatório, 1-100 caracteres)
  if (!quiz.about_who || typeof quiz.about_who !== 'string' || !quiz.about_who.trim()) {
    errors.push('Nome (about_who) é obrigatório');
  } else if (quiz.about_who.trim().length > 100) {
    errors.push('Nome deve ter no máximo 100 caracteres');
  }
  
  // Validar relationship (obrigatório, 1-100 caracteres)
  if (!quiz.relationship || typeof quiz.relationship !== 'string' || !quiz.relationship.trim()) {
    errors.push('Relacionamento é obrigatório');
  } else if (quiz.relationship.trim().length > 100) {
    errors.push('Relacionamento deve ter no máximo 100 caracteres');
  }
  
  // Validar style (obrigatório, 1-50 caracteres)
  if (!quiz.style || typeof quiz.style !== 'string' || !quiz.style.trim()) {
    errors.push('Estilo musical é obrigatório');
  } else if (quiz.style.trim().length > 50) {
    errors.push('Estilo musical deve ter no máximo 50 caracteres');
  }
  
  // Validar language (obrigatório, deve ser pt, en ou es)
  const allowedLanguages = ['pt', 'en', 'es'];
  if (!quiz.language || typeof quiz.language !== 'string' || !allowedLanguages.includes(quiz.language)) {
    errors.push('Idioma deve ser pt, en ou es');
  }
  
  // Validar occasion (obrigatório no novo padrão; opcional para legado - max 150 caracteres)
  if (quiz.occasion !== undefined && quiz.occasion !== null) {
    if (typeof quiz.occasion !== 'string' || (quiz.occasion.trim && quiz.occasion.trim().length === 0)) {
      errors.push('Ocasião deve ser um texto não vazio quando informada');
    } else if (String(quiz.occasion).trim().length > 150) {
      errors.push('Ocasião deve ter no máximo 150 caracteres');
    }
  }
  
  // Validar vocal_gender (opcional, mas se fornecido deve ser m, f ou null)
  if (quiz.vocal_gender !== null && quiz.vocal_gender !== undefined && quiz.vocal_gender !== '') {
    const allowedGenders = ['m', 'f'];
    if (!allowedGenders.includes(quiz.vocal_gender)) {
      errors.push('Gênero vocal deve ser m ou f');
    }
  }
  
  // Validar message (obrigatório no novo padrão; legado pode ter qualities+memories+key_moments)
  const hasMessage = quiz.message && typeof quiz.message === 'string' && String(quiz.message).trim();
  const hasLegacyContext = (quiz.qualities && String(quiz.qualities).trim()) ||
    (quiz.memories && String(quiz.memories).trim()) ||
    (quiz.key_moments && String(quiz.key_moments).trim());
  if (!hasMessage && !hasLegacyContext) {
    errors.push('História/Mensagem ou contexto (qualities/memories/key_moments) é obrigatório');
  } else if (hasMessage && String(quiz.message).trim().length > 2500) {
    errors.push('Mensagem deve ter no máximo 2500 caracteres');
  }

  return errors;
}

/**
 * Valida dados de geração de música
 */
export function validateMusicGenerationData(data: any): string | null {
  if (!data) return 'Dados de geração são obrigatórios';

  // Validar job_id
  if (!data.job_id) {
    return 'job_id é obrigatório';
  }

  if (typeof data.job_id !== 'string' || data.job_id.length < 10) {
    return 'job_id deve ser uma string válida';
  }

  // Validar letra se fornecida
  if (data.lyrics) {
    if (typeof data.lyrics !== 'string' || data.lyrics.length < 10) {
      return 'Letra deve ter pelo menos 10 caracteres';
    }
  }

  // Validar estilo
  if (data.style) {
    const validStyles = ['pop', 'rock', 'jazz', 'classical', 'electronic', 'country', 'blues', 'folk'];
    if (!validStyles.includes(data.style.toLowerCase())) {
      return `Estilo inválido. Estilos aceitos: ${validStyles.join(', ')}`;
    }
  }

  return null;
}

/**
 * Valida dados de webhook
 */
export function validateWebhookData(data: any, webhookType: 'cakto' | 'resend'): string | null {
  if (!data) return 'Dados do webhook são obrigatórios';

  switch (webhookType) {
    case 'cakto':
      if (!data.transaction_id || !data.status) {
        return 'transaction_id e status são obrigatórios para webhook Cakto';
      }
      const validStatuses = ['approved', 'pending', 'cancelled', 'failed'];
      if (!validStatuses.includes(data.status)) {
        return `Status inválido. Status aceitos: ${validStatuses.join(', ')}`;
      }
      break;

    case 'resend':
      if (!data.type && !data.event) {
        return 'Tipo de evento é obrigatório para webhook Resend';
      }
      break;
  }

  return null;
}

/**
 * Sanitiza dados removendo informações sensíveis
 */
export function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };
  
  // Remover campos sensíveis
  const sensitiveFields = [
    'password', 'api_key', 'secret', 'token', 'authorization',
    'suno_api_key', 'resend_api_key',
    'cakto_secret', 'service_role_key'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      delete sanitized[field];
    }
  });

  // Sanitizar objetos aninhados
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  });

  return sanitized;
}

/**
 * Valida rate limiting
 */
export async function validateRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minuto
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  // Implementação básica - em produção usar Redis ou similar
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Simular verificação de rate limit
  // Em produção, isso seria feito com Redis ou banco de dados
  return {
    allowed: true,
    remaining: maxRequests - 1,
    resetTime: now + windowMs
  };
}

/**
 * Valida origem da requisição
 */
export function validateOrigin(origin: string | null): boolean {
  const allowedOrigins = [
    'https://musiclovely.com',
    'https://www.musiclovely.com',
    'http://localhost:8084',
    'http://localhost:5173',
    'http://127.0.0.1:8084',
    'http://127.0.0.1:5173'
  ];

  return !origin || allowedOrigins.includes(origin);
}

/**
 * Validação completa para edge functions
 */
export async function validateEdgeFunctionRequest(
  req: Request,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  // 1. Validar origem
  const origin = req.headers.get('origin');
  if (!validateOrigin(origin)) {
    return {
      data: null,
      error: 'Origem não permitida'
    };
  }

  // 2. Validar request básico
  const result = await validateRequest(req, options);
  if (result.error) {
    return result;
  }

  // 3. Sanitizar dados
  if (result.data) {
    result.data = sanitizeData(result.data);
  }

  return result;
}
