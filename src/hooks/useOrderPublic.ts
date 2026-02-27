import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrderPublic {
  id: string;
  customer_email: string;
  plan: string;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface SongPublic {
  id: string;
  order_id: string;
  quiz_id: string | null;
  title: string;
  variant_number: number | null;
  status: string;
  audio_url: string | null;
  cover_url: string | null;
  lyrics: string | null;
  release_at: string;
  released_at: string | null;
  created_at: string;
}

interface OrderPublicData {
  order: OrderPublic;
  songs: SongPublic[];
}

export function useOrderPublic(magicToken: string | null) {
  const [data, setData] = useState<OrderPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!magicToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: result, error: fnError } = await supabase.functions.invoke('get-order-by-token', {
        body: { magic_token: magicToken },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao buscar pedido');
      }

      setData(result);
    } catch (err: any) {
      console.error('Erro ao buscar pedido:', err);
      setError(err.message || 'Erro ao carregar dados do pedido');
    } finally {
      setLoading(false);
    }
  }, [magicToken]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return { data, loading, error, refetch: fetchOrder };
}

