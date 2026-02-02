import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CustomerFeedback {
  id: string;
  order_id: string | null;
  song_id: string | null;
  customer_email: string;
  customer_name: string | null;
  rating: number | null;
  feedback_text: string;
  feedback_type: 'general' | 'song_review' | 'service_review' | 'suggestion' | 'complaint';
  status: 'pending' | 'approved' | 'rejected' | 'featured';
  is_public: boolean;
  admin_notes: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
  orders?: {
    customer_email: string;
    plan: string;
  } | null;
  songs?: {
    title: string;
  } | null;
}

interface FeedbackFilters {
  status?: string;
  feedback_type?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useFeedbacks(filters: FeedbackFilters = {}) {
  return useQuery({
    queryKey: ['customer-feedbacks', filters],
    queryFn: async () => {
      let query = supabase
        .from('customer_feedbacks')
        .select(`
          *,
          orders(customer_email, plan),
          songs(title)
        `)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.feedback_type && filters.feedback_type !== 'all') {
        query = query.eq('feedback_type', filters.feedback_type);
      }

      if (filters.search) {
        query = query.or(`customer_email.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,feedback_text.ilike.%${filters.search}%`);
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
            console.warn('Tabela customer_feedbacks não encontrada:', error);
          }
          return [];
        }
        
        throw error;
      }

      return (data || []) as CustomerFeedback[];
    },
  });
}

export function useFeedback(id: string | null) {
  return useQuery({
    queryKey: ['customer-feedback', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('customer_feedbacks')
        .select(`
          *,
          orders(customer_email, plan),
          songs(title)
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

      return data as CustomerFeedback;
    },
    enabled: !!id,
  });
}

export function useModerateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feedbackId,
      status,
      adminNotes,
    }: {
      feedbackId: string;
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
        .from('customer_feedbacks')
        .update(updateData)
        .eq('id', feedbackId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-feedbacks'] });
      toast.success('Feedback moderado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao moderar feedback:', error);
      toast.error('Erro ao moderar feedback');
    },
  });
}

export function useFeedbackStats() {
  return useQuery({
    queryKey: ['customer-feedback-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_feedbacks')
        .select('status, rating, feedback_type, created_at');

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
            averageRating: 0,
            byType: {},
          };
        }
        
        throw error;
      }

      const feedbacks = data || [];
      const total = feedbacks.length;
      const pending = feedbacks.filter((f) => f.status === 'pending').length;
      const approved = feedbacks.filter((f) => f.status === 'approved').length;
      const rejected = feedbacks.filter((f) => f.status === 'rejected').length;
      const featured = feedbacks.filter((f) => f.status === 'featured').length;

      const ratings = feedbacks.filter((f) => f.rating !== null).map((f) => f.rating!);
      const averageRating = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : 0;

      const byType: Record<string, number> = {};
      feedbacks.forEach((f) => {
        byType[f.feedback_type] = (byType[f.feedback_type] || 0) + 1;
      });

      return {
        total,
        pending,
        approved,
        rejected,
        featured,
        averageRating,
        byType,
      };
    },
  });
}



















