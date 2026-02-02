// ✅ OTIMIZAÇÃO: Lazy load de zod para reduzir bundle inicial
let zodModule: typeof import('zod') | null = null;
let emailSchema: any = null;
let whatsappSchema: any = null;

// Função para carregar zod dinamicamente
async function loadZod() {
  if (!zodModule) {
    zodModule = await import('zod');
    const z = zodModule.z;
    
    emailSchema = z.string()
      .trim()
      .min(1, { message: "Email é obrigatório" })
      .email({ message: "Digite um email válido (ex: seu@email.com)" })
      .max(255, { message: "Email muito longo" });

    whatsappSchema = z.string()
      .trim()
      .refine((val) => {
        const numbers = val.replace(/\D/g, '');
        return numbers.length >= 10 && numbers.length <= 11;
      }, { message: "WhatsApp inválido. Digite DDD + número (ex: (11) 99999-9999)" });
  }
  return zodModule;
}

// Exportar emailSchema para uso no Checkout.tsx
export async function getEmailSchema() {
  await loadZod();
  return emailSchema;
}

// ✅ OTIMIZAÇÃO CRÍTICA: NÃO inicializar zod imediatamente
// Removido loadZod() aqui para evitar carregamento prematuro
// Zod será carregado apenas quando validateEmail ou validateWhatsApp forem chamados

export function useCheckoutValidation() {
  const validateEmail = async (email: string): Promise<{ isValid: boolean; error: string }> => {
    try {
      await loadZod();
      if (!emailSchema) {
        return { isValid: false, error: 'Validação não disponível' };
      }
      emailSchema.parse(email);
      return { isValid: true, error: '' };
    } catch (error) {
      const zod = await loadZod();
      if (error instanceof zod.ZodError) {
        return { isValid: false, error: error.errors[0].message };
      }
      return { isValid: false, error: 'Email inválido' };
    }
  };

  const validateWhatsApp = async (whatsapp: string): Promise<{ isValid: boolean; error: string }> => {
    try {
      await loadZod();
      if (!whatsappSchema) {
        return { isValid: false, error: 'Validação não disponível' };
      }
      whatsappSchema.parse(whatsapp);
      return { isValid: true, error: '' };
    } catch (error) {
      const zod = await loadZod();
      if (error instanceof zod.ZodError) {
        return { isValid: false, error: error.errors[0].message };
      }
      return { isValid: false, error: 'WhatsApp inválido' };
    }
  };

  const formatWhatsApp = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    const limitedNumbers = numbers.slice(0, 11);
    
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
    } else {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7, 11)}`;
    }
  };

  const normalizeWhatsApp = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    const cleanNumbers = numbers.startsWith('55') ? numbers.slice(2) : numbers;
    return `55${cleanNumbers}`;
  };

  return {
    validateEmail,
    validateWhatsApp,
    formatWhatsApp,
    normalizeWhatsApp,
  };
}

