import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from "@/lib/icons";
import { safeReload } from '@/utils/reload';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  // ✅ CORREÇÃO: Proteção contra loops de recarregamento
  private static lastReloadTime: number = 0;
  private static reloadCount: number = 0;
  private static readonly MAX_RELOADS_PER_MINUTE = 1;
  private static readonly RELOAD_COOLDOWN_MS = 60000; // 1 minuto

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Algo deu errado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página ou entre em contato com o suporte se o problema persistir.
            </p>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="bg-muted p-3 rounded-md">
                <summary className="cursor-pointer font-medium mb-2">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button 
                onClick={() => {
                  // ✅ CORREÇÃO: Proteção contra loops de recarregamento
                  const now = Date.now();
                  const timeSinceLastReload = now - ErrorBoundary.lastReloadTime;
                  
                  if (timeSinceLastReload < ErrorBoundary.RELOAD_COOLDOWN_MS) {
                    ErrorBoundary.reloadCount++;
                    console.warn(`⚠️ [ErrorBoundary] Recarregamento bloqueado. Já recarregou ${ErrorBoundary.reloadCount} vez(es) nos últimos ${Math.round(timeSinceLastReload / 1000)}s`);
                    
                    if (ErrorBoundary.reloadCount >= ErrorBoundary.MAX_RELOADS_PER_MINUTE) {
                      console.error('❌ [ErrorBoundary] Limite de recarregamentos excedido. Não recarregando.');
                      return;
                    }
                  } else {
                    ErrorBoundary.reloadCount = 0;
                  }
                  
                  ErrorBoundary.lastReloadTime = now;
                  ErrorBoundary.reloadCount++;
                  safeReload({ reason: 'ErrorBoundary' });
                }} 
                variant="default" 
                size="sm"
              >
                Recarregar Página
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Hook para usar Error Boundary em componentes funcionais
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    console.error('🚨 Error caught by useErrorHandler:', error);
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
}

// HOC para adicionar Error Boundary a qualquer componente
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}
