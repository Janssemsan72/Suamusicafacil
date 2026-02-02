/**
 * Hook robusto para regenerar todas as letras pendentes
 * 
 * Características:
 * - Persiste progresso no localStorage
 * - Continua de onde parou em caso de interrupção
 * - Retry automático em caso de falhas
 * - Não para até completar todas as letras
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

const STORAGE_KEY = 'regenerate_all_lyrics_progress';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 segundos
const DELAY_BETWEEN_ITEMS = 1500; // 1.5 segundos entre cada item

export interface RegenerateItem {
  approval_id: string;
  order_id?: string;
  customer_email?: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  error?: string;
  retryCount?: number;
}

export interface RegenerateProgress {
  items: RegenerateItem[];
  currentIndex: number;
  isComplete: boolean;
  isRunning: boolean;
  startedAt: string;
  lastUpdatedAt: string;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
}

interface UseRegenerateAllLyricsReturn {
  progress: RegenerateProgress | null;
  isRunning: boolean;
  hasSavedProgress: boolean;
  start: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => void;
  clear: () => void;
}

const getInitialProgress = (): RegenerateProgress => ({
  items: [],
  currentIndex: 0,
  isComplete: false,
  isRunning: false,
  startedAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString(),
  totalProcessed: 0,
  successCount: 0,
  errorCount: 0,
});

export function useRegenerateAllLyrics(
  onRefetch?: () => Promise<void>
): UseRegenerateAllLyricsReturn {
  const [progress, setProgress] = useState<RegenerateProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const abortRef = useRef(false);
  const processingRef = useRef(false);

  // Carregar progresso salvo ao inicializar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as RegenerateProgress;
        // Verificar se há progresso não concluído
        if (parsed && !parsed.isComplete && parsed.items.length > 0) {
          // Marcar itens "processing" como "pending" para retry
          const fixedItems = parsed.items.map(item => ({
            ...item,
            status: item.status === 'processing' ? 'pending' as const : item.status
          }));
          setProgress({ ...parsed, items: fixedItems, isRunning: false });
          setHasSavedProgress(true);
          logger.debug('Progresso de regeneração encontrado', { 
            total: parsed.items.length, 
            processed: parsed.currentIndex 
          });
        }
      } catch (e) {
        logger.error('Erro ao carregar progresso salvo', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Salvar progresso no localStorage
  const saveProgress = useCallback((newProgress: RegenerateProgress) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...newProgress,
        lastUpdatedAt: new Date().toISOString()
      }));
    } catch (e) {
      logger.error('Erro ao salvar progresso', e);
    }
  }, []);

  // Limpar progresso
  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProgress(null);
    setHasSavedProgress(false);
    abortRef.current = false;
  }, []);

  // Parar o processo
  const stop = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
    if (progress) {
      const stoppedProgress = { ...progress, isRunning: false };
      setProgress(stoppedProgress);
      saveProgress(stoppedProgress);
    }
    logger.debug('Regeneração pausada pelo usuário');
  }, [progress, saveProgress]);

  // Regenerar um único item com retry
  const regenerateItem = useCallback(async (
    item: RegenerateItem,
    retryCount = 0
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-lyrics', {
        body: { approval_id: item.approval_id }
      });

      if (error) {
        throw error;
      }

      if (data && (data.success === false || data.error)) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      return { success: true };
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      
      // Se ainda pode fazer retry
      if (retryCount < MAX_RETRIES) {
        logger.debug(`Retry ${retryCount + 1}/${MAX_RETRIES} para ${item.approval_id}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return regenerateItem(item, retryCount + 1);
      }

      return { 
        success: false, 
        error: errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage 
      };
    }
  }, []);

  // Processar todos os itens
  const processItems = useCallback(async (currentProgress: RegenerateProgress) => {
    if (processingRef.current) {
      logger.debug('Processamento já em andamento, ignorando');
      return;
    }

    processingRef.current = true;
    abortRef.current = false;
    setIsRunning(true);

    let updatedProgress = { ...currentProgress, isRunning: true };
    setProgress(updatedProgress);
    saveProgress(updatedProgress);

    logger.debug('Iniciando processamento', { 
      total: updatedProgress.items.length, 
      startIndex: updatedProgress.currentIndex 
    });

    for (let i = updatedProgress.currentIndex; i < updatedProgress.items.length; i++) {
      // Verificar se foi solicitado parar
      if (abortRef.current) {
        logger.debug('Regeneração interrompida pelo usuário no item', { itemIndex: i });
        break;
      }

      const item = updatedProgress.items[i];

      // Pular itens já processados com sucesso
      if (item.status === 'success' || item.status === 'skipped') {
        continue;
      }

      // Atualizar status para processing
      updatedProgress = {
        ...updatedProgress,
        items: updatedProgress.items.map((it, idx) => 
          idx === i ? { ...it, status: 'processing' as const } : it
        ),
        currentIndex: i
      };
      setProgress(updatedProgress);
      saveProgress(updatedProgress);

      // Processar item
      const result = await regenerateItem(item);

      // Atualizar status com resultado
      updatedProgress = {
        ...updatedProgress,
        items: updatedProgress.items.map((it, idx) => 
          idx === i ? { 
            ...it, 
            status: result.success ? 'success' as const : 'error' as const,
            error: result.error
          } : it
        ),
        currentIndex: i + 1,
        totalProcessed: updatedProgress.totalProcessed + 1,
        successCount: updatedProgress.successCount + (result.success ? 1 : 0),
        errorCount: updatedProgress.errorCount + (result.success ? 0 : 1),
        lastUpdatedAt: new Date().toISOString()
      };
      setProgress(updatedProgress);
      saveProgress(updatedProgress);

      logger.debug(`Processado ${i + 1}/${updatedProgress.items.length}`, { 
        success: result.success,
        approval_id: item.approval_id
      });

      // Delay entre itens (exceto no último)
      if (i < updatedProgress.items.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ITEMS));
      }
    }

    // Verificar se concluiu tudo
    const allProcessed = updatedProgress.items.every(
      it => it.status === 'success' || it.status === 'error' || it.status === 'skipped'
    );

    if (allProcessed && !abortRef.current) {
      updatedProgress = {
        ...updatedProgress,
        isComplete: true,
        isRunning: false,
        currentIndex: updatedProgress.items.length
      };
      setProgress(updatedProgress);
      saveProgress(updatedProgress);
      logger.event('regenerate_all_completed', {
        total: updatedProgress.items.length,
        success: updatedProgress.successCount,
        errors: updatedProgress.errorCount
      });

      // Atualizar dados após conclusão
      if (onRefetch) {
        await onRefetch();
      }
    }

    setIsRunning(false);
    processingRef.current = false;
  }, [regenerateItem, saveProgress, onRefetch]);

  // Iniciar regeneração do zero
  const start = useCallback(async () => {
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error('Usuário não autenticado', authError);
      throw new Error('Usuário não autenticado. Faça login novamente.');
    }

    // Buscar todas as letras pendentes
    let allApprovals: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: approvals, error: fetchError } = await supabase
        .from('lyrics_approvals')
        .select(`
          id,
          order_id,
          orders:order_id (
            customer_email
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        throw new Error(`Erro ao buscar letras pendentes: ${fetchError.message}`);
      }

      if (approvals && approvals.length > 0) {
        allApprovals = allApprovals.concat(approvals);
        if (approvals.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    if (allApprovals.length === 0) {
      throw new Error('Nenhuma letra pendente encontrada para regenerar.');
    }

    logger.debug('Letras pendentes encontradas', { total: allApprovals.length });

    // Criar itens de progresso
    const items: RegenerateItem[] = allApprovals.map(approval => ({
      approval_id: approval.id,
      order_id: approval.order_id || undefined,
      customer_email: (approval.orders as any)?.customer_email || undefined,
      status: 'pending' as const
    }));

    const newProgress: RegenerateProgress = {
      items,
      currentIndex: 0,
      isComplete: false,
      isRunning: true,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0
    };

    setProgress(newProgress);
    setHasSavedProgress(true);
    saveProgress(newProgress);

    // Iniciar processamento
    await processItems(newProgress);
  }, [saveProgress, processItems]);

  // Retomar de onde parou
  const resume = useCallback(async () => {
    if (!progress || progress.isComplete) {
      throw new Error('Nenhum progresso para retomar.');
    }

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error('Usuário não autenticado', authError);
      throw new Error('Usuário não autenticado. Faça login novamente.');
    }

    logger.debug('Retomando regeneração', { 
      currentIndex: progress.currentIndex, 
      total: progress.items.length 
    });

    await processItems(progress);
  }, [progress, processItems]);

  return {
    progress,
    isRunning,
    hasSavedProgress,
    start,
    resume,
    stop,
    clear
  };
}

