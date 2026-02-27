import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LyricsApproval, LyricsStatus } from "@/types/admin";
import { getDeviceInfo } from "@/utils/deviceDetection";
import { logger } from "@/utils/logger";

// Verificar se está em desenvolvimento
const isDev = import.meta.env.DEV;

// ✅ CORREÇÃO: Canal realtime compartilhado (singleton) para evitar múltiplas subscriptions
let sharedRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let sharedChannelSubscribers = 0;
let globalInvalidationTimeout: NodeJS.Timeout | null = null;
let globalLastInvalidation = 0;
const GLOBAL_DEBOUNCE_MS = 3000; // ✅ CORREÇÃO: Debounce global de 3 segundos para evitar loops

function isRequestAborted(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const anyError = error as any;
  if (typeof anyError?.name === "string" && anyError.name === "AbortError") return true;
  const message = String(anyError?.message ?? anyError ?? "");
  return message.includes("ERR_ABORTED") || message.includes("AbortError") || message.includes("aborted");
}

interface UseLyricsApprovalsOptions {
  status?: LyricsStatus[];
  includeExpired?: boolean;
  limit?: number; // ✅ NOVO: Limite de itens por página
  offset?: number; // ✅ NOVO: Offset para paginação
  enabled?: boolean; // ✅ NOVO: Controlar se a query deve ser executada
}

