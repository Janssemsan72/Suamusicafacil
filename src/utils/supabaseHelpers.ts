import { supabase } from '@/integrations/supabase/client';

/**
 * Verifica se uma tabela existe no banco de dados
 * @param tableName Nome da tabela
 * @returns true se a tabela existe, false caso contrário
 */
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    // Tentar fazer uma query simples para verificar se a tabela existe
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);
    
    if (error) {
      const isTableNotFound = error.code === 'PGRST116' || 
                             error.code === '42P01' || 
                             error.code === '404' ||
                             error.message?.includes('does not exist') ||
                             error.message?.includes('relation') ||
                             error.message?.includes('not found');
      
      return !isTableNotFound;
    }
    
    return true;
  } catch (err: any) {
    const isTableNotFound = err?.code === 'PGRST116' || 
                           err?.code === '42P01' || 
                           err?.code === '404' ||
                           err?.message?.includes('does not exist') ||
                           err?.message?.includes('relation');
    
    return !isTableNotFound;
  }
}

/**
 * Verifica se um campo existe em uma tabela
 * @param tableName Nome da tabela
 * @param columnName Nome do campo
 * @returns true se o campo existe, false caso contrário
 */
export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    // Tentar fazer uma query incluindo o campo para verificar se existe
    const { error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(0);
    
    if (error) {
      const isColumnError = error.code === '400' && 
                           (error.message?.includes('column') || 
                            error.message?.includes('PGRST') ||
                            error.message?.includes(columnName));
      
      return !isColumnError;
    }
    
    return true;
  } catch (err: any) {
    const isColumnError = err?.code === '400' && 
                         (err?.message?.includes('column') || 
                          err?.message?.includes('PGRST'));
    
    return !isColumnError;
  }
}

/**
 * Executa uma query com fallback automático se campos não existirem
 * @param tableName Nome da tabela
 * @param fields Campos desejados (array de strings)
 * @param fallbackFields Campos de fallback se os campos originais não existirem
 * @param queryBuilder Função para construir a query
 * @returns Resultado da query
 */
export async function queryWithFallback<T = any>(
  tableName: string,
  fields: string[],
  fallbackFields: string[],
  queryBuilder: (selectFields: string) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    // Tentar com campos originais
    const fieldsStr = fields.join(', ');
    const result = await queryBuilder(fieldsStr);
    
    if (result.error) {
      const isColumnError = result.error.code === '400' && 
                           (result.error.message?.includes('column') || 
                            result.error.message?.includes('PGRST'));
      
      if (isColumnError && fallbackFields.length > 0) {
        // Tentar com campos de fallback
        const fallbackStr = fallbackFields.join(', ');
        const fallbackResult = await queryBuilder(fallbackStr);
        
        return fallbackResult;
      }
    }
    
    return result;
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Verifica se um erro é de tabela não encontrada
 * @param error Erro do Supabase
 * @returns true se é erro de tabela não encontrada
 */
export function isTableNotFoundError(error: any): boolean {
  if (!error) return false;
  
  return error.code === 'PGRST116' || 
         error.code === '42P01' || 
         error.code === '404' ||
         error.message?.includes('does not exist') ||
         error.message?.includes('relation') ||
         error.message?.includes('not found');
}

/**
 * Verifica se um erro é de campo não encontrado
 * @param error Erro do Supabase
 * @returns true se é erro de campo não encontrado
 */
export function isColumnNotFoundError(error: any): boolean {
  if (!error) return false;
  
  return error.code === '400' && 
         (error.message?.includes('column') || 
          error.message?.includes('PGRST'));
}

/**
 * Verifica se um erro é de permissão
 * @param error Erro do Supabase
 * @returns true se é erro de permissão
 */
export function isPermissionError(error: any): boolean {
  if (!error) return false;
  
  return error.code === '42501' || 
         error.message?.includes('permission');
}

