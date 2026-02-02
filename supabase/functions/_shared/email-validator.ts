/**
 * Email Validator Utility
 * 
 * Funções para validar emails antes do envio, verificando:
 * - Formato válido
 * - Se está na lista de unsubscribes
 * - Se está na lista de bounces
 * - Se está na lista de emails bloqueados
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface EmailValidationResult {
  isValid: boolean;
  canSend: boolean;
  reason?: string;
  errors: string[];
}

/**
 * Valida formato de email
 * 
 * @param email - Email a validar
 * @returns true se formato é válido
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Regex básico para validação de formato
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Validações adicionais
  if (email.length > 254) { // RFC 5321
    return false;
  }

  if (email.length < 3) {
    return false;
  }

  // Verificar se não começa ou termina com ponto
  if (email.startsWith('.') || email.endsWith('.')) {
    return false;
  }

  // Verificar se não tem espaços
  if (email.includes(' ')) {
    return false;
  }

  // Verificar se não tem caracteres consecutivos inválidos
  if (email.includes('..')) {
    return false;
  }

  return emailRegex.test(email);
}

/**
 * Verifica se email está na lista de unsubscribes
 * 
 * @param supabase - Cliente Supabase
 * @param email - Email a verificar
 * @returns true se email está na lista de unsubscribes
 */
export async function isEmailUnsubscribed(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_email_unsubscribed', {
      p_email: email.toLowerCase().trim()
    });

    if (error) {
      console.error('❌ [EmailValidator] Erro ao verificar unsubscribe:', error);
      // Em caso de erro, permitir envio (fail open)
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('❌ [EmailValidator] Exceção ao verificar unsubscribe:', error);
    return false;
  }
}

/**
 * Verifica se email está na lista de bounces
 * 
 * @param supabase - Cliente Supabase
 * @param email - Email a verificar
 * @returns true se email está na lista de bounces
 */
export async function isEmailBounced(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  try {
    // Verificar na tabela email_logs por bounces recentes (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('email_logs')
      .select('id')
      .eq('recipient_email', email.toLowerCase().trim())
      .eq('status', 'bounced')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(1);

    if (error) {
      console.error('❌ [EmailValidator] Erro ao verificar bounces:', error);
      return false;
    }

    return (data && data.length > 0);
  } catch (error) {
    console.error('❌ [EmailValidator] Exceção ao verificar bounces:', error);
    return false;
  }
}

/**
 * Verifica se email está na lista de complaints (spam reports)
 * 
 * @param supabase - Cliente Supabase
 * @param email - Email a verificar
 * @returns true se email está na lista de complaints
 */
export async function isEmailComplained(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  try {
    // Verificar na tabela email_logs por complaints recentes (últimos 90 dias)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data, error } = await supabase
      .from('email_logs')
      .select('id')
      .eq('recipient_email', email.toLowerCase().trim())
      .eq('status', 'complained')
      .gte('created_at', ninetyDaysAgo.toISOString())
      .limit(1);

    if (error) {
      console.error('❌ [EmailValidator] Erro ao verificar complaints:', error);
      return false;
    }

    return (data && data.length > 0);
  } catch (error) {
    console.error('❌ [EmailValidator] Exceção ao verificar complaints:', error);
    return false;
  }
}

/**
 * Valida email completo antes do envio
 * 
 * @param supabase - Cliente Supabase
 * @param email - Email a validar
 * @returns Resultado da validação
 */
export async function validateEmailForSending(
  supabase: SupabaseClient,
  email: string
): Promise<EmailValidationResult> {
  const result: EmailValidationResult = {
    isValid: false,
    canSend: false,
    errors: []
  };

  // 1. Validar formato
  if (!isValidEmailFormat(email)) {
    result.errors.push('Invalid email format');
    result.reason = 'Formato de email inválido';
    return result;
  }

  result.isValid = true;

  // 2. Verificar unsubscribe
  const isUnsubscribed = await isEmailUnsubscribed(supabase, email);
  if (isUnsubscribed) {
    result.errors.push('Email is unsubscribed');
    result.reason = 'Email está na lista de unsubscribes';
    return result;
  }

  // 3. Verificar bounces
  const isBounced = await isEmailBounced(supabase, email);
  if (isBounced) {
    result.errors.push('Email has bounced recently');
    result.reason = 'Email teve bounce recente (últimos 30 dias)';
    // Não bloquear completamente, apenas avisar
    // result.canSend = false;
    // return result;
  }

  // 4. Verificar complaints
  const isComplained = await isEmailComplained(supabase, email);
  if (isComplained) {
    result.errors.push('Email has complained recently');
    result.reason = 'Email reportou spam recentemente (últimos 90 dias)';
    result.canSend = false;
    return result;
  }

  // Se passou todas as validações
  result.canSend = true;
  return result;
}

/**
 * Normaliza email (lowercase, trim)
 * 
 * @param email - Email a normalizar
 * @returns Email normalizado
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.toLowerCase().trim();
}

