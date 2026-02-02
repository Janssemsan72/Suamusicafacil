// ✅ LOGGING: Sistema de logs estruturado para edge functions
import { sanitizeData } from "./validation.ts";

export interface LogContext {
  functionName: string;
  requestId?: string;
  userId?: string;
  orderId?: string;
  jobId?: string;
  timestamp: string;
}

export interface LogData {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context: LogContext;
  data?: any;
  error?: any;
  duration?: number;
}

/**
 * Gera ID único para rastreamento de requests
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log estruturado para início de função
 */
export function logFunctionStart(
  functionName: string, 
  data: any, 
  context: Partial<LogContext> = {}
): LogContext {
  const requestId = context.requestId || generateRequestId();
  const timestamp = new Date().toISOString();
  
  const logContext: LogContext = {
    functionName,
    requestId,
    timestamp,
    ...context
  };

  console.log(`🚀 [${functionName}] Iniciando`, {
    ...logContext,
    data: sanitizeData(data)
  });

  return logContext;
}

/**
 * Log estruturado para sucesso de função
 */
export function logFunctionSuccess(
  context: LogContext,
  result: any,
  duration?: number
): void {
  console.log(`✅ [${context.functionName}] Sucesso`, {
    ...context,
    result: sanitizeData(result),
    duration: duration ? `${duration}ms` : undefined,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log estruturado para erro de função
 */
export function logFunctionError(
  context: LogContext,
  error: any,
  additionalData?: any
): void {
  console.error(`❌ [${context.functionName}] Erro`, {
    ...context,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    additionalData: sanitizeData(additionalData),
    timestamp: new Date().toISOString()
  });
}

/**
 * Log estruturado para warning
 */
export function logFunctionWarning(
  context: LogContext,
  message: string,
  data?: any
): void {
  console.warn(`⚠️ [${context.functionName}] Warning`, {
    ...context,
    message,
    data: sanitizeData(data),
    timestamp: new Date().toISOString()
  });
}

/**
 * Log estruturado para debug
 */
export function logFunctionDebug(
  context: LogContext,
  message: string,
  data?: any
): void {
  console.log(`🔍 [${context.functionName}] Debug`, {
    ...context,
    message,
    data: sanitizeData(data),
    timestamp: new Date().toISOString()
  });
}

/**
 * Log de performance
 */
export function logPerformance(
  context: LogContext,
  operation: string,
  duration: number,
  metadata?: any
): void {
  const level = duration > 5000 ? 'warn' : 'info';
  const emoji = duration > 5000 ? '🐌' : '⚡';
  
  console.log(`${emoji} [${context.functionName}] Performance`, {
    ...context,
    operation,
    duration: `${duration}ms`,
    metadata: sanitizeData(metadata),
    timestamp: new Date().toISOString()
  });
}

/**
 * Log de integração com APIs externas
 */
export function logApiCall(
  context: LogContext,
  apiName: string,
  endpoint: string,
  method: string,
  statusCode?: number,
  duration?: number,
  error?: any
): void {
  const level = error || (statusCode && statusCode >= 400) ? 'error' : 'info';
  const emoji = error ? '❌' : (statusCode && statusCode >= 400) ? '⚠️' : '🌐';
  
  const logData = {
    ...context,
    apiName,
    endpoint,
    method,
    statusCode,
    duration: duration ? `${duration}ms` : undefined,
    error: error ? {
      message: error.message,
      status: error.status
    } : undefined,
    timestamp: new Date().toISOString()
  };

  if (level === 'error') {
    console.error(`${emoji} [${context.functionName}] API Call`, logData);
  } else {
    console.log(`${emoji} [${context.functionName}] API Call`, logData);
  }
}

/**
 * Log de operações de banco de dados
 */
export function logDatabaseOperation(
  context: LogContext,
  operation: 'select' | 'insert' | 'update' | 'delete',
  table: string,
  duration?: number,
  error?: any,
  recordCount?: number
): void {
  const level = error ? 'error' : 'info';
  const emoji = error ? '❌' : '💾';
  
  console.log(`${emoji} [${context.functionName}] Database`, {
    ...context,
    operation,
    table,
    duration: duration ? `${duration}ms` : undefined,
    recordCount,
    error: error ? {
      message: error.message,
      code: error.code
    } : undefined,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log de email
 */
export function logEmailOperation(
  context: LogContext,
  emailType: string,
  recipient: string,
  status: 'sent' | 'failed' | 'retry',
  duration?: number,
  error?: any
): void {
  const level = status === 'failed' ? 'error' : 'info';
  const emoji = status === 'sent' ? '📧' : status === 'failed' ? '❌' : '🔄';
  
  console.log(`${emoji} [${context.functionName}] Email`, {
    ...context,
    emailType,
    recipient: recipient.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mascarar email
    status,
    duration: duration ? `${duration}ms` : undefined,
    error: error ? {
      message: error.message,
      code: error.code
    } : undefined,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log de webhook
 */
export function logWebhook(
  context: LogContext,
  webhookType: 'cakto' | 'resend' | 'suno',
  eventType: string,
  status: 'received' | 'processed' | 'failed',
  duration?: number,
  error?: any
): void {
  const level = status === 'failed' ? 'error' : 'info';
  const emoji = status === 'received' ? '📨' : status === 'processed' ? '✅' : '❌';
  
  console.log(`${emoji} [${context.functionName}] Webhook`, {
    ...context,
    webhookType,
    eventType,
    status,
    duration: duration ? `${duration}ms` : undefined,
    error: error ? {
      message: error.message,
      code: error.code
    } : undefined,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log de métricas de negócio
 */
export function logBusinessMetric(
  context: LogContext,
  metric: string,
  value: number,
  unit?: string,
  metadata?: any
): void {
  console.log(`📊 [${context.functionName}] Metric`, {
    ...context,
    metric,
    value,
    unit,
    metadata: sanitizeData(metadata),
    timestamp: new Date().toISOString()
  });
}

/**
 * Log de segurança
 */
export function logSecurityEvent(
  context: LogContext,
  event: 'auth_failed' | 'rate_limit' | 'invalid_origin' | 'suspicious_activity',
  details: string,
  metadata?: any
): void {
  console.warn(`🔒 [${context.functionName}] Security`, {
    ...context,
    event,
    details,
    metadata: sanitizeData(metadata),
    timestamp: new Date().toISOString()
  });
}

/**
 * Wrapper para medir tempo de execução
 */
export async function measureExecution<T>(
  context: LogContext,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    logPerformance(context, operation, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logFunctionError(context, error, { operation, duration });
    throw error;
  }
}

/**
 * Log de início de workflow
 */
export function logWorkflowStart(
  context: LogContext,
  workflowName: string,
  steps: string[]
): void {
  console.log(`🔄 [${context.functionName}] Workflow Start`, {
    ...context,
    workflowName,
    steps,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log de progresso de workflow
 */
export function logWorkflowProgress(
  context: LogContext,
  workflowName: string,
  currentStep: string,
  totalSteps: number,
  progress: number
): void {
  console.log(`⏳ [${context.functionName}] Workflow Progress`, {
    ...context,
    workflowName,
    currentStep,
    totalSteps,
    progress: `${progress}%`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log de conclusão de workflow
 */
export function logWorkflowComplete(
  context: LogContext,
  workflowName: string,
  duration: number,
  success: boolean,
  result?: any
): void {
  const emoji = success ? '✅' : '❌';
  console.log(`${emoji} [${context.functionName}] Workflow Complete`, {
    ...context,
    workflowName,
    duration: `${duration}ms`,
    success,
    result: sanitizeData(result),
    timestamp: new Date().toISOString()
  });
}
