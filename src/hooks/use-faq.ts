import { useQuery } from "@tanstack/react-query";

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  display_order?: number;
  is_active: boolean;
}

export const defaultFaqItems: FAQItem[] = [
  {
    id: '1',
    question: 'What makes these songs special?',
    answer: 'Each song is created exclusively for you, with personalized lyrics based on your story and feelings. We compose unique melodies that touch the heart.',
    is_active: true
  },
  {
    id: '2',
    question: 'How long does it take to receive my song?',
    answer: 'Standard delivery is within 48 hours. We also offer express delivery options for those who need it sooner.',
    is_active: true
  },
  {
    id: '3',
    question: 'Can I get my song even faster?',
    answer: 'Yes! We have express delivery options available. Just select that option after filling out the questionnaire for your song.',
    is_active: true
  },
  {
    id: '4',
    question: 'What topics can I request a song about?',
    answer: 'You can create songs about any topic: love, gratitude, birthdays, weddings, tributes, friendship, milestones and much more. If there\'s a story, we turn it into music.',
    is_active: true
  },
  {
    id: '5',
    question: 'How does the creation process work?',
    answer: 'It\'s simple: you answer a questionnaire about the person and the occasion, our technology generates the personalized lyrics, and our producers finalize the composition and melody.',
    is_active: true
  },
  {
    id: '6',
    question: 'How will I receive the finished song?',
    answer: 'You\'ll receive an exclusive link via email to listen and download your song in high quality, ready to share or give as a gift.',
    is_active: true
  },
  {
    id: '7',
    question: 'Will I own the rights to the song?',
    answer: 'Yes! The song is yours for personal use: at events, on social media, in videos, or for special moments. It\'s a unique and timeless gift.',
    is_active: true
  }
];

/**
 * Hook para buscar FAQs com cache agressivo e fallback para dados locais
 */
export function useFAQ() {
  return useQuery({
    queryKey: ['faqs'],
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO: Não fazer chamadas ao Supabase em desenvolvimento local se não necessário
      if (import.meta.env.DEV) {
        return defaultFaqItems;
      }

      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase
          .from('faqs')
          .select('*')
          .eq('is_active', true);

        if (error) throw error;
        
        if (!data || data.length === 0) return defaultFaqItems;

        // Ordenar se display_order existir
        const hasDisplayOrder = data.some((f: any) => typeof f?.display_order === 'number');
        return hasDisplayOrder
          ? [...data].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
          : data;
      } catch (err) {
        console.error('Erro ao buscar FAQs, usando fallback:', err);
        return defaultFaqItems;
      }
    },
    // ✅ CACHE AGRESSIVO: FAQs mudam raramente
    staleTime: 1000 * 60 * 60 * 24, // 24 horas
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 dias
    retry: 2,
    placeholderData: defaultFaqItems
  });
}
