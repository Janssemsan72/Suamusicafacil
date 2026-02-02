/**
 * Tipos compartilhados do Checkout
 */

export interface QuizData {
  id?: string;
  about_who: string;
  relationship?: string;
  style: string;
  language: string;
  vocal_gender?: string | null;
  qualities?: string;
  memories?: string;
  message?: string;
  occasion?: string;
  desired_tone?: string;
  key_moments?: string | null;
  answers?: Record<string, unknown>;
  timestamp?: string;
  whatsapp?: string;
}

export interface CheckoutDraft {
  email: string;
  whatsapp: string;
  planId: string;
  quizData: QuizData;
  transactionId: string;
  timestamp: number;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  delivery: string;
  features: string[];
  featured?: boolean;
  priceId?: string;
}

