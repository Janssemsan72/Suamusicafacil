/**
 * Hook para validação em tempo real do quiz
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  validateQuiz,
  validateQuizRequired,
  sanitizeQuiz,
  formatValidationErrors,
  type QuizData,
  type ValidationResult,
} from '@/utils/quizValidation';
import { useDebounce } from './use-debounce';

export interface UseQuizValidationOptions {
  debounceMs?: number;
  validateOnChange?: boolean;
  strict?: boolean;
}

export function useQuizValidation(
  quiz: QuizData,
  options: UseQuizValidationOptions = {}
) {
  const {
    debounceMs = 300,
    validateOnChange = true,
    strict = false,
  } = options;

  const [errors, setErrors] = useState<ValidationResult['errors']>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Debounce do quiz para evitar validações excessivas
  const debouncedQuiz = useDebounce(quiz, debounceMs);

  // Validação completa
  const validate = useCallback(
    (quizToValidate: QuizData = quiz): ValidationResult => {
      setIsValidating(true);
      const result = validateQuiz(quizToValidate, { strict });
      setErrors(result.errors);
      setIsValidating(false);
      return result;
    },
    [quiz, strict]
  );

  // Validação apenas dos campos obrigatórios
  const validateRequired = useCallback(
    (quizToValidate: QuizData = quiz): ValidationResult => {
      setIsValidating(true);
      const result = validateQuizRequired(quizToValidate);
      setErrors(result.errors);
      setIsValidating(false);
      return result;
    },
    [quiz]
  );

  // Sanitizar quiz
  const sanitize = useCallback(
    (quizToSanitize: QuizData = quiz): QuizData => {
      return sanitizeQuiz(quizToSanitize);
    },
    [quiz]
  );

  // Marcar campo como tocado
  const markFieldTouched = useCallback((field: string) => {
    setTouched((prev) => new Set(prev).add(field));
  }, []);

  // Obter erro de um campo específico
  const getFieldError = useCallback(
    (field: string): string | undefined => {
      if (!touched.has(field)) return undefined;
      const error = errors.find((e) => e.field === field);
      return error?.message;
    },
    [errors, touched]
  );

  // Verificar se campo tem erro
  const hasFieldError = useCallback(
    (field: string): boolean => {
      return touched.has(field) && errors.some((e) => e.field === field);
    },
    [errors, touched]
  );

  // Validação automática quando quiz muda (se habilitado)
  useEffect(() => {
    if (validateOnChange && touched.size > 0) {
      validate(debouncedQuiz);
    }
  }, [debouncedQuiz, validateOnChange, touched, validate]);

  // Resultado da validação
  const validationResult = useMemo<ValidationResult>(
    () => ({
      valid: errors.length === 0,
      errors,
    }),
    [errors]
  );

  // Mensagem de erro formatada
  const errorMessage = useMemo(
    () => formatValidationErrors(errors),
    [errors]
  );

  return {
    validate,
    validateRequired,
    sanitize,
    errors,
    isValid: validationResult.valid,
    isValidating,
    errorMessage,
    getFieldError,
    hasFieldError,
    markFieldTouched,
    touched,
  };
}











