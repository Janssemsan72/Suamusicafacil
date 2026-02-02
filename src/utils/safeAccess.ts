/**
 * ✅ FASE 4: Utilitários para acesso seguro a propriedades
 * Substitui optional chaining e nullish coalescing para compatibilidade
 */

/**
 * Acesso seguro a propriedades (substitui optional chaining ?.)
 */
export function safeGet<T>(obj: any, path: string, defaultValue?: T): T | undefined {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length; i++) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[keys[i]];
  }
  
  return current !== undefined ? current : defaultValue;
}

/**
 * Nullish coalescing seguro (substitui ??)
 */
export function safeNullish<T>(value: T | null | undefined, defaultValue: T): T {
  return value !== null && value !== undefined ? value : defaultValue;
}

/**
 * Verificar se valor existe antes de usar
 */
export function safeValue<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Executar função apenas se valor existir
 */
export function safeCall<T, R>(
  value: T | null | undefined,
  fn: (value: T) => R,
  defaultValue?: R
): R | undefined {
  if (value !== null && value !== undefined) {
    try {
      return fn(value);
    } catch (error) {
      console.warn('[SafeAccess] Erro ao executar função:', error);
      return defaultValue;
    }
  }
  return defaultValue;
}



