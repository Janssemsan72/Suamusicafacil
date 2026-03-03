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
    content: '"Oh, praise the Lord! This is absolutely stunning. I can\'t believe it... It\'s going to be so hard to keep this a secret until Sunday. We\'re going to listen to it on the way to church! God bless the work you\'re doing."',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=1',
    is_active: true
  },
  {
    id: 't2',
    name: 'Maria S.',
    content: '"An incredible song! I loved it, and my husband cried so much. I posted it on social media and sent it to the whole family. Thank you for all your work, God bless you all!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=2',
    is_active: true
  },
  {
    id: 't3',
    name: 'Sarah R.',
    content: '"I was moved to tears when I heard the song! It came out exactly how I wanted. My mom loved it and everyone in the family was impressed with the quality. I recommend it wholeheartedly!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=3',
    is_active: true
  },
  {
    id: 't4',
    name: 'Charles M.',
    content: '"Amazing! The song exceeded all my expectations. The lyrics are beautiful and the production is flawless. Worth every penny. I\'m already thinking about ordering another one!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=4',
    is_active: true
  },
  {
    id: 't5',
    name: 'Julie F.',
    content: '"I have no words to describe how much I loved it! The song came out perfect and moved everyone who heard it. The service was excellent and the result exceeded every expectation."',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=5',
    is_active: true
  },
  {
    id: 't6',
    name: 'Robert L.',
    content: '"Professionalism and quality in every detail! The song was exactly what I imagined. My wife was delighted and all the guests complimented it. Thank you!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=6',
    is_active: true
  },
  {
    id: 't7',
    name: 'Emily C.',
    content: '"Simply perfect! The lyrics captured exactly what I wanted to express. The audio quality is incredible and the delivery was super fast. I\'m very satisfied!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=7',
    is_active: true
  },
  {
    id: 't8',
    name: 'Peter H.',
    content: '"Best gift I\'ve ever given! The song moved my girlfriend and everyone who heard it. The process was simple and the result exceeded expectations. Highly recommend!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=8',
    is_active: true
  },
  {
    id: 't9',
    name: 'Lucy T.',
    content: '"Incredible! The song was beautiful and touched everyone\'s heart. The team was very attentive and understood perfectly what I wanted. It came out exactly as I dreamed!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=9',
    is_active: true
  },
  {
    id: 't10',
    name: 'Mark A.',
    content: '"Stunning! The quality is professional and the lyrics are moving. My mom cried happy tears when she heard it. Totally worth it and I\'ve already recommended it to friends!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=10',
    is_active: true
  },
  {
    id: 't11',
    name: 'Patricia N.',
    content: '"I loved every second of the song! It was perfect and moved the whole family. The service was excellent and the delivery was ahead of schedule. Already planning another one!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=11',
    is_active: true
  },
  {
    id: 't12',
    name: 'Richard S.',
    content: '"First-class professionalism! The song came out exactly as I wanted. My wife was charmed and everyone complimented it. The investment was worth every cent!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=12',
    is_active: true
  },
  {
    id: 't13',
    name: 'Camilla D.',
    content: '"I have no words! The song is beautiful and moving. Everyone who heard it was impressed. The process was simple and the result exceeded every expectation!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=13',
    is_active: true
  },
  {
    id: 't14',
    name: 'Brian K.',
    content: '"Simply incredible! The quality is professional and the lyrics are touching. My girlfriend was thrilled and everyone complimented it. I recommend it without hesitation!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=14',
    is_active: true
  },
  {
    id: 't15',
    name: 'Amanda G.',
    content: '"Perfect in every detail! The song was beautiful and touched everyone\'s heart. The team was very attentive and perfectly understood what I wanted to express."',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=15',
    is_active: true
  },
  {
    id: 't16',
    name: 'Thomas P.',
    content: '"Best investment I\'ve made! The song exceeded all expectations and moved my mom to tears. The quality is professional and the delivery was fast. Thank you so much!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=16',
    is_active: true
  },
  {
    id: 't17',
    name: 'Rachel V.',
    content: '"I absolutely loved it! The song came out exactly as I imagined. Everyone who heard it was moved and complimented it. The service was excellent from start to finish!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=17',
    is_active: true
  },
  {
    id: 't18',
    name: 'Philip J.',
    content: '"Astounding! The quality is incredible and the lyrics are so moving. My wife was delighted and all the guests loved it. Absolutely worth it!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=18',
    is_active: true
  },
  {
    id: 't19',
    name: 'Isabella M.',
    content: '"Perfect! The song was beautiful and moved the whole family. The process was simple and the result exceeded every expectation. Already thinking about ordering another one!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=19',
    is_active: true
  },
  {
    id: 't20',
    name: 'Gabriel O.',
    content: '"Incredible! The song came out exactly how I wanted. The quality is professional and the lyrics are touching. My girlfriend was so happy. Highly recommend!"',
    rating: 5,
    type: 'text',
    avatar_url: 'https://i.pravatar.cc/150?img=20',
    is_active: true
  },
];

export const defaultVideoTestimonials: Testimonial[] = [
  { id: 'v1', song_title: 'God Gave Me You', type: 'video', thumbnail: 'https://picsum.photos/seed/songsurprise-v1/600/800', is_active: true, name: 'Customer' },
  { id: 'v2', song_title: 'Three Squeezes...', type: 'video', thumbnail: 'https://picsum.photos/seed/songsurprise-v2/600/800', is_active: true, name: 'Customer' },
  { id: 'v3', song_title: 'My Heart Is Yours', type: 'video', thumbnail: 'https://picsum.photos/seed/songsurprise-v3/600/800', is_active: true, name: 'Customer' },
  { id: 'v4', song_title: "A Mother's Love...", type: 'video', thumbnail: 'https://picsum.photos/seed/songsurprise-v4/600/800', is_active: true, name: 'Customer' },
  { id: 'v5', song_title: 'Chosen Hearts', type: 'video', thumbnail: 'https://picsum.photos/seed/songsurprise-v5/600/800', is_active: true, name: 'Customer' },
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
