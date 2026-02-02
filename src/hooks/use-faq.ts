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
    question: 'O que torna essas músicas especiais?',
    answer: 'Cada música é criada exclusivamente para você, com letras personalizadas baseadas na sua história e sentimentos. Nossa IA compõe melodias únicas que tocam o coração.',
    is_active: true
  },
  {
    id: '2',
    question: 'Quanto tempo demora para receber a música?',
    answer: 'O prazo padrão é de até 7 dias úteis. Também oferecemos a opção de entrega expressa para quem precisa de mais agilidade.',
    is_active: true
  },
  {
    id: '3',
    question: 'Posso receber minha música em 24 horas?',
    answer: 'Sim! Temos a opção de entrega prioritária em 24 horas por um valor adicional. Basta selecionar essa opção após preencher o formulário da sua música.',
    is_active: true
  },
  {
    id: '4',
    question: 'Sobre quais temas posso pedir uma música?',
    answer: 'Você pode criar músicas sobre qualquer tema: amor, gratidão, aniversários, casamentos, homenagens, amizade, superação e muito mais. Se existe uma história, nós a transformamos em música.',
    is_active: true
  },
  {
    id: '5',
    question: 'Como funciona o processo de criação?',
    answer: 'É simples: você responde a um questionário sobre a pessoa e a ocasião, nossa tecnologia gera a letra personalizada e nossos produtores finalizam a composição e melodia.',
    is_active: true
  },
  {
    id: '6',
    question: 'Como vou receber a música finalizada?',
    answer: 'Você receberá um link exclusivo por e-mail e WhatsApp para ouvir e baixar sua música em alta qualidade, pronta para compartilhar ou presentear.',
    is_active: true
  },
  {
    id: '7',
    question: 'Eu terei os direitos da música?',
    answer: 'Sim! A música é sua para uso pessoal: em eventos, redes sociais, vídeos ou momentos especiais. É um presente único e eterno.',
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
