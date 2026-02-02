import { useState, useRef } from 'react';

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
  session_id?: string;
}

export interface CheckoutState {
  quiz: QuizData | null;
  email: string;
  emailError: string;
  whatsapp: string;
  whatsappError: string;
  selectedPlan: string;
  loading: boolean;
  processing: boolean;
  retryCount: number;
  shouldRedirect: boolean;
  lastClickTime: number;
  currentlyPlaying: number | null;
  currentTimes: { [key: number]: number };
  durations: { [key: number]: number };
  buttonError: boolean;
  cameFromRestore: boolean;
  isRedirecting: boolean;
}

export function useCheckoutState(initialPlan: string) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappError, setWhatsappError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);
  const [currentTimes, setCurrentTimes] = useState<{ [key: number]: number }>({ 0: 0, 1: 0 });
  const [durations, setDurations] = useState<{ [key: number]: number }>({ 0: 0, 1: 0 });
  const [buttonError, setButtonError] = useState(false);
  const [cameFromRestore, setCameFromRestore] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Refs para evitar múltiplas execuções
  const toastShownRef = useRef(false);
  const hasProcessedRef = useRef(false);
  const isRedirectingRef = useRef(false);
  const audioElementsRef = useRef<{ [key: number]: HTMLAudioElement | null }>({ 0: null, 1: null });

  return {
    // State
    quiz,
    setQuiz,
    email,
    setEmail,
    emailError,
    setEmailError,
    whatsapp,
    setWhatsapp,
    whatsappError,
    setWhatsappError,
    selectedPlan,
    setSelectedPlan,
    loading,
    setLoading,
    processing,
    setProcessing,
    retryCount,
    setRetryCount,
    shouldRedirect,
    setShouldRedirect,
    lastClickTime,
    setLastClickTime,
    currentlyPlaying,
    setCurrentlyPlaying,
    currentTimes,
    setCurrentTimes,
    durations,
    setDurations,
    buttonError,
    setButtonError,
    cameFromRestore,
    setCameFromRestore,
    isRedirecting,
    setIsRedirecting,
    // Refs
    toastShownRef,
    hasProcessedRef,
    isRedirectingRef,
    audioElementsRef,
  };
}

