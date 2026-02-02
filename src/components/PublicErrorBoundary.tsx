// ✅ CORREÇÃO LOADING INFINITO: Error Boundary para capturar erros de lazy loading nas rotas públicas
import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, Home, RefreshCw } from "@/lib/icons";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ✅ CORREÇÃO LOADING INFINITO: Wrapper para usar navigate dentro do componente de classe
class PublicErrorBoundaryClass extends Component<Props & { navigate: (path: string) => void }, State> {
  constructor(props: Props & { navigate: (path: string) => void }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // ✅ CORREÇÃO LOADING INFINITO: Usar console.error para logs críticos (não removidos em produção)
    console.error('[PublicErrorBoundary] ❌ Erro capturado:', error);
    console.error('[PublicErrorBoundary] ❌ Error Info:', errorInfo);
    
    // Detectar se é erro de carregamento de módulo
    const isLoadError = 
      error.message.includes('Failed to fetch') || 
      error.message.includes('dynamically imported module') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Load failed') ||
      error.message.includes('ChunkLoadError') ||
      error.name === 'ChunkLoadError';
    
    if (isLoadError) {
      console.error('[PublicErrorBoundary] ⚠️ Erro de carregamento de módulo detectado. Isso pode ser causado por:');
      console.error('[PublicErrorBoundary] - Rede lenta ou instável');
      console.error('[PublicErrorBoundary] - Cache desatualizado do navegador');
      console.error('[PublicErrorBoundary] - Deploy recente na Vercel');
    }
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Recarregar a página para tentar novamente
    window.location.reload();
  };

  handleGoHome = () => {
    this.props.navigate('/');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isLoadError = 
        this.state.error?.message.includes('Failed to fetch') || 
        this.state.error?.message.includes('dynamically imported module') ||
        this.state.error?.message.includes('NetworkError') ||
        this.state.error?.message.includes('Load failed') ||
        this.state.error?.message.includes('ChunkLoadError') ||
        this.state.error?.name === 'ChunkLoadError';

      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>
                  {isLoadError ? 'Erro ao Carregar Página' : 'Algo deu errado'}
                </CardTitle>
              </div>
              <CardDescription>
                {isLoadError 
                  ? 'Não foi possível carregar esta página. Tente recarregar ou voltar para a página inicial.'
                  : 'Ocorreu um erro inesperado. Por favor, tente novamente.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {import.meta.env.DEV && this.state.error && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground mb-2">
                    Detalhes do erro (apenas em desenvolvimento)
                  </summary>
                  <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              
              <div className="flex gap-2">
                <Button onClick={this.handleRetry} variant="default" size="sm" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" size="sm" className="flex-1">
                  <Home className="h-4 w-4 mr-2" />
                  Página Inicial
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// ✅ CORREÇÃO LOADING INFINITO: Componente wrapper para usar hooks
export function PublicErrorBoundary({ children, fallback }: Props) {
  const navigate = useNavigate();
  
  return (
    <PublicErrorBoundaryClass navigate={navigate} fallback={fallback}>
      {children}
    </PublicErrorBoundaryClass>
  );
}

