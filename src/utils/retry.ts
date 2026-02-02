/**
 * Retry utility with exponential backoff
 * Helps handle transient failures in network requests
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryable?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryable: (error: any) => {
    // Retry on network errors, timeouts, and 5xx errors
    if (!error) return false;
    
    // Network errors
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return true;
    }
    
    // Timeout errors
    if (error.message?.includes('timeout') || error.message?.includes('aborted')) {
      return true;
    }
    
    // HTTP 5xx errors (server errors)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // Supabase/PostgreSQL specific errors that are retryable
    if (error.code === 'PGRST116' || error.code === '57014') {
      return true; // Connection timeout, statement timeout
    }
    
    // PostgreSQL error codes for retryable errors
    if (error.code === '40P01') return true; // deadlock detected
    if (error.code === '53300') return true; // too many connections
    if (error.code === '57P03') return true; // cannot connect now
    if (error.code === '08006') return true; // connection failure
    if (error.code === '08003') return true; // connection does not exist
    if (error.code === '08001') return true; // SQL client unable to establish SQL connection
    
    // Check error message for connection-related errors
    const errorMsg = error.message?.toLowerCase() || '';
    if (errorMsg.includes('connection') || errorMsg.includes('econnreset') || errorMsg.includes('etimedout')) {
      return true;
    }
    
    return false;
  }
};

/**
 * Calculate delay for retry attempt with exponential backoff and jitter
 * Jitter helps avoid thundering herd problem when many requests retry simultaneously
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const baseDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, options.maxDelay);
  
  // Add ±20% jitter to avoid synchronized retries
  const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1); // Random between -0.2 and +0.2
  const finalDelay = cappedDelay + jitter;
  
  return Math.max(0, finalDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Promise that resolves with the function result
 * @throws Last error if all retries fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      if (!opts.retryable(error)) {
        throw error;
      }
      
      // Don't retry if this was the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }
      
      // Calculate delay and wait before retrying
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }
  
  // All retries exhausted, throw last error
  throw lastError;
}

/**
 * Retry with custom error handler
 */
export async function retryWithHandler<T>(
  fn: () => Promise<T>,
  onRetry: (error: any, attempt: number, maxRetries: number) => void,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      if (!opts.retryable(error)) {
        throw error;
      }
      
      // Don't retry if this was the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }
      
      // Call retry handler
      onRetry(error, attempt + 1, opts.maxRetries);
      
      // Calculate delay and wait before retrying
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }
  
  // All retries exhausted, throw last error
  throw lastError;
}


