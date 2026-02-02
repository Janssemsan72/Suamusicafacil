import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReactionVideo {
  id: string;
  order_id: string | null;
  song_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  uploader_email: string;
  uploader_name: string | null;
  video_title: string | null;
  description: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'featured';
  admin_notes: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  songs?: {
    title: string;
  } | null;
  orders?: {
    customer_email: string;
  } | null;
}

interface VideoFilters {
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useVideos(filters: VideoFilters = {}) {
  return useQuery({
    queryKey: ['reaction-videos', filters],
    queryFn: async () => {
      let query = supabase
        .from('reaction_videos')
        .select(`
          *,
          songs(title),
          orders(customer_email)
        `)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(`uploader_email.ilike.%${filters.search}%,uploader_name.ilike.%${filters.search}%,video_title.ilike.%${filters.search}%`);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) {
        const isTableNotFound = error.code === 'PGRST116' || 
                               error.code === '42P01' || 
                               error.code === '404' ||
                               error.message?.includes('does not exist') ||
                               error.message?.includes('relation') ||
                               error.message?.includes('not found');
        
        if (isTableNotFound || error.code === '400') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Tabela reaction_videos não encontrada:', error);
          }
          return [];
        }
        
        throw error;
      }

      return (data || []) as ReactionVideo[];
    },
  });
}

export function useVideo(id: string | null) {
  return useQuery({
    queryKey: ['reaction-video', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('reaction_videos')
        .select(`
          *,
          songs(title),
          orders(customer_email)
        `)
        .eq('id', id)
        .single();

      if (error) {
        const isTableNotFound = error.code === 'PGRST116' || 
                               error.code === '42P01' || 
                               error.code === '404';
        
        if (isTableNotFound || error.code === '400') {
          return null;
        }
        
        throw error;
      }

      return data as ReactionVideo;
    },
    enabled: !!id,
  });
}

export function useModerateVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      videoId,
      status,
      adminNotes,
    }: {
      videoId: string;
      status: 'approved' | 'rejected' | 'featured';
      adminNotes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const updateData: any = {
        status,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      };

      if (adminNotes !== undefined) {
        updateData.admin_notes = adminNotes;
      }

      const { data, error } = await supabase
        .from('reaction_videos')
        .update(updateData)
        .eq('id', videoId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reaction-videos'] });
      toast.success('Vídeo moderado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao moderar vídeo:', error);
      toast.error('Erro ao moderar vídeo');
    },
  });
}

export function useVideoStats() {
  return useQuery({
    queryKey: ['reaction-video-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reaction_videos')
        .select('status, view_count, created_at');

      if (error) {
        const isTableNotFound = error.code === 'PGRST116' || 
                               error.code === '42P01' || 
                               error.code === '404';
        
        if (isTableNotFound || error.code === '400') {
          return {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            featured: 0,
            totalViews: 0,
          };
        }
        
        throw error;
      }

      const videos = data || [];
      const total = videos.length;
      const pending = videos.filter((v) => v.status === 'pending').length;
      const approved = videos.filter((v) => v.status === 'approved').length;
      const rejected = videos.filter((v) => v.status === 'rejected').length;
      const featured = videos.filter((v) => v.status === 'featured').length;
      const totalViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);

      return {
        total,
        pending,
        approved,
        rejected,
        featured,
        totalViews,
      };
    },
  });
}



















