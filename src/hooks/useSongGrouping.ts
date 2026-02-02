import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Song {
  id: string;
  title: string;
  variant_number: number;
  cover_url?: string;
  audio_url?: string;
  status: string;
  release_at?: string;
  email_sent?: boolean;
  order_id: string;
  created_at: string;
  style?: string;
  download_url?: string;
  orders: {
    customer_email: string;
    plan: string;
    magic_token: string;
    quizzes: {
      about_who: string;
      style: string;
    };
  };
}

interface SongGroup {
  id: string;
  songs: Song[];
  about: string;
  email: string;
  plan: string;
  magic_token: string;
  created_at: string;
  customer_name?: string;
}

interface UseSongGroupingOptions {
  status?: string[];
  includeEmailLogs?: boolean;
  orderBy?: 'created_at' | 'updated_at';
  orderDirection?: 'asc' | 'desc';
}

export function useSongGrouping(options: UseSongGroupingOptions = {}) {
  const [groups, setGroups] = useState<SongGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    status = ['ready', 'approved'],
    includeEmailLogs = true,
    orderBy = 'created_at',
    orderDirection = 'asc'
  } = options;

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar músicas com filtros
      // ✅ CORREÇÃO: Tratar erro 400 graciosamente (campo released_at pode não existir)
      let { data: songs, error: songsError } = await supabase
        .from('songs')
        .select(`
          *,
          orders (
            customer_email,
            plan,
            magic_token,
            quizzes (
              about_who,
              style
            )
          )
        `)
        .in('status', status)
        .is('released_at', null)
        .not('audio_url', 'is', null)
        .order(orderBy, { ascending: orderDirection === 'asc' });

      // Tratar erro 400 (campo released_at não existe)
      if (songsError && songsError.code === '400' && (
        songsError.message?.includes('released_at') ||
        songsError.message?.includes('column') ||
        songsError.message?.includes('does not exist')
      )) {
        // Tentar query sem released_at
        const result = await supabase
          .from('songs')
          .select(`
            *,
            orders (
              customer_email,
              plan,
              magic_token,
              quizzes (
                about_who,
                style
              )
            )
          `)
          .in('status', status)
          .not('audio_url', 'is', null)
          .order(orderBy, { ascending: orderDirection === 'asc' });
        
        if (result.error) {
          throw result.error;
        }
        
        songs = result.data;
        songsError = null;
      } else if (songsError) {
        throw songsError;
      }

      // Buscar logs de email se necessário
      let emailMap = new Map();
      if (includeEmailLogs && songs?.length) {
        try {
          const songIds = songs.map(s => s.id);
          const { data: emailLogs, error: emailLogsError } = await supabase
            .from('email_logs')
            .select('song_id, status, sent_at')
            .in('song_id', songIds)
            .eq('email_type', 'music_released');

          // ✅ CORREÇÃO: Tratar erros 400/404 graciosamente
          if (emailLogsError) {
            const isTableNotFound = emailLogsError.code === 'PGRST116' || 
                                   emailLogsError.code === '42P01' || 
                                   emailLogsError.code === '404' ||
                                   emailLogsError.message?.includes('does not exist') ||
                                   emailLogsError.message?.includes('relation') ||
                                   emailLogsError.message?.includes('not found');
            
            if (isTableNotFound || emailLogsError.code === '400') {
              // Tabela não existe, continuar sem email logs
              if (process.env.NODE_ENV === 'development') {
                console.warn('Tabela email_logs não encontrada, continuando sem logs de email:', emailLogsError);
              }
            } else {
              // Outro tipo de erro, logar mas não quebrar
              if (process.env.NODE_ENV === 'development') {
                console.warn('Erro ao buscar email logs:', emailLogsError);
              }
            }
          } else if (emailLogs) {
            emailLogs.forEach(log => {
              emailMap.set(log.song_id, { status: log.status, sent_at: log.sent_at });
            });
          }
        } catch (error) {
          // Erro ao buscar email logs, continuar sem eles
          if (process.env.NODE_ENV === 'development') {
            console.warn('Erro ao buscar email logs:', error);
          }
        }
      }

      // Agrupar por geração (2 músicas por grupo)
      const groupedSongs = new Map<string, Song[]>();
      
      songs?.forEach(song => {
        const groupKey = `${song.order_id}_${Math.floor(song.variant_number / 2)}`;
        
        if (!groupedSongs.has(groupKey)) {
          groupedSongs.set(groupKey, []);
        }
        
        groupedSongs.get(groupKey)!.push(song);
      });

      // Converter para formato de grupos
      const songGroups: SongGroup[] = Array.from(groupedSongs.entries()).map(([groupKey, songs]) => {
        // Ordenar músicas por variant_number
        const sortedSongs = songs.sort((a, b) => a.variant_number - b.variant_number);
        
        // Adicionar informações de email se disponível
        const firstSong = sortedSongs[0];
        const enrichedSongs = sortedSongs.map(song => ({
          ...song,
          email_sent: emailMap.has(song.id) ? emailMap.get(song.id).status === 'sent' : false
        }));

        return {
          id: groupKey,
          songs: enrichedSongs,
          about: firstSong.orders?.quizzes?.about_who || 'N/A',
          email: firstSong.orders?.customer_email || 'N/A',
          plan: firstSong.orders?.plan || 'standard',
          magic_token: firstSong.orders?.magic_token || '',
          created_at: firstSong.created_at,
          customer_name: firstSong.orders?.customer_email?.split('@')[0] || 'Cliente'
        };
      });

      // Ordenar grupos por data de criação
      songGroups.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return orderDirection === 'asc' ? dateA - dateB : dateB - dateA;
      });

      setGroups(songGroups);

    } catch (err: any) {
      console.error('❌ Erro ao carregar grupos de músicas:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [status, includeEmailLogs, orderBy, orderDirection]);

  // Função refetch simples
  const refetch = useCallback(() => {
    loadGroups();
  }, []);

  return {
    groups,
    loading,
    error,
    refetch
  };
}
