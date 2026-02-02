/**
 * Utilitário para sincronização entre localStorage e banco de dados
 */

import { supabase } from '@/integrations/supabase/client';
import type { QuizData } from './quizValidation';

const QUIZ_STORAGE_KEY = 'pending_quiz';
const QUIZ_SYNC_KEY = 'quiz_sync_status';

// ✅ COMPATIBILIDADE: Verificar se localStorage está disponível
const isLocalStorageAvailable = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    if (typeof Storage === 'undefined') return false;
    
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    // localStorage pode estar desabilitado ou em modo privado
    console.warn('⚠️ [quizSync] localStorage não disponível:', e);
    return false;
  }
};

// ✅ COMPATIBILIDADE: Verificar se sessionStorage está disponível
const isSessionStorageAvailable = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    if (typeof Storage === 'undefined') return false;
    
    const test = '__session_storage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch (e) {
    // sessionStorage pode estar desabilitado ou em modo privado
    console.warn('⚠️ [quizSync] sessionStorage não disponível:', e);
    return false;
  }
};

// ✅ COMPATIBILIDADE: Fallback em memória para navegadores sem storage
let memoryStorage: Record<string, string> = {};

export interface SyncStatus {
  synced: boolean;
  lastSync?: string;
  quizId?: string;
}

/**
 * Gera um UUID único para identificar a sessão do quiz
 * Este UUID será usado para vincular o quiz ao navegador do cliente
 */
export function generateQuizSessionId(): string {
  // Usar crypto.randomUUID() se disponível (navegadores modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback para geração manual de UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Obtém ou gera um quiz_session_id para o quiz atual
 * Se já existe no localStorage, retorna o existente
 * Caso contrário, gera um novo e salva
 */
export function getOrCreateQuizSessionId(): string {
  const storageKey = 'quiz_session_id';
  
  if (isLocalStorageAvailable()) {
    try {
      const existing = localStorage.getItem(storageKey);
      if (existing) {
        // Validar que é um UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(existing)) {
          return existing;
        }
      }
    } catch (error) {
      console.warn('⚠️ [quizSync] Erro ao ler session_id do localStorage:', error);
    }
  }
  
  // Gerar novo session_id
  const newSessionId = generateQuizSessionId();
  
  // Salvar no localStorage
  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(storageKey, newSessionId);
    } catch (error) {
      console.warn('⚠️ [quizSync] Erro ao salvar session_id no localStorage:', error);
    }
  }
  
  return newSessionId;
}

/**
 * Limpa o quiz_session_id do localStorage
 * Útil quando o quiz é concluído e o pedido é criado
 */
export function clearQuizSessionId(): void {
  const storageKey = 'quiz_session_id';
  
  if (isLocalStorageAvailable()) {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('⚠️ [quizSync] Erro ao limpar session_id:', error);
    }
  }
}

/**
 * Salva quiz no localStorage com retry logic e fallback para memória
 */
