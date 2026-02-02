"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Copy, Check, ChevronDown, ChevronUp } from "@/lib/icons";

interface ErrorProps {
  error: Error & { digest?: string; cause?: Error; stack?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    // Coletar informações do navegador para debug
    if (typeof window !== 'undefined') {
      setBrowserInfo({
        userAgent: navigator.userAgent || 'N/A',
        platform: navigator.platform || 'N/A',
        language: navigator.language || 'N/A',
        cookieEnabled: navigator.cookieEnabled ? 'Sim' : 'Não',
        onLine: navigator.onLine ? 'Online' : 'Offline',
        localStorage: typeof Storage !== 'undefined' ? 'Disponível' : 'Indisponível',
        sessionStorage: typeof Storage !== 'undefined' ? 'Disponível' : 'Indisponível',
      });
    }
  }, []);

  const errorDetails = {
    message: error.message || 'Erro desconhecido',
    name: error.name || 'Error',
    stack: error.stack || 'Stack trace não disponível',
    digest: error.digest,
    cause: error.cause ? (error.cause instanceof Error ? error.cause.message : String(error.cause)) : undefined,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'N/A',
  };

  const copyErrorDetails = async () => {
    const errorText = JSON.stringify({
      ...errorDetails,
      browserInfo,
    }, null, 2);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(errorText);
      } else {
        // Fallback para navegadores antigos
        const textArea = document.createElement('textarea');
        textArea.value = errorText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('Erro ao copiar detalhes:', copyError);
    }
  };

  // Detectar tipo de erro comum
  const getErrorType = () => {
    const message = error.message.toLowerCase();
    if (message.includes('removechild') || message.includes('not found')) {
      return {
        type: 'Erro de DOM',
        description: 'Tentativa de manipular elemento DOM que não existe mais',
        suggestion: 'Recarregue a página. Se o problema persistir, limpe o cache do navegador.',
      };
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return {
        type: 'Erro de Rede',
        description: 'Problema de conexão com o servidor',
        suggestion: 'Verifique sua conexão com a internet e tente novamente.',
      };
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('403')) {
      return {
        type: 'Erro de Permissão',
        description: 'Você não tem permissão para realizar esta ação',
        suggestion: 'Verifique se você está logado corretamente e tem as permissões necessárias.',
      };
    }
    if (message.includes('404') || message.includes('not found')) {
      return {
        type: 'Recurso Não Encontrado',
        description: 'O recurso solicitado não foi encontrado',
        suggestion: 'Verifique se a URL está correta ou se o recurso ainda existe.',
      };
    }
    return {
      type: 'Erro Desconhecido',
      description: 'Ocorreu um erro inesperado',
      suggestion: 'Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.',
    };
  };

  const errorType = getErrorType();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <h1 className="text-3xl font-bold text-destructive">Erro ao Carregar Admin</h1>
      </div>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center justify-between">
            <span>Erro Detectado</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyErrorDetails}
              className="h-8"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Detalhes
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo de erro e sugestão */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
            <p className="font-semibold text-blue-900 mb-2">Tipo: {errorType.type}</p>
            <p className="text-sm text-blue-800 mb-2">{errorType.description}</p>
            <p className="text-sm text-blue-700">
              <strong>Sugestão:</strong> {errorType.suggestion}
            </p>
          </div>

          {/* Mensagem de erro */}
          <div className="bg-destructive/10 p-4 rounded-md text-destructive-foreground">
            <p className="font-semibold mb-2">Mensagem de Erro:</p>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-background p-2 rounded border">
              {errorDetails.message}
            </pre>
            {errorDetails.digest && (
              <p className="text-xs text-muted-foreground mt-2">
                Error ID: <code className="bg-background px-1 rounded">{errorDetails.digest}</code>
              </p>
            )}
          </div>

          {/* Detalhes expandíveis */}
          <div className="border rounded-md">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <span className="font-semibold">Detalhes Técnicos</span>
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            
            {showDetails && (
              <div className="p-4 pt-0 space-y-4 border-t">
                {/* Stack trace */}
                <div>
                  <p className="font-semibold text-sm mb-2">Stack Trace:</p>
                  <pre className="whitespace-pre-wrap text-xs font-mono bg-muted p-3 rounded border max-h-64 overflow-y-auto">
                    {errorDetails.stack}
                  </pre>
                </div>

                {/* Informações do navegador */}
                <div>
                  <p className="font-semibold text-sm mb-2">Informações do Navegador:</p>
                  <div className="bg-muted p-3 rounded border">
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(browserInfo).map(([key, value]) => (
                        <div key={key}>
                          <dt className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</dt>
                          <dd className="text-muted-foreground break-all">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                {/* Causa do erro */}
                {errorDetails.cause && (
                  <div>
                    <p className="font-semibold text-sm mb-2">Causa:</p>
                    <pre className="whitespace-pre-wrap text-xs font-mono bg-muted p-3 rounded border">
                      {errorDetails.cause}
                    </pre>
                  </div>
                )}

                {/* URL e timestamp */}
                <div className="text-xs text-muted-foreground">
                  <p><strong>URL:</strong> {errorDetails.url}</p>
                  <p><strong>Timestamp:</strong> {errorDetails.timestamp}</p>
                </div>
              </div>
            )}
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/admin';
                }
              }}
            >
              Ir para Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
