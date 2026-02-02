import { useState, useEffect, useCallback, useRef } from 'react';
import { retry, RetryOptions } from '@/utils/retry';
import { logger } from '@/utils/logger';

export interface UseSupabaseQueryOptions<T> {
  queryFn: () => Promise<{ data: T | null; error: any }>;
  enabled?: boolean;
  retryOptions?: RetryOptions;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  refetchInterval?: number;
  staleTime?: number; // Cache time in milliseconds
}

export interface UseSupabaseQueryResult<T> {
  data: T | null;
  error: any;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for Supabase queries with automatic retry and error handling
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Error tracking and reporting
 * - Cache support (staleTime)
 * - Refetch interval support
 * - Loading states
 */
export function useSupabaseQuery<T = any>(
  options: UseSupabaseQueryOptions<T>
): UseSupabaseQueryResult<T> {
  const {
    queryFn,
    enabled = true,
    retryOptions = {},
    onSuccess,
    onError,
    refetchInterval,
    staleTime = 0
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const cacheRef = useRef<{ data: T | null; timestamp: number } | null>(null);
  const refetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const executeQuery = useCallback(async (useCache = true) => {
    // Check cache if staleTime is set
    if (useCache && staleTime > 0 && cacheRef.current) {
      const now = Date.now();
      const cacheAge = now - cacheRef.current.timestamp;
      
      if (cacheAge < staleTime) {
        // Use cached data
        setData(cacheRef.current.data);
        setIsLoading(false);
        setIsError(false);
        setIsSuccess(true);
        return;
      }
    }

    if (!isMountedRef.current) return;

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const startTime = Date.now();
      
      // Execute query with retry
      const result = await retry(
        async () => {
          const queryResult = await queryFn();
          
          // Check if Supabase returned an error
          if (queryResult.error) {
            throw queryResult.error;
          }
          
          return queryResult.data;
        },
        {
          ...retryOptions,
          retryable: (err) => {
            // Use custom retryable function if provided
            if (retryOptions.retryable) {
              return retryOptions.retryable(err);
            }
            
            // Default: retry on network errors and 5xx
            if (!err) return false;
            if (err.message?.includes('network') || err.message?.includes('fetch')) return true;
            if (err.message?.includes('timeout') || err.message?.includes('aborted')) return true;
            if (err.status >= 500 && err.status < 600) return true;
            if (err.code === 'PGRST116' || err.code === '57014') return true;
            
            return false;
          }
        }
      );

      const duration = Date.now() - startTime;

      if (!isMountedRef.current) return;

      // Log performance metrics in development
      if (import.meta.env.DEV) {
        logger.debug(`Query completed in ${duration}ms`);
      }

      // Update cache
      if (staleTime > 0) {
        cacheRef.current = {
          data: result,
          timestamp: Date.now()
        };
      }

      setData(result);
      setIsLoading(false);
      setIsError(false);
      setIsSuccess(true);
      setError(null);

      // Call success callback
      if (onSuccess && result) {
        onSuccess(result);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;

      const duration = Date.now() - Date.now();
      
      // Log error metrics
      logger.error('Query failed after retries', err, {
        duration,
        retries: retryOptions.maxRetries || 3
      });

      setError(err);
      setIsLoading(false);
      setIsError(true);
      setIsSuccess(false);
      setData(null);

      // Call error callback
      if (onError) {
        onError(err);
      }
    }
  }, [queryFn, retryOptions, staleTime, onSuccess, onError]);

  const refetch = useCallback(async () => {
    await executeQuery(false); // Force refetch, don't use cache
  }, [executeQuery]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(true);
    setIsError(false);
    setIsSuccess(false);
    cacheRef.current = null;
  }, []);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      executeQuery();
    } else {
      setIsLoading(false);
    }
  }, [enabled, executeQuery]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && refetchInterval > 0 && enabled) {
      refetchIntervalRef.current = setInterval(() => {
        executeQuery(false); // Don't use cache for interval refetches
      }, refetchInterval);

      return () => {
        if (refetchIntervalRef.current) {
          clearInterval(refetchIntervalRef.current);
        }
      };
    }
  }, [refetchInterval, enabled, executeQuery]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, []);

  return {
    data,
    error,
    isLoading,
    isError,
    isSuccess,
    refetch,
    reset
  };
}