export async function saveQuizToStorage(
  quiz: QuizData,
  options: { retries?: number; delay?: number } = {}
): Promise<{ success: boolean; error?: Error }> {
  const { retries = 3, delay = 100 } = options;
  const quizJson = JSON.stringify(quiz);
  const hasLocalStorage = isLocalStorageAvailable();
  const hasSessionStorage = isSessionStorageAvailable();
  
  // ✅ PROTEÇÃO ADICIONAL: Log timestamp para diagnóstico de problemas perto das 23h
  const saveTimestamp = new Date().toISOString();
  const hour = new Date().getHours();
  
  console.log(`💾 [quizSync] Tentando salvar quiz às ${saveTimestamp} (hora: ${hour}h)`, {
    quizSize: quizJson.length,
    hasLocalStorage,
    hasSessionStorage,
    retries
  });

  // Se nenhum storage está disponível, usar memória como fallback
  if (!hasLocalStorage && !hasSessionStorage) {
    console.warn('⚠️ [quizSync] Nenhum storage disponível, usando memória como fallback');
    try {
      memoryStorage[QUIZ_STORAGE_KEY] = quizJson;
      const parsed = JSON.parse(quizJson);
      if (!parsed.about_who || !parsed.style) {
        return { success: false, error: new Error('Quiz está incompleto') };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // ✅ PROTEÇÃO ADICIONAL: Verificar quota do localStorage antes de salvar
      if (hasLocalStorage) {
        try {
          // Tentar verificar se há espaço disponível
          const testKey = '__storage_quota_test__';
          localStorage.setItem(testKey, 'test');
          localStorage.removeItem(testKey);
        } catch (quotaError: any) {
          // Se erro de quota, tentar limpar dados antigos não essenciais
          if (quotaError.name === 'QuotaExceededError' || quotaError.code === 22) {
            console.warn('⚠️ [quizSync] Quota do localStorage excedida, tentando limpar dados antigos...');
            try {
              // Limpar apenas chaves que não são essenciais
              const keysToKeep = [QUIZ_STORAGE_KEY, 'suamusicafacil_language', 'editing_order_id', 'editing_quiz_id', 'editing_token'];
              const allKeys = Object.keys(localStorage);
              allKeys.forEach(key => {
                if (!keysToKeep.includes(key) && (key.startsWith('quiz_') || key.startsWith('sync_') || key.includes('cache'))) {
                  try {
                    localStorage.removeItem(key);
                  } catch (e) {
                    // Ignorar erro individual
                  }
                }
              });
            } catch (cleanupError) {
              console.warn('⚠️ [quizSync] Erro ao limpar localStorage:', cleanupError);
            }
          }
        }
        
        // Tentar salvar no localStorage
        localStorage.setItem(QUIZ_STORAGE_KEY, quizJson);
        
        // ✅ PROTEÇÃO ADICIONAL: Aguardar um pouco antes de verificar (garantir persistência)
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Verificar se foi salvo corretamente
        const saved = localStorage.getItem(QUIZ_STORAGE_KEY);
        if (!saved) {
          throw new Error('Quiz não foi salvo no localStorage');
        }

        // Validar que o JSON salvo é válido
        const parsed = JSON.parse(saved);
        if (!parsed.about_who || !parsed.style) {
          throw new Error('Quiz salvo está incompleto');
        }
        
        // ✅ PROTEÇÃO ADICIONAL: Log de sucesso com timestamp
        console.log(`✅ [quizSync] Quiz salvo com sucesso no localStorage (tentativa ${attempt}/${retries})`, {
          timestamp: saveTimestamp,
          hour,
          quizSize: quizJson.length,
          savedSize: saved.length
        });
      }

      // Salvar também no sessionStorage como backup
      if (hasSessionStorage) {
        try {
          sessionStorage.setItem(QUIZ_STORAGE_KEY, quizJson);
        } catch (sessionError) {
          console.warn('⚠️ [quizSync] Não foi possível salvar no sessionStorage:', sessionError);
          // Continuar mesmo assim
        }
      }

      // ✅ PROTEÇÃO ADICIONAL: Aguardar múltiplos frames para garantir persistência
      // Isso é especialmente importante perto das 23h quando pode haver problemas de sincronização
      if (typeof requestAnimationFrame !== 'undefined') {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Aumentar delay para garantir persistência
      }
      
      // ✅ PROTEÇÃO ADICIONAL: Verificação final após aguardar
      if (hasLocalStorage) {
        const finalCheck = localStorage.getItem(QUIZ_STORAGE_KEY);
        if (!finalCheck) {
          throw new Error('Quiz foi perdido após salvamento (possível limpeza de localStorage)');
        }
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [quizSync] Erro ao salvar quiz (tentativa ${attempt}/${retries}):`, {
        error: errorMessage,
        timestamp: saveTimestamp,
        hour,
        hasLocalStorage,
        hasSessionStorage
      });
      
      if (attempt === retries) {
        // Última tentativa: tentar salvar em memória como fallback
        try {
          memoryStorage[QUIZ_STORAGE_KEY] = quizJson;
          console.warn('⚠️ [quizSync] Salvando em memória como fallback (última tentativa)', {
            timestamp: saveTimestamp,
            hour
          });
          return { success: true };
        } catch (memoryError) {
          console.error('❌ [quizSync] Falha total ao salvar quiz (incluindo memória):', {
            error: errorMessage,
            memoryError: memoryError instanceof Error ? memoryError.message : String(memoryError),
            timestamp: saveTimestamp,
            hour
          });
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      }
      // Aguardar antes de tentar novamente (backoff exponencial)
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  return { success: false, error: new Error('Falha ao salvar após múltiplas tentativas') };
}

/**
 * Carrega quiz do localStorage com fallback para sessionStorage e memória
 */
export function loadQuizFromStorage(): QuizData | null {
  try {
    const hasLocalStorage = isLocalStorageAvailable();
    const hasSessionStorage = isSessionStorageAvailable();

    // Tentar localStorage primeiro
    if (hasLocalStorage) {
      try {
        const localStorageQuiz = localStorage.getItem(QUIZ_STORAGE_KEY);
        if (localStorageQuiz) {
          const parsed = JSON.parse(localStorageQuiz);
          if (parsed.about_who && parsed.style) {
            return parsed;
          }
        }
      } catch (localError) {
        console.warn('⚠️ [quizSync] Erro ao ler localStorage:', localError);
      }
    }

    // Fallback para sessionStorage
    if (hasSessionStorage) {
      try {
        const sessionStorageQuiz = sessionStorage.getItem(QUIZ_STORAGE_KEY);
        if (sessionStorageQuiz) {
          const parsed = JSON.parse(sessionStorageQuiz);
          if (parsed.about_who && parsed.style) {
            // Tentar restaurar para localStorage se disponível
            if (hasLocalStorage) {
              try {
                localStorage.setItem(QUIZ_STORAGE_KEY, sessionStorageQuiz);
              } catch {
                // Ignorar erro
              }
            }
            return parsed;
          }
        }
      } catch (sessionError) {
        console.warn('⚠️ [quizSync] Erro ao ler sessionStorage:', sessionError);
      }
    }

    // Fallback final: memória
    if (memoryStorage[QUIZ_STORAGE_KEY]) {
      try {
        const parsed = JSON.parse(memoryStorage[QUIZ_STORAGE_KEY]);
        if (parsed.about_who && parsed.style) {
          console.warn('⚠️ [quizSync] Carregando quiz da memória (fallback)');
          return parsed;
        }
      } catch (memoryError) {
        console.warn('⚠️ [quizSync] Erro ao ler memória:', memoryError);
      }
    }
  } catch (error) {
    console.error('❌ [quizSync] Erro ao carregar quiz do storage:', error);
  }

  return null;
}

/**
 * Verifica se quiz está sincronizado com o banco
 */
export async function checkQuizSync(quizId: string): Promise<SyncStatus> {
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('id, updated_at')
      .eq('id', quizId)
      .single();

    if (error || !data) {
      return { synced: false };
    }

    // ✅ COMPATIBILIDADE: Verificar storage antes de usar
    if (isLocalStorageAvailable()) {
      try {
        const syncStatus = localStorage.getItem(QUIZ_SYNC_KEY);
        if (syncStatus) {
          const status: SyncStatus = JSON.parse(syncStatus);
          if (status.quizId === quizId && status.lastSync) {
            const lastSyncDate = new Date(status.lastSync);
            const dbUpdatedDate = new Date(data.updated_at);
            
            // Se o banco foi atualizado depois da última sincronização, não está sincronizado
            if (dbUpdatedDate > lastSyncDate) {
              return { synced: false, quizId, lastSync: status.lastSync };
            }
          }
        }
      } catch (storageError) {
        console.warn('⚠️ [quizSync] Erro ao ler sync status:', storageError);
      }
    }

    return { synced: true, quizId, lastSync: new Date().toISOString() };
  } catch (error) {
    console.error('Erro ao verificar sincronização:', error);
    return { synced: false };
  }
}

/**
 * Marca quiz como sincronizado
 */
export function markQuizAsSynced(quizId: string): void {
  try {
    const status: SyncStatus = {
      synced: true,
      quizId,
      lastSync: new Date().toISOString(),
    };
    
    // ✅ COMPATIBILIDADE: Verificar storage antes de usar
    if (isLocalStorageAvailable()) {
      localStorage.setItem(QUIZ_SYNC_KEY, JSON.stringify(status));
    } else {
      // Fallback para memória
      memoryStorage[QUIZ_SYNC_KEY] = JSON.stringify(status);
    }
  } catch (error) {
    console.error('❌ [quizSync] Erro ao marcar quiz como sincronizado:', error);
  }
}

/**
 * Limpa dados de sincronização
 */
export function clearSyncStatus(): void {
  try {
    // ✅ COMPATIBILIDADE: Verificar storage antes de usar
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(QUIZ_SYNC_KEY);
    }
    // Limpar também da memória
    delete memoryStorage[QUIZ_SYNC_KEY];
  } catch (error) {
    console.error('❌ [quizSync] Erro ao limpar status de sincronização:', error);
  }
}

const QUIZ_STEP_STATE_KEY = 'quiz_step_state';

export interface QuizStepState {
  step: number;
  lyricsTitle: string;
  lyricsText: string;
  lyricsApproved: boolean;
  quizId: string | null;
}

/**
 * Persiste o estado do fluxo (passo atual + letra) para restaurar ao retornar à página.
 */
export function saveQuizStepState(state: QuizStepState): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(QUIZ_STEP_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('⚠️ [quizSync] Erro ao salvar step state:', e);
  }
}

/**
 * Carrega o estado do fluxo (passo + letra) do localStorage.
 */
export function loadQuizStepState(): QuizStepState | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const raw = localStorage.getItem(QUIZ_STEP_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.step >= 1 && parsed.step <= 3) {
      return {
        step: parsed.step,
        lyricsTitle: typeof parsed.lyricsTitle === 'string' ? parsed.lyricsTitle : '',
        lyricsText: typeof parsed.lyricsText === 'string' ? parsed.lyricsText : '',
        lyricsApproved: !!parsed.lyricsApproved,
        quizId: parsed.quizId || null,
      };
    }
    return null;
  } catch (e) {
    console.warn('⚠️ [quizSync] Erro ao carregar step state:', e);
    return null;
  }
}

/**
 * Limpa o estado do fluxo (chamar quando checkout for concluído).
 */
export function clearQuizStepState(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.removeItem(QUIZ_STEP_STATE_KEY);
  } catch (e) {
    console.warn('⚠️ [quizSync] Erro ao limpar step state:', e);
  }
}

/**
 * Verifica se há divergência entre localStorage e banco
 */
export async function checkDataDivergence(quiz: QuizData): Promise<{
  hasDivergence: boolean;
  reason?: string;
}> {
  if (!quiz.id) {
    return { hasDivergence: false };
  }

  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quiz.id)
      .single();

    if (error || !data) {
      return {
        hasDivergence: true,
        reason: 'Quiz não encontrado no banco de dados',
      };
    }

    // Comparar campos críticos
    if (data.about_who !== quiz.about_who || data.style !== quiz.style) {
      return {
        hasDivergence: true,
        reason: 'Dados do quiz divergem do banco de dados',
      };
    }

    return { hasDivergence: false };
  } catch (error) {
    console.error('Erro ao verificar divergência:', error);
    return {
      hasDivergence: true,
      reason: 'Erro ao verificar dados',
    };
  }
}










