/**
 * Email Headers Utility
 * 
 * Funções para gerar headers de email padronizados que melhoram deliverability
 * e garantem compliance com leis de email marketing.
 */

export interface EmailHeaders {
  'List-Unsubscribe'?: string;
  'List-Unsubscribe-Post'?: string;
  'Precedence'?: string;
  'X-Auto-Response-Suppress'?: string;
  'Message-ID'?: string;
  'Return-Path'?: string;
  'X-Mailer'?: string;
  'X-Entity-Ref-ID'?: string;
  'Priority'?: string;
  'X-Priority'?: string;
  'X-MSMail-Priority'?: string;
  'Importance'?: string;
  'Content-Type'?: string;
  'MIME-Version'?: string;
}

/**
 * Gera headers de email padronizados para melhorar deliverability
 * 
 * @param recipientEmail - Email do destinatário
 * @param unsubscribeToken - Token único para unsubscribe (opcional, será gerado se não fornecido)
 * @param baseUrl - URL base do site (ex: https://suamusicafacil.com)
 * @param isTransactional - Se true, trata como email transacional (não marketing)
 * @param enableAvatar - Se true, permite exibição de avatar (Gravatar). Se false, previne avatar automático
 * @returns Objeto com headers de email
 */
export function getEmailHeaders(
  recipientEmail: string,
  unsubscribeToken?: string,
  baseUrl: string = 'https://suamusicafacil.com',
  isTransactional: boolean = true,
  enableAvatar: boolean = true
): EmailHeaders {
  // Gerar token de unsubscribe se não fornecido
  const token = unsubscribeToken || generateUnsubscribeToken(recipientEmail);
  
  // URL do endpoint de unsubscribe
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe?token=${token}&email=${encodeURIComponent(recipientEmail)}`;
  
  // Gerar Message-ID único
  const messageId = generateMessageId(recipientEmail);
  
  // Extrair domínio do baseUrl para Return-Path
  const domain = baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const returnPath = `bounce@${domain}`;
  
  // Headers base
  const headers: EmailHeaders = {
    // List-Unsubscribe: Obrigatório por lei em muitos países (CAN-SPAM, GDPR, etc.)
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    
    // List-Unsubscribe-Post: Permite unsubscribe com um clique (RFC 8058)
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    
    // X-Auto-Response-Suppress: Evita auto-respostas (out of office, etc.)
    'X-Auto-Response-Suppress': 'All',
    
    // Message-ID: ID único para rastreamento (formato compatível com Outlook)
    'Message-ID': messageId,
    
    // X-Mailer: Identifica o sistema de envio
    'X-Mailer': 'Sua Música Fácil Email System v2.0',
    
    // Return-Path: Email para bounces (importante para deliverability)
    'Return-Path': returnPath,
    
    // Priority: Normal para emails transacionais (não urgente, não baixa)
    'Priority': 'normal',
    'X-Priority': '3',
    
    // ✅ Headers específicos para Outlook (melhor deliverability)
    'X-MSMail-Priority': 'Normal',
    'Importance': 'normal',
    
    // Content-Type: Especifica tipo MIME
    'Content-Type': 'text/html; charset=UTF-8',
    'MIME-Version': '1.0',
  };
  
  // Precedence: Para emails transacionais, usar 'auto' ou omitir
  // 'bulk' pode ser problemático para emails transacionais importantes
  if (!isTransactional) {
    headers['Precedence'] = 'bulk';
  }
  // Para transacionais, não adicionar Precedence (melhor para deliverability)
  
  // X-Entity-Ref-ID: Controla exibição de avatar
  // Se enableAvatar = false, previne avatar automático
  // Se enableAvatar = true, permite Gravatar (não adiciona o header)
  if (!enableAvatar) {
    headers['X-Entity-Ref-ID'] = 'noreply';
  }
  // Quando enableAvatar = true, não adicionamos X-Entity-Ref-ID
  // Isso permite que clientes de email usem Gravatar ou outras formas de avatar
  
  return headers;
}

/**
 * Gera token único para unsubscribe
 * 
 * @param email - Email do destinatário
 * @returns Token único
 */
function generateUnsubscribeToken(email: string): string {
  // Usar timestamp + email hash para gerar token único
  const timestamp = Date.now();
  const emailHash = simpleHash(email);
  return `${timestamp}-${emailHash}`.substring(0, 32);
}

/**
 * Gera Message-ID único para o email
 * 
 * @param recipientEmail - Email do destinatário
 * @returns Message-ID no formato padrão (compatível com Outlook)
 */
function generateMessageId(recipientEmail: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const domain = 'suamusicafacil.com';
  // ✅ Formato melhorado para compatibilidade com Outlook e outros clientes
  // Usar formato RFC 5322 padrão: <local-part@domain>
  const emailHash = simpleHash(recipientEmail).substring(0, 8);
  return `<${timestamp}.${emailHash}.${random}@${domain}>`;
}

/**
 * Hash simples para email (não criptográfico, apenas para token)
 * 
 * @param str - String para hash
 * @returns Hash hexadecimal
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Converte headers para formato de string (para uso em APIs que não aceitam objeto)
 * 
 * @param headers - Objeto de headers
 * @returns Array de strings no formato "Header: Value"
 */
export function headersToStringArray(headers: EmailHeaders): string[] {
  return Object.entries(headers)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`);
}

/**
 * Adiciona headers ao payload do Resend
 * 
 * @param payload - Payload do Resend
 * @param headers - Headers a adicionar
 * @returns Payload atualizado
 */
export function addHeadersToResendPayload(
  payload: any,
  headers: EmailHeaders
): any {
  // Resend aceita headers customizados no campo 'headers'
  if (!payload.headers) {
    payload.headers = {};
  }
  
  // Adicionar cada header
  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) {
      payload.headers[key] = value;
    }
  });
  
  return payload;
}
