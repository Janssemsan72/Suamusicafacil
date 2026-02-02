import { useQuery } from "@tanstack/react-query";

export interface Testimonial {
  id: string;
  name: string;
  content: string;
  avatar_url: string | null;
  rating: number | null;
  song_title?: string;
  type?: 'video' | 'text';
  thumbnail?: string;
  display_order?: number;
  is_active: boolean;
}

export const defaultTextTestimonials: Testimonial[] = [
  {
    id: 't1',
    name: 'Wendy B.',
    content: '"Oh, louvado seja Deus! Isso é absolutamente impressionante. Não consigo acreditar... Será difícil guardar o segredo até domingo. Vamos ouvi-la a caminho da igreja! Que Deus abençoe este trabalho que vocês estão fazendo."',
    rating: 5,
    type: 'text',
    is_active: true
  },
  {
    id: 't2',
    name: 'Maria S.',
    content: '"Uma música incrível! Eu amei, e meu marido chorou muito. Postei nas redes e enviei para toda a família para que pudessem cantar louvando a Deus. Obrigada por todo o seu trabalho, que Deus abençoe a todos vocês!"',
    rating: 5,
    type: 'text',
    is_active: true
  },
];

export const defaultVideoTestimonials: Testimonial[] = [
  { id: 'v1', song_title: 'Deus me deu a ti', type: 'video', thumbnail: 'https://picsum.photos/seed/suamusicafacil-v1/600/800', is_active: true, name: 'Cliente' },
  { id: 'v2', song_title: 'Três apertos e...', type: 'video', thumbnail: 'https://picsum.photos/seed/suamusicafacil-v2/600/800', is_active: true, name: 'Cliente' },
  { id: 'v3', song_title: 'Meu coração é teu', type: 'video', thumbnail: 'https://picsum.photos/seed/suamusicafacil-v3/600/800', is_active: true, name: 'Cliente' },
  { id: 'v4', song_title: 'O amor de mamãe...', type: 'video', thumbnail: 'https://picsum.photos/seed/suamusicafacil-v4/600/800', is_active: true, name: 'Cliente' },
  { id: 'v5', song_title: 'Corações Escolhidos', type: 'video', thumbnail: 'https://picsum.photos/seed/suamusicafacil-v5/600/800', is_active: true, name: 'Cliente' },
];

/**
 * Hook para buscar depoimentos com cache agressivo e fallback para dados locais
 */
export function useTestimonials() {
  return useQuery({
    queryKey: ['testimonials'],
    queryFn: async () => {
      // ✅ OTIMIZAÇÃO: Não fazer chamadas ao Supabase em desenvolvimento local se não necessário
      if (import.meta.env.DEV) {
        return { text: defaultTextTestimonials, video: defaultVideoTestimonials };
      }

      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase
          .from('testimonials')
          .select('*')
          .eq('is_active', true);

        if (error) throw error;
        
        if (!data || data.length === 0) {
          return { text: defaultTextTestimonials, video: defaultVideoTestimonials };
        }

        // Separar por tipo
        const text = data.filter((t: any) => t.type === 'text');
        const video = data.filter((t: any) => t.type === 'video');

        // Ordenar se display_order existir
        const sortFn = (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0);
        
        return {
          text: text.length > 0 ? text.sort(sortFn) : defaultTextTestimonials,
          video: video.length > 0 ? video.sort(sortFn) : defaultVideoTestimonials
        };
      } catch (err) {
        console.error('Erro ao buscar depoimentos, usando fallback:', err);
        return { text: defaultTextTestimonials, video: defaultVideoTestimonials };
      }
    },
    // ✅ CACHE AGRESSIVO: Depoimentos mudam raramente
    staleTime: 1000 * 60 * 60 * 24, // 24 horas
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 dias
    retry: 2,
    placeholderData: { text: defaultTextTestimonials, video: defaultVideoTestimonials }
  });
}
