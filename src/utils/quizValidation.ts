/**
 * Utilitário centralizado para validação de dados do quiz
 * Usado tanto no frontend quanto no backend para garantir consistência
 */

import { STYLE_LABELS, STYLE_VALUES } from "@/constants/musicStyles";

/** Campos do quiz - novo padrão: apenas about_who, relationship, occasion, style, vocal_gender, message */
export interface QuizData {
  relationship?: string;
  about_who?: string;
  occasion?: string;
  style?: string;
  language?: string;
  vocal_gender?: string | null;
  message?: string;
  customRelationship?: string;
  /** @deprecated Legado - não usado no novo quiz */
  qualities?: string;
  /** @deprecated Legado - não usado no novo quiz */
  memories?: string;
  /** @deprecated Legado - não usado no novo quiz */
  key_moments?: string;
  /** @deprecated Legado - não usado no novo quiz */
  desired_tone?: string;
  [key: string]: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Limites de caracteres conforme definido no sistema
const FIELD_LIMITS = {
  about_who: { min: 1, max: 100 },
  relationship: { min: 1, max: 100 },
  occasion: { min: 1, max: 150 },
  customRelationship: { min: 2, max: 100 },
  style: { min: 1, max: 50 },
  language: { min: 1, max: 10 },
  message: { max: 2500 },
  vocal_gender: { allowed: ['m', 'f', ''] },
} as const;

/** Limite máximo de caracteres para o campo message (história/mensagem) */
export const MESSAGE_MAX_LENGTH = FIELD_LIMITS.message.max;
export const LYRICS_MAX_LENGTH = 5000;
export const LYRICS_TITLE_MAX_LENGTH = 120;

// Idiomas permitidos
const ALLOWED_LANGUAGES = ['pt'];

// Estilos permitidos (valores e labels de musicStyles.ts)
const ALLOWED_STYLES = [
  ...STYLE_VALUES,
  ...STYLE_LABELS,
];

/**
 * Sanitiza uma string removendo espaços extras e caracteres perigosos
 */
export function sanitizeString(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().replace(/[\x00-\x1F\x7F]/g, ''); // Remove caracteres de controle
}

/**
 * Valida um campo de texto com limites
 */
function validateTextField(
  field: string,
  value: string | undefined | null,
  limits: { min?: number; max?: number },
  required = false
): ValidationError | null {
  const sanitized = sanitizeString(value);

  if (required && !sanitized) {
    // Mapear campos para mensagens amigáveis (serão traduzidas no componente)
    const fieldMessages: Record<string, string> = {
      'about_who': 'Nome é obrigatório',
      'relationship': 'Relacionamento é obrigatório',
      'occasion': 'Ocasião é obrigatória',
      'style': 'Estilo musical é obrigatório',
      'language': 'Idioma é obrigatório',
      'customRelationship': 'Relacionamento é obrigatório',
    };
    
    return {
      field,
      message: fieldMessages[field] || `${field} é obrigatório`,
    };
  }

  if (!sanitized && !required) {
    return null; // Campo opcional vazio é válido
  }

  if (limits.min && sanitized.length < limits.min) {
    return {
      field,
      message: `${field} deve ter pelo menos ${limits.min} caracteres`,
    };
  }

  if (limits.max && sanitized.length > limits.max) {
    return {
      field,
      message: `${field} deve ter no máximo ${limits.max} caracteres`,
    };
  }

  return null;
}

/**
 * Valida campo de enum (valores permitidos)
 */
function validateEnumField(
  field: string,
  value: string | undefined | null,
  allowedValues: readonly string[],
  required = false
): ValidationError | null {
  if (required && !value) {
    return {
      field,
      message: `${field} é obrigatório`,
    };
  }

  if (!value && !required) {
    return null;
  }

  if (value && !allowedValues.includes(value)) {
    return {
      field,
      message: `${field} deve ser um dos valores permitidos: ${allowedValues.join(', ')}`,
    };
  }

  return null;
}

/**
 * Validação completa do quiz
 */
export function validateQuiz(quiz: QuizData, options: { strict?: boolean } = {}): ValidationResult {
  const errors: ValidationError[] = [];
  const { strict = false } = options;

  // 1. Validar about_who (obrigatório)
  const aboutWhoError = validateTextField(
    'about_who',
    quiz.about_who,
    FIELD_LIMITS.about_who,
    true
  );
  if (aboutWhoError) errors.push(aboutWhoError);

  // 2. Validar occasion (obrigatório no novo fluxo)
  const occasionError = validateTextField(
    'occasion',
    quiz.occasion,
    FIELD_LIMITS.occasion,
    true
  );
  if (occasionError) errors.push(occasionError);

  // 3. Validar relationship (obrigatório)
  let relationship = quiz.relationship || '';
  if (relationship.startsWith('Outro: ')) {
    const customRel = relationship.replace('Outro: ', '');
    const customRelError = validateTextField(
      'customRelationship',
      customRel,
      FIELD_LIMITS.customRelationship,
      true
    );
    if (customRelError) errors.push(customRelError);
  } else {
    const relationshipError = validateTextField(
      'relationship',
      relationship,
      FIELD_LIMITS.relationship,
      true
    );
    if (relationshipError) errors.push(relationshipError);
  }

  // 4. Validar style (obrigatório)
  const styleError = validateTextField('style', quiz.style, FIELD_LIMITS.style, true);
  if (styleError) errors.push(styleError);

  // 5. Validar language (obrigatório)
  const languageError = validateEnumField('language', quiz.language, ALLOWED_LANGUAGES, true);
  if (languageError) errors.push(languageError);

  // 6. Validar vocal_gender (opcional, mas se fornecido deve ser válido)
  if (quiz.vocal_gender !== null && quiz.vocal_gender !== undefined && quiz.vocal_gender !== '') {
    const vocalGenderError = validateEnumField(
      'vocal_gender',
      quiz.vocal_gender,
      FIELD_LIMITS.vocal_gender.allowed,
      false
    );
    if (vocalGenderError) errors.push(vocalGenderError);
  }

  // 7. Validar message (obrigatório - fonte única da história no novo quiz)
  const messageError = validateTextField('message', quiz.message, FIELD_LIMITS.message, true);
  if (messageError) errors.push(messageError);

  // 8. Validação adicional em modo strict
  if (strict) {
    // Verificar se style é um dos valores permitidos
    if (quiz.style && !ALLOWED_STYLES.includes(quiz.style)) {
      errors.push({
        field: 'style',
        message: `Estilo musical deve ser um dos valores permitidos`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitiza todos os campos do quiz
 */
export function sanitizeQuiz(quiz: QuizData): QuizData {
  return {
    ...quiz,
    about_who: sanitizeString(quiz.about_who),
    occasion: sanitizeString(quiz.occasion),
    relationship: sanitizeString(quiz.relationship),
    style: sanitizeString(quiz.style),
    language: sanitizeString(quiz.language),
    message: quiz.message ? sanitizeString(quiz.message) : undefined,
    vocal_gender: (quiz.vocal_gender === '' || quiz.vocal_gender === 'm' || quiz.vocal_gender === 'f') 
      ? (quiz.vocal_gender === '' ? null : quiz.vocal_gender) 
      : null,
  };
}

/**
 * Validação rápida apenas dos campos obrigatórios
 */
export function validateQuizRequired(quiz: QuizData): ValidationResult {
  const errors: ValidationError[] = [];

  if (!quiz.about_who || !sanitizeString(quiz.about_who)) {
    errors.push({ field: 'about_who', message: 'Nome é obrigatório' });
  }

  if (!quiz.occasion || !sanitizeString(quiz.occasion)) {
    errors.push({ field: 'occasion', message: 'Ocasião é obrigatória' });
  }

  if (!quiz.style || !sanitizeString(quiz.style)) {
    errors.push({ field: 'style', message: 'Estilo musical é obrigatório' });
  }

  if (!quiz.language || !ALLOWED_LANGUAGES.includes(quiz.language)) {
    errors.push({ field: 'language', message: 'Idioma é obrigatório' });
  }

  if (!quiz.relationship || !sanitizeString(quiz.relationship)) {
    errors.push({ field: 'relationship', message: 'Relacionamento é obrigatório' });
  }

  if (!quiz.message || !sanitizeString(quiz.message)) {
    errors.push({ field: 'message', message: 'História/Mensagem é obrigatória' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Formata mensagens de erro para exibição ao usuário
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0].message;
  return `Múltiplos erros: ${errors.map((e) => e.message).join(', ')}`;
}