export function useLyricsApprovals(options: UseLyricsApprovalsOptions = {}) {
  const { status = ['pending'], includeExpired = false, limit, offset = 0, enabled = true } = options;
  const queryClient = useQueryClient();

  // ✅ CORREÇÃO: Desabilitar refetch automático - usar apenas realtime para atualizações
  // Isso evita que as páginas admin fiquem piscando/recarregando constantemente
  const refetchInterval = false; // Desabilitado - usar apenas realtime
  const refetchIntervalInBackground = false; // Desabilitado

  // ✅ CORREÇÃO: Função auxiliar para invalidar queries de dados e contagem
  const invalidateAllQueries = useCallback((refetchType: 'active' | 'all' = 'active') => {
    queryClient.invalidateQueries({ 
      queryKey: ["lyrics-approvals"],
      refetchType
    });
    queryClient.invalidateQueries({ 
      queryKey: ["lyrics-approvals-count"],
      refetchType
    });
  }, [queryClient]);

  // ✅ OTIMIZAÇÃO: Query para buscar aprovações com paginação real
  const { data: approvals, isLoading, error, refetch } = useQuery({
    queryKey: ["lyrics-approvals", status, includeExpired, limit, offset],
    enabled: enabled, // ✅ Controlar se a query deve ser executada
    queryFn: async () => {
      logger.debug('Fetching lyrics approvals', { status, includeExpired, limit, offset });
      
      // ✅ CORREÇÃO: Interceptar erro 400 antes de chegar ao console
      try {
        // ✅ CORREÇÃO: Tentar primeiro sem relações para evitar erro 400
        // Se funcionar, tentar com relações depois
        let query = supabase
          .from("lyrics_approvals")
          .select(`
            id,
            job_id,
            order_id,
            quiz_id,
            status,
            lyrics,
            lyrics_preview,
            voice,
            expires_at,
            created_at,
            updated_at,
            regeneration_count,
            is_highlighted
          `, { count: 'exact' });
        
        // Aplicar filtros
        if (status.length === 1) {
          query = query.eq("status", status[0]);
        } else {
          query = query.in("status", status);
        }
        
        // Aplicar filtro de expires_at ANTES da ordenação para usar índice
        if (!includeExpired) {
          const nowISO = new Date().toISOString();
          query = query.gt('expires_at', nowISO);
        }
        
        // Ordenar
        query = query.order("created_at", { ascending: false });
        
        // ✅ CORREÇÃO: Aplicar paginação apenas se limit estiver definido
        if (limit !== undefined) {
          query = query.range(offset || 0, (offset || 0) + limit - 1);
        }

        let { data: pageData, error } = await query;
        
        // Se funcionou sem relações, tentar buscar relações separadamente
        if (!error && pageData && pageData.length > 0) {
          try {
            // Buscar dados relacionados separadamente
            const orderIds = [...new Set(pageData.map((p: any) => p.order_id).filter(Boolean))];
            const quizIds = [...new Set(pageData.map((p: any) => p.quiz_id).filter(Boolean))];
            const jobIds = [...new Set(pageData.map((p: any) => p.job_id).filter(Boolean))];
            
            const [ordersData, quizzesData, jobsData] = await Promise.all([
              orderIds.length > 0 ? supabase.from("orders").select("id, customer_email, plan").in("id", orderIds) : { data: [], error: null },
              quizIds.length > 0 ? supabase.from("quizzes").select("id, about_who, style, desired_tone, music_prompt, vocal_gender").in("id", quizIds) : { data: [], error: null },
              jobIds.length > 0 ? supabase.from("jobs").select("id, suno_task_id, status").in("id", jobIds) : { data: [], error: null },
            ]);
            
            // Adicionar dados relacionados aos resultados
            if (ordersData.data || quizzesData.data || jobsData.data) {
              const ordersMap = new Map((ordersData.data || []).map((o: any) => [o.id, o]));
              const quizzesMap = new Map((quizzesData.data || []).map((q: any) => [q.id, q]));
              const jobsMap = new Map((jobsData.data || []).map((j: any) => [j.id, j]));
              
              pageData = pageData.map((item: any) => ({
                ...item,
                orders: item.order_id ? ordersMap.get(item.order_id) : null,
                quizzes: item.quiz_id ? quizzesMap.get(item.quiz_id) : null,
                jobs: item.job_id ? jobsMap.get(item.job_id) : null,
              }));
            }
          } catch (relationError) {
            // Se falhar ao buscar relações, continuar sem elas
            if (process.env.NODE_ENV === 'development') {
              logger.warn('Erro ao buscar relações, continuando sem elas', relationError);
            }
          }
        }
      
        if (error) {
          const isTableNotFound = error.code === 'PGRST116' || 
                                 error.code === '42P01' || 
                                 error.code === '404' ||
                                 error.message?.includes('does not exist') ||
                                 error.message?.includes('relation') ||
                                 error.message?.includes('not found');
          
          const isColumnError = error.code === '400';
          
          const isRLSError = error.code === '42501' || 
                            error.message?.toLowerCase().includes('permission denied') ||
                            error.message?.toLowerCase().includes('row-level security') ||
                            error.message?.toLowerCase().includes('policy violation');
          
          if (isTableNotFound) {
            // Tabela não existe, retornar array vazio
            logger.warn('Tabela lyrics_approvals não encontrada, retornando array vazio', { status, includeExpired });
            return [];
          }
          
          // Tratar qualquer erro 400 (pode ser campo, relação, etc.)
          if (isColumnError || error.code === '400') {
            // Campo não existe ou problema com relações, tentar query simplificada sem relações
            logger.warn('Erro de campo/relação ao buscar lyrics approvals, tentando query simplificada', { status, includeExpired });
            try {
              // Primeiro tentar sem relações
              let simpleQuery = supabase
                .from("lyrics_approvals")
                .select("id, order_id, quiz_id, job_id, status, lyrics, lyrics_preview, voice, expires_at, created_at, updated_at, regeneration_count, is_highlighted");
              
              if (status.length === 1) {
                simpleQuery = simpleQuery.eq("status", status[0]);
              } else {
                simpleQuery = simpleQuery.in("status", status);
              }
              
              if (!includeExpired) {
                const nowISO = new Date().toISOString();
                simpleQuery = simpleQuery.gt('expires_at', nowISO);
              }
              
              const { data: simpleData, error: simpleError } = await simpleQuery.order("created_at", { ascending: false });
              
              if (simpleError) {
                // Se ainda falhar, tentar query ainda mais simples
                logger.warn('Erro na query simplificada, tentando query mínima', simpleError);
                const minimalQuery = supabase
                  .from("lyrics_approvals")
                  .select("id, status, created_at");
                
                if (status.length === 1) {
                  minimalQuery.eq("status", status[0]);
                } else {
                  minimalQuery.in("status", status);
                }
                
                const { data: minimalData, error: minimalError } = await minimalQuery.order("created_at", { ascending: false });
                
                if (minimalError) {
                  logger.warn('Erro na query mínima, retornando array vazio', minimalError);
                  return [];
                }
                
                return (minimalData || []) as LyricsApproval[];
              }
              
              return (simpleData || []) as LyricsApproval[];
            } catch (e) {
              logger.warn('Erro ao executar query simplificada, retornando array vazio', e);
              return [];
            }
          }
          
          if (isRLSError) {
            const rlsError = new Error(
              'Acesso negado: Você precisa estar autenticado como administrador para acessar as aprovações de letras. ' +
              'Verifique se você está logado e se sua conta tem a role "admin".'
            ) as any;
            rlsError.code = error.code;
            logger.error('Erro de RLS ao buscar lyrics approvals', rlsError, { status, includeExpired });
            throw rlsError;
          }
          
          logger.error('Erro ao buscar lyrics approvals', error, { status, includeExpired });
          throw error;
        }
        
        // ✅ OTIMIZAÇÃO: Removida busca de songs - carregar apenas quando necessário (lazy loading)
        logger.debug('Lyrics approvals loaded', { count: pageData?.length || 0, limit, offset });
        return (pageData || []) as LyricsApproval[];
      } catch (queryError: any) {
        if (isRequestAborted(queryError)) {
          throw queryError;
        }
        // Tratar erros 400/404 graciosamente (não quebrar a aplicação)
        const isTableNotFound = queryError?.code === 'PGRST116' || 
                               queryError?.code === '42P01' || 
                               queryError?.code === '404' ||
                               queryError?.message?.includes('does not exist') ||
                               queryError?.message?.includes('relation') ||
                               queryError?.message?.includes('not found');
        
        const isColumnError = queryError?.code === '400';
        
        if (isTableNotFound || isColumnError) {
          // Tabela não existe ou erro de campo/relação, retornar array vazio silenciosamente
          if (process.env.NODE_ENV === 'development') {
            logger.warn('Erro tratado graciosamente, retornando array vazio', queryError);
          }
          return [];
        }
        
        // Para outros erros, logar e lançar
        if (isDev) {
          console.error('❌ [useLyricsApprovals] Erro ao executar query:', queryError);
        }
        logger.error('Erro ao buscar lyrics approvals', queryError, { status, includeExpired });
        throw queryError;
      }
    },
    refetchInterval: refetchInterval, // ✅ Desabilitado - usar apenas realtime
    refetchIntervalInBackground: refetchIntervalInBackground, // ✅ Desabilitado
    refetchOnWindowFocus: false, // ✅ Desabilitado para evitar recarregamentos
    refetchOnMount: false, // ✅ OTIMIZAÇÃO: Não refetch ao montar (usar cache)
    refetchOnReconnect: false, // ✅ Desabilitado - realtime já reconecta automaticamente
    staleTime: 3 * 60 * 1000, // ✅ OTIMIZAÇÃO: 3 minutos - reduzido para melhor performance
    gcTime: 10 * 60 * 1000, // ✅ Manter cache por 10 minutos
    placeholderData: (previousData) => previousData, // ✅ Manter dados anteriores durante refetch (evita piscar)
  });

  // ✅ OTIMIZAÇÃO: Query separada para contar o total usando COUNT (muito mais rápido)
  // ✅ NOTA: Contagem sempre habilitada para mostrar totais corretos nas badges
  const { data: totalCount, isLoading: isLoadingCount } = useQuery({
    queryKey: ["lyrics-approvals-count", status, includeExpired],
    enabled: true, // ✅ Sempre habilitado para mostrar totais corretos
    queryFn: async () => {
      try {
        // ✅ OTIMIZAÇÃO: Usar COUNT do Supabase (muito mais rápido que buscar todos os dados)
        let countQuery = supabase
          .from("lyrics_approvals")
          .select("*", { count: 'exact', head: true }); // ✅ COUNT sem buscar dados
        
        // ✅ CORREÇÃO: Usar .eq() para array com um elemento, .in() para múltiplos
        if (status.length === 1) {
          countQuery = countQuery.eq("status", status[0]);
        } else {
          countQuery = countQuery.in("status", status);
        }

        if (!includeExpired) {
          const nowISO = new Date().toISOString();
          countQuery = countQuery.gt('expires_at', nowISO);
        }

        const { count, error } = await countQuery;

        if (error) {
          logger.warn('Erro ao contar lyrics approvals', error);
          if (isDev) {
            console.error('❌ [useLyricsApprovals] Erro ao contar:', error);
          }
          // ✅ FALLBACK: Se COUNT falhar, tentar contar manualmente (mais lento)
          return await countManually();
        }

        // ✅ OTIMIZAÇÃO: Removido filtro de email_logs - muito lento e não crítico
        // O filtro pode ser aplicado no backend via view/materialized view se necessário
        return count || 0;
      } catch (error) {
        if (isRequestAborted(error)) {
          return null;
        }
        logger.warn('Erro ao contar lyrics approvals', error);
        if (isDev) {
          console.error('❌ [useLyricsApprovals] Erro na contagem:', error);
        }
        return null;
      }
    },
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
    gcTime: 5 * 60 * 1000,
  });

  // ✅ FUNÇÃO AUXILIAR: Contar manualmente (fallback se COUNT falhar)
  const countManually = async (): Promise<number> => {
    let allApprovals: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore && from < 100000) { // Limite de segurança
      let countQuery = supabase
        .from("lyrics_approvals")
        .select("id", { count: 'exact' });
      
      if (status.length === 1) {
        countQuery = countQuery.eq("status", status[0]);
      } else {
        countQuery = countQuery.in("status", status);
      }
      
      countQuery = countQuery.range(from, from + pageSize - 1);

      if (!includeExpired) {
        const nowISO = new Date().toISOString();
        countQuery = countQuery.gt('expires_at', nowISO);
      }

      const { data: pageData, error } = await countQuery;

      if (error || !pageData) {
        break;
      }

      if (pageData.length > 0) {
        allApprovals = allApprovals.concat(pageData);
        from += pageSize;
        hasMore = pageData.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allApprovals.length;
  };

  // ✅ CORREÇÃO: Realtime subscription compartilhada (singleton) para evitar múltiplas subscriptions
  // Usar ref para capturar queryClient de forma estável
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient; // Atualizar ref sempre que queryClient mudar
  
  useEffect(() => {
    // ✅ CORREÇÃO ERRO 401: Verificar autenticação antes de criar channel
    const setupRealtime = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          logger.debug('Usuário não autenticado, pulando criação de channel Realtime');
          return;
        }
        
        // Criar canal compartilhado se não existir
        if (!sharedRealtimeChannel) {
          sharedRealtimeChannel = supabase
            .channel('lyrics-approvals-realtime-shared')
            .on('postgres_changes', { 
              event: '*', 
              schema: 'public', 
              table: 'lyrics_approvals' 
            }, (payload) => {
          const now = Date.now();
          
          // ✅ CORREÇÃO: Log detalhado para debug
          logger.debug('Realtime event recebido', {
            event: payload.eventType,
            new: payload.new,
            old: payload.old,
            table: payload.table
          });
          
          // ✅ CORREÇÃO: Se for INSERT de uma aprovação com status 'pending', invalidar e refetchar imediatamente
          if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
            logger.debug('Nova aprovação pendente detectada, invalidando e refetchando imediatamente', {
              approval_id: payload.new?.id,
              order_id: payload.new?.order_id
            });
            
            // Invalidar todas as queries relacionadas (incluindo contagem)
            queryClientRef.current.invalidateQueries({ 
              queryKey: ["lyrics-approvals"],
              refetchType: 'active'
            });
            queryClientRef.current.invalidateQueries({ 
              queryKey: ["lyrics-approvals-count"],
              refetchType: 'active'
            });
            
            // Forçar refetch imediato das queries ativas
            const activeQueries = queryClientRef.current.getQueryCache().findAll({ 
              queryKey: ["lyrics-approvals"],
              type: 'active'
            });
            
            activeQueries.forEach(query => {
              queryClientRef.current.refetchQueries({ 
                queryKey: query.queryKey,
                type: 'active'
              });
            });
            
            globalLastInvalidation = now;
            return;
          }
          
          // ✅ CORREÇÃO: Se for UPDATE que muda status para 'pending', também invalidar
          if (payload.eventType === 'UPDATE' && payload.new?.status === 'pending' && payload.old?.status !== 'pending') {
            logger.debug('Aprovação atualizada para pendente, invalidando imediatamente', {
              approval_id: payload.new?.id,
              order_id: payload.new?.order_id
            });
            queryClientRef.current.invalidateQueries({ 
              queryKey: ["lyrics-approvals"],
              refetchType: 'active'
            });
            queryClientRef.current.invalidateQueries({ 
              queryKey: ["lyrics-approvals-count"],
              refetchType: 'active'
            });
            globalLastInvalidation = now;
            return;
          }
          
          // ✅ CORREÇÃO: Debounce GLOBAL para evitar invalidações excessivas de múltiplas instâncias
          // Se já invalidou recentemente (< 3s), aguardar antes de invalidar novamente
          if (now - globalLastInvalidation < GLOBAL_DEBOUNCE_MS) {
            if (globalInvalidationTimeout) {
              clearTimeout(globalInvalidationTimeout);
            }
            globalInvalidationTimeout = setTimeout(() => {
              logger.debug('Invalidando queries após debounce global');
              queryClientRef.current.invalidateQueries({ 
                queryKey: ["lyrics-approvals"],
                refetchType: 'active' // ✅ CORREÇÃO: Refetchar queries ativas para mostrar novas aprovações
              });
              queryClientRef.current.invalidateQueries({ 
                queryKey: ["lyrics-approvals-count"],
                refetchType: 'active'
              });
              globalLastInvalidation = Date.now();
            }, GLOBAL_DEBOUNCE_MS - (now - globalLastInvalidation));
          } else {
            // Invalidar imediatamente se passou tempo suficiente
            logger.debug('Invalidando queries (realtime compartilhado)');
            queryClientRef.current.invalidateQueries({ 
              queryKey: ["lyrics-approvals"],
              refetchType: 'active' // ✅ CORREÇÃO: Refetchar queries ativas para mostrar novas aprovações
            });
            queryClientRef.current.invalidateQueries({ 
              queryKey: ["lyrics-approvals-count"],
              refetchType: 'active'
            });
            globalLastInvalidation = now;
          }
            })
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'jobs'
            }, async (payload) => {
              // ✅ NOVO: Quando um job receber suno_task_id, aprovar automaticamente a letra
              const newJob = payload.new as any;
              const oldJob = payload.old as any;
              
              // Verificar se o job foi enviado para o Suno (recebeu suno_task_id)
              const wasSentToSuno = !oldJob?.suno_task_id && newJob?.suno_task_id;
              
              if (wasSentToSuno) {
                logger.debug('Job enviado para Suno detectado, aprovando letra automaticamente', {
                  job_id: newJob?.id,
                  suno_task_id: newJob?.suno_task_id
                });
                
                try {
                  // Buscar a lyrics_approval associada a este job
                  const { data: approval, error: approvalError } = await supabase
                    .from('lyrics_approvals')
                    .select('id, status')
                    .eq('job_id', newJob.id)
                    .eq('status', 'pending')
                    .maybeSingle();
                  
                  if (approvalError) {
                    logger.error('Erro ao buscar lyrics_approval para aprovar', approvalError);
                    return;
                  }
                  
                  if (approval) {
                    // Atualizar status para 'approved'
                    const { error: updateError } = await supabase
                      .from('lyrics_approvals')
                      .update({ 
                        status: 'approved',
                        approved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', approval.id);
                    
                    if (updateError) {
                      logger.error('Erro ao aprovar letra automaticamente', updateError);
                    } else {
                      logger.debug('Letra aprovada automaticamente após envio para Suno', {
                        approval_id: approval.id,
                        job_id: newJob.id
                      });
                      
                      // Invalidar queries para atualizar as listas
                      queryClientRef.current.invalidateQueries({ 
                        queryKey: ["lyrics-approvals"],
                        refetchType: 'active'
                      });
                      queryClientRef.current.invalidateQueries({ 
                        queryKey: ["lyrics-approvals-count"],
                        refetchType: 'active'
                      });
                    }
                  }
                } catch (error) {
                  logger.error('Erro ao processar aprovação automática', error);
                }
              }
            });
          
          // Subscrever apenas uma vez
          sharedRealtimeChannel.subscribe((status) => {
            logger.debug('Status da subscription realtime:', status);
            // Logs removidos para reduzir verbosidade - apenas erros críticos serão logados
            if (status === 'CHANNEL_ERROR' && isDev) {
              console.error('❌ [Realtime] Erro na subscription');
            }
          });
          logger.debug('Canal realtime compartilhado criado e subscrito');
          
          // Incrementar contador de subscribers apenas quando channel for criado
          sharedChannelSubscribers++;
          logger.debug('Subscriber adicionado', { total: sharedChannelSubscribers });
        } else {
          // Channel já existe, apenas incrementar contador
          sharedChannelSubscribers++;
          logger.debug('Subscriber adicionado (channel existente)', { total: sharedChannelSubscribers });
        }
      } catch (error) {
        logger.warn('Erro ao verificar autenticação para Realtime:', error);
      }
    };
    
    setupRealtime();

    return () => {
      // Decrementar contador
      sharedChannelSubscribers--;
      logger.debug('Subscriber removido', { total: sharedChannelSubscribers });
      
      // Se não há mais subscribers, limpar canal
      if (sharedChannelSubscribers <= 0 && sharedRealtimeChannel) {
        logger.debug('Removendo canal realtime compartilhado (sem subscribers)');
        supabase.removeChannel(sharedRealtimeChannel);
        sharedRealtimeChannel = null;
        sharedChannelSubscribers = 0;
        
        // Limpar timeout global se existir
        if (globalInvalidationTimeout) {
          clearTimeout(globalInvalidationTimeout);
          globalInvalidationTimeout = null;
        }
      }
    };
  }, []); // ✅ CORREÇÃO: Array vazio - queryClient capturado via ref, não precisa estar nas dependências

  // Mutation para aprovar letras
  const approveMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      try {
        // Verificar se o cliente Supabase está inicializado corretamente
        if (!supabase || !supabase.functions) {
          logger.error('Cliente Supabase não inicializado corretamente', { hasSupabase: !!supabase, hasFunctions: !!supabase?.functions });
          throw new Error('Cliente Supabase não está configurado. Recarregue a página.');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logger.warn('Erro ao obter sessão (continuando sem auth):', sessionError);
        }
        const authToken = session?.access_token;

        logger.debug('Chamando Edge Function admin-approve-lyrics', { approvalId, hasToken: !!authToken });

        const { data, error } = await supabase.functions.invoke('admin-approve-lyrics', {
          body: { approval_id: approvalId },
          headers: authToken ? {
            Authorization: `Bearer ${authToken}`
          } : undefined
        });

        if (error) {
          logger.error('Erro na Edge Function admin-approve-lyrics', error, { 
            approvalId, 
            status: error.status,
            message: error.message,
            context: error.context
          });
          throw error;
        }

        // ✅ CORREÇÃO: Verificar se a resposta confirma sucesso antes de retornar
        if (!data || (data.success === false)) {
          const errorMessage = data?.error || 'Erro ao aprovar letra';
          logger.error('Erro ao aprovar letra - resposta da edge function indica falha', { approvalId, data });
          throw new Error(errorMessage);
        }

        return data;
      } catch (error) {
        logger.error('Erro ao aprovar letras', error, { approvalId });
        throw error;
      }
    },
    onSuccess: (data, approvalId) => {
      // ✅ CORREÇÃO: Aguardar delay suficiente para garantir que o toast de sucesso apareça primeiro
      // O card só desaparecerá após a mensagem de sucesso aparecer e ser visível
      setTimeout(() => {
        invalidateAllQueries('active');
        globalLastInvalidation = Date.now();
        logger.debug('Aprovação confirmada - queries invalidadas', { approvalId });
      }, 300); // Delay de 300ms para garantir que o toast apareça e seja visível antes do card desaparecer
    },
    onError: (error) => {
      // ✅ CORREÇÃO: Não invalidar queries em caso de erro - manter o card visível
      logger.error('Erro na mutation de aprovação - card permanece em pendentes', error);
    }
  });

  // Mutation para rejeitar letras
  const rejectMutation = useMutation({
    mutationFn: async ({ approvalId, reason }: { approvalId: string; reason: string }) => {
      try {
        // Verificar se o cliente Supabase está inicializado corretamente
        if (!supabase || !supabase.functions) {
          logger.error('Cliente Supabase não inicializado corretamente', { hasSupabase: !!supabase, hasFunctions: !!supabase?.functions });
          throw new Error('Cliente Supabase não está configurado. Recarregue a página.');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logger.warn('Erro ao obter sessão (continuando sem auth):', sessionError);
        }
        const authToken = session?.access_token;

        logger.debug('Chamando Edge Function admin-reject-lyrics', { approvalId, hasToken: !!authToken });

        const { data, error } = await supabase.functions.invoke('admin-reject-lyrics', {
          body: { approval_id: approvalId, reason: reason },
          headers: authToken ? {
            Authorization: `Bearer ${authToken}`
          } : undefined
        });

        if (error) {
          logger.error('Erro na Edge Function admin-reject-lyrics', error, { 
            approvalId, 
            status: error.status,
            message: error.message,
            context: error.context
          });
          throw error;
        }

        return data;
      } catch (error) {
        logger.error('Erro ao rejeitar letras', error, { approvalId });
        throw error;
      }
    },
    onSuccess: () => {
      // ✅ CORREÇÃO: Usar debounce global para invalidação
      const now = Date.now();
      if (now - globalLastInvalidation < GLOBAL_DEBOUNCE_MS) {
        if (globalInvalidationTimeout) {
          clearTimeout(globalInvalidationTimeout);
        }
        globalInvalidationTimeout = setTimeout(() => {
          invalidateAllQueries('active');
          globalLastInvalidation = Date.now();
        }, GLOBAL_DEBOUNCE_MS - (now - globalLastInvalidation));
      } else {
        invalidateAllQueries('active');
        globalLastInvalidation = now;
      }
    }
  });

  // Mutation para regenerar letras
  const regenerateMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      try {
        // Verificar se o cliente Supabase está inicializado corretamente
        if (!supabase || !supabase.functions) {
          logger.error('Cliente Supabase não inicializado corretamente', { hasSupabase: !!supabase, hasFunctions: !!supabase?.functions });
          throw new Error('Cliente Supabase não está configurado. Recarregue a página.');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logger.warn('Erro ao obter sessão (continuando sem auth):', sessionError);
        }
        const authToken = session?.access_token;

        // ✅ DIAGNÓSTICO: Verificar URL do Supabase antes de chamar Edge Function (apenas em dev)
        const supabaseUrl = (supabase as any).supabaseUrl || (supabase as any).rest?.url || 'não detectado';
        if (isDev) {
          console.log('🔍 [DIAGNÓSTICO] Chamando Edge Function regenerate-lyrics:', {
            approvalId,
            hasToken: !!authToken,
            supabaseUrl,
            isLocalhost: supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1'),
            hasFunctions: !!supabase.functions
          });
        }
        
        // ✅ CORREÇÃO CRÍTICA: Se estiver em localhost, avisar que Edge Functions só funcionam no remoto
        if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
          const errorMsg = 'Edge Functions não estão disponíveis em localhost. O cliente Supabase precisa estar configurado para usar a URL remota do Supabase.';
          if (isDev) {
            console.error('❌ [DIAGNÓSTICO]', errorMsg);
          }
          logger.error('Tentativa de chamar Edge Function em localhost', { supabaseUrl, approvalId });
          throw new Error(errorMsg);
        }

        logger.debug('Chamando Edge Function regenerate-lyrics', { approvalId, hasToken: !!authToken, supabaseUrl });

        // Chamar a Edge Function de regeneração - passar headers apenas se houver token (mesmo padrão das outras)
        const { data, error } = await supabase.functions.invoke('regenerate-lyrics', {
          body: { approval_id: approvalId },
          headers: authToken ? {
            Authorization: `Bearer ${authToken}`
          } : undefined
        });
        
        if (error) {
          // Extrair mensagem de erro mais detalhada
          let errorMessage = error.message || 'Erro desconhecido ao chamar Edge Function';
          
          // Se for erro 404, a função pode não estar deployada
          if (error.status === 404) {
            errorMessage = 'Edge Function "regenerate-lyrics" não encontrada. Verifique se está deployada no Supabase Dashboard.';
          } else if (error.status === 503 || errorMessage.includes('Failed to send a request')) {
            errorMessage = 'Não foi possível conectar à Edge Function. A função pode não estar deployada ou há um problema de rede. Verifique o Supabase Dashboard.';
          } else if (error.status) {
            errorMessage = `Erro ${error.status}: ${errorMessage}`;
          }
          
          logger.error('Erro na Edge Function regenerate-lyrics', error, { 
            approvalId, 
            status: error.status,
            message: error.message,
            context: error.context,
            errorMessage
          });
          
          throw new Error(errorMessage);
        }

        // ✅ CORREÇÃO: Algumas funções retornam HTTP 200 com success=false para evitar erro non-2xx no invoke
        // Nesse caso, precisamos tratar aqui e lançar um erro para a UI.
        if ((data as any)?.success === false || (data as any)?.error) {
          const msg =
            (data as any)?.error ||
            'Erro ao regenerar letra. Verifique as secrets (OPENAI_API_KEY/SUPABASE_SERVICE_ROLE_KEY) e logs da Edge Function.';
          logger.error('regenerate-lyrics retornou falha', { approvalId, data });
          throw new Error(msg);
        }
        
        return { approvalId, data };
      } catch (error) {
        // Se já for um Error com mensagem, re-throw
        if (error instanceof Error) {
          throw error;
        }
        
        // Caso contrário, criar um novo Error
        logger.error('Erro ao regenerar letras', error, { approvalId });
        throw new Error('Erro desconhecido ao regenerar letras');
      }
    },
    onSuccess: ({ approvalId, data }) => {
      // Atualização otimista: aplicar lyrics/preview retornados (se vierem) no item do cache
      const updatedApproval = data?.approval;
      const keys = queryClient.getQueryCache().findAll({ queryKey: ["lyrics-approvals"] }) || [];
      if (updatedApproval) {
        keys.forEach(k => {
          queryClient.setQueryData(k.queryKey, (old: any[] = []) =>
            old.map(a => a?.id === approvalId ? { ...a, ...updatedApproval } : a)
          );
        });
      }
      // ✅ CORREÇÃO: Usar debounce global para invalidação
      const now = Date.now();
      if (now - globalLastInvalidation < GLOBAL_DEBOUNCE_MS) {
        if (globalInvalidationTimeout) {
          clearTimeout(globalInvalidationTimeout);
        }
        globalInvalidationTimeout = setTimeout(() => {
          invalidateAllQueries('active');
          globalLastInvalidation = Date.now();
        }, GLOBAL_DEBOUNCE_MS - (now - globalLastInvalidation));
      } else {
        invalidateAllQueries('active');
        globalLastInvalidation = now;
      }
    }
  });

  // Mutation para desaprovar letras (reverter approved -> pending)
  const unapproveMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      try {
        // Verificar se o cliente Supabase está inicializado corretamente
        if (!supabase || !supabase.functions) {
          logger.error('Cliente Supabase não inicializado corretamente', { hasSupabase: !!supabase, hasFunctions: !!supabase?.functions });
          throw new Error('Cliente Supabase não está configurado. Recarregue a página.');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logger.warn('Erro ao obter sessão (continuando sem auth):', sessionError);
        }
        const authToken = session?.access_token;

        logger.debug('Chamando Edge Function admin-unapprove-lyrics', { approvalId, hasToken: !!authToken });

        const { data, error } = await supabase.functions.invoke('admin-unapprove-lyrics', {
          body: { approval_id: approvalId },
          headers: authToken ? {
            Authorization: `Bearer ${authToken}`
          } : undefined
        });

        if (error) {
          logger.error('Erro na Edge Function admin-unapprove-lyrics', error, { 
            approvalId, 
            status: error.status,
            message: error.message,
            context: error.context
          });
          throw error;
        }

        return data;
      } catch (error) {
        logger.error('Erro ao desaprovar letras', error, { approvalId });
        throw error;
      }
    },
    onSuccess: async () => {
      // ✅ CORREÇÃO: Usar debounce global para invalidação
      const now = Date.now();
      if (now - globalLastInvalidation < GLOBAL_DEBOUNCE_MS) {
        if (globalInvalidationTimeout) {
          clearTimeout(globalInvalidationTimeout);
        }
        globalInvalidationTimeout = setTimeout(async () => {
          invalidateAllQueries('active');
          globalLastInvalidation = Date.now();
        }, GLOBAL_DEBOUNCE_MS - (now - globalLastInvalidation));
      } else {
        invalidateAllQueries('active');
        globalLastInvalidation = now;
      }
    }
  });

  // Mutation para deletar letras
  const deleteMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      try {
        // Verificar se o cliente Supabase está inicializado corretamente
        if (!supabase || !supabase.functions) {
          logger.error('Cliente Supabase não inicializado corretamente', { hasSupabase: !!supabase, hasFunctions: !!supabase?.functions });
          throw new Error('Cliente Supabase não está configurado. Recarregue a página.');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logger.warn('Erro ao obter sessão (continuando sem auth):', sessionError);
        }
        const authToken = session?.access_token;

        logger.debug('Chamando Edge Function delete-lyrics-approval', { approvalId, hasToken: !!authToken });

        const { data, error } = await supabase.functions.invoke('delete-lyrics-approval', {
          body: { approval_id: approvalId },
          headers: authToken ? {
            Authorization: `Bearer ${authToken}`
          } : undefined
        });

        if (error) {
          logger.error('Erro na Edge Function delete-lyrics-approval', error, { 
            approvalId, 
            status: error.status,
            message: error.message,
            context: error.context
          });
          throw error;
        }

        return { approvalId };
      } catch (error) {
        logger.error('Erro ao deletar letras', error, { approvalId });
        throw error;
      }
    },
    onMutate: async (approvalId: string) => {
      // Cancelar refetches em andamento
      await queryClient.cancelQueries({ queryKey: ["lyrics-approvals"] });

      // Snapshot do cache atual para restaurar em caso de erro
      const keys = queryClient.getQueryCache().findAll({ queryKey: ["lyrics-approvals"] }) || [];
      const snapshots = keys.map(k => ({ key: k.queryKey, data: queryClient.getQueryData(k.queryKey) }));

      // Remoção otimista para todas as variantes (pending/approved/rejected)
      keys.forEach(k => {
        queryClient.setQueryData(k.queryKey, (old: any[] = []) => old.filter(a => a?.id !== approvalId));
      });

      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      // Restaurar snapshots em caso de falha
      if (ctx?.snapshots) {
        ctx.snapshots.forEach((s: any) => queryClient.setQueryData(s.key, s.data));
      }
    },
    onSettled: () => {
      // ✅ CORREÇÃO: Usar debounce global para invalidação
      const now = Date.now();
      if (now - globalLastInvalidation < GLOBAL_DEBOUNCE_MS) {
        if (globalInvalidationTimeout) {
          clearTimeout(globalInvalidationTimeout);
        }
        globalInvalidationTimeout = setTimeout(() => {
          invalidateAllQueries('active');
          globalLastInvalidation = Date.now();
        }, GLOBAL_DEBOUNCE_MS - (now - globalLastInvalidation));
      } else {
        invalidateAllQueries('active');
        globalLastInvalidation = now;
      }
    }
  });

  return {
    approvals: approvals || [],
    // ✅ CORREÇÃO: Para pendentes, não usar fallback de length para evitar mostrar contagem errada
    // Só mostrar totalCount quando estiver pronto, ou usar length apenas se não for pending
    totalCount: status.includes('pending') 
      ? (totalCount ?? null) // Para pending, aguardar contagem filtrada completa
      : (totalCount ?? (approvals?.length ?? 0)), // Para outros status, usar fallback
    isLoading: isLoading || isLoadingCount, // Incluir loading da contagem
    error,
    refetch,
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    unapprove: unapproveMutation.mutateAsync,
    regenerate: regenerateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isUnapproving: unapproveMutation.isPending,
    isRegenerating: regenerateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
}
