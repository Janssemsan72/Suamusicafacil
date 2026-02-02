/**
 * Validações do Checkout
 */
import { z } from 'zod';

export const emailSchema = z.string()
  .trim()
  .min(1, { message: "Email é obrigatório" })
  .email({ message: "Digite um email válido (ex: seu@email.com)" })
  .max(255, { message: "Email muito longo" });

export const whatsappSchema = z.string()
  .trim()
  .refine((val) => {
    const numbers = val.replace(/\D/g, '');
    return numbers.length >= 10 && numbers.length <= 11;
  }, { message: "WhatsApp inválido. Digite DDD + número (ex: (11) 99999-9999)" });

export function validateEmail(email: string): { valid: boolean; error?: string } {
  try {
    emailSchema.parse(email);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Email inválido' };
  }
}

export function validateWhatsapp(whatsapp: string): { valid: boolean; error?: string } {
  try {
    whatsappSchema.parse(whatsapp);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'WhatsApp inválido' };
  }
}

export function formatWhatsappForHotmart(whatsapp: string): string {
  const numbers = whatsapp.replace(/\D/g, '');
  if (!numbers.startsWith('55')) {
    return '55' + numbers;
  }
  return numbers;
}

