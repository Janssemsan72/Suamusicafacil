// FASE 1: Utilitário de Logging Detalhado para Checkout

export interface CheckoutLogEvent {
  type: 'checkout_started' | 'quiz_creation_started' | 'quiz_created' | 'order_creation_started' | 'order_created' | 'checkout_requested' | 'checkout_received' | 'redirect' | 'redirect_direct' | 'error';
  timestamp: string;
  transactionId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
}

class CheckoutLogger {
  private logs: CheckoutLogEvent[] = [];
  private transactionId: string;

  constructor(transactionId: string) {
    this.transactionId = transactionId;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(type: CheckoutLogEvent['type'], data?: any, error?: string) {
    const event: CheckoutLogEvent = {
      type,
      timestamp: new Date().toISOString(),
      transactionId: this.transactionId,
      data,
      error
    };

    this.logs.push(event);
    
    // Log to console with color coding
    const prefix = `[CHECKOUT ${this.transactionId.slice(0, 8)}]`;
    switch (type) {
      case 'error':
        console.error(prefix, type, error || data);
        break;
      case 'quiz_created':
      case 'order_created':
      case 'checkout_received':
        console.log(`✅ ${prefix}`, type, data);
        break;
      default:
        console.log(prefix, type, data);
    }
  }

  getLogs(): CheckoutLogEvent[] {
    return this.logs;
  }

  getTransactionId(): string {
    return this.transactionId;
  }

  // Salvar logs no localStorage para debug
  saveToDraft() {
    try {
      localStorage.setItem(`checkout_logs_${this.transactionId}`, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save logs to localStorage:', error);
    }
  }

  // Enviar logs para o banco (opcional - para monitoring dashboard)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendToDatabase(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabaseClient: any, 
    orderId?: string
  ) {
    try {
      const events = this.logs.map(log => ({
        transaction_id: this.transactionId,
        order_id: orderId || null,
        event_type: log.type,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: log.data || {},
        error: log.error || null
      }));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const { error } = await supabaseClient
        .from('checkout_events')
        .insert(events);

      // ✅ CORREÇÃO: Tratar erros 400/404 graciosamente (tabela pode não existir)
      if (error) {
        const isTableNotFound = error.code === 'PGRST116' || 
                               error.code === '42P01' || 
                               error.code === '404' ||
                               error.message?.includes('does not exist') ||
                               error.message?.includes('relation') ||
                               error.message?.includes('not found');
        
        if (isTableNotFound || error.code === '400') {
          // Tabela não existe, apenas logar em desenvolvimento
          if (process.env.NODE_ENV === 'development') {
            console.warn('Tabela checkout_events não encontrada, eventos não foram salvos:', error);
          }
        } else {
          // Outro tipo de erro, logar normalmente
          console.error('Failed to save checkout events to database:', error);
        }
      }
    } catch (error) {
      console.error('Error sending logs to database:', error);
    }
  }
}

export function createCheckoutLogger(): CheckoutLogger {
  // Gerar UUID único para esta transação
  // Usar crypto.randomUUID se disponível, senão usar fallback
  let transactionId: string;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    transactionId = crypto.randomUUID();
  } else {
    // Fallback para navegadores que não suportam crypto.randomUUID
    transactionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  return new CheckoutLogger(transactionId);
}

export function loadCheckoutLogger(transactionId: string): CheckoutLogger {
  return new CheckoutLogger(transactionId);
}
