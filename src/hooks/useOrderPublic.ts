import { useState, useEffect } from 'react';
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

  const fetchOrder = async () => {
    if (!magicToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pszyhjshppvrzhkrgmrz.supabase.co';
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      const functionUrl = `https://${projectRef}.functions.supabase.co/get-order-by-token`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ magic_token: magicToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || 'Erro ao buscar pedido');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Erro ao buscar pedido:', err);
      setError(err.message || 'Erro ao carregar dados do pedido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [magicToken]);

  return { data, loading, error, refetch: fetchOrder };
}

