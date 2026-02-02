import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from "@/lib/icons";
import { logErrorToDatabase } from '@/utils/errorHandler';
import { safeReload } from '@/utils/reload';
import { isMobileDevice, getDeviceInfo } from '@/utils/deviceDetection';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  // ✅ FASE 1: Proteção contra loops de recarregamento
  private static lastReloadTime: number = 0;
  private static reloadCount: number = 0;
  private static readonly MAX_RELOADS_PER_MINUTE = 1;
  private static readonly RELOAD_COOLDOWN_MS = 60000; // 1 minuto

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ [AdminErrorBoundary] Erro capturado:', error);
    console.error('❌ [AdminErrorBoundary] Error Info:', errorInfo);
    
    // ✅ OTIMIZAÇÃO MOBILE: Detectar se é erro de carregamento
    const deviceInfo = getDeviceInfo();
    const isLoadError = error.message.includes('Failed to fetch') || 
                       error.message.includes('dynamically imported module') ||
                       error.message.includes('NetworkError') ||
                       error.message.includes('Load failed');
    
    // Salvar erro no banco de dados
    logErrorToDatabase({
      error_type: isLoadError ? 'javascript_error' : 'react_error',
      error_message: error.message || 'React Error',
      error_stack: error.stack || errorInfo.componentStack,
      page_path: window.location.pathname,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      metadata: {
        componentStack: errorInfo.componentStack,
        errorName: error.name,
        errorString: error.toString(),
        isMobile: deviceInfo.isMobile,
        connectionType: deviceInfo.connectionType,
        isLoadError: isLoadError,
      },
    }).catch((logError) => {
      console.error('❌ [AdminErrorBoundary] Erro ao salvar no banco:', logError);
    });
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    // ✅ FASE 1: Proteção contra loops de recarregamento
    const now = Date.now();
    const timeSinceLastReload = now - AdminErrorBoundary.lastReloadTime;
    
    // Verificar se já recarregou recentemente
    if (timeSinceLastReload < AdminErrorBoundary.RELOAD_COOLDOWN_MS) {
      AdminErrorBoundary.reloadCount++;
      console.warn(`⚠️ [AdminErrorBoundary] Tentativa de recarregamento bloqueada. Já recarregou ${AdminErrorBoundary.reloadCount} vez(es) nos últimos ${Math.round(timeSinceLastReload / 1000)}s`);
      
      // Se excedeu o limite, não recarregar e apenas resetar o estado
      if (AdminErrorBoundary.reloadCount >= AdminErrorBoundary.MAX_RELOADS_PER_MINUTE) {
        console.error('❌ [AdminErrorBoundary] Limite de recarregamentos excedido. Resetando estado sem recarregar página.');
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
        });
        return;
      }
    } else {
      // Resetar contador se passou o cooldown
      AdminErrorBoundary.reloadCount = 0;
    }
    
    // Log detalhado antes de recarregar
    console.log('🔄 [AdminErrorBoundary] Recarregando página...', {
      error: this.state.error?.message,
      errorName: this.state.error?.name,
      timeSinceLastReload: timeSinceLastReload,
      reloadCount: AdminErrorBoundary.reloadCount,
    });
    
    // Verificar se o erro é realmente crítico antes de recarregar
    const isCriticalError = this.state.error && (
      this.state.error.message?.includes('ChunkLoadError') ||
      this.state.error.message?.includes('Loading chunk') ||
      this.state.error.message?.includes('Failed to fetch dynamically imported module') ||
      this.state.error.name === 'ChunkLoadError'
    );
    
    if (!isCriticalError) {
      console.warn('⚠️ [AdminErrorBoundary] Erro não é crítico. Resetando estado sem recarregar.');
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
      return;
    }
    
    // Atualizar timestamp do último recarregamento
    AdminErrorBoundary.lastReloadTime = now;
    AdminErrorBoundary.reloadCount++;
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Recarregar apenas se for erro crítico e não excedeu o limite
    if (AdminErrorBoundary.reloadCount <= AdminErrorBoundary.MAX_RELOADS_PER_MINUTE) {
      safeReload({ reason: 'AdminErrorBoundary' });
    } else {
      console.error('❌ [AdminErrorBoundary] Limite de recarregamentos atingido. Não recarregando.');
    }
  };

  render() {
    if (this.state.hasError) {
      const deviceInfo = getDeviceInfo();
      const isMobile = deviceInfo.isMobile;
      const isLoadError = this.state.error?.message.includes('Failed to fetch') || 
                         this.state.error?.message.includes('dynamically imported module') ||
                         this.state.error?.message.includes('NetworkError');
      
      return (
        <div className={`min-h-[100dvh] flex items-center justify-center bg-background ${isMobile ? 'p-2' : 'p-4'}`}>
          <Card className={`w-full ${isMobile ? 'max-w-full' : 'max-w-2xl'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                {isLoadError ? 'Erro ao Carregar Página' : 'Erro ao Carregar Admin'}
              </CardTitle>
              <CardDescription>
                {isLoadError 
                  ? isMobile 
                    ? 'Problema de conexão detectado. Verifique sua internet e tente novamente.'
                    : 'Ocorreu um erro ao carregar recursos da página. Tente recarregar.'
                  : 'Ocorreu um erro ao carregar a página administrativa'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Erro:</p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                    {this.state.error.toString()}
                  </pre>
                </div>
              )}
              
              {this.state.errorInfo && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Stack Trace:</p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recarregar Página
                </Button>
                <Button onClick={() => window.location.href = '/admin/auth'} variant="outline">
                  Ir para Login
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Possíveis causas:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Erro de importação de componente</li>
                  <li>Problema com dependências</li>
                  <li>Erro de sintaxe no código</li>
                  <li>Problema de autenticação/permissões</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
