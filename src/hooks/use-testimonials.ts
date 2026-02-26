import { useQuery } from "@tanstack/react-query";

export interface Testimonial {
  id: string;
  name: string;
  content?: string;
  avatar_url?: string | null;
  rating?: number | null;
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
    avatar_url: 'https://i.pravatar.cc/150?img=1',
    is_active: true
  },
  {
    id: 't2',
    name: 'Maria S.',
    content: '"Uma música incrível! Eu amei, e meu marido chorou muito. Postei nas redes e enviei para toda a família para que pudessem cantar louvando a Deus. Obrigada por todo o seu trabalho, que Deus abençoe a todos vocês!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=2',
    is_active: true
  },
  {
    id: 't3',
    name: 'Ana Paula R.',
    content: '"Fiquei emocionada ao ouvir a música! Ficou exatamente como eu queria. Minha mãe adorou e todos da família ficaram impressionados com a qualidade. Recomendo de olhos fechados!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=3',
    is_active: true
  },
  {
    id: 't4',
    name: 'Carlos M.',
    content: '"Surpreendente! A música superou todas as minhas expectativas. A letra é linda e a produção está impecável. Valeu cada centavo investido. Já estou pensando em fazer outra!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=4',
    is_active: true
  },
  {
    id: 't5',
    name: 'Juliana F.',
    content: '"Não tenho palavras para descrever o quanto amei! A música ficou perfeita e emocionou todos que ouviram. O atendimento foi excelente e o resultado superou qualquer expectativa."',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=5',
    is_active: true
  },
  {
    id: 't6',
    name: 'Roberto L.',
    content: '"Profissionalismo e qualidade em cada detalhe! A música ficou exatamente como eu imaginava. Minha esposa ficou encantada e todos os convidados elogiaram muito. Obrigado!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=6',
    is_active: true
  },
  {
    id: 't7',
    name: 'Fernanda C.',
    content: '"Simplesmente perfeito! A letra capturou exatamente o que eu queria expressar. A qualidade do áudio é incrível e a entrega foi super rápida. Estou muito satisfeita!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=7',
    is_active: true
  },
  {
    id: 't8',
    name: 'Pedro H.',
    content: '"Melhor presente que já dei! A música emocionou minha namorada e todos que ouviram. O processo foi simples e o resultado foi além do esperado. Recomendo muito!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=8',
    is_active: true
  },
  {
    id: 't9',
    name: 'Luciana T.',
    content: '"Incrível! A música ficou linda e tocou o coração de todos. A equipe foi muito atenciosa e entenderam perfeitamente o que eu queria. Ficou exatamente como sonhei!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=9',
    is_active: true
  },
  {
    id: 't10',
    name: 'Marcos A.',
    content: '"Surpreendente! A qualidade é profissional e a letra é emocionante. Minha mãe chorou de emoção ao ouvir. Valeu muito a pena e já recomendei para vários amigos!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=10',
    is_active: true
  },
  {
    id: 't11',
    name: 'Patricia N.',
    content: '"Amei cada segundo da música! Ficou perfeita e emocionou toda a família. O atendimento foi excelente e a entrega superou o prazo. Já estou planejando fazer outra!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=11',
    is_active: true
  },
  {
    id: 't12',
    name: 'Ricardo S.',
    content: '"Profissionalismo de primeira! A música ficou exatamente como eu queria. Minha esposa ficou encantada e todos elogiaram muito. O investimento valeu cada centavo!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=12',
    is_active: true
  },
  {
    id: 't13',
    name: 'Camila D.',
    content: '"Não tenho palavras! A música é linda e emocionante. Todos que ouviram ficaram impressionados. O processo foi simples e o resultado superou qualquer expectativa!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=13',
    is_active: true
  },
  {
    id: 't14',
    name: 'Bruno K.',
    content: '"Simplesmente incrível! A qualidade é profissional e a letra é emocionante. Minha namorada ficou muito feliz e todos elogiaram. Recomendo de olhos fechados!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=14',
    is_active: true
  },
  {
    id: 't15',
    name: 'Amanda G.',
    content: '"Perfeito em todos os detalhes! A música ficou linda e tocou o coração de todos. A equipe foi muito atenciosa e entenderam perfeitamente o que eu queria expressar."',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=15',
    is_active: true
  },
  {
    id: 't16',
    name: 'Thiago P.',
    content: '"Melhor investimento que fiz! A música superou todas as expectativas e emocionou minha mãe. A qualidade é profissional e a entrega foi rápida. Muito obrigado!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=16',
    is_active: true
  },
  {
    id: 't17',
    name: 'Renata V.',
    content: '"Amei demais! A música ficou exatamente como eu imaginava. Todos que ouviram ficaram emocionados e elogiaram muito. O atendimento foi excelente do início ao fim!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=17',
    is_active: true
  },
  {
    id: 't18',
    name: 'Felipe J.',
    content: '"Surpreendente! A qualidade é incrível e a letra é emocionante. Minha esposa ficou encantada e todos os convidados elogiaram. Valeu muito a pena!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=18',
    is_active: true
  },
  {
    id: 't19',
    name: 'Isabela M.',
    content: '"Perfeito! A música ficou linda e emocionou toda a família. O processo foi simples e o resultado superou qualquer expectativa. Já estou pensando em fazer outra!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=19',
    is_active: true
  },
  {
    id: 't20',
    name: 'Gabriel O.',
    content: '"Incrível! A música ficou exatamente como eu queria. A qualidade é profissional e a letra é emocionante. Minha namorada ficou muito feliz. Recomendo muito!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=20',
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
